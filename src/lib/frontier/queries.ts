/**
 * Soul Lab — Query Expansion（FR-M13）
 *
 * 检索 Query 不能只有关键词。基于 Soul 的标题 / 研究问题 / Gap / 机制链扩展同义、邻域与机制查询；
 * 若存在黄叶（失败条件），额外生成针对失败条件的查询。
 *
 * 纯确定性：不调用 LLM，产出可追溯、可测试。
 */
import type { SoulDoc } from '../types';
import type { QueryPlan } from './types';

interface ExpansionRule {
  test: RegExp;
  queries: string[];
}

/** 领域邻域扩展：让检索覆盖「机制/邻域」而不只是字面关键词 */
const DOMAIN_EXPANSIONS: ExpansionRule[] = [
  {
    test: /horizon|chunk|temporal|latency|action|control|policy|imitation/i,
    queries: [
      'dynamic temporal action prediction',
      'adaptive temporal horizon robotics',
      'uncertainty action chunking',
      'variable action chunk VLA',
      'temporal consistency robot policy',
      'adaptive inference length robotics',
    ],
  },
  {
    test: /uncertain|robust|noise|calibrat|risk|safety/i,
    queries: [
      'uncertainty-aware action generation',
      'calibrated uncertainty robot policy',
      'risk-aware robot control policy',
    ],
  },
  {
    test: /gaussian|splat|3d|perception|vision|slam|nerf|point cloud/i,
    queries: ['gaussian splatting robot perception', 'real-time 3d scene reconstruction for manipulation'],
  },
];

/** 黄叶（失败条件）扩展：把「哪里失败过」变成检索方向 */
const FAILURE_EXPANSIONS: ExpansionRule[] = [
  {
    test: /long[\s-]?horizon|长程|时间尺度|instability/i,
    queries: [
      'long horizon instability action policy',
      'temporal action chunk stability',
      'robot policy horizon ablation',
    ],
  },
  {
    test: /noise|噪声|robust|扰动/i,
    queries: ['chunk selection under visual noise', 'uncertainty drift horizon'],
  },
];

export function generateQueries(doc: SoulDoc): QueryPlan {
  const set = new Set<string>();

  // 1) 标题作为锚点
  if (doc.soul.title) set.add(doc.soul.title.toLowerCase());

  // 2) 领域邻域扩展
  const domainText = [
    doc.soul.title,
    doc.soul.researchQuestion,
    doc.soul.mainGap,
    doc.soul.mechanismChain.join(' '),
  ].join(' ');
  for (const rule of DOMAIN_EXPANSIONS) {
    if (rule.test.test(domainText)) rule.queries.forEach((q) => set.add(q));
  }

  // 3) 黄叶失败条件驱动
  const leafText = doc.leaves.map((l) => `${l.label} ${l.failureCondition}`).join(' ');
  if (leafText.trim()) {
    for (const rule of FAILURE_EXPANSIONS) {
      if (rule.test.test(leafText)) rule.queries.forEach((q) => set.add(q));
    }
  }

  // 4) 兜底：从 Gap 抽一个可检索短语
  if (set.size <= 1 && doc.soul.mainGap) {
    set.add(`${doc.soul.mainGap.slice(0, 40)} robot learning`);
  }

  return { soulId: doc.soul.id, queries: [...set].slice(0, 12) };
}
