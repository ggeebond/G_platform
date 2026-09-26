/**
 * Soul Lab — 从真实 SoulDoc 构建 Research Garden
 *
 * Garden 是产品本体：每株花都是一个真实 SoulDoc 的形态，
 * 花瓣数、黄叶数、知识球全部来自 State Engine 的状态，没有任何手写视觉常量。
 */
import type { EvidenceLeaf, SoulDoc } from '../types';
import { LEAF_SEVERITY, STAGE } from '../balance';
import { accentFor, CLUSTER_ANCHORS, CLUSTER_LABELS, CLUSTER_ORDER, hashUnit, plotPosition } from './layout';
import type { GardenCluster, GardenModel, GardenPlot, LineageEdge, SoulStage } from './types';

/** 已知项目的花圃归属；未知项目交给关键词分类器 */
const CLUSTER_HINTS: Record<string, string> = {
  soul_adaptive_horizon: 'temporal',
  soul_temporal_policy: 'temporal',
  soul_efficient_vla: 'temporal',
  soul_uncertainty_vla: 'uncertainty',
  soul_noise_robust: 'uncertainty',
  soul_gaussian_splat: 'perception',
};

const CLUSTER_KEYWORDS: Array<[string, RegExp]> = [
  ['temporal', /horizon|chunk|temporal|latency|action|control|policy|imitation/i],
  ['uncertainty', /uncertain|robust|noise|calibrat|risk|failure|safety/i],
  ['perception', /gaussian|splat|3d|perception|vision|slam|nerf|point cloud/i],
];

export function clusterOf(doc: SoulDoc): string {
  const hinted = CLUSTER_HINTS[doc.soul.id];
  if (hinted) return hinted;
  const text = [
    doc.soul.title,
    doc.soul.researchQuestion,
    doc.soul.mainGap,
    doc.soul.mechanismChain.join(' '),
  ].join(' ');
  for (const [cluster, re] of CLUSTER_KEYWORDS) {
    if (re.test(text)) return cluster;
  }
  return 'frontier';
}

/** 植物生命周期 —— 完全由证据结构决定 */
export function stageOf(doc: SoulDoc): SoulStage {
  const solid = doc.petals.filter((p) => p.status === 'solid').length;
  const candidates = doc.petals.filter((p) => p.status === 'candidate').length;
  const reviews = doc.reviews.filter((r) => r.verdict === 'accepted').length;

  if (
    solid >= STAGE.bloomedMinSolid &&
    candidates <= STAGE.bloomedMaxCandidates &&
    doc.leaves.length <= STAGE.bloomedMaxOpenLeaves
  )
    return 'bloomed';
  if (solid >= STAGE.matureMinSolid || (solid >= STAGE.matureAltSolid && reviews >= STAGE.matureAltAcceptedReviews))
    return 'mature';
  if (solid >= 1 || doc.experiments.length > 0) return 'growing';
  return 'bud';
}

const STAGE_RANK: Record<SoulStage, number> = { bloomed: 4, mature: 3, growing: 2, bud: 1 };

export function buildPlot(doc: SoulDoc, clusterId: string, indexInCluster: number, clusterSize: number): GardenPlot {
  const solid = doc.petals.filter((p) => p.status === 'solid').length;
  const candidate = doc.petals.filter((p) => p.status === 'candidate').length;
  const insufficient = doc.petals.filter((p) => p.status === 'insufficient').length;
  const withdrawn = doc.petals.filter((p) => p.status === 'withdrawn').length;

  return {
    id: doc.soul.id,
    title: doc.soul.title,
    stage: stageOf(doc),
    accent: accentFor(doc.soul.id),
    clusterId,
    position: plotPosition(clusterId, indexInCluster, clusterSize),
    solid,
    candidate,
    insufficient,
    withdrawn,
    leaves: doc.leaves.filter((l) => l.status === 'warning').length,
    leafResolved: doc.leaves.filter((l) => l.status !== 'warning').length,
    baselines: doc.baselines.length,
    memoryPapers: doc.papers.filter((p) => p.inMemory).length,
    freshPapers: doc.papers.filter((p) => !p.inMemory).length,
  };
}

/**
 * Research Lineage —— Garden 最大的价值：花与花之间的关系。
 *
 * 判定依据（都来自真实数据，不靠 LLM 现编）：
 *  1. 共享 Soul Memory 论文   → 同一知识基础
 *  2. 机制链词项重叠          → B extends A
 *  3. 同花圃                  → 弱关联
 */
export function detectLineages(docs: SoulDoc[], clusterOfSoul: Record<string, string>): LineageEdge[] {
  const edges: LineageEdge[] = [];

  for (let i = 0; i < docs.length; i++) {
    for (let j = i + 1; j < docs.length; j++) {
      const a = docs[i];
      const b = docs[j];

      const memA = new Set(a.papers.filter((p) => p.inMemory).map((p) => p.paperId));
      const memB = new Set(b.papers.filter((p) => p.inMemory).map((p) => p.paperId));
      const sharedPapers = [...memA].filter((id) => memB.has(id));

      const chainA = new Set(a.soul.mechanismChain.map((s) => s.toLowerCase()));
      const sharedMech = b.soul.mechanismChain.filter((s) => chainA.has(s.toLowerCase()));

      const sameCluster = clusterOfSoul[a.soul.id] === clusterOfSoul[b.soul.id];

      let relation: LineageEdge['relation'] = 'related';
      let strength = 0;
      const reasons: string[] = [];

      if (sharedPapers.length > 0) {
        strength += 0.3 + sharedPapers.length * 0.18;
        reasons.push(`${sharedPapers.length} 篇共同记忆论文`);
      }
      if (sharedMech.length > 0) {
        strength += 0.25 + sharedMech.length * 0.14;
        reasons.push(`机制链重叠：${sharedMech.slice(0, 2).join(' / ')}`);
        relation = 'extends';
      }

      // 只有「共同记忆论文」或「机制链重叠」才算实质关联。
      // 否则在共享一个小论文池的花园里，所有花都会两两相连，藤蔓会糊满画面。
      const substantive = sharedPapers.length > 0 || sharedMech.length > 0;
      if (!substantive) continue;

      // 以下只在实质关联成立时增强权重，不单独构成关联
      const citesA = a.papers.map((p) => p.paperId);
      if (citesA.some((id) => memB.has(id)) || b.papers.map((p) => p.paperId).some((id) => memA.has(id))) {
        strength += 0.2;
        reasons.push('共享检索命中');
      }
      if (sameCluster) {
        strength += 0.22;
        reasons.push('同一科研方向');
      }

      edges.push({
        id: `lin_${a.soul.id}__${b.soul.id}`,
        from: a.soul.id,
        to: b.soul.id,
        relation,
        strength: Math.min(strength, 1),
        reason: reasons.join(' · '),
      });
    }
  }

  // 控制密度：只保留最强的若干条藤蔓，花园不能被连线糊满
  return edges
    .filter((e) => e.strength >= 0.65)
    .sort((x, y) => y.strength - x.strength)
    .slice(0, 8);
}

export function buildGarden(docs: SoulDoc[]): GardenModel {
  const byId: Record<string, SoulDoc> = {};
  docs.forEach((d) => {
    byId[d.soul.id] = d;
  });

  const clusterOfSoul: Record<string, string> = {};
  const buckets: Record<string, SoulDoc[]> = {};
  for (const id of CLUSTER_ORDER) buckets[id] = [];

  for (const doc of docs) {
    const c = clusterOf(doc);
    clusterOfSoul[doc.soul.id] = c;
    (buckets[c] ??= []).push(doc);
  }

  const plots: GardenPlot[] = [];
  const clusters: GardenCluster[] = [];

  for (const clusterId of CLUSTER_ORDER) {
    const members = buckets[clusterId] ?? [];
    if (members.length === 0) continue;

    // 最成熟的居中，其余沿环铺开 —— 让花圃有「中心-外围」的层次
    members.sort((a, b) => {
      const d = STAGE_RANK[stageOf(b)] - STAGE_RANK[stageOf(a)];
      return d !== 0 ? d : hashUnit(a.soul.id) - hashUnit(b.soul.id);
    });

    members.forEach((doc, i) => {
      plots.push(buildPlot(doc, clusterId, i, members.length));
    });

    clusters.push({
      id: clusterId,
      label: members.length === 1 && clusterId === 'frontier' ? 'New Exploration' : labelFor(clusterId, members.length),
      anchor: anchorOf(clusterId),
      soulIds: members.map((d) => d.soul.id),
    });
  }

  return { plots, clusters, lineages: detectLineages(docs, clusterOfSoul), byId };
}

function anchorOf(clusterId: string): [number, number, number] {
  return CLUSTER_ANCHORS[clusterId] ?? CLUSTER_ANCHORS.frontier;
}

function labelFor(clusterId: string, count: number): string {
  return `${CLUSTER_LABELS[clusterId] ?? 'Research'} · ${count}`;
}

/* ==================== 黄叶严重程度 ==================== */

/**
 * 黄叶不是一种东西，而是三种不同的研究边界：
 *   limitation  正常限制   —— 结论在某个条件下收窄，机制本身没被推翻
 *   weakening   削弱结论   —— 有明显的反例，需要限定条件
 *   refutation  严重反证   —— 效果量足以动摇原假设
 *
 * 判定完全来自实验数据里最不利的那个指标（|deltaPercent|），
 * 不经过 AI —— 与 State Engine 的其他视觉映射同权。
 * 阈值是产品规范，写在代码里可被 review，而不是藏在模型权重里。
 */
export type LeafSeverity = 'limitation' | 'weakening' | 'refutation';

export const LEAF_SEVERITY_META: Record<LeafSeverity, { label: string; color: string; hint: string }> = {
  limitation: {
    label: '条件限制',
    color: '#86EFAC',
    hint: '结论在某个条件下收窄，机制本身仍然成立。',
  },
  weakening: {
    label: '削弱结论',
    color: '#FBBF24',
    hint: '出现了明确的反而证据，结论需要附加条件。',
  },
  refutation: {
    label: '严重反证',
    color: '#FB923C',
    hint: '效果量足以动摇原假设，需要重新审视机制。',
  },
};

export function leafSeverity(doc: SoulDoc, leaf: EvidenceLeaf): LeafSeverity {
  const exp = doc.experiments.find((e) => e.id === leaf.experimentId);
  const stats = exp?.result?.stats ?? [];
  if (stats.length === 0) return 'weakening';

  // 最不利的指标决定这片叶子的重量
  const worst = Math.max(...stats.map((s) => Math.abs(s.deltaPercent)));
  if (worst >= LEAF_SEVERITY.refutationAt) return 'refutation';
  if (worst >= LEAF_SEVERITY.weakeningAt) return 'weakening';
  return 'limitation';
}

export const STAGE_LABEL: Record<SoulStage, string> = {
  bud: 'Idea',
  growing: 'Growing',
  mature: 'Mature',
  bloomed: 'Bloomed',
};

export const STAGE_HINT: Record<SoulStage, string> = {
  bud: 'Idea stage · 还没有实验证据',
  growing: 'Growing · 证据正在积累',
  mature: 'Mature · 论证结构基本成型',
  bloomed: 'Bloomed Paper · 可以写成论文了',
};

/** 花的状态 → 花圃首页要显示的告警语 */
export function plotAlert(plot: GardenPlot): string | null {
  if (plot.candidate > 0) return `${plot.candidate} 片候选花瓣在等待结果`;
  if (plot.leaves > 0) return `${plot.leaves} 条结论边界未解决`;
  if (plot.freshPapers > 0) return `${plot.freshPapers} 篇新论文待归档`;
  return null;
}
