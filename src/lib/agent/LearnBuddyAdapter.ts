/**
 * Soul Lab — LearnBuddyAdapter
 * 只负责调用本应用后端（后端再通过 CodeBuddy Agent SDK 调用 LearnBuddy 元 Agent）。
 * 返回必须经 Zod 校验；校验失败抛 ContractViolationError（F1：不改花状态）。
 */
import {
  DesignVerdictSchema,
  EvidencePackageSchema,
  EvidenceVerdictSchema,
  FrontierCandidatesSchema,
  KeeperResponseSchema,
  PaperMatchSchema,
  type DesignVerdict,
  type EvidencePackage,
  type EvidenceVerdict,
  type IdeaResult,
  type PaperMatch,
} from '../../../shared/schemas';
import type {
  AgentBridge,
  BriefInput,
  EvidenceInput,
  ExperimentDesignInput,
  FrontierLoopInput,
  IdeaInput,
  MathInvestigationInput,
  NoveltyInput,
  PaperSearchInput,
} from './types';
import { ContractViolationError, NetworkError } from './types';
import type { FrontierScanResult, MorningBrief, NoveltyDecision } from '../frontier/types';
import type { SoulDoc } from '../types';
import {
  evaluateNovelty as evaluateNoveltyFn,
  generateBrief as generateBriefFn,
  generateQueries,
  runFrontierLoop as runFrontierLoopFn,
} from '../frontier';

async function postJSON<T>(path: string, body: unknown, schema: { safeParse: (v: unknown) => any }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e: any) {
    throw new NetworkError(e?.message ?? '无法连接到 Soul Lab 后端');
  }

  let json: any;
  try {
    json = await res.json();
  } catch {
    throw new NetworkError('后端返回了非 JSON 响应');
  }

  if (json?.ok === false) {
    if (json.error === 'schema_violation') {
      throw new ContractViolationError('Agent 输出未通过结构校验，状态未改变', json.detail);
    }
    throw new Error(json?.message ?? 'Agent 调用失败');
  }

  const parsed = schema.safeParse(json?.data);
  if (!parsed.success) {
    throw new ContractViolationError('Agent 输出未通过结构校验，状态未改变', JSON.stringify(parsed.error.issues));
  }
  return parsed.data as T;
}

export const learnBuddyAdapter: AgentBridge = {
  async structureIdea(input: IdeaInput): Promise<IdeaResult> {
    const res = await postJSON<{ mode: string; idea: IdeaResult | null }>(
      '/api/soul/keeper',
      { intent: 'idea', soul: input.soul ?? null, message: input.rawIdea },
      KeeperResponseSchema,
    );
    if (!res.idea) {
      throw new ContractViolationError('Idea Analyst 未返回结构化结果，状态未改变');
    }
    return res.idea;
  },

  async reviewExperimentDesign(input: ExperimentDesignInput): Promise<DesignVerdict> {
    const res = await postJSON<{ mode: string; design: DesignVerdict | null }>(
      '/api/soul/keeper',
      { intent: 'design', soul: input.soul, message: input.proposal },
      KeeperResponseSchema,
    );
    if (!res.design) {
      throw new ContractViolationError('Experiment Designer 未返回结构化结果，状态未改变');
    }
    return res.design;
  },

  async reviewEvidence(input: EvidenceInput): Promise<EvidenceVerdict> {
    return postJSON<EvidenceVerdict>(
      '/api/soul/review-evidence',
      {
        soul: input.soul,
        experiment: input.experiment,
        stats: input.stats,
        dataBrief: input.dataBrief,
        humanView: input.humanView,
        fileName: input.fileName,
      },
      EvidenceVerdictSchema,
    );
  },

  async searchPapers(input: PaperSearchInput): Promise<PaperMatch[]> {
    return postJSON<PaperMatch[]>(
      '/api/soul/search-papers',
      {
        soul: input.soul,
        trigger: input.trigger,
        focusLabel: input.focusLabel,
        knownPaperIds: input.knownPaperIds,
      },
      { safeParse: (v) => PaperMatchSchema.array().safeParse(v ?? []) },
    );
  },

  /**
   * Frontier 层真实链路（FR-M11）：
   *   候选论文检索 → 后端 /api/soul/frontier/loop（Paper Scout + 检索 MCP，受 Research Memory 约束）
   *   去重 / 机制筛选 / Novelty Gate / 映射 → 本地确定性内核
   * 调用方若已提供 source（离线演示 / 测试），则跳过检索。
   */
  async runFrontierLoop(input: FrontierLoopInput): Promise<FrontierScanResult> {
    let source = input.source;
    if (source.length === 0) {
      const queries = input.docs.flatMap((d) => generateQueries(d).queries);
      const fetched = await postJSON<{ candidates: PaperMatch[] }>(
        '/api/soul/frontier/loop',
        { souls: frontierContext(input.docs), memory: input.memory, queries },
        FrontierCandidatesSchema,
      );
      source = fetched.candidates;
    }
    return runFrontierLoopFn(input.docs, source, input.memory);
  },

  async evaluateNovelty(input: NoveltyInput): Promise<NoveltyDecision[]> {
    return evaluateNoveltyFn(input.candidates, input.memory);
  },

  async generateBrief(input: BriefInput): Promise<MorningBrief> {
    return generateBriefFn(input.docs, input.scan);
  },

  /**
   * Instrument Workshop：迭代数学调查（SSE）。
   * 逐轮事件（仪器台账）实时回调给 UI；done 事件的数据必须再过一次 Zod（F1）。
   */
  async runMathInvestigation(input: MathInvestigationInput): Promise<EvidencePackage> {
    const { onEvent, ...body } = input;

    let res: Response;
    try {
      res = await fetch('/api/math/investigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (e: any) {
      throw new NetworkError(e?.message ?? '无法连接到 Soul Lab 后端');
    }
    if (!res.ok || !res.body) {
      throw new NetworkError(`后端返回 ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let pkg: unknown = null;
    let errorMessage: string | null = null;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';
      for (const part of parts) {
        const line = part.split('\n').find((l) => l.startsWith('data: '));
        if (!line) continue;
        let ev: any;
        try {
          ev = JSON.parse(line.slice(6));
        } catch {
          continue;
        }
        if (ev.type === 'done') {
          pkg = ev.package;
        } else if (ev.type === 'error') {
          errorMessage = String(ev.message ?? '调查失败');
        } else {
          onEvent?.(ev);
        }
      }
    }

    if (errorMessage) throw new Error(errorMessage);
    if (!pkg) throw new NetworkError('调查意外中断（未收到 done 事件）');

    const parsed = EvidencePackageSchema.safeParse(pkg);
    if (!parsed.success) {
      throw new ContractViolationError(
        'Evidence Package 未通过结构校验，状态未改变',
        JSON.stringify(parsed.error.issues),
      );
    }
    return parsed.data;
  },
};

/** 发给后端的精简上下文：只带语义字段，不带任何视觉 / 布局数值 */
function frontierContext(docs: SoulDoc[]) {
  return docs.map((d) => ({
    id: d.soul.id,
    title: d.soul.title,
    researchQuestion: d.soul.researchQuestion,
    hypothesis: d.soul.hypothesis,
    mainGap: d.soul.mainGap,
    mechanismChain: d.soul.mechanismChain,
    leaves: d.leaves.map((l) => ({ label: l.label, failureCondition: l.failureCondition })),
    knownPaperIds: d.papers.map((p) => p.paperId),
  }));
}

export { DesignVerdictSchema };
