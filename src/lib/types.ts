/**
 * Soul Lab — 领域实体定义
 * 所有状态变更只能通过 soul-machine 的事件完成。
 */

export type Actor = 'user' | 'agent';

export type SoulStatus =
  | 'Growing'
  | 'WaitingForResult'
  | 'ReviewNeeded'
  | 'PaperReady'
  | 'Archived';

/** 花瓣：候选 → 实体 → 不足 → 撤回 */
export type PetalStatus = 'candidate' | 'solid' | 'insufficient' | 'withdrawn';

/** 黄叶：警告 → 已解决 → 归档 */
export type LeafStatus = 'warning' | 'resolved' | 'archived';

export type ExperimentStatus =
  | 'proposed'
  | 'designAccepted'
  | 'resultSubmitted'
  | 'reviewed'
  | 'rejected'
  | 'invalid';

export interface MetricStat {
  metric: string;
  baseline: { mean: number; std: number; n: number };
  treatment: { mean: number; std: number; n: number };
  delta: number;
  deltaPercent: number;
}

export interface ResultMapping {
  groupColumn: string;
  baselineLabel: string;
  treatmentLabel: string;
  metricColumns: string[];
}

export interface ExperimentResult {
  fileName?: string;
  rows: number;
  mapping: ResultMapping;
  stats: MetricStat[];
  humanView?: string;
  submittedAt: number;
  /** Instrument Workshop：数学仪器层的 Evidence Package（LLM 看到的是它，不是原始数据） */
  evidencePackage?: import('../../shared/schemas').EvidencePackage;
}

export interface Soul {
  id: string;
  title: string;
  rawIdea: string;
  researchQuestion: string;
  hypothesis: string;
  independentVariable: string;
  dependentMetrics: string[];
  openQuestions: string[];
  mainGap: string;
  mechanismChain: string[];
  status: SoulStatus;
  createdAt: number;
}

export interface Baseline {
  id: string;
  soulId: string;
  index: number;
  name: string;
  value: string;
  reason: string;
  /** 绑定论文 / 配置 / 实验协议后根部变粗并显示标签 */
  bound: boolean;
  sourcePaperId?: string | null;
  protocol?: string;
}

export interface Experiment {
  id: string;
  soulId: string;
  index: number;
  title: string;
  goal: string;
  hypothesis: string;
  baseline: { name: string; value: string };
  treatment: { name: string; value: string; range: Array<number | string> };
  controlledVariables: string[];
  metrics: string[];
  expectedObservation: string;
  mainRisk: string;
  status: ExperimentStatus;
  result?: ExperimentResult | null;
  createdAt: number;
}

export interface Petal {
  id: string;
  soulId: string;
  experimentId: string;
  index: number;
  label: string;
  status: PetalStatus;
  /** State Engine 计算出的确定性布局角度（AI 永不输出此值） */
  angle: number;
  solidifiedAt?: number;
  withdrawnReason?: string;
}

export interface EvidenceLeaf {
  id: string;
  soulId: string;
  experimentId: string;
  index: number;
  label: string;
  status: LeafStatus;
  angle: number;
  attachY: number;
  side: 1 | -1;
  failureCondition: string;
  aiJudgement: string;
  userJudgement: string;
  nextSteps: string;
  createdAt: number;
}

export interface PaperInsight {
  id: string;
  soulId: string;
  paperId: string;
  title: string;
  year: number;
  authors: string[];
  abstract: string;
  matchedGap: string;
  relatedPetalId: string | null;
  relationType: 'background' | 'supporting' | 'conflicting' | 'method';
  reason: string;
  keyMechanism: string;
  source: string;
  discoveredAt: number;
  inMemory: boolean;
  memoryNote?: string;
}

export interface Review {
  id: string;
  soulId: string;
  targetType: 'design' | 'evidence';
  targetId: string;
  verdict: string;
  rationale: string;
  dataBrief?: string;
  aiView?: string;
  humanView?: string;
  conditions?: string[];
  confidence?: number;
  suggestedNext?: string;
  actor: Actor;
  createdAt: number;
}

export interface TimelineEvent {
  id: string;
  soulId: string;
  type: SoulEventType;
  actor: Actor;
  summary: string;
  at: number;
  payload?: Record<string, unknown>;
}

export interface SoulDoc {
  soul: Soul;
  baselines: Baseline[];
  experiments: Experiment[];
  petals: Petal[];
  leaves: EvidenceLeaf[];
  papers: PaperInsight[];
  reviews: Review[];
  timeline: TimelineEvent[];
}

/* ==================== State Engine 事件 ==================== */

export type SoulEventType =
  | 'SOUL_CREATED'
  | 'BASELINE_ADDED'
  | 'EXPERIMENT_PROPOSED'
  | 'DESIGN_ACCEPTED'
  | 'DESIGN_REJECTED'
  | 'RESULT_SUBMITTED'
  | 'EVIDENCE_ACCEPTED'
  | 'EVIDENCE_INSUFFICIENT'
  | 'EVIDENCE_CONTRADICTORY'
  | 'EVIDENCE_INVALID'
  | 'PETAL_WITHDRAWN'
  | 'LEAF_RESOLVED'
  | 'PAPER_DISCOVERED'
  | 'PAPER_ADDED_TO_MEMORY';

export interface SoulEventBase {
  actor?: Actor;
  at?: number;
}

export type SoulEvent = SoulEventBase &
  (
    | { type: 'SOUL_CREATED'; soul: Soul; baselines?: Baseline[] }
    | { type: 'BASELINE_ADDED'; baseline: Baseline }
    | { type: 'EXPERIMENT_PROPOSED'; experiment: Experiment }
    | { type: 'DESIGN_ACCEPTED'; experimentId: string; petal: Petal; baseline?: Baseline }
    | { type: 'DESIGN_REJECTED'; experimentId: string; reason: string }
    | { type: 'RESULT_SUBMITTED'; experimentId: string; result: ExperimentResult }
    | {
        type: 'EVIDENCE_ACCEPTED';
        experimentId: string;
        review: Omit<Review, 'id' | 'soulId' | 'createdAt' | 'targetType' | 'targetId' | 'actor'>;
      }
    | {
        type: 'EVIDENCE_INSUFFICIENT';
        experimentId: string;
        review: Omit<Review, 'id' | 'soulId' | 'createdAt' | 'targetType' | 'targetId' | 'actor'>;
      }
    | {
        type: 'EVIDENCE_CONTRADICTORY';
        experimentId: string;
        review: Omit<Review, 'id' | 'soulId' | 'createdAt' | 'targetType' | 'targetId' | 'actor'>;
        leaf: Omit<EvidenceLeaf, 'id' | 'soulId' | 'status' | 'angle' | 'attachY' | 'side' | 'createdAt'>;
      }
    | {
        type: 'EVIDENCE_INVALID';
        experimentId: string;
        review: Omit<Review, 'id' | 'soulId' | 'createdAt' | 'targetType' | 'targetId' | 'actor'>;
      }
    | { type: 'PETAL_WITHDRAWN'; petalId: string; reason: string }
    | { type: 'LEAF_RESOLVED'; leafId: string; note: string }
    | { type: 'PAPER_DISCOVERED'; papers: Array<Omit<PaperInsight, 'id' | 'soulId' | 'discoveredAt' | 'inMemory'>> }
    | { type: 'PAPER_ADDED_TO_MEMORY'; paperId: string; note?: string }
  );
