/**
 * Instrument Workshop · store.ts —— 工具注册表与运行溯源的持久化
 *
 * 后端为异步（libSQL / better-sqlite3 统一接口），所有函数返回 Promise。
 * 两张表（在 server/db.ts 的 SCHEMA 里建好）：
 *   tools      —— ToolSpec + 代码 + 测试 + 状态（core/experimental/trusted）
 *   tool_runs  —— 每次运行的 Provenance：结果永远可以回查"这个数字怎么算出来的"
 */
import * as db from "../db.js";
import { v4 as uuidv4 } from "uuid";
import type { ToolSpec } from "../../shared/schemas.js";

export interface ToolRow {
  tool_id: string;
  version: number;
  spec_json: string;
  code: string;
  tests_code: string;
  status: string;
  code_hash: string;
  created_at: string;
}

export interface ToolRunRow {
  run_id: string;
  tool_id: string;
  tool_version: number;
  soul_id: string | null;
  experiment_id: string | null;
  params_json: string;
  input_summary: string;
  output_json: string | null;
  code_hash: string;
  duration_ms: number;
  status: string;
  created_at: string;
}

export async function latestToolVersion(toolId: string): Promise<number> {
  const row = (await db
    .get("SELECT MAX(version) AS v FROM tools WHERE tool_id = ?", [toolId])) as
    | { v: number | null }
    | undefined;
  return row?.v ?? 0;
}

export async function insertTool(params: {
  spec: ToolSpec;
  code: string;
  testsCode: string;
  codeHash: string;
}): Promise<void> {
  await db.run(
    `INSERT INTO tools (tool_id, version, spec_json, code, tests_code, status, code_hash, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      params.spec.tool_id,
      params.spec.version,
      JSON.stringify(params.spec),
      params.code,
      params.testsCode,
      params.spec.status,
      params.codeHash,
      new Date().toISOString(),
    ],
  );
}

/** 每个 tool_id 取最新版本 */
export async function getAllLatestTools(): Promise<ToolRow[]> {
  return (await db.all(`
    SELECT t.* FROM tools t
    JOIN (SELECT tool_id, MAX(version) AS v FROM tools GROUP BY tool_id) m
      ON t.tool_id = m.tool_id AND t.version = m.v
    ORDER BY t.status, t.tool_id
  `)) as ToolRow[];
}

export async function getLatestTool(toolId: string): Promise<ToolRow | undefined> {
  return (await db.get(`
    SELECT * FROM tools WHERE tool_id = ?
    ORDER BY version DESC LIMIT 1
  `, [toolId])) as ToolRow | undefined;
}

/** 仅允许 experimental → trusted（Core 永远是 core；降级不存在） */
export async function promoteTool(toolId: string): Promise<boolean> {
  const row = await getLatestTool(toolId);
  if (!row || row.status !== "experimental") return false;
  const r = await db.run(
    "UPDATE tools SET status = ? WHERE tool_id = ? AND version = ?",
    ["trusted", toolId, row.version],
  );
  return r.changes > 0;
}

export async function insertRun(params: {
  toolId: string;
  toolVersion: number;
  soulId?: string | null;
  experimentId?: string | null;
  paramsJson: string;
  inputSummary: string;
  outputJson: string | null;
  codeHash: string;
  durationMs: number;
  status: "ok" | "error";
}): Promise<string> {
  const runId = uuidv4();
  await db.run(
    `INSERT INTO tool_runs (run_id, tool_id, tool_version, soul_id, experiment_id,
                             params_json, input_summary, output_json, code_hash,
                             duration_ms, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      runId,
      params.toolId,
      params.toolVersion,
      params.soulId ?? null,
      params.experimentId ?? null,
      params.paramsJson,
      params.inputSummary,
      params.outputJson,
      params.codeHash,
      params.durationMs,
      params.status,
      new Date().toISOString(),
    ],
  );
  return runId;
}

export async function getRuns(toolId: string, limit = 20): Promise<ToolRunRow[]> {
  return (await db.all(
    `SELECT * FROM tool_runs WHERE tool_id = ?
     ORDER BY created_at DESC LIMIT ?`,
    [toolId, limit],
  )) as ToolRunRow[];
}
