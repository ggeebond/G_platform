/**
 * Soul Lab — Seed 花园（3 分钟 Demo 起始态）
 *
 * 不是「一个 Soul + 四个装饰」，而是五篇真实文档：
 * Adaptive Action Horizon 是主花（Demo 剧本所在），
 * 其余四株分别处于 Idea / Growing / Bloomed 阶段，并与主花之间存在真实可推导的 Lineage。
 */
import { petalAngles, leafLayout } from '../state/soul-machine';
import type { SoulDoc } from '../types';

const H = 3600 * 1000;
const D = 24 * H;

/* ============================================================
 * 主花：Adaptive Action Horizon（Demo 剧本）
 * ============================================================ */

export function createSeedDoc(): SoulDoc {
  const now = Date.now();
  const soulId = 'soul_adaptive_horizon';

  const soul = {
    id: soulId,
    title: 'Adaptive Action Horizon',
    rawIdea:
      '根据当前任务状态动态调整 action horizon，希望降低推理延迟，同时不显著损失 success rate。',
    researchQuestion:
      '在同一 policy 与同一任务集下，将 action horizon 由固定 16 改为按状态不确定性动态选择（8~24），能否在 success rate 下降不超过 1.5 个百分点的前提下显著降低 p50 latency？',
    hypothesis:
      '动态 horizon 可使 p50 latency 下降 ≥15%，且 success rate 相对固定 horizon 的下降不超过 1.5 个百分点。',
    independentVariable: 'action horizon 选择策略（fixed = 16 vs adaptive ∈ [8, 24]）',
    dependentMetrics: ['success_rate', 'latency_ms'],
    openQuestions: [
      '不确定性估计的误差如何传导到 horizon 选择？',
      '长程任务是否要求更大的 horizon 上限？',
      '高视觉噪声下自适应策略是否失效？',
    ],
    mainGap:
      '现有 action chunking 工作默认固定 horizon，缺少「状态自适应 horizon」的定量延迟-成功率权衡证据。',
    mechanismChain: ['State', 'Uncertainty Estimation', 'Dynamic Horizon Selection', 'Action Sequence'],
    status: 'WaitingForResult' as const,
    createdAt: now - 9 * D,
  };

  const baselines = [
    {
      id: 'base_fixed16',
      soulId,
      index: 0,
      name: 'Fixed Horizon',
      value: '16',
      reason: '目标论文默认配置，作为直接对照；唯一变量是 horizon 选择策略。',
      bound: true,
      sourcePaperId: 'W_fixed_horizon_2023',
      protocol: '同一 policy checkpoint、同一 200 条 episode 任务集、同一随机种子。',
    },
    {
      id: 'base_act',
      soulId,
      index: 1,
      name: 'ACT (Action Chunking Transformer)',
      value: 'chunk=16',
      reason: '主流 action chunking 基线，用于确认收益不是来自 backbone 差异。',
      bound: true,
      sourcePaperId: 'W_act_2023',
      protocol: '官方实现，chunk size = 16，其余超参保持一致。',
    },
    {
      id: 'base_diffusion',
      soulId,
      index: 2,
      name: 'Diffusion Policy',
      value: 'horizon=16',
      reason: '另一类生成式策略基线，尚未完成配置对齐。',
      bound: false,
      sourcePaperId: null,
      protocol: '',
    },
  ];

  const experiments = [
    {
      id: 'exp_01',
      soulId,
      index: 1,
      title: 'Adaptive vs Fixed on short-horizon tasks',
      goal: '验证动态 horizon 在短程任务上是否降低 latency 而不显著损失 success rate。',
      hypothesis: soul.hypothesis,
      baseline: { name: 'Fixed Horizon', value: '16' },
      treatment: { name: 'Adaptive Horizon', value: '8~24', range: [8, 24] },
      controlledVariables: ['policy checkpoint', 'task set (short-horizon)', 'random seed', 'hardware'],
      metrics: ['success_rate', 'latency_ms'],
      expectedObservation: 'latency 下降，success rate 基本持平。',
      mainRisk: '样本量不足，latency 差异可能来自调度抖动。',
      status: 'reviewed' as const,
      createdAt: now - 7 * D,
      result: {
        fileName: 'exp01_short_horizon.xlsx',
        rows: 240,
        mapping: {
          groupColumn: 'policy',
          baselineLabel: 'fixed_16',
          treatmentLabel: 'adaptive',
          metricColumns: ['success_rate', 'latency_ms'],
        },
        stats: [
          {
            metric: 'success_rate',
            baseline: { mean: 0.812, std: 0.031, n: 120 },
            treatment: { mean: 0.806, std: 0.029, n: 120 },
            delta: -0.006,
            deltaPercent: -0.74,
          },
          {
            metric: 'latency_ms',
            baseline: { mean: 148.4, std: 12.7, n: 120 },
            treatment: { mean: 121.9, std: 11.4, n: 120 },
            delta: -26.5,
            deltaPercent: -17.86,
          },
        ],
        humanView: 'latency 降 17.9% 超过阈值 15%，success rate 只掉 0.6 个百分点，我认为足以支撑假设。',
        submittedAt: now - 6 * D,
      },
    },
    {
      id: 'exp_02',
      soulId,
      index: 2,
      title: 'Adaptive horizon under high visual noise',
      goal: '检验自适应策略在视觉噪声下的鲁棒性边界。',
      hypothesis: '在高视觉噪声下，动态 horizon 仍能维持 success rate 优势。',
      baseline: { name: 'Fixed Horizon', value: '16' },
      treatment: { name: 'Adaptive Horizon', value: '8~24', range: [8, 24] },
      controlledVariables: ['noise level = 0.25', 'same checkpoint', 'same task subset'],
      metrics: ['success_rate', 'latency_ms'],
      expectedObservation: 'success rate 优势保持。',
      mainRisk: '不确定性估计被噪声污染，导致 horizon 频繁切换。',
      status: 'reviewed' as const,
      createdAt: now - 4 * D,
      result: {
        fileName: 'exp02_noise.xlsx',
        rows: 180,
        mapping: {
          groupColumn: 'policy',
          baselineLabel: 'fixed_16',
          treatmentLabel: 'adaptive',
          metricColumns: ['success_rate', 'latency_ms'],
        },
        stats: [
          {
            metric: 'success_rate',
            baseline: { mean: 0.664, std: 0.048, n: 90 },
            treatment: { mean: 0.571, std: 0.061, n: 90 },
            delta: -0.093,
            deltaPercent: -14.01,
          },
          {
            metric: 'latency_ms',
            baseline: { mean: 152.1, std: 15.2, n: 90 },
            treatment: { mean: 133.8, std: 18.9, n: 90 },
            delta: -18.3,
            deltaPercent: -12.03,
          },
        ],
        humanView: '噪声下 success rate 掉 9.3 个百分点，远超 1.5 的容限，这条结论在噪声条件下不成立。',
        submittedAt: now - 3 * D,
      },
    },
    {
      id: 'exp_03',
      soulId,
      index: 3,
      title: 'Adaptive horizon 8–24 on long-horizon tasks',
      goal: '把结论从短程任务推广到长程任务，确认 latency 收益是否保持。',
      hypothesis: '在长程任务上，动态 horizon 仍能带来 ≥10% 的 latency 收益。',
      baseline: { name: 'Fixed Horizon', value: '16' },
      treatment: { name: 'Adaptive Horizon', value: '8~24', range: [8, 24] },
      controlledVariables: ['same checkpoint', 'long-horizon task set', 'random seed', 'hardware'],
      metrics: ['success_rate', 'latency_ms'],
      expectedObservation: 'latency 收益保持，success rate 不显著下降。',
      mainRisk: '长程任务本身 horizon 需求更大，8~24 的上限可能不够。',
      status: 'designAccepted' as const,
      createdAt: now - 1 * D,
      result: null,
    },
  ];

  const angles = petalAngles(3);
  const petals = [
    {
      id: 'petal_01',
      soulId,
      experimentId: 'exp_01',
      index: 0,
      label: 'Short-horizon: latency −17.9%',
      status: 'solid' as const,
      angle: angles[0],
      solidifiedAt: now - 6 * D,
    },
    {
      id: 'petal_02',
      soulId,
      experimentId: 'exp_02',
      index: 1,
      label: 'Noise: success −9.3pp',
      status: 'withdrawn' as const,
      angle: angles[1],
      withdrawnReason: 'Contradicted by evidence',
    },
    {
      id: 'petal_03',
      soulId,
      experimentId: 'exp_03',
      index: 2,
      label: 'Long-horizon: waiting for result',
      status: 'candidate' as const,
      angle: angles[2],
    },
  ];

  const layout0 = leafLayout(0);
  const leaves = [
    {
      id: 'leaf_01',
      soulId,
      experimentId: 'exp_02',
      index: 0,
      label: 'High visual noise: −9.3pp success',
      status: 'warning' as const,
      angle: 0,
      attachY: layout0.attachY,
      side: layout0.side,
      failureCondition: '视觉噪声 σ ≥ 0.2 时，自适应 horizon 的成功率优势消失并反转为劣势。',
      aiJudgement:
        '该结果与原假设矛盾：在高噪声条件下动态 horizon 使 success rate 下降 9.3 个百分点，远超 1.5 个百分点容限。结论应限定在低噪声条件。',
      userJudgement: '',
      nextSteps: '为不确定性估计加入噪声鲁棒性校准，或在高噪声下退化回固定 horizon。',
      createdAt: now - 3 * D,
    },
  ];

  const papers = [
    {
      id: 'paper_01',
      soulId,
      paperId: 'W_adaptive_chunk_2024',
      title: 'Uncertainty-Aware Action Chunking for Efficient Visuomotor Policies',
      year: 2024,
      authors: ['L. Wen', 'M. Zhao', 'K. Ito'],
      abstract:
        '提出依据策略不确定性动态调整 action chunk 长度的机制，在保持成功率的同时降低推理开销，并给出延迟-成功率的权衡曲线。',
      matchedGap: '直接命中「固定 horizon 缺少状态自适应」这一 gap。',
      relatedPetalId: 'petal_01',
      relationType: 'supporting' as const,
      reason: '机制与 Soul 的核心机制链几乎一致（State → Uncertainty → Chunk Selection → Action）。',
      keyMechanism: '用 ensemble disagreement 估计不确定性，再映射为 chunk 长度。',
      source: 'arXiv 2024',
      discoveredAt: now - 2 * D,
      inMemory: true,
      memoryNote: '作为机制层最直接的相关工作保存。',
    },
    {
      id: 'paper_02',
      soulId,
      paperId: 'W_noise_robust_chunk_2025',
      title: 'When Adaptive Horizons Fail: Robustness of Chunk Selection under Visual Noise',
      year: 2025,
      authors: ['A. Ferrante', 'S. Park'],
      abstract:
        '系统评测多种自适应 chunk 选择策略在视觉噪声下的表现，指出不确定性估计被污染会导致 horizon 频繁切换并显著损害成功率。',
      matchedGap: '解释 Yellow Leaf：高噪声下自适应 horizon 失效。',
      relatedPetalId: 'petal_02',
      relationType: 'conflicting' as const,
      reason: '与 exp_02 的失败条件高度一致，提供了失效机理与可能的修复方向。',
      keyMechanism: '噪声 → 不确定性估计偏差 → horizon 抖动 → 控制不稳定。',
      source: 'OpenAlex 2025',
      discoveredAt: now - 0.4 * D,
      inMemory: false,
    },
    {
      id: 'paper_03',
      soulId,
      paperId: 'W_action_chunking_survey_2023',
      title: 'A Survey on Action Chunking in Imitation Learning',
      year: 2023,
      authors: ['R. Müller', 'T. Nguyen'],
      abstract: '综述 action chunking 的设计空间与常见超参选择，默认使用固定 horizon。',
      matchedGap: '背景知识：说明固定 horizon 是领域默认。',
      relatedPetalId: null,
      relationType: 'background' as const,
      reason: '用于确认 baseline 选择的合理性。',
      keyMechanism: '固定 horizon 的经验选择准则。',
      source: 'OpenAlex 2023',
      discoveredAt: now - 8 * D,
      inMemory: true,
      memoryNote: 'Baseline 依据。',
    },
  ];

  const reviews = [
    {
      id: 'rev_01',
      soulId,
      targetType: 'evidence' as const,
      targetId: 'exp_01',
      verdict: 'accepted',
      rationale:
        'latency 下降 17.86% 超过 15% 预设阈值，success rate 下降 0.74% 在 1.5% 容限内，n=120/组，标准差可控。',
      dataBrief: 'success_rate 0.812→0.806；latency_ms 148.4→121.9；n=120/组。',
      aiView: '效果量与样本量均支持原假设，结论可成立。',
      humanView: '同意，收益明显且代价可控。',
      conditions: ['短程任务', '低视觉噪声'],
      confidence: 0.82,
      suggestedNext: '将结论推广到长程任务（exp_03）。',
      actor: 'agent' as const,
      createdAt: now - 6 * D,
    },
    {
      id: 'rev_02',
      soulId,
      targetType: 'evidence' as const,
      targetId: 'exp_02',
      verdict: 'contradictory',
      rationale:
        'success rate 下降 9.3 个百分点，远超 1.5 个百分点容限，与原假设矛盾；latency 收益不足以补偿成功率损失。',
      dataBrief: 'success_rate 0.664→0.571；latency_ms 152.1→133.8；n=90/组。',
      aiView: '结果削弱原结论，应作为研究边界而非失败。',
      humanView: '同意，结论需限定条件。',
      conditions: ['高视觉噪声 σ ≥ 0.2'],
      confidence: 0.88,
      suggestedNext: '加入噪声鲁棒的不确定性校准后再重跑。',
      actor: 'agent' as const,
      createdAt: now - 3 * D,
    },
  ];

  const timeline = [
    { id: 'ev_seed_1', soulId, type: 'SOUL_CREATED' as const, actor: 'user' as const, summary: `研究想法诞生：${soul.title}`, at: now - 9 * D },
    { id: 'ev_seed_2', soulId, type: 'BASELINE_ADDED' as const, actor: 'user' as const, summary: 'Baseline 根系延伸：Fixed Horizon = 16', at: now - 8 * D },
    { id: 'ev_seed_3', soulId, type: 'DESIGN_ACCEPTED' as const, actor: 'agent' as const, summary: '实验设计成立，长出候选花瓣：Adaptive vs Fixed on short-horizon tasks', at: now - 7 * D },
    { id: 'ev_seed_4', soulId, type: 'EVIDENCE_ACCEPTED' as const, actor: 'user' as const, summary: '证据审议通过，花瓣实体化', at: now - 6 * D },
    { id: 'ev_seed_5', soulId, type: 'EVIDENCE_CONTRADICTORY' as const, actor: 'user' as const, summary: '实验结果削弱原结论，长出黄叶：High visual noise: −9.3pp success', at: now - 3 * D },
    { id: 'ev_seed_6', soulId, type: 'PAPER_DISCOVERED' as const, actor: 'agent' as const, summary: 'Paper Scout 检索到 1 篇相关工作', at: now - 0.4 * D },
    { id: 'ev_seed_7', soulId, type: 'DESIGN_ACCEPTED' as const, actor: 'agent' as const, summary: '实验设计成立，长出候选花瓣：Adaptive horizon 8–24 on long-horizon tasks', at: now - 1 * D },
  ];

  return { soul, baselines, experiments, petals, leaves, papers, reviews, timeline };
}

/* ============================================================
 * 其余四株：让花园从第一眼就成立
 * ============================================================ */

/** Uncertainty-Aware VLA —— 刚种下的花蕾，只有想法，没有证据 */
function createUncertaintyVlaDoc(): SoulDoc {
  const now = Date.now();
  const soulId = 'soul_uncertainty_vla';
  return {
    soul: {
      id: soulId,
      title: 'Uncertainty-Aware VLA',
      rawIdea: '让 VLA 模型在动作生成前显式输出不确定性，并据此决定是否交还控制权给人类。',
      researchQuestion: '把不确定性作为显式输出通道后，VLA 在长尾场景下的误动作能否被提前拦截？',
      hypothesis: '显式不确定性通道可在误动作发生前 0.5s 内以 ≥70% 召回率触发人工接管。',
      independentVariable: '是否引入显式不确定性输出头',
      dependentMetrics: ['false_action_recall', 'handover_latency_ms'],
      openQuestions: ['不确定性如何校准？', '接管阈值如何随任务变化？'],
      mainGap: '现有 VLA 把不确定性隐含在动作分布里，没有可直接触发的接管信号。',
      mechanismChain: ['Observation', 'Uncertainty Head', 'Handover Policy', 'Action'],
      status: 'Growing',
      createdAt: now - 2 * D,
    },
    baselines: [
      {
        id: 'base_vla_plain',
        soulId,
        index: 0,
        name: 'OpenVLA (no uncertainty head)',
        value: 'default',
        reason: '作为「不显式建模不确定性」的直接对照。',
        bound: false,
        sourcePaperId: null,
        protocol: '',
      },
    ],
    experiments: [],
    petals: [],
    leaves: [],
    papers: [
      {
        id: 'paper_uv_01',
        soulId,
        paperId: 'W_action_chunking_survey_2023',
        title: 'A Survey on Action Chunking in Imitation Learning',
        year: 2023,
        authors: ['R. Müller', 'T. Nguyen'],
        abstract: '综述 action chunking 的设计空间与常见超参选择，默认使用固定 horizon。',
        matchedGap: '确认 chunk 长度是 VLA 动作生成的关键设计维度。',
        relatedPetalId: null,
        relationType: 'background' as const,
        reason: '用于理解动作序列生成的基本设计空间。',
        keyMechanism: '固定 horizon 的经验选择准则。',
        source: 'OpenAlex 2023',
        discoveredAt: now - 1.6 * D,
        inMemory: true,
        memoryNote: '入门背景。',
      },
      {
        id: 'paper_uv_02',
        soulId,
        paperId: 'W_adaptive_chunk_2024',
        title: 'Uncertainty-Aware Action Chunking for Efficient Visuomotor Policies',
        year: 2024,
        authors: ['L. Wen', 'M. Zhao', 'K. Ito'],
        abstract:
          '提出依据策略不确定性动态调整 action chunk 长度的机制，在保持成功率的同时降低推理开销。',
        matchedGap: '证明不确定性信号可用于控制决策，本 Soul 把它推进到接管决策。',
        relatedPetalId: null,
        relationType: 'method' as const,
        reason: '同样以不确定性驱动决策，但目标是效率而非安全接管。',
        keyMechanism: 'ensemble disagreement → chunk 长度。',
        source: 'arXiv 2024',
        discoveredAt: now - 0.9 * D,
        inMemory: true,
        memoryNote: '最接近的前置工作。',
      },
    ],
    reviews: [],
    timeline: [
      { id: 'ev_uv_1', soulId, type: 'SOUL_CREATED' as const, actor: 'user' as const, summary: '研究想法诞生：Uncertainty-Aware VLA', at: now - 2 * D },
      { id: 'ev_uv_2', soulId, type: 'BASELINE_ADDED' as const, actor: 'user' as const, summary: 'Baseline 根系延伸：OpenVLA (no uncertainty head)', at: now - 1.8 * D },
      { id: 'ev_uv_3', soulId, type: 'PAPER_DISCOVERED' as const, actor: 'agent' as const, summary: 'Paper Scout 检索到 2 篇相关工作', at: now - 0.9 * D },
    ],
  };
}

/** Temporal Policy Adaptation —— 论证完整、已经可以写成论文 */
function createTemporalPolicyDoc(): SoulDoc {
  const now = Date.now();
  const soulId = 'soul_temporal_policy';
  const angles = petalAngles(3);

  const petals = [0, 1, 2].map((i) => ({
    id: `petal_tp_0${i + 1}`,
    soulId,
    experimentId: `exp_tp_0${i + 1}`,
    index: i,
    label: [
      'Temporal ensembling: success +4.1pp',
      'Cross-embodiment transfer holds',
      'Latency within budget on edge device',
    ][i],
    status: 'solid' as const,
    angle: angles[i],
    solidifiedAt: now - (6 - i) * D,
  }));

  return {
    soul: {
      id: soulId,
      title: 'Temporal Policy Adaptation',
      rawIdea: '让同一 policy 在推理时自适应调整时间尺度，从而跨不同控制频率的机器人复用。',
      researchQuestion: '时间尺度自适应能否让单一 policy 在 5Hz~50Hz 的不同本体上保持性能？',
      hypothesis: '时间尺度自适应可使跨本体性能损失控制在 3 个百分点以内。',
      independentVariable: '推理时时间尺度策略',
      dependentMetrics: ['success_rate', 'control_jitter'],
      openQuestions: ['极低控制频率下是否仍成立？'],
      mainGap: '跨本体复用通常需要重新训练或固定重采样，缺少推理时的自适应机制。',
      mechanismChain: ['State', 'Temporal Scaling', 'Action Sequence', 'Control'],
      status: 'Growing',
      createdAt: now - 40 * D,
    },
    baselines: [
      { id: 'base_tp_fixed', soulId, index: 0, name: 'Fixed-rate policy', value: '20Hz', reason: '原始训练频率，直接对照。', bound: true, sourcePaperId: 'W_action_chunking_survey_2023', protocol: '官方 checkpoint，20Hz 推理。' },
      { id: 'base_tp_resample', soulId, index: 1, name: 'Naive resampling', value: 'linear', reason: '常见工程做法，用于确认收益不是来自插值。', bound: true, sourcePaperId: null, protocol: '线性重采样到目标频率。' },
    ],
    experiments: [0, 1, 2].map((i) => ({
      id: `exp_tp_0${i + 1}`,
      soulId,
      index: i + 1,
      title: ['Temporal ensembling', 'Cross-embodiment transfer', 'Edge-device latency'][i],
      goal: '验证时间尺度自适应在该条件下的效果。',
      hypothesis: '时间尺度自适应保持性能且不引入抖动。',
      baseline: { name: 'Fixed-rate policy', value: '20Hz' },
      treatment: { name: 'Adaptive temporal scaling', value: '5~50Hz', range: [5, 50] },
      controlledVariables: ['checkpoint', 'task set', 'seed'],
      metrics: ['success_rate', 'control_jitter'],
      expectedObservation: '性能持平或提升。',
      mainRisk: '低频率端抖动增加。',
      status: 'reviewed' as const,
      createdAt: now - (30 - i * 4) * D,
      result: {
        fileName: `tp_0${i + 1}.xlsx`,
        rows: 200,
        mapping: { groupColumn: 'policy', baselineLabel: 'fixed_20hz', treatmentLabel: 'adaptive', metricColumns: ['success_rate'] },
        stats: [
          {
            metric: 'success_rate',
            baseline: { mean: 0.71 + i * 0.02, std: 0.034, n: 100 },
            treatment: { mean: 0.752 + i * 0.015, std: 0.031, n: 100 },
            delta: 0.042 - i * 0.005,
            deltaPercent: 5.9 - i * 0.6,
          },
        ],
        humanView: '跨本体条件下收益稳定，满足论文主张。',
        submittedAt: now - (29 - i * 4) * D,
      },
    })),
    petals,
    leaves: [],
    papers: [
      {
        id: 'paper_tp_01',
        soulId,
        paperId: 'W_action_chunking_survey_2023',
        title: 'A Survey on Action Chunking in Imitation Learning',
        year: 2023,
        authors: ['R. Müller', 'T. Nguyen'],
        abstract: '综述 action chunking 的设计空间与常见超参选择。',
        matchedGap: '确认时间尺度是动作分块的核心维度。',
        relatedPetalId: 'petal_tp_01',
        relationType: 'background' as const,
        reason: '本工作的设计空间来源。',
        keyMechanism: '固定 horizon 的经验选择准则。',
        source: 'OpenAlex 2023',
        discoveredAt: now - 38 * D,
        inMemory: true,
        memoryNote: '核心背景引用。',
      },
      {
        id: 'paper_tp_02',
        soulId,
        paperId: 'W_temporal_ensemble_2024',
        title: 'Temporal Ensembling for Visuomotor Policies',
        year: 2024,
        authors: ['J. Ho', 'P. Chen'],
        abstract: '通过时间维度的集成平滑动作序列，降低抖动并提升成功率。',
        matchedGap: '提供了时间尺度自适应的平滑机制。',
        relatedPetalId: 'petal_tp_01',
        relationType: 'method' as const,
        reason: '本工作的方法学基础。',
        keyMechanism: '滑动窗口指数集成。',
        source: 'arXiv 2024',
        discoveredAt: now - 34 * D,
        inMemory: true,
        memoryNote: '方法来源。',
      },
    ],
    reviews: [0, 1, 2].map((i) => ({
      id: `rev_tp_0${i + 1}`,
      soulId,
      targetType: 'evidence' as const,
      targetId: `exp_tp_0${i + 1}`,
      verdict: 'accepted',
      rationale: '效果量与样本量支持假设。',
      dataBrief: `success_rate 提升 ${(4.2 - i * 0.5).toFixed(1)} 个百分点，n=100/组。`,
      aiView: '结论可成立。',
      humanView: '同意。',
      conditions: ['中等控制频率'],
      confidence: 0.8 - i * 0.04,
      suggestedNext: '补充极低频率条件下的实验。',
      actor: 'agent' as const,
      createdAt: now - (29 - i * 4) * D,
    })),
    timeline: [
      { id: 'ev_tp_1', soulId, type: 'SOUL_CREATED' as const, actor: 'user' as const, summary: '研究想法诞生：Temporal Policy Adaptation', at: now - 40 * D },
      { id: 'ev_tp_2', soulId, type: 'BASELINE_ADDED' as const, actor: 'user' as const, summary: 'Baseline 根系延伸：Fixed-rate policy = 20Hz', at: now - 39 * D },
      { id: 'ev_tp_3', soulId, type: 'EVIDENCE_ACCEPTED' as const, actor: 'user' as const, summary: '证据审议通过，花瓣实体化', at: now - 29 * D },
      { id: 'ev_tp_4', soulId, type: 'EVIDENCE_ACCEPTED' as const, actor: 'user' as const, summary: '证据审议通过，花瓣实体化', at: now - 25 * D },
      { id: 'ev_tp_5', soulId, type: 'EVIDENCE_ACCEPTED' as const, actor: 'user' as const, summary: '证据审议通过，花瓣实体化', at: now - 21 * D },
    ],
  };
}

/** Efficient VLA Pruning —— 正在生长，两片候选花瓣在等结果 */
function createEfficientVlaDoc(): SoulDoc {
  const now = Date.now();
  const soulId = 'soul_efficient_vla';
  const angles = petalAngles(3);

  return {
    soul: {
      id: soulId,
      title: 'Efficient VLA Pruning',
      rawIdea: '把 VLA 的视觉 backbone 按任务相关性剪枝，在保持成功率的前提下降低显存占用。',
      researchQuestion: '结构化剪枝到 40% 参数量后，VLA 在标准任务集上的成功率损失能否控制在 2 个百分点内？',
      hypothesis: '结构化剪枝到 40% 参数量，成功率损失 ≤2pp，显存占用下降 ≥50%。',
      independentVariable: '剪枝率（0% / 20% / 40%）',
      dependentMetrics: ['success_rate', 'peak_vram_mb'],
      openQuestions: ['剪枝后的 policy 是否更容易过拟合？'],
      mainGap: 'VLA 的推理成本阻碍了机载部署，缺少结构化剪枝的系统评测。',
      mechanismChain: ['Observation', 'Pruned Backbone', 'Action Sequence', 'Control'],
      status: 'WaitingForResult',
      createdAt: now - 14 * D,
    },
    baselines: [
      { id: 'base_ev_full', soulId, index: 0, name: 'Full VLA', value: '100%', reason: '未剪枝的完整模型，直接对照。', bound: true, sourcePaperId: null, protocol: '官方 checkpoint，同一评测集。' },
    ],
    experiments: [0, 1, 2].map((i) => ({
      id: `exp_ev_0${i + 1}`,
      soulId,
      index: i + 1,
      title: ['Prune 20%', 'Prune 40%', 'Prune 40% + finetune'][i],
      goal: '测量该剪枝率下的成功率与显存占用。',
      hypothesis: '剪枝到 40% 时成功率损失不超过 2pp。',
      baseline: { name: 'Full VLA', value: '100%' },
      treatment: { name: 'Pruned VLA', value: ['80%', '60%', '60%+ft'][i], range: [] },
      controlledVariables: ['eval set', 'seed', 'batch size'],
      metrics: ['success_rate', 'peak_vram_mb'],
      expectedObservation: '成功率小幅下降，显存显著下降。',
      mainRisk: '显存测量受驱动版本影响。',
      status: (i === 0 ? 'reviewed' : 'designAccepted') as 'reviewed' | 'designAccepted',
      createdAt: now - (12 - i * 3) * D,
      result:
        i === 0
          ? {
              fileName: 'ev_prune20.xlsx',
              rows: 160,
              mapping: { groupColumn: 'model', baselineLabel: 'full', treatmentLabel: 'prune20', metricColumns: ['success_rate', 'peak_vram_mb'] },
              stats: [
                {
                  metric: 'success_rate',
                  baseline: { mean: 0.784, std: 0.027, n: 80 },
                  treatment: { mean: 0.779, std: 0.029, n: 80 },
                  delta: -0.005,
                  deltaPercent: -0.64,
                },
                {
                  metric: 'peak_vram_mb',
                  baseline: { mean: 18420, std: 210, n: 80 },
                  treatment: { mean: 14980, std: 190, n: 80 },
                  delta: -3440,
                  deltaPercent: -18.7,
                },
              ],
              humanView: '剪 20% 几乎无损，显存降 18.7%，方向成立。',
              submittedAt: now - 10 * D,
            }
          : null,
    })),
    petals: [
      { id: 'petal_ev_01', soulId, experimentId: 'exp_ev_01', index: 0, label: 'Prune 20%: success −0.6pp', status: 'solid' as const, angle: angles[0], solidifiedAt: now - 10 * D },
      { id: 'petal_ev_02', soulId, experimentId: 'exp_ev_02', index: 1, label: 'Prune 40%: waiting', status: 'candidate' as const, angle: angles[1] },
      { id: 'petal_ev_03', soulId, experimentId: 'exp_ev_03', index: 2, label: 'Prune 40% + finetune: waiting', status: 'candidate' as const, angle: angles[2] },
    ],
    leaves: [],
    papers: [
      {
        id: 'paper_ev_01',
        soulId,
        paperId: 'W_structured_prune_2024',
        title: 'Structured Pruning of Large Vision-Language-Action Models',
        year: 2024,
        authors: ['H. Sato', 'Y. Lin'],
        abstract: '对 VLA 提出结构化剪枝流程，报告在 50% 剪枝率下成功率损失小于 3 个百分点。',
        matchedGap: '提供了剪枝流程与评测协议的直接参考。',
        relatedPetalId: 'petal_ev_01',
        relationType: 'supporting' as const,
        reason: '剪枝率-性能曲线与本 Soul 的预期一致。',
        keyMechanism: '基于激活重要性的通道剪枝。',
        source: 'arXiv 2024',
        discoveredAt: now - 8 * D,
        inMemory: true,
        memoryNote: '剪枝方法参考。',
      },
      {
        id: 'paper_ev_02',
        soulId,
        paperId: 'W_adaptive_chunk_2024',
        title: 'Uncertainty-Aware Action Chunking for Efficient Visuomotor Policies',
        year: 2024,
        authors: ['L. Wen', 'M. Zhao', 'K. Ito'],
        abstract: '依据策略不确定性动态调整 action chunk 长度以降低推理开销。',
        matchedGap: '另一条降低推理成本的路线，可与剪枝叠加。',
        relatedPetalId: null,
        relationType: 'method' as const,
        reason: '同样以推理效率为目标，可能可以组合。',
        keyMechanism: '不确定性 → chunk 长度。',
        source: 'arXiv 2024',
        discoveredAt: now - 5 * D,
        inMemory: false,
      },
    ],
    reviews: [
      {
        id: 'rev_ev_01',
        soulId,
        targetType: 'evidence' as const,
        targetId: 'exp_ev_01',
        verdict: 'accepted',
        rationale: '剪枝 20% 后成功率下降 0.64pp，显存下降 18.7%，n=80/组，支持假设。',
        dataBrief: 'success_rate 0.784→0.779；peak_vram_mb 18420→14980；n=80/组。',
        aiView: '方向成立，可继续推进更高剪枝率。',
        humanView: '同意，继续做 40%。',
        conditions: ['同一评测集'],
        confidence: 0.76,
        suggestedNext: '推进到 40% 剪枝率。',
        actor: 'agent' as const,
        createdAt: now - 10 * D,
      },
    ],
    timeline: [
      { id: 'ev_ev_1', soulId, type: 'SOUL_CREATED' as const, actor: 'user' as const, summary: '研究想法诞生：Efficient VLA Pruning', at: now - 14 * D },
      { id: 'ev_ev_2', soulId, type: 'BASELINE_ADDED' as const, actor: 'user' as const, summary: 'Baseline 根系延伸：Full VLA = 100%', at: now - 13 * D },
      { id: 'ev_ev_3', soulId, type: 'EVIDENCE_ACCEPTED' as const, actor: 'user' as const, summary: '证据审议通过，花瓣实体化', at: now - 10 * D },
      { id: 'ev_ev_4', soulId, type: 'DESIGN_ACCEPTED' as const, actor: 'agent' as const, summary: '实验设计成立，长出候选花瓣：Prune 40%', at: now - 6 * D },
      { id: 'ev_ev_5', soulId, type: 'DESIGN_ACCEPTED' as const, actor: 'agent' as const, summary: '实验设计成立，长出候选花瓣：Prune 40% + finetune', at: now - 3 * D },
    ],
  };
}

/** Noise-Robust Chunk Selection —— 与主花共享知识，形成 Lineage */
function createNoiseRobustDoc(): SoulDoc {
  const now = Date.now();
  const soulId = 'soul_noise_robust';
  const angles = petalAngles(2);
  const layout0 = leafLayout(0);

  return {
    soul: {
      id: soulId,
      title: 'Noise-Robust Chunk Selection',
      rawIdea: '给不确定性估计本身加一层噪声校准，让 chunk 选择在视觉噪声下不抖动。',
      researchQuestion: '对不确定性估计做噪声校准后，能否恢复自适应 horizon 在高噪声下的成功率优势？',
      hypothesis: '噪声校准可使高噪声条件下的 success rate 恢复到固定 horizon 水平以上。',
      independentVariable: '是否对不确定性估计做噪声校准',
      dependentMetrics: ['success_rate', 'horizon_switch_rate'],
      openQuestions: ['校准是否会削弱低噪声下的收益？'],
      mainGap: '已知自适应 horizon 在高噪声下失效，但没有针对「不确定性估计被污染」的修复方案。',
      mechanismChain: ['State', 'Uncertainty Estimation', 'Noise Calibration', 'Dynamic Horizon Selection', 'Action Sequence'],
      status: 'WaitingForResult',
      createdAt: now - 6 * D,
    },
    baselines: [
      { id: 'base_nr_fixed', soulId, index: 0, name: 'Fixed Horizon', value: '16', reason: '噪声条件下的实际最优对照。', bound: true, sourcePaperId: 'W_noise_robust_chunk_2025', protocol: '噪声 σ=0.25，同 checkpoint。' },
      { id: 'base_nr_uncal', soulId, index: 1, name: 'Uncalibrated adaptive', value: '8~24', reason: '未校准的自适应策略，用于隔离校准本身的贡献。', bound: true, sourcePaperId: 'W_adaptive_chunk_2024', protocol: '同上一实验的自适应配置。' },
    ],
    experiments: [
      {
        id: 'exp_nr_01',
        soulId,
        index: 1,
        title: 'Noise-calibrated adaptive horizon @ σ=0.25',
        goal: '验证噪声校准能否恢复高噪声下的成功率。',
        hypothesis: '校准后 success rate 恢复到固定 horizon 以上。',
        baseline: { name: 'Fixed Horizon', value: '16' },
        treatment: { name: 'Calibrated adaptive', value: '8~24', range: [8, 24] },
        controlledVariables: ['noise σ=0.25', 'checkpoint', 'task subset'],
        metrics: ['success_rate', 'horizon_switch_rate'],
        expectedObservation: 'success rate 回升，切换率下降。',
        mainRisk: '校准参数在低噪声下过强。',
        status: 'reviewed' as const,
        createdAt: now - 4 * D,
        result: {
          fileName: 'nr_sigma025.xlsx',
          rows: 180,
          mapping: { groupColumn: 'policy', baselineLabel: 'fixed_16', treatmentLabel: 'calibrated', metricColumns: ['success_rate', 'horizon_switch_rate'] },
          stats: [
            {
              metric: 'success_rate',
              baseline: { mean: 0.664, std: 0.048, n: 90 },
              treatment: { mean: 0.702, std: 0.044, n: 90 },
              delta: 0.038,
              deltaPercent: 5.72,
            },
            {
              metric: 'horizon_switch_rate',
              baseline: { mean: 0.31, std: 0.06, n: 90 },
              treatment: { mean: 0.14, std: 0.04, n: 90 },
              delta: -0.17,
              deltaPercent: -54.8,
            },
          ],
          humanView: '高噪声下成功率反超固定 horizon 3.8pp，切换率降一半，校准确实解决了抖动问题。',
          submittedAt: now - 3 * D,
        },
      },
      {
        id: 'exp_nr_02',
        soulId,
        index: 2,
        title: 'Calibration at low noise (σ=0.05)',
        goal: '确认校准项在低噪声条件下是否仍然无害。',
        hypothesis: '校准在低噪声下不产生副作用。',
        baseline: { name: 'Uncalibrated adaptive', value: '8~24' },
        treatment: { name: 'Calibrated adaptive', value: '8~24', range: [8, 24] },
        controlledVariables: ['noise σ=0.05', 'checkpoint', 'task subset'],
        metrics: ['success_rate'],
        expectedObservation: '两者持平。',
        mainRisk: '校准引入的额外平滑让 horizon 偏保守。',
        status: 'reviewed' as const,
        createdAt: now - 2.6 * D,
        result: {
          fileName: 'nr_sigma005.xlsx',
          rows: 160,
          mapping: { groupColumn: 'policy', baselineLabel: 'uncalibrated', treatmentLabel: 'calibrated', metricColumns: ['success_rate'] },
          stats: [
            {
              metric: 'success_rate',
              baseline: { mean: 0.847, std: 0.026, n: 80 },
              treatment: { mean: 0.829, std: 0.028, n: 80 },
              delta: -0.018,
              deltaPercent: -2.13,
            },
          ],
          humanView: '低噪声下校准反而掉 1.8pp —— 幅度不大，但说明它不是一个无条件收益。',
          submittedAt: now - 2.2 * D,
        },
      },
    ],
    petals: [
      { id: 'petal_nr_01', soulId, experimentId: 'exp_nr_01', index: 0, label: 'Calibrated @ σ=0.25: success +5.7pp', status: 'solid' as const, angle: angles[0], solidifiedAt: now - 3 * D },
      { id: 'petal_nr_02', soulId, experimentId: 'exp_nr_02', index: 1, label: 'Calibrated @ σ=0.05: success −2.1pp', status: 'withdrawn' as const, angle: angles[1], withdrawnReason: 'Contradicted by evidence' },
    ],
    leaves: [
      {
        id: 'leaf_nr_01',
        soulId,
        experimentId: 'exp_nr_02',
        index: 0,
        label: '校准在 σ<0.1 时反而降低成功率',
        status: 'warning' as const,
        angle: 0,
        attachY: layout0.attachY,
        side: layout0.side,
        failureCondition: '低噪声条件下，校准项引入的额外平滑使 horizon 选择偏保守，成功率下降 1.8pp。',
        aiJudgement: '校准不是无条件收益，存在噪声区间依赖。需要在最终方法里做条件化。',
        userJudgement: '',
        nextSteps: '把校准强度设为噪声水平的函数，而不是常数。',
        createdAt: now - 2 * D,
      },
    ],
    papers: [
      {
        id: 'paper_nr_01',
        soulId,
        paperId: 'W_noise_robust_chunk_2025',
        title: 'When Adaptive Horizons Fail: Robustness of Chunk Selection under Visual Noise',
        year: 2025,
        authors: ['A. Ferrante', 'S. Park'],
        abstract:
          '系统评测多种自适应 chunk 选择策略在视觉噪声下的表现，指出不确定性估计被污染会导致 horizon 频繁切换并显著损害成功率。',
        matchedGap: '本 Soul 直接针对该论文提出的失效机理给出修复方案。',
        relatedPetalId: 'petal_nr_01',
        relationType: 'supporting' as const,
        reason: '问题定义来源，也是必须超越的对照。',
        keyMechanism: '噪声 → 不确定性估计偏差 → horizon 抖动 → 控制不稳定。',
        source: 'OpenAlex 2025',
        discoveredAt: now - 5.6 * D,
        inMemory: true,
        memoryNote: '问题来源，核心引用。',
      },
      {
        id: 'paper_nr_02',
        soulId,
        paperId: 'W_adaptive_chunk_2024',
        title: 'Uncertainty-Aware Action Chunking for Efficient Visuomotor Policies',
        year: 2024,
        authors: ['L. Wen', 'M. Zhao', 'K. Ito'],
        abstract: '依据策略不确定性动态调整 action chunk 长度的机制。',
        matchedGap: '提供了待校准的不确定性信号来源。',
        relatedPetalId: 'petal_nr_02',
        relationType: 'method' as const,
        reason: '本工作在该机制之上加噪声校准层。',
        keyMechanism: 'ensemble disagreement → chunk 长度。',
        source: 'arXiv 2024',
        discoveredAt: now - 5.2 * D,
        inMemory: true,
        memoryNote: '方法基础。',
      },
      {
        id: 'paper_nr_03',
        soulId,
        paperId: 'W_action_chunking_survey_2023',
        title: 'A Survey on Action Chunking in Imitation Learning',
        year: 2023,
        authors: ['R. Müller', 'T. Nguyen'],
        abstract: '综述 action chunking 的设计空间与常见超参选择。',
        matchedGap: '背景。',
        relatedPetalId: null,
        relationType: 'background' as const,
        reason: '确认固定 horizon 是领域默认。',
        keyMechanism: '固定 horizon 的经验选择准则。',
        source: 'OpenAlex 2023',
        discoveredAt: now - 5.8 * D,
        inMemory: true,
        memoryNote: '背景。',
      },
    ],
    reviews: [],
    timeline: [
      { id: 'ev_nr_1', soulId, type: 'SOUL_CREATED' as const, actor: 'user' as const, summary: '研究想法诞生：Noise-Robust Chunk Selection', at: now - 6 * D },
      { id: 'ev_nr_2', soulId, type: 'BASELINE_ADDED' as const, actor: 'user' as const, summary: 'Baseline 根系延伸：Fixed Horizon = 16', at: now - 5.7 * D },
      { id: 'ev_nr_3', soulId, type: 'PAPER_DISCOVERED' as const, actor: 'agent' as const, summary: 'Paper Scout 检索到 3 篇相关工作', at: now - 5.2 * D },
      { id: 'ev_nr_4', soulId, type: 'DESIGN_ACCEPTED' as const, actor: 'agent' as const, summary: '实验设计成立，长出候选花瓣：Noise-calibrated adaptive horizon', at: now - 4 * D },
      { id: 'ev_nr_5', soulId, type: 'EVIDENCE_CONTRADICTORY' as const, actor: 'user' as const, summary: '实验结果削弱原结论，长出黄叶：校准在 σ<0.1 时反而降低成功率', at: now - 2 * D },
    ],
  };
}

/** 3D Gaussian Splatting for RL —— 另一块花圃，让花园有第二个方向 */
function createGaussianSplatDoc(): SoulDoc {
  const now = Date.now();
  const soulId = 'soul_gaussian_splat';
  const angles = petalAngles(2);
  const layout0 = leafLayout(0);

  return {
    soul: {
      id: soulId,
      title: '3D Gaussian Splatting for RL',
      rawIdea: '用 3D Gaussian Splatting 重建的场景表示直接喂给 RL policy，替代点云与深度图。',
      researchQuestion: '在同等训练预算下，Gaussian Splatting 场景表示能否比点云提升 RL policy 的样本效率？',
      hypothesis: 'Gaussian Splatting 表示可使样本效率提升 ≥25%，且渲染开销可接受。',
      independentVariable: '场景表示（point cloud vs 3D Gaussian Splatting）',
      dependentMetrics: ['sample_efficiency', 'render_ms'],
      openQuestions: ['渲染开销是否会抵消样本效率收益？', '动态场景下是否需要重建？'],
      mainGap: 'RL 场景表示仍以点云/深度图为主，缺少 Gaussian Splatting 在闭环控制中的系统评测。',
      mechanismChain: ['Observation', 'Gaussian Scene', 'Policy', 'Action'],
      status: 'WaitingForResult',
      createdAt: now - 11 * D,
    },
    baselines: [
      { id: 'base_gs_pc', soulId, index: 0, name: 'Point cloud + PointNet', value: 'baseline', reason: 'RL 场景表示的领域默认。', bound: true, sourcePaperId: null, protocol: '同分辨率、同 policy 网络。' },
    ],
    experiments: [
      {
        id: 'exp_gs_01',
        soulId,
        index: 1,
        title: 'Sample efficiency: GS vs point cloud',
        goal: '比较两种场景表示下的样本效率，并测量渲染开销。',
        hypothesis: 'GS 表示样本效率更高，且渲染开销可接受。',
        baseline: { name: 'Point cloud + PointNet', value: 'baseline' },
        treatment: { name: 'Gaussian Splatting encoder', value: 'gaussian', range: [] },
        controlledVariables: ['policy network', 'task set', 'seed'],
        metrics: ['sample_efficiency', 'render_ms'],
        expectedObservation: '样本效率提升，渲染开销小幅上升。',
        mainRisk: '渲染开销在高频控制下不可接受。',
        status: 'reviewed' as const,
        createdAt: now - 5 * D,
        result: {
          fileName: 'gs_vs_pc.xlsx',
          rows: 200,
          mapping: { groupColumn: 'encoder', baselineLabel: 'pointcloud', treatmentLabel: 'gaussian', metricColumns: ['sample_efficiency', 'render_ms'] },
          stats: [
            {
              metric: 'sample_efficiency',
              baseline: { mean: 0.42, std: 0.05, n: 100 },
              treatment: { mean: 0.58, std: 0.06, n: 100 },
              delta: 0.16,
              deltaPercent: 38.1,
            },
            {
              metric: 'render_ms',
              baseline: { mean: 4.1, std: 0.6, n: 100 },
              treatment: { mean: 21.7, std: 2.9, n: 100 },
              delta: 17.6,
              deltaPercent: 429.3,
            },
          ],
          humanView: '样本效率确实高 38%，但渲染 21.7ms 远超 12ms 预算，闭环根本跑不起来。',
          submittedAt: now - 3.4 * D,
        },
      },
      {
        id: 'exp_gs_02',
        soulId,
        index: 2,
        title: 'Pre-rendered key-view cache @ 30Hz',
        goal: '把光栅化移出控制回路，验证渲染开销能否回到预算内。',
        hypothesis: '预渲染关键视角缓存后，控制回路内渲染开销降到 4ms 以内，样本效率收益得以保留。',
        baseline: { name: 'Point cloud + PointNet', value: 'baseline' },
        treatment: { name: 'GS + key-view cache', value: 'cached', range: [] },
        controlledVariables: ['policy network', 'task set', 'seed', 'control freq = 30Hz'],
        metrics: ['sample_efficiency', 'render_ms'],
        expectedObservation: 'render_ms 回到预算内，样本效率收益大部分保留。',
        mainRisk: '缓存视角覆盖不足时，策略在未见视角上退化。',
        status: 'designAccepted' as const,
        createdAt: now - 2 * D,
        result: null,
      },
    ],
    petals: [
      { id: 'petal_gs_01', soulId, experimentId: 'exp_gs_01', index: 0, label: 'Sample eff +38%, render ×5.3', status: 'withdrawn' as const, angle: angles[0], withdrawnReason: 'Contradicted by evidence' },
      { id: 'petal_gs_02', soulId, experimentId: 'exp_gs_02', index: 1, label: 'Cached key-views: waiting', status: 'candidate' as const, angle: angles[1] },
    ],
    leaves: [
      {
        id: 'leaf_gs_01',
        soulId,
        experimentId: 'exp_gs_01',
        index: 0,
        label: '渲染开销在 30Hz 控制下超预算',
        status: 'warning' as const,
        angle: 0,
        attachY: layout0.attachY,
        side: layout0.side,
        failureCondition: '当控制频率 ≥30Hz 时，Gaussian 光栅化耗时超过 12ms 预算，闭环无法维持。',
        aiJudgement: '样本效率的收益被渲染开销抵消，需要降分辨率或多视角缓存才能成立。',
        userJudgement: '',
        nextSteps: '尝试预渲染关键视角缓存，把光栅化移出控制回路。',
        createdAt: now - 3 * D,
      },
    ],
    papers: [
      {
        id: 'paper_gs_01',
        soulId,
        paperId: 'W_gs_3d_2023',
        title: '3D Gaussian Splatting for Real-Time Radiance Field Rendering',
        year: 2023,
        authors: ['B. Kerbl', 'G. Kopanas', 'T. Leimkühler', 'G. Drettakis'],
        abstract: '用各向异性 3D 高斯表示场景，实现实时高质量辐射场渲染。',
        matchedGap: '提供了本 Soul 所依赖的场景表示与实时渲染能力。',
        relatedPetalId: null,
        relationType: 'method' as const,
        reason: '方法基础，也是渲染开销的来源。',
        keyMechanism: '各向异性高斯 + 可微光栅化。',
        source: 'arXiv 2023',
        discoveredAt: now - 9 * D,
        inMemory: true,
        memoryNote: '方法基础引用。',
      },
    ],
    reviews: [],
    timeline: [
      { id: 'ev_gs_1', soulId, type: 'SOUL_CREATED' as const, actor: 'user' as const, summary: '研究想法诞生：3D Gaussian Splatting for RL', at: now - 11 * D },
      { id: 'ev_gs_2', soulId, type: 'BASELINE_ADDED' as const, actor: 'user' as const, summary: 'Baseline 根系延伸：Point cloud + PointNet', at: now - 10 * D },
      { id: 'ev_gs_3', soulId, type: 'PAPER_DISCOVERED' as const, actor: 'agent' as const, summary: 'Paper Scout 检索到 1 篇相关工作', at: now - 9 * D },
      { id: 'ev_gs_4', soulId, type: 'EVIDENCE_CONTRADICTORY' as const, actor: 'user' as const, summary: '实验结果削弱原结论，长出黄叶：渲染开销在 30Hz 控制下超预算', at: now - 3.4 * D },
      { id: 'ev_gs_5', soulId, type: 'DESIGN_ACCEPTED' as const, actor: 'agent' as const, summary: '实验设计成立，长出候选花瓣：Pre-rendered key-view cache @ 30Hz', at: now - 2 * D },
    ],
  };
}

/** 完整 Seed 花园：主花在前，其余按成熟度递减 */
export function createSeedGarden(): SoulDoc[] {
  return [
    createSeedDoc(),
    createTemporalPolicyDoc(),
    createEfficientVlaDoc(),
    createNoiseRobustDoc(),
    createGaussianSplatDoc(),
    createUncertaintyVlaDoc(),
  ];
}
