/**
 * Instrument Workshop · mathagent.ts —— 两个 Agent + 迭代调查循环
 *
 * Mathematical Scientist（Agent 1）：
 *   Observe / Form Hypothesis / Choose Instrument / Read Result /
 *   Challenge / Request New Instrument / Synthesize。不写代码。
 * Toolsmith（Agent 2）：只根据明确需求制造工具，不解释科研结论。
 * Tool Verifier（verify.ts，非 Agent）：验证不过不入 Registry。
 *
 * 无 LLM 凭证时：确定性降级 —— 只用 Core 仪器跑一遍，EvidencePackage
 * 显式标注 fallback=true，绝不冒充 Agent 结论。
 */
import { z } from 'zod';
import {
  EvidencePackageSchema,
  ScientistDecisionSchema,
  type EvidencePackage,
  type ScientistDecision,
  type ToolRequirement,
} from '../../shared/schemas.js';
import { runAgent, extractJSON } from '../soul-agent.js';
import { runInstrument } from './sandbox.js';
import { verifyTool } from './verify.js';
import {
  initRegistry,
  getTool,
  catalogForScientist,
  publishGeneratedTool,
} from './registry.js';
import * as store from './store.js';

/* ==================== 类型 ==================== */

export interface MathMapping {
  groupColumn?: string;
  baselineValue?: string;
  treatmentValue?: string;
  metricColumns?: string[];
}

export interface InvestigateInput {
  soul: Record<string, unknown>;
  experiment: Record<string, unknown>;
  rows: Array<Record<string, unknown>>;
  mapping: MathMapping;
  fileName?: string;
  humanView?: string;
  onEvent?: (ev: MathProgressEvent) => void;
}

export type MathProgressEvent =
  | { type: 'plan'; question: string; hypotheses: Array<{ id: string; statement: string }> }
  | { type: 'round_start'; round: number }
  | { type: 'tool_call'; round: number; tool_id: string; params: unknown }
  | { type: 'tool_result'; round: number; tool_id: string; outputs: unknown }
  | { type: 'tool_generating'; round: number; goal: string }
  | { type: 'tool_verified'; round: number; tool_id: string; version: number; testsPassed: number; testsTotal: number }
  | { type: 'tool_rejected'; round: number; detail: string }
  | { type: 'finding'; finding: string }
  | { type: 'fallback'; reason: string }
  | { type: 'error'; message: string };

interface DataPayload {
  columns: Record<string, unknown[]>;
  groups: {
    baseline: Record<string, unknown[]>;
    treatment: Record<string, unknown[]>;
  };
  shape: {
    rows: number;
    columns: string[];
    groupCounts: { baseline: number; treatment: number };
  };
}

const MAX_ROUNDS = 3;
const TOOLSMITH_RETRIES = 2; // 验证失败回喂重试上限

/* ==================== System Prompts ==================== */

const MATHEMATICAL_SCIENTIST = `你是 Soul Lab 的 Mathematical Scientist —— 数学研究 Agent。
你的职责是决定"应该算什么"，而不是替用户做计算：
观察 → 形成假设 → 选择仪器 → 读结果 → 质疑结果 → 请求新仪器 → 综合发现。

铁律：
1. 你看不到原始数据行；你看到的是数据形状（列名/行数/分组）与仪器的结构化输出。所有数值结论必须引用仪器输出，禁止凭空给数字。
2. 每轮只输出一个 JSON 对象，三选一：
   {"action":"use_tool","tool_id":"...","params":{...},"reason":"为什么用这个仪器"}
   {"action":"request_tool","requirement":{"goal":"...","input":{"列名":"形状描述"},"requiredOutputs":["..."],"constraints":["no network","deterministic",...]},"reason":"为什么现有仪器不够"}
   {"action":"conclude","finding":"...","hypothesesVerdicts":[{"id":"H1","statement":"...","status":"supported|refuted|untested","evidence":"引用哪轮哪个仪器的输出"}],"interpretation":"...","confidence":0.0-1.0}
3. 有证据就尽早 conclude（最多 ${MAX_ROUNDS} 轮）。
4. 像数学家调查问题那样迭代：非线性存在 → 是否条件依赖 → 阈值在哪 → 对应什么几何变化。`;

const TOOLSMITH = `你是 Soul Lab 的 Scientific Toolsmith —— 数学工具生成 Agent。
你不解释科研结论。你只根据明确的数学需求，制造可靠、可执行、可复用的工具。

铁律：
1. 工具代码必须定义：def run(data, params) -> dict；返回可 JSON 序列化的 dict，禁止 NaN/Inf。
2. 只允许 import：numpy, scipy, sklearn, math, statistics, typing, itertools, functools, collections, dataclasses。
3. 禁止 open / eval / exec / subprocess / socket / ctypes / 任何文件与网络访问；必须确定性（随机一律固定种子）。
4. tests_code 必须定义至少 2 个 test_* 函数，用已知合成样例断言（例如 y=2x 必须检出强关系；恒定输入不得崩溃）。
5. 只输出一个 JSON 对象：
   {"tool_id":"小写下划线标识","scientific_question":"...","input_schema":{"字段":"描述"},"assumptions":["..."],"method":"数学方法一句话","output_schema":{"字段":"描述"},"dependencies":["numpy"],"code":"def run(data, params):\\n    ...","tests_code":"def test_...():\\n    ..."}`;

const ToolsmithOutputSchema = z.object({
  tool_id: z.string().regex(/^[a-z][a-z0-9_]*$/),
  scientific_question: z.string().min(1),
  input_schema: z.record(z.string(), z.string()).default({}),
  assumptions: z.array(z.string()).default([]),
  method: z.string().min(1),
  output_schema: z.record(z.string(), z.string()).default({}),
  dependencies: z.array(z.string()).default([]),
  code: z.string().min(1),
  tests_code: z.string().default(''),
});

/* ==================== 数据形状（LLM 只看这个，不看原始行） ==================== */

function buildDataPayload(rows: Array<Record<string, unknown>>, mapping: MathMapping): DataPayload {
  const columns: Record<string, unknown[]> = {};
  const groups = {
    baseline: {} as Record<string, unknown[]>,
    treatment: {} as Record<string, unknown[]>,
  };

  const push = (bucket: Record<string, unknown[]>, row: Record<string, unknown>) => {
    for (const k of Object.keys(row)) (bucket[k] ??= []).push(row[k]);
  };

  for (const row of rows) {
    push(columns, row);
    const g = mapping.groupColumn ? String(row[mapping.groupColumn] ?? '') : '';
    if (mapping.groupColumn) {
      if (g === String(mapping.treatmentValue ?? '')) push(groups.treatment, row);
      else if (g === String(mapping.baselineValue ?? '')) push(groups.baseline, row);
    }
  }

  return {
    columns,
    groups,
    shape: {
      rows: rows.length,
      columns: Object.keys(columns),
      groupCounts: {
        baseline: mapping.groupColumn ? (groups.baseline[mapping.groupColumn]?.length ?? 0) : 0,
        treatment: mapping.groupColumn ? (groups.treatment[mapping.groupColumn]?.length ?? 0) : 0,
      },
    },
  };
}

function inputSummary(payload: DataPayload): string {
  const { rows, columns, groupCounts } = payload.shape;
  return `${rows} 行 × ${columns.length} 列（${columns.slice(0, 12).join(', ')}${columns.length > 12 ? ' …' : ''}）；baseline ${groupCounts.baseline} / treatment ${groupCounts.treatment}`;
}

/* ==================== 主循环 ==================== */

export async function runInvestigation(input: InvestigateInput): Promise<EvidencePackage> {
  await initRegistry();
  const emit = (ev: MathProgressEvent) => input.onEvent?.(ev);
  const payload = buildDataPayload(input.rows, input.mapping);

  const context = [
    `Soul：${JSON.stringify(input.soul).slice(0, 600)}`,
    `实验：${JSON.stringify(input.experiment).slice(0, 600)}`,
    `数据文件：${input.fileName ?? '（未提供）'}`,
    `数据形状：${inputSummary(payload)}`,
    `分组列：${input.mapping.groupColumn ?? '无'}（baseline=${input.mapping.baselineValue ?? '?'} / treatment=${input.mapping.treatmentValue ?? '?'}）`,
    `指标列：${(input.mapping.metricColumns ?? []).join(', ') || '未指定'}`,
    `研究者判断（Human View）：${input.humanView || '（未填写）'}`,
  ].join('\n');

  const rounds: EvidencePackage['rounds'] = [];
  const history: string[] = [];

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    emit({ type: 'round_start', round });

    // ---- Agent 1：这一轮做什么 ----
    let decision: ScientistDecision;
    try {
      const prompt = [
        MATHEMATICAL_SCIENTIST,
        '',
        '===== 调查上下文 =====',
        context,
        '',
        '===== 可用仪器（Tool Registry）=====',
        await catalogForScientist(),
        '',
        '===== 历轮结果 =====',
        history.length ? history.join('\n---\n') : '（第一轮，还没有任何测量）',
        '',
        `这是第 ${round}/${MAX_ROUNDS} 轮。请输出唯一 JSON 对象。`,
      ].join('\n');
      const raw = await runAgent(prompt, context, 2);
      decision = ScientistDecisionSchema.parse(extractJSON(raw));
    } catch (err: any) {
      // 无凭证 / 契约失败 → 确定性降级（只用 Core 仪器，显式标注）
      const reason = String(err?.message ?? err);
      emit({ type: 'fallback', reason });
      const pkg = await deterministicFallback(input, payload, rounds, emit);
      return pkg;
    }

    if (decision.action === 'conclude') {
      const pkg: EvidencePackage = {
        finding: decision.finding,
        rounds,
        hypothesesVerdicts: decision.hypothesesVerdicts,
        interpretation: decision.interpretation,
        confidence: decision.confidence,
        fallback: false,
      };
      emit({ type: 'finding', finding: decision.finding });
      return EvidencePackageSchema.parse(pkg);
    }

    if (decision.action === 'use_tool') {
      const result = await executeTool({
        toolId: decision.tool_id,
        params: decision.params,
        payload,
        input,
        round,
        emit,
      });
      if (result) {
        rounds.push(result.round);
        history.push(`第 ${round} 轮 · 使用 ${decision.tool_id}（${decision.reason}）\n输出：${JSON.stringify(result.outputs).slice(0, 900)}`);
      } else {
        history.push(`第 ${round} 轮 · ${decision.tool_id} 不可用或执行失败（${decision.reason}）`);
      }
      continue;
    }

    // ---- request_tool：交给 Toolsmith 制造 ----
    const generated = await generateTool(decision.requirement, round, emit);
    if (!generated) {
      history.push(`第 ${round} 轮 · 工具生成失败：${decision.requirement.goal}（Verifier 未放行，重试上限已到）`);
      continue;
    }
    // 生成成功 → 立即用它跑这一轮
    const result = await executeTool({
      toolId: generated.toolId,
      params: {},
      payload,
      input,
      round,
      emit,
    });
    if (result) {
      rounds.push(result.round);
      history.push(`第 ${round} 轮 · 新造 ${generated.toolId} v${generated.version}（${decision.requirement.goal}）\n输出：${JSON.stringify(result.outputs).slice(0, 900)}`);
    }
  }

  // 轮数用尽仍未 conclude → 汇总已有测量（诚实降级）
  const pkg: EvidencePackage = {
    finding: `调查在 ${MAX_ROUNDS} 轮内未得到结论性证据；已有 ${rounds.length} 次测量。`,
    rounds,
    hypothesesVerdicts: [],
    interpretation: '轮数上限已到，建议基于以上测量继续下一轮调查。',
    confidence: 0.3,
    fallback: false,
  };
  emit({ type: 'finding', finding: pkg.finding });
  return EvidencePackageSchema.parse(pkg);
}

/* ==================== 执行一个仪器（含 Provenance 落库） ==================== */

async function executeTool(args: {
  toolId: string;
  params: unknown;
  payload: DataPayload;
  input: InvestigateInput;
  round: number;
  emit: (ev: MathProgressEvent) => void;
}): Promise<{ round: EvidencePackage['rounds'][number]; outputs: unknown } | null> {
  const entry = await getTool(args.toolId);
  if (!entry) {
    args.emit({ type: 'tool_rejected', round: args.round, detail: `工具 ${args.toolId} 不在 Registry 中` });
    return null;
  }

  args.emit({ type: 'tool_call', round: args.round, tool_id: args.toolId, params: args.params });

  const data = args.toolId === 'bootstrap_ci' ? { groups: args.payload.groups } : { columns: args.payload.columns };
  const started = Date.now();
  const outcome = await runInstrument(entry.code, data, args.params);
  const durationMs = Date.now() - started;

  // Provenance：每次运行都可回查
  await store.insertRun({
    toolId: args.toolId,
    toolVersion: entry.spec.version,
    soulId: String(args.input.soul?.id ?? ''),
    experimentId: String(args.input.experiment?.id ?? ''),
    paramsJson: JSON.stringify(args.params ?? {}),
    inputSummary: inputSummary(args.payload),
    outputJson: outcome.ok ? JSON.stringify(outcome.result).slice(0, 60_000) : null,
    codeHash: entry.codeHash,
    durationMs,
    status: outcome.ok ? 'ok' : 'error',
  });

  if (!outcome.ok) {
    args.emit({ type: 'tool_rejected', round: args.round, detail: String(outcome.error).slice(0, 1500) });
    return null;
  }

  args.emit({ type: 'tool_result', round: args.round, tool_id: args.toolId, outputs: outcome.result });
  return {
    outputs: outcome.result,
    round: {
      tool_id: args.toolId,
      tool_version: entry.spec.version,
      question: entry.spec.scientific_question,
      outputs: outcome.result,
      note: `runtime ${durationMs}ms`,
      code_hash: entry.codeHash,
    },
  };
}

/* ==================== Toolsmith + Verifier ==================== */

async function generateTool(
  requirement: ToolRequirement,
  round: number,
  emit: (ev: MathProgressEvent) => void,
): Promise<{ toolId: string; version: number } | null> {
  emit({ type: 'tool_generating', round, goal: requirement.goal });

  let feedback = '';
  for (let attempt = 0; attempt <= TOOLSMITH_RETRIES; attempt++) {
    let spec: z.infer<typeof ToolsmithOutputSchema>;
    try {
      const prompt = [
        TOOLSMITH,
        '',
        '===== Tool Requirement =====',
        JSON.stringify(requirement, null, 2),
        feedback ? `\n===== 上一次被 Verifier 打回（必须修正）=====\n${feedback}` : '',
        '',
        '请输出唯一 JSON 对象（含 code 与 tests_code）。',
      ].join('\n');
      const raw = await runAgent(prompt, JSON.stringify(requirement), 3);
      spec = ToolsmithOutputSchema.parse(extractJSON(raw));
    } catch (err: any) {
      feedback = `生成/解析失败：${String(err?.message ?? err).slice(0, 300)}`;
      continue;
    }

    const report = await verifyTool(spec.code, spec.tests_code);
    if (report.passed) {
      const pub = await publishGeneratedTool({
        spec: {
          tool_id: spec.tool_id,
          scientific_question: spec.scientific_question,
          input_schema: spec.input_schema,
          assumptions: spec.assumptions,
          method: spec.method,
          output_schema: spec.output_schema,
          dependencies: spec.dependencies,
        },
        code: spec.code,
        testsCode: spec.tests_code,
      });
      emit({
        type: 'tool_verified', round,
        tool_id: pub.toolId, version: pub.version,
        testsPassed: report.testsPassed, testsTotal: report.testsTotal,
      });
      return { toolId: pub.toolId, version: pub.version };
    }
    feedback = report.checks.map((c) => `${c.passed ? '✓' : '✗'} ${c.name}: ${c.detail}`).join('\n');
  }

  emit({ type: 'tool_rejected', round, detail: `Toolsmith 重试上限（${TOOLSMITH_RETRIES}）已到，本轮放弃该工具` });
  return null;
}

/* ==================== 确定性降级（无 LLM 凭证时） ==================== */

async function deterministicFallback(
  input: InvestigateInput,
  payload: DataPayload,
  roundsSoFar: EvidencePackage['rounds'],
  emit: (ev: MathProgressEvent) => void,
): Promise<EvidencePackage> {
  const rounds = [...roundsSoFar];
  const metrics = input.mapping.metricColumns ?? [];

  // 1. 基础统计（全部指标列）
  if (await getTool('basic_statistics') && metrics.length > 0) {
    const r = await executeTool({
      toolId: 'basic_statistics', params: { columns: metrics }, payload, input, round: rounds.length + 1,
      emit,
    });
    if (r) rounds.push(r.round);
  }

  // 2. baseline vs treatment 的均值差 CI（有分组时）
  if (await getTool('bootstrap_ci') && input.mapping.groupColumn && metrics.length > 0) {
    const r = await executeTool({
      toolId: 'bootstrap_ci', params: { column: metrics[0], iterations: 2000 }, payload, input, round: rounds.length + 1,
      emit,
    });
    if (r) rounds.push(r.round);
  }

  // 3. 前两个指标列之间的相关（有 ≥2 列时）
  if (await getTool('correlation_analysis') && metrics.length >= 2) {
    const r = await executeTool({
      toolId: 'correlation_analysis', params: { x: metrics[0], y: metrics[1] }, payload, input, round: rounds.length + 1,
      emit,
    });
    if (r) rounds.push(r.round);
  }

  const ciRound = rounds.find((r) => r.tool_id === 'bootstrap_ci');
  const outputs = (ciRound?.outputs ?? {}) as Record<string, unknown>;
  const ciExcludes = Boolean((outputs as any)?.ci_excludes_zero);

  const pkg: EvidencePackage = {
    finding: ciRound
      ? `确定性仪器层测量：baseline 与 treatment 的均值差 95% CI ${ciExcludes ? '不包含 0（存在可测差异）' : '包含 0（无法区分）'}。`
      : `确定性仪器层测量：完成 ${rounds.length} 项基础统计（未配置分组，无法做组间比较）。`,
    rounds,
    hypothesesVerdicts: [],
    interpretation: '本包由 Core Instruments 确定性计算生成（LLM 不可用），未经 Mathematical Scientist 解读；confidence 仅供结构占位。',
    confidence: 0.4,
    fallback: true,
  };
  return EvidencePackageSchema.parse(pkg);
}
