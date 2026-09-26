/**
 * Scientific Sandbox · sandbox.ts —— TS 侧执行编排
 *
 * 所有仪器代码（Core 与 Toolsmith 生成的）都只在这里进入 Python 子进程：
 *   python -I guard.py / runner.py   （-I = isolated mode）
 *   stdin/stdout 走 JSON、超时 30s、输出上限 10MB、PYTHONHASHSEED=0（确定性）
 *
 * 安全模型（诚实声明）：AST 白名单 + isolated mode + 超时，是防 LLM 写出
 * 危险代码的 best-effort，不是容器级隔离；生产级答案是容器。
 */
import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runPyInPyodide } from './pyodide.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PY_DIR = path.join(__dirname, 'py');
const TIMEOUT_MS = 30_000;
const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;

/**
 * 选择沙箱执行器：
 *   - 本地开发：默认用系统/venv 的 CPython（child_process，速度快、行为一致）
 *   - Vercel / Serverless：无系统 Python，用 Pyodide 在进程内运行（MATH_EXECUTOR=pyodide 或 VERCEL 环境变量）
 * 可用 MATH_EXECUTOR=child_process | pyodide 强制覆盖。
 */
function usePyodide(): boolean {
  const forced = process.env.MATH_EXECUTOR;
  if (forced === 'pyodide') return true;
  if (forced === 'child_process') return false;
  return Boolean(process.env.VERCEL);
}

/** 沙箱解释器解析：MATH_SANDBOX_PYTHON → 项目 .venv → PATH 上的 python */
export function pythonExe(): string {
  if (process.env.MATH_SANDBOX_PYTHON) return process.env.MATH_SANDBOX_PYTHON;
  const win = path.join(__dirname, '..', '..', '.venv', 'Scripts', 'python.exe');
  if (fs.existsSync(win)) return win;
  const unix = path.join(__dirname, '..', '..', '.venv', 'bin', 'python');
  if (fs.existsSync(unix)) return unix;
  return 'python';
}

export function codeHash(code: string): string {
  return crypto.createHash('sha256').update(code, 'utf8').digest('hex').slice(0, 16);
}

interface PyOutcome {
  stdout: string;
  stderr: string;
  timedOut: boolean;
  ok: boolean;
}

function runPy(script: string, job: unknown): Promise<PyOutcome> {
  // Serverless / Vercel：用 Pyodide 在进程内运行（无系统 Python）
  if (usePyodide()) {
    return runPyInPyodide(path.basename(script), job).then((r) => ({
      stdout: r.stdout,
      stderr: r.stderr,
      timedOut: r.timedOut,
      ok: r.ok && !r.timedOut && r.stderr.trim() === '',
    }));
  }

  // 本地开发：CPython 子进程（-I isolated mode）
  return new Promise((resolve) => {
    const child = spawn(pythonExe(), ['-I', script], {
      cwd: PY_DIR,
      env: {
        ...process.env,
        PYTHONHASHSEED: '0',        // 确定性：dict/集合遍历顺序稳定
        PYTHONIOENCODING: 'utf-8',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let killed = false;

    const timer = setTimeout(() => {
      timedOut = true;
      killed = true;
      child.kill();
    }, TIMEOUT_MS);

    child.stdout.on('data', (d: Buffer) => {
      if (stdout.length + d.length <= MAX_OUTPUT_BYTES) stdout += d.toString('utf8');
      else if (!killed) { killed = true; child.kill(); }
    });
    child.stderr.on('data', (d: Buffer) => {
      if (stderr.length < 64 * 1024) stderr += d.toString('utf8');
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ stdout: '', stderr: String(err), timedOut: false, ok: false });
    });
    child.on('close', () => {
      clearTimeout(timer);
      resolve({ stdout, stderr, timedOut, ok: !timedOut && !killed && stderr.trim() === '' });
    });

    // 写入用原始字节：避免 Node 字符串编码与 Python locale（-I 模式忽略
    // PYTHONIOENCODING）之间出现 GBK/UTF-8 错配产生的 surrogateescape 残渣
    child.stdin.end(Buffer.from(JSON.stringify(job), 'utf8'));
  });
}

function parseOut<T>(o: PyOutcome, what: string): T {
  if (o.timedOut) throw new Error(`${what}: 沙箱执行超时（>${TIMEOUT_MS / 1000}s）`);
  if (o.stderr.trim()) throw new Error(`${what}: 沙箱异常输出 ${o.stderr.slice(0, 400)}`);
  try {
    return JSON.parse(o.stdout) as T;
  } catch {
    throw new Error(`${what}: 沙箱返回了非 JSON（${o.stdout.slice(0, 200)}）`);
  }
}

/* ============ guard：静态校验 ============ */

export interface GuardViolation {
  where: string;
  line: number;
  rule: string;
  detail: string;
}

export async function guardCode(code: string, testsCode = ''): Promise<{ ok: boolean; violations: GuardViolation[] }> {
  const out = await runPy(path.join(PY_DIR, 'guard.py'), { code, tests_code: testsCode });
  return parseOut(out, 'guard');
}

/* ============ 执行仪器 ============ */

export interface RunOutcome {
  ok: boolean;
  result?: unknown;
  error?: string;
  runtimeMs: number;
}

export async function runInstrument(code: string, data: unknown, params: unknown): Promise<RunOutcome> {
  const started = Date.now();
  const out = await runPy(path.join(PY_DIR, 'runner.py'), { mode: 'run', code, data, params });
  const runtimeMs = Date.now() - started;
  const parsed = parseOut<{ ok: boolean; result?: unknown; error?: string }>(out, 'run');
  return { ...parsed, runtimeMs };
}

/* ============ 跑工具自带的测试 ============ */

export interface TestOutcome {
  name: string;
  passed: boolean;
  error: string | null;
}

export async function runTests(code: string, testsCode = ''): Promise<{ ok: boolean; tests: TestOutcome[] }> {
  const out = await runPy(path.join(PY_DIR, 'runner.py'), { mode: 'test', code, tests_code: testsCode });
  return parseOut(out, 'test');
}

/* ============ 沙箱健康自检 ============ */

export async function sandboxHealth(): Promise<{
  ok: boolean;
  python: string;
  version: string;
  error?: string;
}> {
  // 探针代码是我们自己写的（不经过 guard，也不入 Registry），只报告解释器版本
  const code = [
    'import sys',
    '',
    'def run(data, params):',
    '    return {"python": sys.version.split()[0], "platform": sys.platform}',
  ].join('\n');
  const pythonLabel = usePyodide() ? 'pyodide' : pythonExe();
  const out = await runInstrument(code, {}, {});
  if (!out.ok) {
    return { ok: false, python: pythonLabel, version: '', error: out.error };
  }
  const r = out.result as { python?: string } | undefined;
  return { ok: true, python: pythonLabel, version: r?.python ?? (usePyodide() ? 'pyodide' : '') };
}
