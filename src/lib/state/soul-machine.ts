/**
 * Soul Lab — State Engine（确定性状态机）
 *
 * 唯一输入：SoulEvent。唯一输出：新的 SoulDoc（含 TimelineEvent）。
 * 不解析自由文本，不接受 AI 的视觉数值。
 */
import { uid } from '../utils/id';
import type {
  Actor,
  Baseline,
  Experiment,
  EvidenceLeaf,
  PaperInsight,
  Petal,
  Review,
  Soul,
  SoulDoc,
  SoulEvent,
  SoulStatus,
  TimelineEvent,
} from '../types';

/** 花瓣布局角度：State Engine 计算，AI 不参与 */
export function petalAngles(count: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [0];
  const span = 142;
  const step = span / (count - 1);
  return Array.from({ length: count }, (_, i) => -span / 2 + i * step);
}

export function leafLayout(index: number) {
  return {
    attachY: 332 + index * 44,
    side: (index % 2 === 0 ? 1 : -1) as 1 | -1,
  };
}

function recomputePetals(petals: Petal[]): Petal[] {
  const angles = petalAngles(petals.length);
  return petals.map((p, i) => ({ ...p, index: i, angle: angles[i] }));
}

function makeReview(
  soulId: string,
  targetType: Review['targetType'],
  targetId: string,
  actor: Actor,
  payload: Omit<Review, 'id' | 'soulId' | 'createdAt' | 'targetType' | 'targetId' | 'actor'>,
): Review {
  return {
    id: uid('rev'),
    soulId,
    targetType,
    targetId,
    actor,
    createdAt: Date.now(),
    ...payload,
  };
}

export function deriveSoulStatus(doc: SoulDoc): SoulStatus {
  if (doc.experiments.some((e) => e.status === 'resultSubmitted')) return 'ReviewNeeded';
  if (doc.experiments.some((e) => e.status === 'designAccepted')) return 'WaitingForResult';
  if (doc.papers.some((p) => !p.inMemory)) return 'PaperReady';
  return 'Growing';
}

function withStatus(doc: SoulDoc): SoulDoc {
  const status = deriveSoulStatus(doc);
  if (doc.soul.status === status) return doc;
  return { ...doc, soul: { ...doc.soul, status } };
}

function event(
  soulId: string,
  type: TimelineEvent['type'],
  actor: Actor,
  summary: string,
  at: number,
  payload?: Record<string, unknown>,
): TimelineEvent {
  return { id: uid('ev'), soulId, type, actor, summary, at, payload };
}

/**
 * 纯函数：应用一个事件。
 * 任何非法输入都被视为无操作（返回原 doc），保证「Agent 输出不合法时不改变状态」。
 */
export function applyEvent(doc: SoulDoc, raw: SoulEvent): SoulDoc {
  if (!raw || !raw.type) return doc;
  const at = raw.at ?? Date.now();
  const actor: Actor = raw.actor ?? 'user';
  const soulId = doc.soul.id;

  switch (raw.type) {
    case 'SOUL_CREATED': {
      const soul: Soul = { ...raw.soul, status: 'Growing' };
      const baselines = (raw.baselines ?? []).map((b, i) => ({ ...b, index: i }));
      return withStatus({
        soul,
        baselines,
        experiments: [],
        petals: [],
        leaves: [],
        papers: [],
        reviews: [],
        timeline: [
          event(soulId, 'SOUL_CREATED', actor, `研究想法诞生：${soul.title}`, at, { title: soul.title }),
        ],
      });
    }

    case 'BASELINE_ADDED': {
      const exists = doc.baselines.some((b) => b.name === raw.baseline.name && b.value === raw.baseline.value);
      if (exists) return doc;
      const baseline: Baseline = { ...raw.baseline, index: doc.baselines.length };
      return withStatus({
        ...doc,
        baselines: [...doc.baselines, baseline],
        timeline: [
          ...doc.timeline,
          event(soulId, 'BASELINE_ADDED', actor, `Baseline 根系延伸：${baseline.name} = ${baseline.value}`, at, {
            baselineId: baseline.id,
          }),
        ],
      });
    }

    case 'EXPERIMENT_PROPOSED': {
      const experiment: Experiment = { ...raw.experiment, result: null };
      return withStatus({
        ...doc,
        experiments: [...doc.experiments, experiment],
        timeline: [
          ...doc.timeline,
          event(soulId, 'EXPERIMENT_PROPOSED', actor, `实验提案：${experiment.title}`, at, {
            experimentId: experiment.id,
          }),
        ],
      });
    }

    case 'DESIGN_ACCEPTED': {
      const experiments = doc.experiments.map((e) =>
        e.id === raw.experimentId ? { ...e, status: 'designAccepted' as const } : e,
      );
      const petals = recomputePetals([
        ...doc.petals,
        { ...raw.petal, index: doc.petals.length, status: 'candidate' as const },
      ]);
      let baselines = doc.baselines;
      if (raw.baseline && !baselines.some((b) => b.name === raw.baseline!.name)) {
        baselines = [...baselines, { ...raw.baseline, index: baselines.length }];
      }
      const exp = experiments.find((e) => e.id === raw.experimentId);
      return withStatus({
        ...doc,
        experiments,
        petals,
        baselines,
        timeline: [
          ...doc.timeline,
          event(soulId, 'DESIGN_ACCEPTED', actor, `实验设计成立，长出候选花瓣：${exp?.title ?? ''}`, at, {
            experimentId: raw.experimentId,
            petalId: raw.petal.id,
          }),
        ],
      });
    }

    case 'DESIGN_REJECTED': {
      const experiments = doc.experiments.map((e) =>
        e.id === raw.experimentId ? { ...e, status: 'rejected' as const } : e,
      );
      return withStatus({
        ...doc,
        experiments,
        timeline: [
          ...doc.timeline,
          event(soulId, 'DESIGN_REJECTED', actor, `实验设计未通过：${raw.reason.slice(0, 60)}`, at, {
            experimentId: raw.experimentId,
          }),
        ],
      });
    }

    case 'RESULT_SUBMITTED': {
      const experiments = doc.experiments.map((e) =>
        e.id === raw.experimentId
          ? { ...e, status: 'resultSubmitted' as const, result: raw.result }
          : e,
      );
      return withStatus({
        ...doc,
        experiments,
        timeline: [
          ...doc.timeline,
          event(soulId, 'RESULT_SUBMITTED', actor, `实验结果已提交（${raw.result.rows} 行）`, at, {
            experimentId: raw.experimentId,
          }),
        ],
      });
    }

    case 'EVIDENCE_ACCEPTED': {
      const review = makeReview(soulId, 'evidence', raw.experimentId, actor, raw.review);
      const experiments = doc.experiments.map((e) =>
        e.id === raw.experimentId ? { ...e, status: 'reviewed' as const } : e,
      );
      const petals = doc.petals.map((p) =>
        p.experimentId === raw.experimentId
          ? { ...p, status: 'solid' as const, solidifiedAt: at }
          : p,
      );
      return withStatus({
        ...doc,
        experiments,
        petals,
        reviews: [...doc.reviews, review],
        timeline: [
          ...doc.timeline,
          event(soulId, 'EVIDENCE_ACCEPTED', actor, '证据审议通过，花瓣实体化', at, {
            experimentId: raw.experimentId,
          }),
        ],
      });
    }

    case 'EVIDENCE_INSUFFICIENT': {
      const review = makeReview(soulId, 'evidence', raw.experimentId, actor, raw.review);
      const experiments = doc.experiments.map((e) =>
        e.id === raw.experimentId ? { ...e, status: 'designAccepted' as const } : e,
      );
      const petals = doc.petals.map((p) =>
        p.experimentId === raw.experimentId ? { ...p, status: 'insufficient' as const } : p,
      );
      return withStatus({
        ...doc,
        experiments,
        petals,
        reviews: [...doc.reviews, review],
        timeline: [
          ...doc.timeline,
          event(soulId, 'EVIDENCE_INSUFFICIENT', actor, '证据不足，花瓣保持虚幻', at, {
            experimentId: raw.experimentId,
          }),
        ],
      });
    }

    case 'EVIDENCE_CONTRADICTORY': {
      const review = makeReview(soulId, 'evidence', raw.experimentId, actor, raw.review);
      const experiments = doc.experiments.map((e) =>
        e.id === raw.experimentId ? { ...e, status: 'reviewed' as const } : e,
      );
      const petals = doc.petals.map((p) =>
        p.experimentId === raw.experimentId
          ? { ...p, status: 'withdrawn' as const, withdrawnReason: 'Contradicted by evidence' }
          : p,
      );
      const layout = leafLayout(doc.leaves.length);
      const leaf: EvidenceLeaf = {
        id: uid('leaf'),
        soulId,
        status: 'warning',
        angle: 0,
        createdAt: at,
        ...layout,
        ...raw.leaf,
      };
      return withStatus({
        ...doc,
        experiments,
        petals,
        leaves: [...doc.leaves, leaf],
        reviews: [...doc.reviews, review],
        timeline: [
          ...doc.timeline,
          event(soulId, 'EVIDENCE_CONTRADICTORY', actor, `实验结果削弱原结论，长出黄叶：${leaf.label}`, at, {
            experimentId: raw.experimentId,
            leafId: leaf.id,
          }),
        ],
      });
    }

    case 'EVIDENCE_INVALID': {
      const review = makeReview(soulId, 'evidence', raw.experimentId, actor, raw.review);
      const experiments = doc.experiments.map((e) =>
        e.id === raw.experimentId ? { ...e, status: 'invalid' as const } : e,
      );
      const petals = doc.petals.map((p) =>
        p.experimentId === raw.experimentId
          ? { ...p, status: 'withdrawn' as const, withdrawnReason: 'Experiment invalid' }
          : p,
      );
      return withStatus({
        ...doc,
        experiments,
        petals,
        reviews: [...doc.reviews, review],
        timeline: [
          ...doc.timeline,
          event(soulId, 'EVIDENCE_INVALID', actor, '实验无效，仅保留实验记录', at, {
            experimentId: raw.experimentId,
          }),
        ],
      });
    }

    case 'PETAL_WITHDRAWN': {
      const petals = doc.petals.map((p) =>
        p.id === raw.petalId
          ? { ...p, status: 'withdrawn' as const, withdrawnReason: raw.reason }
          : p,
      );
      if (petals.every((p, i) => p.status === doc.petals[i].status)) return doc;
      return withStatus({
        ...doc,
        petals,
        timeline: [
          ...doc.timeline,
          event(soulId, 'PETAL_WITHDRAWN', actor, `研究者撤回花瓣：${raw.reason.slice(0, 50)}`, at, {
            petalId: raw.petalId,
          }),
        ],
      });
    }

    case 'LEAF_RESOLVED': {
      const leaves = doc.leaves.map((l) =>
        l.id === raw.leafId ? { ...l, status: 'resolved' as const, userJudgement: raw.note } : l,
      );
      return withStatus({
        ...doc,
        leaves,
        timeline: [
          ...doc.timeline,
          event(soulId, 'LEAF_RESOLVED', actor, `黄叶标记为解决：${raw.note.slice(0, 50)}`, at, {
            leafId: raw.leafId,
          }),
        ],
      });
    }

    case 'PAPER_DISCOVERED': {
      const existing = new Set(doc.papers.map((p) => p.paperId));
      const fresh = raw.papers.filter((p) => !existing.has(p.paperId));
      if (fresh.length === 0) return doc;
      const papers: PaperInsight[] = fresh.map((p) => ({
        ...p,
        id: uid('paper'),
        soulId,
        discoveredAt: at,
        inMemory: false,
      }));
      return withStatus({
        ...doc,
        papers: [...doc.papers, ...papers],
        timeline: [
          ...doc.timeline,
          event(soulId, 'PAPER_DISCOVERED', actor, `Paper Scout 检索到 ${papers.length} 篇相关工作`, at, {
            paperIds: papers.map((p) => p.paperId),
          }),
        ],
      });
    }

    case 'PAPER_ADDED_TO_MEMORY': {
      const target = doc.papers.find((p) => p.paperId === raw.paperId);
      if (!target || target.inMemory) return doc;
      const papers = doc.papers.map((p) =>
        p.paperId === raw.paperId ? { ...p, inMemory: true, memoryNote: raw.note } : p,
      );
      return withStatus({
        ...doc,
        papers,
        timeline: [
          ...doc.timeline,
          event(soulId, 'PAPER_ADDED_TO_MEMORY', actor, `论文加入 Soul Memory：${target.title}`, at, {
            paperId: raw.paperId,
          }),
        ],
      });
    }

    default:
      return doc;
  }
}

export function applyEvents(doc: SoulDoc, events: SoulEvent[]): SoulDoc {
  return events.reduce(applyEvent, doc);
}
