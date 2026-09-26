/**
 * pyodide.ts —— Vercel / Serverless 上的 Python 沙箱执行器
 *
 * 在 Serverless 环境里没有系统 Python，也没有 .venv。这里用 Pyodide（Python → WASM）
 * 在 Node 进程内直接运行与本地完全相同的 runner.py / guard.py，从而保留：
 *   - 同一套数学仪器（numpy / scipy / sklearn）
 *   - guard.py 的 AST 白名单静态校验
 *   - runner.py 的确定性执行契约
 *
 * 与本地 child_process 路径的差异仅在于「解释器实现」，仪器代码与守卫逻辑零改动。
 *
 * 说明：
 * - Pyodide 首次加载需下载 wasm（走 jsdelivr CDN，需要函数有网络出口）。
 * - 科学计算包（scipy / scikit-learn）较重，会增加冷启动耗时；建议在 Vercel Pro 计划部署。
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// pyodide 较重，动态 import，避免本地开发也加载它
let pyodideMod: any = null;
let pyodideInstance: any = null;
let loadPromise: Promise<any> | null = null;

// 白名单模块 → Pyodide 包名映射（其余为 Python 标准库，无需加载）
const PKG_MAP: Record<string, string> = {
  numpy: "numpy",
  scipy: "scipy",
  sklearn: "scikit-learn",
};

function depsFromCode(...codes: string[]): string[] {
  const all = codes.join("\n");
  const pkgs = new Set<string>();
  for (const mod of Object.keys(PKG_MAP)) {
    // 匹配 `import numpy` / `from scipy import ...` / `import sklearn.something`
    const re = new RegExp(
      `(?:^|[\\s.])from\\s+${mod}(?:[\\s.]|$)|(?:^|\\s)import\\s+${mod}(?:[\\s.]|$)`,
      "m",
    );
    if (re.test(all)) pkgs.add(PKG_MAP[mod]);
  }
  return [...pkgs];
}

async function getPyodide(): Promise<any> {
  if (pyodideInstance) return pyodideInstance;
  if (!loadPromise) {
    loadPromise = (async () => {
      if (!pyodideMod) pyodideMod = await import("pyodide");
      const py = await pyodideMod.loadPyodide();
      pyodideInstance = py;
      return py;
    })();
  }
  return loadPromise;
}

export interface PyRunResult {
  stdout: string;
  stderr: string;
  timedOut: boolean;
  ok: boolean;
}

/**
 * 在 Pyodide 内运行 server/math/py/<scriptName>（guard.py / runner.py）。
 * job 通过 sys.stdin 注入；stdout 通过 setStdout 捕获。
 */
export async function runPyInPyodide(scriptName: string, job: unknown): Promise<PyRunResult> {
  const py = await getPyodide();

  // 按需加载科学计算依赖（仅当仪器代码引用了对应模块）
  const deps = depsFromCode(
    (job as any)?.code ?? "",
    (job as any)?.tests_code ?? "",
  );
  if (deps.length) {
    try {
      await py.loadPackage(deps);
    } catch (e) {
      // 某些包在 Pyodide 中不可用；交给执行阶段报错，不阻断
      console.warn("[Pyodide] loadPackage 失败:", deps, e);
    }
  }

  try {
    // 把 stdout / stderr 重定向到 StringIO（比 setStdout 的 batched 更可靠：
    // Pyodide 的 sys.stdout 自带 .buffer，直接写 buffer 会绕过 setStdout 的捕获）。
    // 同时把 job 注入 sys.stdin（runner.py / guard.py 已兼容 StringIO）。
    py.globals.set("__job_json", JSON.stringify(job));
    await py.runPythonAsync(`
import sys, io
__soul_stdout = io.StringIO()
__soul_stderr = io.StringIO()
sys.stdout = __soul_stdout
sys.stderr = __soul_stderr
sys.stdin = io.StringIO(__job_json)
`);

    const scriptSrc = fs.readFileSync(path.join(__dirname, "py", scriptName), "utf8");
    await py.runPythonAsync(scriptSrc);

    // 从 Python 侧读回捕获内容
    const stdout = String(await py.runPythonAsync("__soul_stdout.getvalue()"));
    const stderr = String(await py.runPythonAsync("__soul_stderr.getvalue()"));

    return {
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      timedOut: false,
      ok: stderr.trim() === "" && stdout.trim() !== "",
    };
  } catch (e: any) {
    // 执行阶段抛出异常（如 import 失败）：尽量把 stderr 也带出来
    let stderr = "";
    try {
      stderr = String(await py.runPythonAsync("__soul_stderr.getvalue()"));
    } catch {
      /* 忽略 */
    }
    const message = String(e?.message ?? e);
    return {
      stdout: "",
      stderr: (stderr.trim() + "\n" + message).trim(),
      timedOut: false,
      ok: false,
    };
  }
}
