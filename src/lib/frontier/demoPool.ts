/**
 * Soul Lab — Frontier 演示论文池
 *
 * 演示环境不接线实时检索（无 MCP / 无 API Key），用一份静态候选集驱动外循环，
 * 保证「已看过不被重推」「四身份 Orb」「Why Now」都能在演示里复现。
 * 真实链路下，这份 source 由后端从 OpenAlex / arXiv 拉取后注入 runFrontierLoop。
 */
import type { PaperMatch } from '../../../shared/schemas';

export const frontierDemoPool: PaperMatch[] = [
  {
    paperId: 'FX_uncertainty_temporal_2026',
    title: 'Uncertainty-Conditioned Temporal Action Prediction',
    year: 2026,
    authors: ['R. Nkemelu', 'Y. Chen', 'D. Wang'],
    abstract: '使用不确定性信号动态调整 temporal prediction range，替代固定规则调整 horizon。',
    matchedGap: '「什么时候缩短 horizon」缺少可学习信号',
    relatedPetalId: null,
    relationType: 'supporting',
    reason: '与当前机制链互补：你用的是规则式 horizon 调整，它用的是可学习的不确定性信号。',
    keyMechanism: 'learned uncertainty → temporal range controller',
    source: 'arXiv (demo)',
  },
  {
    paperId: 'FX_longhorizon_degrade_2026',
    title: 'Dynamic Temporal Policies Degrade on Long Manipulation Sequences',
    year: 2026,
    authors: ['S. Alvarez', 'T. Mori'],
    abstract: '报告动态 temporal policy 在长程操作序列上性能显著下降，并给出失败条件分析。',
    matchedGap: '长程任务下 dynamic horizon 的稳定性',
    relatedPetalId: null,
    relationType: 'conflicting',
    reason: '该结论与你「动态 horizon 不影响成功率」的主张在长程条件下不一致。',
    keyMechanism: 'dynamic temporal policy → long-horizon instability',
    source: 'OpenAlex (demo)',
  },
  {
    paperId: 'FX_variable_chunk_vla_2026',
    title: 'Variable Action Chunking for Efficient VLA Inference',
    year: 2026,
    authors: ['H. Ito', 'L. Zhang'],
    abstract: '提出变长 action chunk 机制，在保持精度的同时降低推理成本。',
    matchedGap: '降低 inference cost 的另一条路线',
    relatedPetalId: null,
    relationType: 'method',
    reason: '它不是动态 horizon，但提供了另一种降低推理成本的机制，可作为新 baseline。',
    keyMechanism: 'variable chunk length → inference cost',
    source: 'arXiv (demo)',
  },
  {
    paperId: 'FX_diffusion_policy_2023',
    title: 'Diffusion Policy: Visuomotor Policy Learning via Action Diffusion',
    year: 2023,
    authors: ['C. Chi', 'et al.'],
    abstract: '经典 diffusion policy 工作。',
    matchedGap: '背景',
    relatedPetalId: null,
    relationType: 'background',
    reason: '广泛已知的经典方法，应被 Research Memory 记住而不再重复推送。',
    keyMechanism: 'diffusion policy',
    source: 'arXiv (demo)',
  },
];
