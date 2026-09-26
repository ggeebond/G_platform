/**
 * Soul Lab — Agent 结构化输出契约（Zod）
 *
 * 铁律：AI 只输出语义，不输出任何视觉数值（opacity / scale / color）。
 * 前端与后端共用本文件；校验失败 → ContractViolationError → 不改花状态（F1）。
 */
import { z } from 'zod';

/* ============ Mode A — Idea Structuring ============ */
export const IdeaResultSchema = z.object({
  accepted: z.boolean(),
  title: z.string().min(1),
  researchQuestion: z.string().default(''),
  hypothesis: z.string().default(''),
  independentVariable: z.string().default(''),
  dependentMetrics: z.array(z.string()).default([]),
  baseline: z.object({ name: z.string().default(''), value: z.string().default('') }),
  mainGap: z.string().default(''),
  firstExperiment: z.string().default(''),
  openQuestions: z.array(z.string()).default([]),
  notes: z.string().default(''),
});

/* ============ Mode B — Experiment Design ============ */
export const DesignVerdictSchema = z.object({
  accepted: z.boolean(),
  title: z.string().min(1),
  goal: z.string().default(''),
  hypothesis: z.string().default(''),
  baseline: z.object({ name: z.string().default(''), value: z.string().default('') }),
  treatment: z.object({
    name: z.string().default(''),
    range: z.array(z.union([z.number(), z.string()])).default([]),
    value: z.string().default(''),
  }),
  controlledVariables: z.array(z.string()).default([]),
  metrics: z.array(z.string()).default([]),
  expectedObservation: z.string().default(''),
  mainRisk: z.string().default(''),
  reason: z.string().default(''),
  missingControls: z.array(z.string()).default([]),
});

/* ============ Mode C — Evidence Review ============ */
export const EvidenceVerdictSchema = z.object({
  verdict: z.enum(['accepted', 'insufficient', 'contradictory', 'invalid']),
  dataBrief: z.string().default(''),
  aiView: z.string().default(''),
  rationale: z.string().default(''),
  conditions: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).default(0.5),
  suggestedNext: z.string().default(''),
});

/* ============ Mode D — Research Scout ============ */
export const PaperMatchSchema = z.object({
  paperId: z.string().min(1),
  title: z.string().min(1),
  year: z.number().int().default(2024),
  authors: z.array(z.string()).default([]),
  abstract: z.string().default(''),
  matchedGap: z.string().default(''),
  relatedPetalId: z.string().nullable().default(null),
  relationType: z.enum(['background', 'supporting', 'conflicting', 'method']),
  reason: z.string().default(''),
  keyMechanism: z.string().default(''),
  source: z.string().default('OpenAlex / arXiv'),
});

/* ============ Frontier Loop 检索候选（FR-M11 第 4 步产出） ============ */
export const FrontierCandidatesSchema = z.object({
  candidates: z.array(PaperMatchSchema).default([]),
});

/* ============ Lab Keeper 路由结果 ============ */
export const KeeperResponseSchema = z.object({
  mode: z.enum(['idea', 'design', 'scout', 'chat']),
  reply: z.string().default(''),
  idea: IdeaResultSchema.nullable().default(null),
  design: DesignVerdictSchema.nullable().default(null),
  papers: z.array(PaperMatchSchema).default([]),
});

export type IdeaResult = z.infer<typeof IdeaResultSchema>;
export type DesignVerdict = z.infer<typeof DesignVerdictSchema>;
export type EvidenceVerdict = z.infer<typeof EvidenceVerdictSchema>;
export type PaperMatch = z.infer<typeof PaperMatchSchema>;
export type FrontierCandidates = z.infer<typeof FrontierCandidatesSchema>;
export type KeeperResponse = z.infer<typeof KeeperResponseSchema>;

/* =====================================================================
   Mathematical Instrument Layer · Instrument Workshop（科研仪器工坊）
   Raw Data → Mathematical Instruments → Observable Structures
           → Mathematical Scientist → Scientific Interpretation
   ===================================================================== */

/** Mathematical Scientist 的分析计划（它决定"应该算什么"） */
export const AnalysisPlanSchema = z.object({
  question: z.string().min(1),
  observedVariables: z.array(z.string()).default([]),
  hypotheses: z.array(z.object({ id: z.string(), statement: z.string() })).default([]),
  requiredInstruments: z.array(z.string()).default([]),
});

/** 给 Toolsmith 的工具需求（"帮我造一个能做 X 的仪器"） */
export const ToolRequirementSchema = z.object({
  goal: z.string().min(1),
  input: z.record(z.string(), z.string()).default({}),
  requiredOutputs: z.array(z.string()).min(1),
  constraints: z.array(z.string()).default([]),
});

/** 正式的工具规格（Core 与 Generated 共用；代码与测试另存） */
export const ToolSpecSchema = z.object({
  tool_id: z.string().regex(/^[a-z][a-z0-9_]*$/, "tool_id 必须是小写下划线标识符"),
  version: z.number().int().min(1).default(1),
  scientific_question: z.string().min(1),
  input_schema: z.record(z.string(), z.string()).default({}),
  assumptions: z.array(z.string()).default([]),
  method: z.string().min(1),
  output_schema: z.record(z.string(), z.string()).default({}),
  dependencies: z.array(z.string()).default([]),
  status: z.enum(['core', 'experimental', 'trusted']).default('experimental'),
});

/** Tool Verifier 的验证报告（确定性关卡：测试不过不入 Registry） */
export const ToolVerificationReportSchema = z.object({
  passed: z.boolean(),
  checks: z.array(z.object({
    name: z.string(),
    passed: z.boolean(),
    detail: z.string().default(''),
  })).default([]),
  testsPassed: z.number().int().min(0).default(0),
  testsTotal: z.number().int().min(0).default(0),
});

/** 经过可追溯数学计算得到的结构化结果（LLM 看到的是它，不是原始数据） */
export const StructuredResultSchema = z.object({
  tool_id: z.string(),
  tool_version: z.number().int().default(1),
  params: z.record(z.string(), z.unknown()).default({}),
  outputs: z.unknown(),
  provenance: z.object({
    code_hash: z.string(),
    libs: z.array(z.string()).default([]),
    runtime_ms: z.number().default(0),
    validation: z.string().default(''),
  }),
});

/** Evidence Package：仪器层的最终产出，交给 Evidence Reviewer */
export const EvidencePackageSchema = z.object({
  finding: z.string().min(1),
  rounds: z.array(z.object({
    tool_id: z.string(),
    tool_version: z.number().int().default(1),
    question: z.string().default(''),
    outputs: z.unknown(),
    note: z.string().default(''),
    code_hash: z.string().default(''),
  })).default([]),
  hypothesesVerdicts: z.array(z.object({
    id: z.string(),
    statement: z.string().default(''),
    status: z.enum(['supported', 'refuted', 'untested']),
    evidence: z.string().default(''),
  })).default([]),
  interpretation: z.string().default(''),
  confidence: z.number().min(0).max(1).default(0.5),
  /** 无 LLM 凭证时确定性降级（只用 Core 仪器）——必须显式标注，不许冒充 */
  fallback: z.boolean().default(false),
});

/** Mathematical Scientist 每一轮的决策（判别联合：用仪器 / 造仪器 / 下结论） */
export const ScientistDecisionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('use_tool'),
    tool_id: z.string(),
    params: z.record(z.string(), z.unknown()).default({}),
    reason: z.string().default(''),
  }),
  z.object({
    action: z.literal('request_tool'),
    requirement: ToolRequirementSchema,
    reason: z.string().default(''),
  }),
  z.object({
    action: z.literal('conclude'),
    finding: z.string().min(1),
    hypothesesVerdicts: z.array(z.object({
      id: z.string(),
      statement: z.string().default(''),
      status: z.enum(['supported', 'refuted', 'untested']),
      evidence: z.string().default(''),
    })).default([]),
    interpretation: z.string().default(''),
    confidence: z.number().min(0).max(1).default(0.5),
  }),
]);

export type AnalysisPlan = z.infer<typeof AnalysisPlanSchema>;
export type ToolRequirement = z.infer<typeof ToolRequirementSchema>;
export type ToolSpec = z.infer<typeof ToolSpecSchema>;
export type ToolVerificationReport = z.infer<typeof ToolVerificationReportSchema>;
export type StructuredResult = z.infer<typeof StructuredResultSchema>;
export type EvidencePackage = z.infer<typeof EvidencePackageSchema>;
export type ScientistDecision = z.infer<typeof ScientistDecisionSchema>;
