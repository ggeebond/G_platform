/**
 * Soul Lab — AgentBridge 契约
 * 业务组件永远不直接调用 LearnBuddy；只通过这里的结构化方法。
 */
import type { DesignVerdict, EvidencePackage, EvidenceVerdict, IdeaResult, PaperMatch } from '../../../shared/schemas';
import type { MetricStat, SoulDoc } from '../types';
import type { FrontierScanResult, MorningBrief, NoveltyDecision, ResearchMemory } from '../frontier/types';

export class ContractViolationError extends Error {
  detail?: string;
  constructor(message: string, detail?: string) {
    super(message);
    this.name = 'ContractViolationError';
    this.detail = detail;
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

export interface SoulContext {
  soulId: string;
  title: string;
  rawIdea: string;
  researchQuestion: string;
  hypothesis: string;
  independentVariable: string;
  dependentMetrics: string[];
  mainGap: string;
  openQuestions: string[];
  mechanismChain: string[];
  baselines: Array<{ name: string; value: string; bound: boolean }>;
  experiments: Array<{
    id: string;
    title: string;
    status: string;
    metrics: string[];
    baseline: string;
    treatment: string;
  }>;
  petals: Array<{ id: string; label: string; status: string }>;
  leaves: Array<{ id: string; label: string; failureCondition: string }>;
  memoryPaperIds: string[];
}

export interface IdeaInput {
  rawIdea: string;
  soul?: SoulContext | null;
}

export interface ExperimentDesignInput {
  soul: SoulContext;
  proposal: string;
}

export interface EvidenceInput {
  soul: SoulContext;
  experiment: {
    id: string;
    title: string;
    hypothesis: string;
    baseline: string;
    treatment: string;
    metrics: string[];
    expectedObservation: string;
    mainRisk: string;
  };
  stats: MetricStat[];
  dataBrief: string;
  humanView: string;
  fileName?: string;
}

export interface PaperSearchInput {
  soul: SoulContext;
  trigger: 'soul_created' | 'ghost_petal' | 'yellow_leaf' | 'manual_scan';
  focusLabel: string;
  knownPaperIds: string[];
}

/* ============ Frontier 层（FR-M11 / M12 / M15） ============ */

export interface FrontierLoopInput {
  docs: SoulDoc[];
  /** 已拉取的候选论文（真实链路由后端从 OpenAlex / arXiv 注入） */
  source: PaperMatch[];
  memory: ResearchMemory;
}

export interface NoveltyInput {
  candidates: PaperMatch[];
  memory: ResearchMemory;
}

export interface BriefInput {
  docs: SoulDoc[];
  scan: FrontierScanResult;
}

/* ============ Mathematical Instrument Layer（Instrument Workshop） ============ */

/** 与后端 /api/math/investigate 的入参一致 */
export interface MathInvestigationInput {
  soul: SoulContext;
  experiment: {
    id: string;
    title: string;
    hypothesis: string;
    baseline: string;
    treatment: string;
    metrics: string[];
  };
  rows: Array<Record<string, unknown>>;
  mapping: {
    groupColumn?: string;
    baselineValue?: string;
    treatmentValue?: string;
    metricColumns?: string[];
  };
  fileName?: string;
  humanView?: string;
  /** SSE 逐轮进度（仪器台账） */
  onEvent?: (ev: MathProgressEvent) => void;
}

/** 与 server/math/mathagent.ts 的事件流一一对应 */
export type MathProgressEvent =
  | { type: 'plan'; question: string; hypotheses: Array<{ id: string; statement: string }> }
  | { type: 'round_start'; round: number }
  | { type: 'tool_call'; round: number; tool_id: string; params: unknown }
  | { type: 'tool_result'; round: number; tool_id: string; outputs: unknown }
  | { type: 'tool_generating'; round: number; goal: string }
  | { type: 'tool_verified'; round: number; tool_id: string; version: number; testsPassed: number; testsTotal: number }
  | { type: 'tool_rejected'; round: number; detail: string }
  | { type: 'finding'; finding: string }
  | { type: 'fallback'; reason: string }
  | { type: 'error'; message: string };

export interface AgentBridge {
  structureIdea(input: IdeaInput): Promise<IdeaResult>;
  reviewExperimentDesign(input: ExperimentDesignInput): Promise<DesignVerdict>;
  reviewEvidence(input: EvidenceInput): Promise<EvidenceVerdict>;
  searchPapers(input: PaperSearchInput): Promise<PaperMatch[]>;
  /** FR-M11：跑一次后台 Frontier Loop（含 Query 扩展 / 机制筛选 / Novelty Gate） */
  runFrontierLoop(input: FrontierLoopInput): Promise<FrontierScanResult>;
  /** FR-M12：Novelty Gate —— 判断哪些候选是真正的新信息（防重复推送） */
  evaluateNovelty(input: NoveltyInput): Promise<NoveltyDecision[]>;
  /** FR-M15：生成每日 Morning Research Brief */
  generateBrief(input: BriefInput): Promise<MorningBrief>;
  /** Instrument Workshop：迭代数学调查（Raw Data → Instruments → Evidence Package） */
  runMathInvestigation(input: MathInvestigationInput): Promise<EvidencePackage>;
}

export type AdapterKind = 'learnbuddy' | 'mock';
