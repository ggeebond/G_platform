/**
 * Soul Lab — Frontier 层领域类型（FR-M11 ~ M15）
 *
 * 外循环：GLOBAL RESEARCH WORLD → Frontier Agent → New Knowledge
 *        → 分流 Existing Soul（影响 Claim/Gap）/ New Opportunity（新 Bud）。
 * 全部为语义类型；任何视觉数值仍由 State Engine / 渲染层映射，AI 不参与。
 */

export type OrbIdentity = 'related' | 'signal' | 'challenge' | 'opportunity';

export type SignalLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export type WhyNowKind = 'trend' | 'first' | 'conflict' | 'benchmark';

/** Signal 影响的对象：具体到某个 Claim / Boundary / Gap（禁止「与你方向相关」式泛化） */
export interface FrontierTarget {
  type: 'claim' | 'boundary' | 'gap';
  id: string | null;
  label: string;
}

export type FrontierActionType =
  | 'add_baseline'
  | 'read_section'
  | 'add_ablation'
  | 'plant_idea'
  | 'verify_long_horizon'
  | 'watch'
  | 'ignore';

export interface FrontierAction {
  type: FrontierActionType;
  detail: string;
}

/** 四问（FR-M3）+ Why Now（FR-M14） */
export interface FrontierSignal {
  id: string;
  soulId: string;
  soulTitle: string;
  level: SignalLevel;
  paperId: string;
  title: string;
  orbIdentity: OrbIdentity;
  /** 关键机制（用于机制级 Novelty 记忆） */
  mechanismKey: string;
  /** What changed */
  whatChanged: string;
  /** Why does it matter to me —— 必须指向具体对象 */
  whyMatters: FrontierTarget;
  /** What is different */
  whatIsDifferent: { yours: string; theirs: string };
  /** What should I do */
  whatToDo: FrontierAction;
  /** Why now */
  whyNow: { kind: WhyNowKind; detail: string };
}

/** FR-M13：状态驱动的检索计划 */
export interface QueryPlan {
  soulId: string;
  queries: string[];
}

/** FR-M12：研究记忆（防重复推送的地基） */
export interface ResearchMemory {
  seenPaperIds: string[];
  knownMechanisms: string[];
  pushedSignalIds: string[];
}

export interface NoveltyDecision {
  paperId: string;
  novel: boolean;
  reason: string;
}

export interface FrontierScanResult {
  scanned: number;
  relevant: number;
  affecting: number;
  /** 被 Novelty Gate 挡下的候选数量 */
  filtered: number;
  signals: FrontierSignal[];
  queries: QueryPlan[];
}

/** FR-M15：Morning Research Brief */
export interface BriefSoulLine {
  soulId: string;
  soulTitle: string;
  highPriority: number;
  signals: number;
  relatedPapers: number;
  challenges: number;
  possibleBaselines: number;
  mostUsefulNext: string | null;
  /** 今日无实质变化时的「明说」分支 */
  quiet: boolean;
}

export interface MorningBrief {
  generatedAt: number;
  totals: { scanned: number; relevant: number; affecting: number };
  lines: BriefSoulLine[];
}

/** FR-M7：30 天趋势（Emerging Direction） */
export interface Trend {
  name: string;
  paperCount: number;
  commonIdea: string;
  relationToSoul: 'High' | 'Med' | 'Low';
}
