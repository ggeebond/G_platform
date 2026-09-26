/**
 * Instrument Workshop · routes.ts —— 数学仪器层的 HTTP/SSE 路由
 *
 * POST /api/math/investigate 是核心：SSE 事件流逐轮直播调查过程
 * （plan → round → tool_call/result → tool_generating/verified → finding → done），
 * done 事件携带 EvidencePackage（前端再过一次 Zod，F1 铁律不变）。
 */
import express from "express";
import { EvidencePackageSchema } from "../../shared/schemas.js";
import { sandboxHealth } from "./sandbox.js";
import { listTools, promoteTool } from "./registry.js";
import * as store from "./store.js";
import { runInvestigation } from "./mathagent.js";

const router = express.Router();

/* ---------- 沙箱自检：python 路径 / 版本 ---------- */
router.get("/api/math/health", async (_req, res) => {
  try {
    const h = await sandboxHealth();
    res.json({ ok: h.ok, data: h });
  } catch (err: any) {
    res.json({ ok: false, data: { error: String(err?.message ?? err) } });
  }
});

/* ---------- 工具库 ---------- */
router.get("/api/math/tools", async (_req, res) => {
  try {
    const tools = (await listTools()).map((t) => ({
      ...t.spec,
      code_hash: t.codeHash,
      core: t.core,
    }));
    res.json({ ok: true, data: { tools } });
  } catch (err: any) {
    res.status(500).json({ ok: false, message: String(err?.message ?? err) });
  }
});

/* ---------- 溯源：某个工具的运行历史 ---------- */
router.get("/api/math/tools/:toolId/runs", async (req, res) => {
  try {
    res.json({ ok: true, data: { runs: await store.getRuns(req.params.toolId) } });
  } catch (err: any) {
    res.status(500).json({ ok: false, message: String(err?.message ?? err) });
  }
});

/* ---------- experimental → trusted（用户显式动作，科研诚信）---------- */
router.post("/api/math/tools/:toolId/promote", async (req, res) => {
  const ok = await promoteTool(req.params.toolId);
  if (!ok) {
    return res.status(409).json({ ok: false, message: "只允许 experimental → trusted" });
  }
  res.json({ ok: true });
});

/* ---------- 核心入口：迭代数学调查（SSE）---------- */
router.post("/api/math/investigate", async (req, res) => {
  const { soul = {}, experiment = {}, rows = [], mapping = {}, fileName = "", humanView = "" } = req.body ?? {};

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const pkg = await runInvestigation({
      soul, experiment, rows, mapping, fileName, humanView,
      onEvent: (ev) => res.write(`data: ${JSON.stringify(ev)}\n\n`),
    });
    // 出口再校验一次（与前端同源契约）
    const parsed = EvidencePackageSchema.parse(pkg);
    res.write(`data: ${JSON.stringify({ type: "done", package: parsed })}\n\n`);
  } catch (err: any) {
    res.write(`data: ${JSON.stringify({ type: "error", message: String(err?.message ?? err).slice(0, 500) })}\n\n`);
  }
  res.end();
});

export default router;
