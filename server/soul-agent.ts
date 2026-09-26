/**
 * Soul Lab — LearnBuddy 结构化 Agent 路由
 *
 * 前台只有一个 Agent：Soul Keeper；内部由 Lab Keeper（元 Agent）路由专家：
 * Idea Analyst / Experiment Designer / Evidence Reviewer / Paper Scout·Gatekeeper。
 *
 * 所有输出必须是通过 Zod 校验的 JSON；校验失败返回 422 + schema_violation，
 * 前端据此不改变花的状态（F1）。
 */
import express from "express";
import { query } from "@tencent-ai/agent-sdk";
import {
  EvidenceVerdictSchema,
  FrontierCandidatesSchema,
  KeeperResponseSchema,
  PaperMatchSchema,
} from "../shared/schemas.js";
import { getDefaultModelId } from "./model-config.js";

const router = express.Router();

/* ==================== 公共：调用 LearnBuddy SDK ==================== */

/** 公共：调用 LearnBuddy SDK（Instrument Workshop 的两个 Agent 也复用） */
export async function runAgent(systemPrompt: string, userPrompt: string, maxTurns = 3): Promise<string> {
  // 运行时解析默认模型（flash 系列），避免硬编码供应商名
  const model = await getDefaultModelId();
  const stream = query({
    prompt: userPrompt,
    options: {
      cwd: process.cwd(),
      ...(model ? { model } : {}),
      systemPrompt,
      maxTurns,
      permissionMode: "default",
    },
  });

  let text = "";
  for await (const msg of stream) {
    if (msg.type === "assistant") {
      const content: any = (msg as any).message?.content;
      if (typeof content === "string") {
        text += content;
      } else if (Array.isArray(content)) {
        for (const block of content) {
          if (block?.type === "text") text += block.text;
        }
      }
    }
  }
  return text;
}

/** 公共：从 Agent 输出里提取 JSON（供 math 模块复用） */
export function extractJSON(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : text).trim();
  const objStart = candidate.indexOf("{");
  const objEnd = candidate.lastIndexOf("}");
  const arrStart = candidate.indexOf("[");
  const arrEnd = candidate.lastIndexOf("]");
  if (objStart !== -1 && objEnd > objStart && (arrStart === -1 || objStart < arrStart)) {
    return JSON.parse(candidate.slice(objStart, objEnd + 1));
  }
  if (arrStart !== -1 && arrEnd > arrStart) {
    return JSON.parse(candidate.slice(arrStart, arrEnd + 1));
  }
  throw new Error("Agent 输出中没有找到 JSON");
}

function ok(res: express.Response, data: unknown) {
  res.json({ ok: true, data });
}

function violation(res: express.Response, err: unknown) {
  res.status(422).json({
    ok: false,
    error: "schema_violation",
    message: "Agent 输出未通过结构校验",
    detail: String(err),
  });
}

/* ==================== System Prompts ==================== */

const LAB_KEEPER = `你是 Soul Lab 的 Lab Keeper —— 一个元 Agent。
你的团队包含：Idea Analyst（把模糊想法变成可证伪假设）、Experiment Designer（判断实验能否真正检验假设）、
Paper Scout·Gatekeeper（检索并判断机制相关性）。Soul Keeper 只是面向研究者的唯一界面。

铁律：
1. 网页不解析自由文本，只接受结构化 JSON。你必须输出且仅输出一个 JSON 对象，不要任何额外文字、不要 Markdown 代码块以外的说明。
2. 你只输出语义，绝不输出任何视觉数值（不要出现 opacity / scale / color / petalOpacity 之类的字段）。
3. 你不能替研究者做决定：不自动实体化花瓣、不自动把论文纳入记忆、不宣布研究成功。
4. 所有判断必须指向当前 Soul 的具体 gap / petal / baseline，不允许泛泛而谈。

根据用户意图 intent 选择专家并输出对应字段。`;

const IDEA_ANALYST = `${LAB_KEEPER}

本次角色：Idea Analyst。
输出 JSON：
{
  "mode": "idea",
  "reply": "不超过 120 字的中文说明",
  "idea": {
    "accepted": true,
    "title": "研究标题",
    "researchQuestion": "可回答的研究问题",
    "hypothesis": "可证伪假设（含量化阈值）",
    "independentVariable": "自变量",
    "dependentMetrics": ["指标1","指标2"],
    "baseline": {"name":"基线名","value":"基线取值"},
    "mainGap": "现有工作缺什么",
    "firstExperiment": "第一个该做的实验",
    "openQuestions": ["未解决问题"],
    "notes": ""
  },
  "design": null,
  "papers": []
}`;

const EXPERIMENT_DESIGNER = `${LAB_KEEPER}

本次角色：Experiment Designer。判断用户提出的实验能否真正检验 Soul 的假设。
只有同时具备「明确 baseline」「可测量指标」「可控变量」时才 accepted=true。
输出 JSON：
{
  "mode": "design",
  "reply": "不超过 120 字的中文说明",
  "idea": null,
  "design": {
    "accepted": true/false,
    "title": "实验标题",
    "goal": "实验目的",
    "hypothesis": "被检验的假设",
    "baseline": {"name":"基线名","value":"取值"},
    "treatment": {"name":"处理名","range":[8,24],"value":"8~24"},
    "controlledVariables": ["控制变量"],
    "metrics": ["指标"],
    "expectedObservation": "若假设成立应观察到什么",
    "mainRisk": "最大风险",
    "reason": "判断理由",
    "missingControls": ["缺失的控制项"]
  },
  "papers": []
}`;

const EVIDENCE_REVIEWER = `${LAB_KEEPER}

本次角色：Evidence Reviewer。你会收到：实验设计、确定性代码算出的统计量（mean/std/delta/n）、
以及研究者自己的判断（humanView）。你必须先复述数据，再给出自己的判断，最后给出 verdict。

流程固定：Data Brief → Human View → AI View → Verdict。
verdict 取值：
- accepted：结果足以支持原假设
- insufficient：样本量或效果量不足
- contradictory：明显反驳假设或暴露重要限制
- invalid：实验本身无效

只输出 JSON：
{
  "verdict": "accepted|insufficient|contradictory|invalid",
  "dataBrief": "你对数据的复述",
  "aiView": "你的独立判断",
  "rationale": "判定理由",
  "conditions": ["结论成立的条件"],
  "confidence": 0.0-1.0,
  "suggestedNext": "下一步建议"
}`;

const PAPER_SCOUT = `${LAB_KEEPER}

本次角色：Paper Scout · Gatekeeper。你可以使用可用的检索工具（WebSearch / WebFetch / OpenAlex / arXiv MCP，若可用）去找真实论文；
若工具不可用，就基于你的知识给出真实存在的论文（务必给出真实标题与年份，不要编造不存在的 DOI）。

必须指向当前 Soul 的具体 gap / petal / yellow leaf，不能说「你可能感兴趣」。
只输出一个 JSON 数组，长度 1-4，每项：
{
  "paperId": "稳定唯一 id",
  "title": "论文标题",
  "year": 2024,
  "authors": ["作者"],
  "abstract": "3-4 句摘要",
  "matchedGap": "命中当前 Soul 的哪个 gap",
  "relatedPetalId": null,
  "relationType": "background|supporting|conflicting|method",
  "reason": "为什么相关",
  "keyMechanism": "关键机制",
  "source": "arXiv / OpenAlex"
}`;

const FRONTIER_RETRIEVER = `${PAPER_SCOUT}

本次角色：Frontier Retriever。你会收到一组由「Soul 当前状态」扩展得到的检索 Query，
而不是单个关键词；以及当前的 Research Memory（已看过的论文 id / 已出现过的机制）。

要求：
1. 依据这些 Query 检索近期的真实新工作（优先最近 30 天）；
2. 必须排除 Research Memory 中已存在的 paperId 与已出现过的 keyMechanism —— 只返回真正的新信息；
3. 每条都要落到具体机制（keyMechanism），而不是笼统的「相关」；
4. 若确无新信息，返回空数组。

只输出一个 JSON 对象：{ "candidates": [ ...PaperMatch ] }，不要任何额外文字。`;

/* ==================== Routes ==================== */

router.post("/api/soul/keeper", async (req, res) => {
  const { intent = "idea", soul = null, message = "" } = req.body ?? {};
  const systemPrompt = intent === "design" ? EXPERIMENT_DESIGNER : IDEA_ANALYST;
  const userPrompt = [
    "当前 Soul 上下文（JSON）：",
    JSON.stringify(soul ?? {}, null, 2),
    "",
    "研究者的输入：",
    String(message),
    "",
    "请按 system prompt 要求输出唯一 JSON 对象。",
  ].join("\n");

  try {
    const raw = await runAgent(systemPrompt, userPrompt);
    const parsed = KeeperResponseSchema.safeParse(extractJSON(raw));
    if (!parsed.success) return violation(res, JSON.stringify(parsed.error.issues));
    return ok(res, parsed.data);
  } catch (err: any) {
    console.error("[SoulAgent] keeper error:", err?.message);
    res.status(500).json({ ok: false, error: "agent_error", message: err?.message ?? String(err) });
  }
});

router.post("/api/soul/review-evidence", async (req, res) => {
  const { soul = {}, experiment = {}, stats = [], dataBrief = "", humanView = "", fileName = "" } = req.body ?? {};
  const userPrompt = [
    "当前 Soul 上下文（JSON）：",
    JSON.stringify(soul, null, 2),
    "",
    "实验设计（JSON）：",
    JSON.stringify(experiment, null, 2),
    "",
    "确定性代码算出的统计量（JSON）：",
    JSON.stringify(stats, null, 2),
    "",
    "数据文件：",
    String(fileName || "（未提供）"),
    "",
    "数据摘要（Data Brief）：",
    String(dataBrief),
    "",
    "研究者的判断（Human View）：",
    String(humanView || "（研究者未填写）"),
    "",
    "请按 Data Brief → Human View → AI View → Verdict 的顺序输出唯一 JSON 对象。",
  ].join("\n");

  try {
    const raw = await runAgent(EVIDENCE_REVIEWER, userPrompt, 2);
    const parsed = EvidenceVerdictSchema.safeParse(extractJSON(raw));
    if (!parsed.success) return violation(res, JSON.stringify(parsed.error.issues));
    return ok(res, parsed.data);
  } catch (err: any) {
    console.error("[SoulAgent] review-evidence error:", err?.message);
    res.status(500).json({ ok: false, error: "agent_error", message: err?.message ?? String(err) });
  }
});

router.post("/api/soul/search-papers", async (req, res) => {
  const { soul = {}, trigger = "manual_scan", focusLabel = "", knownPaperIds = [] } = req.body ?? {};
  const userPrompt = [
    "当前 Soul 上下文（JSON）：",
    JSON.stringify(soul, null, 2),
    "",
    `本次检索触发点：${trigger}`,
    `当前焦点：${focusLabel}`,
    `已存在于研究轨道中的论文 id（请排除）：${JSON.stringify(knownPaperIds)}`,
    "",
    "请输出唯一 JSON 数组。",
  ].join("\n");

  try {
    const raw = await runAgent(PAPER_SCOUT, userPrompt, 8);
    const parsed = PaperMatchSchema.array().min(1).safeParse(extractJSON(raw));
    if (!parsed.success) return violation(res, JSON.stringify(parsed.error.issues));
    return ok(res, parsed.data);
  } catch (err: any) {
    console.error("[SoulAgent] search-papers error:", err?.message);
    res.status(500).json({ ok: false, error: "agent_error", message: err?.message ?? String(err) });
  }
});

router.post("/api/soul/frontier/loop", async (req, res) => {
  const { souls = [], memory = {}, queries = [] } = req.body ?? {};
  const userPrompt = [
    "当前 Souls 上下文（JSON）：",
    JSON.stringify(souls, null, 2),
    "",
    "状态扩展得到的检索 Query（JSON）：",
    JSON.stringify(queries, null, 2),
    "",
    "Research Memory（已看过 / 已知机制，必须排除，JSON）：",
    JSON.stringify(memory, null, 2),
    "",
    "请输出唯一 JSON 对象。",
  ].join("\n");

  try {
    const raw = await runAgent(FRONTIER_RETRIEVER, userPrompt, 8);
    const parsed = FrontierCandidatesSchema.safeParse(extractJSON(raw));
    if (!parsed.success) return violation(res, JSON.stringify(parsed.error.issues));
    return ok(res, parsed.data);
  } catch (err: any) {
    console.error("[SoulAgent] frontier-loop error:", err?.message);
    res.status(500).json({ ok: false, error: "agent_error", message: err?.message ?? String(err) });
  }
});

export default router;
