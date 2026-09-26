"""
Scientific Sandbox · runner.py —— 确定性执行入口

工具代码契约（Toolsmith 与 Core Instruments 共用）：
    必须定义  def run(data: dict, params: dict) -> dict
    data   —— JSON 输入（列 / 分组），永远不是文件路径
    params —— 仪器参数
    返回值必须可 JSON 序列化且不含 NaN / Inf（allow_nan=False 强制）

测试代码契约：
    定义若干  def test_xxx(): ...（用 assert 断言）
    测试通过闭包直接访问工具命名空间里的 run

输入（stdin JSON）:
    {"mode": "run",  "code": "...", "data": {...}, "params": {...}}
    {"mode": "test", "code": "...", "tests_code": "..."}
输出（stdout JSON）:
    {"ok": true, "result": {...}}                       # mode=run
    {"ok": true, "tests": [{name,passed,error}, ...]}   # mode=test
    {"ok": false, "error": "traceback"}                  # 任何异常
"""
import json
import sys
import traceback


def _load_tool(code: str) -> dict:
    ns: dict = {"__name__": "instrument"}
    exec(compile(code, "<instrument>", "exec"), ns)  # noqa: S102 —— 前置已过 guard.py AST 白名单
    return ns


def _mode_run(job: dict) -> dict:
    ns = _load_tool(job["code"])
    run_fn = ns.get("run")
    if not callable(run_fn):
        raise RuntimeError("tool code must define run(data, params) -> dict")
    result = run_fn(job.get("data") or {}, job.get("params") or {})
    # NaN / Inf / 不可序列化 在这里统一被拒绝
    json.dumps(result, allow_nan=False)
    return result


def _mode_test(job: dict) -> list:
    ns = _load_tool(job["code"])
    tns = dict(ns)
    exec(compile(job["tests_code"], "<tests>", "exec"), tns)  # noqa: S102
    results = []
    for name in sorted(n for n in tns if n.startswith("test_") and callable(tns[n])):
        try:
            tns[name]()
            results.append({"name": name, "passed": True, "error": None})
        except Exception as exc:  # noqa: BLE001
            results.append({"name": name, "passed": False, "error": f"{type(exc).__name__}: {exc}"})
    return results


def _emit(obj: dict) -> None:
    """输出 JSON。优先写字节（CPython -I 模式）；Pyodide 下 sys.stdout 无 .buffer，回退字符串。

    末尾追加换行：Pyodide 的 setStdout({batched}) 仅在遇到换行或 flush 时才回调，
    不加换行会导致 stdout 捕获为空。CPython 侧 stdout 在进程退出时整体被读取，
    末尾换行对 JSON.parse 无影响。
    """
    data = json.dumps(obj, allow_nan=False, default=str) + "\n"
    try:
        sys.stdout.buffer.write(data.encode("utf-8"))  # type: ignore[attr-defined]
    except AttributeError:
        sys.stdout.write(data)


def main():
    out = {}
    try:
        # 关键：-I 模式会忽略 PYTHONIOENCODING，stdin 默认走 locale（Windows 上是 GBK），
        # 与 Node 的 UTF-8 错配会产生 surrogateescape 残渣。因此这里显式按字节读、UTF-8 解码。
        # Pyodide 环境下 sys.stdin 没有 .buffer，回退到字符串读取。
        try:
            raw = sys.stdin.buffer.read()
            job = json.loads(raw.decode("utf-8"))
        except AttributeError:
            job = json.loads(sys.stdin.read())
        mode = job.get("mode")
        if mode == "run":
            out = {"ok": True, "result": _mode_run(job)}
        elif mode == "test":
            out = {"ok": True, "tests": _mode_test(job)}
        else:
            out = {"ok": False, "error": f"unknown mode: {mode!r}"}
    except Exception:  # noqa: BLE001 —— 沙箱永不把 traceback 直接抛给调用方
        out = {"ok": False, "error": traceback.format_exc(limit=4)}
    _emit(out)


if __name__ == "__main__":
    main()
