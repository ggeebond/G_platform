/**
 * Instrument Workshop · registry.ts —— 工具注册表
 *
 * 两类仪器（科研诚信：绝不把 AI 临时生成的代码与成熟工具等价）：
 *   Core Instruments（status=core）        —— 出厂仪器，随仓库分发，仓库内测试保证
 *   Generated Instruments（experimental）  —— Toolsmith 动态生成，验证通过后入库；
 *                                             多次成功运行或用户显式 promote 后 → trusted
 *
 * 同一 tool_id 再生成 → version+1，历史版本保留在 tools 表里，可追溯。
 *
 * 注意：DB 访问已异步化，所有对外函数均为 async。
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { ToolSpec } from '../../shared/schemas.js';
import * as store from './store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INSTRUMENTS_DIR = path.join(__dirname, 'py', 'instruments');

/* ---------- Core Instruments 的 ToolSpec 元数据 ---------- */

interface CoreMeta {
  file: string;
  spec: Omit<ToolSpec, 'version' | 'status'>;
}

const CORE_META: CoreMeta[] = [
  {
    file: 'basic_statistics.py',
    spec: {
      tool_id: 'basic_statistics',
      scientific_question: '对每个数值列给出可复查的描述统计（n/mean/std/分位数）',
      input_schema: { columns: '{列名: [数值数组]}' },
      assumptions: ['非数值项（如 "n/a"）在计算前被过滤'],
      method: 'numpy 逐列聚合；std 用无偏估计 (ddof=1)',
      output_schema: { per_column: '{列名: {n, mean, std, min, q25, median, q75, max}}' },
      dependencies: ['numpy'],
    },
  },
  {
    file: 'correlation_analysis.py',
    spec: {
      tool_id: 'correlation_analysis',
      scientific_question: '两列之间是线性相关还是秩相关（Pearson + Spearman）',
      input_schema: { columns: '{列名: [数值数组]}', params: '{x: 列名, y: 列名}' },
      assumptions: ['按行配对；非数值对被剔除', '任一列恒定时相关无定义'],
      method: 'scipy.stats.pearsonr / spearmanr',
      output_schema: { pearson_r: '[-1,1]', pearson_p: 'p 值', spearman_r: '[-1,1]', spearman_p: 'p 值' },
      dependencies: ['numpy', 'scipy'],
    },
  },
  {
    file: 'bootstrap_ci.py',
    spec: {
      tool_id: 'bootstrap_ci',
      scientific_question: 'baseline 与 treatment 的均值差是否显著异于 0（95% Bootstrap CI）',
      input_schema: { groups: '{baseline: {列: [...]}, treatment: {列: [...]}}', params: '{column, iterations}' },
      assumptions: ['固定种子 42 → 同一输入永远得到同一 CI', '两组各需 ≥2 个样本'],
      method: '非参数重抽样（各组内有放回抽样，均值差分布的 2.5/97.5 分位）',
      output_schema: { observed_delta: '均值差', ci95: '[lo, hi]', ci_excludes_zero: 'bool' },
      dependencies: ['numpy'],
    },
  },
  {
    file: 'nonlinear_dependence.py',
    spec: {
      tool_id: 'nonlinear_dependence',
      scientific_question: '两列之间是否存在线性相关测不到的非线性依赖（distance correlation）',
      input_schema: { columns: '{列名: [数值数组]}', params: '{x: 列名, y: 列名}' },
      assumptions: ['按行配对；配对样本需 ≥4', '能量距离意义下的依赖强度'],
      method: 'Szekely distance correlation（双中心距离矩阵）',
      output_schema: { distance_correlation: '[0,1]', dependence: 'strong/moderate/weak-or-none' },
      dependencies: ['numpy'],
    },
  },
  {
    file: 'change_point.py',
    spec: {
      tool_id: 'change_point',
      scientific_question: '某个指标序列在哪里发生均值突变（如 pruning=0.4→0.6 之间的崩溃点）',
      input_schema: { columns: '{列名: [数值数组]}', params: '{column, min_side}' },
      assumptions: ['穷举分割点，每侧至少 min_side 个样本'],
      method: '最大化两侧均值差的分割点搜索',
      output_schema: { changepoint_index: 'int|null', mean_before: '', mean_after: '', shift: '' },
      dependencies: ['numpy'],
    },
  },
];

/* ---------- 内存注册表 ---------- */

export interface RegistryEntry {
  spec: ToolSpec;
  code: string;
  testsCode: string;
  codeHash: string;
  core: boolean;
}

const registry = new Map<string, RegistryEntry>();

let initialized = false;

/** 启动时调用：Core（磁盘）+ Generated（SQLite）。幂等，可安全多次调用。 */
export async function initRegistry(): Promise<void> {
  if (initialized) return;
  initialized = true;

  // Core：代码即文件本身，测试与代码同文件（testsCode 为空表示"内嵌"）
  for (const meta of CORE_META) {
    const file = path.join(INSTRUMENTS_DIR, meta.file);
    if (!fs.existsSync(file)) {
      console.warn(`[Registry] 缺少 Core Instrument 文件：${file}`);
      continue;
    }
    const code = fs.readFileSync(file, 'utf8');
    registry.set(meta.spec.tool_id, {
      spec: { ...meta.spec, version: 1, status: 'core' },
      code,
      testsCode: '',
      codeHash: hashOf(code),
      core: true,
    });
  }

  // Generated：SQLite 里的最新版本
  const rows = await store.getAllLatestTools();
  for (const row of rows) {
    if (row.status === 'core') continue; // Core 已从磁盘加载
    try {
      const spec = JSON.parse(row.spec_json) as ToolSpec;
      registry.set(row.tool_id, {
        spec,
        code: row.code,
        testsCode: row.tests_code,
        codeHash: row.code_hash,
        core: false,
      });
    } catch (e) {
      console.warn(`[Registry] 跳过损坏的工具记录 ${row.tool_id}:`, e);
    }
  }

  console.log(`[Registry] ${registry.size} instruments ready ` +
    `(${CORE_META.length} core / ${registry.size - CORE_META.length} generated)`);
}

function hashOf(code: string): string {
  return crypto.createHash('sha256').update(code, 'utf8').digest('hex').slice(0, 16);
}

export async function listTools(): Promise<Array<{ spec: ToolSpec; codeHash: string; core: boolean }>> {
  await initRegistry();
  return [...registry.values()].map((e) => ({ spec: e.spec, codeHash: e.codeHash, core: e.core }));
}

/** 给 Mathematical Scientist 看的精简清单（tool_id + 一句话用途） */
export async function catalogForScientist(): Promise<string> {
  await initRegistry();
  return [...registry.values()]
    .map((e) => `- ${e.spec.tool_id} [${e.spec.status}]: ${e.spec.scientific_question}`)
    .join('\n');
}

export async function getTool(toolId: string): Promise<RegistryEntry | undefined> {
  await initRegistry();
  return registry.get(toolId);
}

/** 发布一个 Toolsmith 生成的工具（version 自增，历史保留） */
export async function publishGeneratedTool(params: {
  spec: Omit<ToolSpec, 'version' | 'status'>;
  code: string;
  testsCode: string;
}): Promise<{ toolId: string; version: number; codeHash: string }> {
  await initRegistry();
  const toolId = params.spec.tool_id;
  const version = (await store.latestToolVersion(toolId)) + 1;
  const spec: ToolSpec = { ...params.spec, version, status: 'experimental' };
  const codeHash = hashOf(params.code);

  await store.insertTool({ spec, code: params.code, testsCode: params.testsCode, codeHash });
  registry.set(toolId, { spec, code: params.code, testsCode: params.testsCode, codeHash, core: false });
  return { toolId, version, codeHash };
}

export async function promoteTool(toolId: string): Promise<boolean> {
  await initRegistry();
  const entry = registry.get(toolId);
  if (!entry || entry.core || entry.spec.status !== 'experimental') return false;
  if (!(await store.promoteTool(toolId))) return false;
  entry.spec = { ...entry.spec, status: 'trusted' };
  return true;
}
