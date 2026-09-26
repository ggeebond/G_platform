"""
Scientific Sandbox · guard.py —— AST 静态校验（任何代码执行前必过）

职责：
- import 白名单：只允许科学计算库（numpy / scipy / sklearn / math / statistics 等）
- 禁用：文件读写、网络、子进程、动态执行、系统访问、危险的 dunder 访问

输入（stdin JSON）: {"code": "...", "tests_code": "..."}
输出（stdout JSON）:
  {"ok": bool, "violations": [{"where": "code|tests_code", "line": int, "rule": str, "detail": str}]}

安全模型（诚实声明）：这是防 LLM 写出危险代码的 best-effort 静态防护，
不是容器级隔离。生产级的答案是容器（见项目已知限制）。
"""
import ast
import json
import sys

# 只允许这些顶层模块；geomstats / pandas 等按 Tool Requirement 反馈逐步放行
WHITELIST_MODULES = {
    "numpy", "scipy", "sklearn",
    "math", "statistics", "typing",
    "itertools", "functools", "collections", "dataclasses",
    "__future__",
}

# 禁止调用的函数名（无论来源）
BANNED_CALLS = {
    "open", "eval", "exec", "compile", "__import__",
    "input", "breakpoint", "exit", "quit", "help",
    "system", "popen", "Popen", "urlopen", "spawn", "spawnl",
}

# 允许出现的 dunder 名（其余 dunder 属性访问一律拒绝，如 x.__globals__）
ALLOWED_DUNDERS = {"__future__", "__name__", "__all__", "__version__"}


def check(source: str, where: str):
    violations = []
    tree = ast.parse(source)

    for node in ast.walk(tree):
        # ---- import 白名单 ----
        if isinstance(node, ast.Import):
            for alias in node.names:
                root = alias.name.split(".")[0]
                if root not in WHITELIST_MODULES:
                    violations.append({
                        "where": where, "line": node.lineno, "rule": "import_whitelist",
                        "detail": f"import {alias.name} 不在白名单",
                    })
        elif isinstance(node, ast.ImportFrom):
            root = (node.module or "").split(".")[0]
            if root not in WHITELIST_MODULES:
                violations.append({
                    "where": where, "line": node.lineno, "rule": "import_whitelist",
                    "detail": f"from {node.module} import ... 不在白名单",
                })

        # ---- 禁用调用 ----
        elif isinstance(node, ast.Call):
            func = node.func
            name = None
            if isinstance(func, ast.Name):
                name = func.id
            elif isinstance(func, ast.Attribute):
                name = func.attr
            if name and name in BANNED_CALLS:
                violations.append({
                    "where": where, "line": node.lineno, "rule": "banned_call",
                    "detail": f"禁止调用 {name}()",
                })

        # ---- 危险 dunder 属性访问 ----
        elif isinstance(node, ast.Attribute):
            attr = node.attr
            if attr.startswith("__") and attr.endswith("__") and attr not in ALLOWED_DUNDERS:
                violations.append({
                    "where": where, "line": node.lineno, "rule": "dunder_access",
                    "detail": f"禁止访问 {attr}",
                })

    return violations


def main():
    # 显式按字节读、UTF-8 解码（-I 模式会忽略 PYTHONIOENCODING，默认走 locale）
    # Pyodide 环境下 sys.stdin 没有 .buffer，回退到字符串读取。
    try:
        try:
            job = json.loads(sys.stdin.buffer.read().decode("utf-8"))
        except AttributeError:
            job = json.loads(sys.stdin.read())
    except Exception as exc:  # noqa: BLE001 —— 守卫自身永不崩溃
        _emit({"ok": False, "violations": [
            {"where": "stdin", "line": 0, "rule": "bad_input", "detail": str(exc)},
        ]})
        return

    violations = []
    for key in ("code", "tests_code"):
        src = job.get(key) or ""
        if not src.strip():
            continue
        try:
            violations += check(src, key)
        except SyntaxError as exc:
            violations.append({
                "where": key, "line": exc.lineno or 0, "rule": "syntax",
                "detail": f"语法错误: {exc.msg}",
            })

    _emit({"ok": len(violations) == 0, "violations": violations})


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


if __name__ == "__main__":
    main()
