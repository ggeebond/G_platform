/**
 * db.ts —— 统一异步数据库访问层（Vercel Serverless 适配）
 *
 * 双后端：
 *   - 本地开发 / 自托管：better-sqlite3（同步，动态 import，避免被 Vercel 打包进函数）
 *   - Vercel（设置 TURSO_URL 时）：@libsql/client（Turso / libSQL，异步，Serverless 友好）
 *
 * 上层调用方只需把原来的 `db.xxx()` 改为 `await db.xxx()`，函数签名语义不变。
 * 注意：Vercel 文件系统只读（仅 /tmp 可写），所以 Serverless 下必须用外部 DB（Turso）。
 */
import { createClient, type Client } from "@libsql/client";

/* ---------- 统一查询接口（异步） ---------- */
interface Queryable {
  all(sql: string, params?: unknown[]): Promise<any[]>;
  get(sql: string, params?: unknown[]): Promise<any>;
  run(sql: string, params?: unknown[]): Promise<{ changes: number }>;
  exec(sql: string): Promise<void>;
}

/* ---------- libSQL / Turso 后端 ---------- */
let libsqlClient: Client | null = null;
function getLibsql(): Client {
  if (libsqlClient) return libsqlClient;
  const url = process.env.TURSO_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("TURSO_URL 未设置，无法使用 libSQL 后端");
  libsqlClient = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN,
  });
  return libsqlClient;
}

const libsqlBackend: Queryable = {
  async all(sql, params = []) {
    const r = await getLibsql().execute({ sql, args: params as any[] });
    return r.rows as any[];
  },
  async get(sql, params = []) {
    const r = await getLibsql().execute({ sql, args: params as any[] });
    return (r.rows[0] as any) ?? undefined;
  },
  async run(sql, params = []) {
    const r = await getLibsql().execute({ sql, args: params as any[] });
    return { changes: Number(r.rowsAffected ?? 0) };
  },
  async exec(sql) {
    await getLibsql().executeMultiple(sql);
  },
};

/* ---------- better-sqlite3 后端（仅本地，动态 import） ---------- */
let sqliteDb: any = null;
let sqliteModule: any = null;
async function getSqlite(): Promise<any> {
  if (sqliteDb) return sqliteDb;
  sqliteModule = (await import("better-sqlite3")).default;
  const fs = await import("fs");
  const path = await import("path");
  const { fileURLToPath } = await import("url");
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const dbPath =
    process.env.SQLITE_PATH || path.join(__dirname, "..", "data", "chat.db");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  sqliteDb = new sqliteModule(dbPath);
  sqliteDb.pragma("journal_mode = WAL");
  return sqliteDb;
}

const sqliteBackend: Queryable = {
  async all(sql, params = []) {
    const d = await getSqlite();
    return d.prepare(sql).all(...(params as any[]));
  },
  async get(sql, params = []) {
    const d = await getSqlite();
    return d.prepare(sql).get(...(params as any[]));
  },
  async run(sql, params = []) {
    const d = await getSqlite();
    const r = d.prepare(sql).run(...(params as any[]));
    return { changes: r.changes };
  },
  async exec(sql) {
    const d = await getSqlite();
    d.exec(sql);
  },
};

/* ---------- 后端选择 ---------- */
function backend(): Queryable {
  // Vercel / Serverless：设置了 Turso 就用 libSQL
  if (process.env.TURSO_URL || process.env.DATABASE_URL) return libsqlBackend;
  return sqliteBackend;
}

/* ---------- DDL ---------- */
const SCHEMA = `
  -- 会话表
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    model TEXT NOT NULL,
    sdk_session_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- 消息表
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    model TEXT,
    created_at TEXT NOT NULL,
    tool_calls TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);

  -- ============ Instrument Workshop（数学仪器层） ============

  CREATE TABLE IF NOT EXISTS tools (
    tool_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    spec_json TEXT NOT NULL,
    code TEXT NOT NULL,
    tests_code TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL CHECK (status IN ('core', 'experimental', 'trusted')),
    code_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (tool_id, version)
  );

  CREATE TABLE IF NOT EXISTS tool_runs (
    run_id TEXT PRIMARY KEY,
    tool_id TEXT NOT NULL,
    tool_version INTEGER NOT NULL,
    soul_id TEXT,
    experiment_id TEXT,
    params_json TEXT NOT NULL DEFAULT '{}',
    input_summary TEXT NOT NULL DEFAULT '',
    output_json TEXT,
    code_hash TEXT NOT NULL,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_tool_runs_tool ON tool_runs(tool_id, tool_version);
`;

let dbInitialized = false;

/** 初始化数据库（建表 + 兼容性迁移）。幂等，可安全多次调用。 */
export async function initDb(): Promise<void> {
  if (dbInitialized) return;
  const b = backend();

  if (b === sqliteBackend) {
    // SQLite：WAL 等pragma已在 getSqlite 里设置
  }

  await b.exec(SCHEMA);

  // 兼容性迁移：老库可能没有 sdk_session_id 列（新 DDL 已包含，幂等忽略失败）
  try {
    await b.run("ALTER TABLE sessions ADD COLUMN sdk_session_id TEXT");
  } catch {
    /* 列已存在或表不兼容，忽略 */
  }

  dbInitialized = true;
}

/* ---------- 类型定义 ---------- */
export interface DbSession {
  id: string;
  title: string;
  model: string;
  sdk_session_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  model: string | null;
  created_at: string;
  tool_calls: string | null;
}

/* ============= 会话操作 ============= */

export async function getAllSessions(): Promise<DbSession[]> {
  const stmt = await backend().all(
    "SELECT * FROM sessions ORDER BY updated_at DESC",
  );
  return stmt as DbSession[];
}

export async function getSession(id: string): Promise<DbSession | undefined> {
  return (await backend().get("SELECT * FROM sessions WHERE id = ?", [id])) as
    | DbSession
    | undefined;
}

export async function createSession(session: DbSession): Promise<DbSession> {
  await backend().run(
    `INSERT INTO sessions (id, title, model, sdk_session_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      session.id,
      session.title,
      session.model,
      session.sdk_session_id,
      session.created_at,
      session.updated_at,
    ],
  );
  return session;
}

export async function updateSession(
  id: string,
  updates: Partial<Pick<DbSession, "title" | "model" | "sdk_session_id">>,
): Promise<boolean> {
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.title !== undefined) {
    fields.push("title = ?");
    values.push(updates.title);
  }
  if (updates.model !== undefined) {
    fields.push("model = ?");
    values.push(updates.model);
  }
  if (updates.sdk_session_id !== undefined) {
    fields.push("sdk_session_id = ?");
    values.push(updates.sdk_session_id);
  }

  if (fields.length === 0) return false;

  fields.push("updated_at = ?");
  values.push(new Date().toISOString());
  values.push(id);

  const r = await backend().run(
    `UPDATE sessions SET ${fields.join(", ")} WHERE id = ?`,
    values,
  );
  return r.changes > 0;
}

export async function deleteSession(id: string): Promise<boolean> {
  const r = await backend().run("DELETE FROM sessions WHERE id = ?", [id]);
  return r.changes > 0;
}

/* ============= 消息操作 ============= */

export async function getMessagesBySession(
  sessionId: string,
): Promise<DbMessage[]> {
  return (await backend().all(
    "SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC",
    [sessionId],
  )) as DbMessage[];
}

export async function createMessage(message: DbMessage): Promise<DbMessage> {
  await backend().run(
    `INSERT INTO messages (id, session_id, role, content, model, created_at, tool_calls)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      message.id,
      message.session_id,
      message.role,
      message.content,
      message.model,
      message.created_at,
      message.tool_calls,
    ],
  );

  // 更新会话的 updated_at
  await backend().run(
    "UPDATE sessions SET updated_at = ? WHERE id = ?",
    [new Date().toISOString(), message.session_id],
  );

  return message;
}

export async function updateMessage(
  id: string,
  updates: Partial<Pick<DbMessage, "content" | "tool_calls">>,
): Promise<boolean> {
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.content !== undefined) {
    fields.push("content = ?");
    values.push(updates.content);
  }
  if (updates.tool_calls !== undefined) {
    fields.push("tool_calls = ?");
    values.push(updates.tool_calls);
  }

  if (fields.length === 0) return false;

  values.push(id);

  const r = await backend().run(
    `UPDATE messages SET ${fields.join(", ")} WHERE id = ?`,
    values,
  );
  return r.changes > 0;
}

export async function deleteMessage(id: string): Promise<boolean> {
  const r = await backend().run("DELETE FROM messages WHERE id = ?", [id]);
  return r.changes > 0;
}

export async function createMessages(messages: DbMessage[]): Promise<void> {
  for (const msg of messages) {
    await createMessage(msg);
  }
}

export async function clearAllData(): Promise<void> {
  await backend().exec("DELETE FROM messages");
  await backend().exec("DELETE FROM sessions");
  await backend().exec("DELETE FROM tool_runs");
  await backend().exec("DELETE FROM tools");
}

/* ============= 通用查询原语（math 层 store.ts / routes.ts 依赖） ============= */

export async function all(sql: string, params: unknown[] = []): Promise<any[]> {
  return backend().all(sql, params);
}

export async function get(sql: string, params: unknown[] = []): Promise<any> {
  return backend().get(sql, params);
}

export async function run(sql: string, params: unknown[] = []): Promise<{ changes: number }> {
  return backend().run(sql, params);
}

export default {
  initDb,
  getAllSessions,
  getSession,
  createSession,
  updateSession,
  deleteSession,
  getMessagesBySession,
  createMessage,
  updateMessage,
  deleteMessage,
  createMessages,
  clearAllData,
  all,
  get,
  run,
};
