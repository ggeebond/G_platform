/**
 * Soul Lab — MockAdapter
 * 仅用于 UI 开发与自动化测试：返回合法 schema 的假数据。
 * 不进入比赛智能来源；LearnBuddy 不可用时也只作为「演示降级」，界面会明确标注。
 */
import type { DesignVerdict, EvidencePackage, EvidenceVerdict, IdeaResult, PaperMatch } from '../../../shared/schemas';
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
import type { FrontierScanResult, MorningBrief, NoveltyDecision } from '../frontier/types';
import {
  evaluateNovelty as evaluateNoveltyFn,
  generateBrief as generateBriefFn,
  runFrontierLoop as runFrontierLoopFn,
} from '../frontier';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const PAPER_POOL: PaperMatch[] = [
  {
    paperId: 'MOCK_adaptive_chunk_2024',
    title: 'Uncertainty-Aware Action Chunking for Efficient Visuomotor Policies',
    year: 2024,
    authors: ['L. Wen', 'M. Zhao', 'K. Ito'],
    abstract:
      '提出依据策略不确定性动态调整 action chunk 长度的机制，并给出延迟-成功率的权衡曲线。',
    matchedGap: '状态自适应 horizon 的定量权衡证据',
    relatedPetalId: null,
    relationType: 'supporting',
    reason: '核心机制链与本 Soul 一致：State → Uncertainty → Chunk Selection → Action。',
    keyMechanism: 'ensemble disagreement → chunk length',
    source: 'arXiv (mock)',
  },
  {
    paperId: 'MOCK_noise_robust_2025',
    title: 'When Adaptive Horizons Fail: Robustness of Chunk Selection under Visual Noise',
    year: 2025,
    authors: ['A. Ferrante', 'S. Park'],
    abstract: '系统评测自适应 chunk 选择策略在视觉噪声下的失效机理。',
    matchedGap: '解释黄叶：高噪声下自适应 horizon 失效',
    relatedPetalId: null,
    relationType: 'conflicting',
    reason: '与当前黄叶的失败条件高度一致，给出可能的修复方向。',
    keyMechanism: '噪声 → 不确定性偏差 → horizon 抖动',
    source: 'OpenAlex (mock)',
  },
  {
    paperId: 'MOCK_long_horizon_2025',
    title: 'Temporal Abstraction Limits in Long-Horizon Imitation Learning',
    year: 2025,
    authors: ['J. Ortiz', 'H. Sato'],
    abstract: '讨论长程任务中 chunk 上限不足导致的次优行为。',
    matchedGap: '长程任务 horizon 上限',
    relatedPetalId: null,
    relationType: 'method',
    reason: '直接关系到当前 Ghost Petal 实验的风险点。',
    keyMechanism: 'horizon 上限与任务时间尺度匹配',
    source: 'arXiv (mock)',
  },
];

export const mockAdapter: AgentBridge = {
  async structureIdea(input: IdeaInput): Promise<IdeaResult> {
    await delay(650);
    const idea = input.rawIdea.trim() || '未命名研究想法';
    return {
      accepted: true,
      title: idea.slice(0, 42) || 'Untitled Idea',
      researchQuestion: `在控制其他变量的前提下，「${idea.slice(0, 30)}」是否能在目标指标上带来可测量的改进？`,
      hypothesis: `采用该机制后，主指标相对现有 baseline 有统计上可分辨的改善，且副作用指标不超出预设容限。`,
      independentVariable: '待验证的核心机制开关（treatment）',
      dependentMetrics: ['success_rate', 'latency_ms'],
      baseline: { name: '现有默认配置', value: 'default' },
      mainGap: '现有工作缺少该机制与目标指标之间可证伪的定量证据。',
      firstExperiment: '在最小可控任务子集上做 baseline vs treatment 对照（n ≥ 60/组）。',
      openQuestions: ['机制在何种条件下会失效？', '效果量是否足以覆盖实现成本？'],
      notes: 'MockAdapter 生成，仅用于界面演示。',
    };
  },

  async reviewExperimentDesign(input: ExperimentDesignInput): Promise<DesignVerdict> {
    await delay(700);
    const text = input.proposal.toLowerCase();
    const hasBaseline = /baseline|对照|固定|fixed|fixed_16/.test(text) || input.soul.baselines.length > 0;
    const hasMetric = /success|latency|指标|metric|成功率|延迟/.test(text) || input.soul.dependentMetrics.length > 0;
    const accepted = hasBaseline && hasMetric;
    const baseline = input.soul.baselines[0] ?? { name: '现有默认配置', value: 'default' };
    return {
      accepted,
      title: input.proposal.slice(0, 48) || '未命名实验',
      goal: '检验该 treatment 是否相对 baseline 在目标指标上产生可分辨的差异。',
      hypothesis: input.soul.hypothesis || 'treatment 在目标指标上优于 baseline。',
      baseline: { name: baseline.name, value: baseline.value },
      treatment: { name: 'Adaptive / Proposed', value: '见实验描述', range: [] },
      controlledVariables: ['policy checkpoint', 'task set', 'random seed', 'hardware'],
      metrics: input.soul.dependentMetrics.length ? input.soul.dependentMetrics : ['success_rate'],
      expectedObservation: 'treatment 在至少一项主指标上优于 baseline。',
      mainRisk: accepted ? '样本量与调度抖动可能影响指标稳定性。' : '设计缺少对照组或指标定义。',
      reason: accepted
        ? '该设计包含了明确的 baseline、可测量的指标与可控变量，能够真正检验原假设。'
        : '设计无法真正检验假设：缺少明确的对照组或可测量指标。',
      missingControls: accepted ? [] : ['明确的 baseline 配置', '可量化的主指标定义'],
    };
  },

  async reviewEvidence(input: EvidenceInput): Promise<EvidenceVerdict> {
    await delay(750);
    const stats = input.stats ?? [];
    const minN = Math.min(...stats.map((s) => Math.min(s.baseline.n, s.treatment.n)), Infinity);
    const success = stats.find((s) => /success|acc|rate/i.test(s.metric));
    const latency = stats.find((s) => /latency|time|ms|cost/i.test(s.metric));

    let verdict: EvidenceVerdict['verdict'] = 'insufficient';
    let rationale = '样本量或效果量不足以支撑结论。';

    if (!Number.isFinite(minN) || stats.length === 0) {
      verdict = 'invalid';
      rationale = '没有可用的统计量，实验记录无效。';
    } else if (success && success.delta <= -0.02) {
      verdict = 'contradictory';
      rationale = `主指标 ${success.metric} 下降 ${Math.abs(success.delta).toFixed(3)}（${success.deltaPercent.toFixed(1)}%），超出可接受容限，削弱原假设。`;
    } else if (minN < 30) {
      verdict = 'insufficient';
      rationale = `每组样本量仅 ${minN}，置信区间过宽，不足以支撑实体化。`;
    } else if (latency && latency.deltaPercent <= -10 && (!success || success.delta >= -0.015)) {
      verdict = 'accepted';
      rationale = `${latency.metric} 改善 ${Math.abs(latency.deltaPercent).toFixed(1)}%，且主指标未超出容限，样本量 ${minN}/组，结果足以支持原假设。`;
    }

    return {
      verdict,
      dataBrief: input.dataBrief || '（无数据摘要）',
      aiView: input.humanView
        ? `研究者判断：${input.humanView}。Agent 判断：${rationale}`
        : `Agent 判断：${rationale}`,
      rationale,
      conditions: stats.length ? [`基于 ${stats.map((s) => s.metric).join(' / ')} 的对照统计`] : [],
      confidence: verdict === 'accepted' ? 0.84 : verdict === 'contradictory' ? 0.79 : 0.42,
      suggestedNext:
        verdict === 'accepted'
          ? '将结论推广到更广的任务分布，并补充失败条件分析。'
          : verdict === 'contradictory'
            ? '把该条件写成研究边界（黄叶），并设计针对性的修复实验。'
            : '扩大样本量或降低指标方差后重跑。',
    };
  },

  async searchPapers(input: PaperSearchInput): Promise<PaperMatch[]> {
    await delay(900);
    const pool = PAPER_POOL.filter((p) => !input.knownPaperIds.includes(p.paperId));
    const picked = pool.slice(0, input.trigger === 'yellow_leaf' ? 2 : 3);
    return picked.map((p) => ({
      ...p,
      matchedGap: `${p.matchedGap} · 当前焦点：${input.focusLabel}`,
    }));
  },

  /* ---------- Frontier 层：复用确定性内核 ---------- */
  async runFrontierLoop(input: FrontierLoopInput): Promise<FrontierScanResult> {
    await delay(500);
    return runFrontierLoopFn(input.docs, input.source, input.memory);
  },

  async evaluateNovelty(input: NoveltyInput): Promise<NoveltyDecision[]> {
    await delay(120);
    return evaluateNoveltyFn(input.candidates, input.memory);
  },

  async generateBrief(input: BriefInput): Promise<MorningBrief> {
    await delay(120);
    return generateBriefFn(input.docs, input.scan);
  },

  /* ---------- Instrument Workshop：离线演示剧本 ----------
   * Mock 不跑真实沙箱；回放一轮"预录"的仪器调查（明确标注 fallback），
   * 让 UI 与交互链路在无后端时也可完整演示。 */
  async runMathInvestigation(input: MathInvestigationInput): Promise<EvidencePackage> {
    const metrics = input.mapping.metricColumns ?? [];
    const primary = metrics[0] ?? 'metric';

    input.onEvent?.({ type: 'round_start', round: 1 });
    await delay(400);
    input.onEvent?.({ type: 'tool_call', round: 1, tool_id: 'basic_statistics', params: { columns: metrics } });
    await delay(600);
    input.onEvent?.({
      type: 'tool_result', round: 1, tool_id: 'basic_statistics',
      outputs: { per_column: { [primary]: { n: input.rows.length, mean: 0.79, std: 0.03 } } },
    });
    input.onEvent?.({ type: 'tool_call', round: 2, tool_id: 'bootstrap_ci', params: { column: primary } });
    await delay(700);
    input.onEvent?.({
      type: 'tool_result', round: 2, tool_id: 'bootstrap_ci',
      outputs: { observed_delta: -0.05, ci95: [-0.06, -0.04], ci_excludes_zero: true },
    });
    await delay(300);
    input.onEvent?.({ type: 'finding', finding: '（演示数据）baseline 与 treatment 存在可测差异。' });

    return {
      finding: '（演示剧本）baseline 与 treatment 的均值差 95% CI 不包含 0。',
      rounds: [
        {
          tool_id: 'basic_statistics', tool_version: 1,
          question: '每列基础统计（演示）',
          outputs: { per_column: { [primary]: { n: input.rows.length, mean: 0.79, std: 0.03 } } },
          note: 'mock · demo', code_hash: 'demo0000000000000',
        },
        {
          tool_id: 'bootstrap_ci', tool_version: 1,
          question: '均值差置信区间（演示）',
          outputs: { observed_delta: -0.05, ci95: [-0.06, -0.04], ci_excludes_zero: true },
          note: 'mock · demo', code_hash: 'demo0000000000001',
        },
      ],
      hypothesesVerdicts: [],
      interpretation: '这是 MockAdapter 的预录演示剧本，不代表真实计算；切换到 LearnBuddy Agent 并连接后端可获得真实的 Mathematical Instrument Layer。',
      confidence: 0.4,
      fallback: true,
    };
  },
};
