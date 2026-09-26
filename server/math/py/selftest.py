"""
Scientific Sandbox · selftest.py —— 沙箱自检（开发期用，不是沙箱内代码）

验证三件事：
1. guard 拒绝危险代码（import socket / open() / dunder 访问），放行 numpy
2. 每个 Core Instrument 在真实子进程里通过全部测试
3. 确定性：同输入两次运行 → 逐字节一致输出

用法：cd server/math/py && python selftest.py（用 venv 解释器）
"""
import json
import pathlib
import subprocess
import sys

PY = sys.executable
HERE = pathlib.Path(__file__).resolve().parent


def _run(args, stdin_bytes: bytes):
    # 与 server/math/sandbox.ts 相同的字节通道（绕开 locale 编码错配）
    return subprocess.run(
        [PY, "-I", *args],
        input=stdin_bytes, capture_output=True, timeout=90,
    )


def guard(code, tests=""):
    p = _run([str(HERE / "guard.py")], json.dumps({"code": code, "tests_code": tests}).encode("utf-8"))
    return json.loads(p.stdout.decode("utf-8"))


def runner(job):
    p = _run([str(HERE / "runner.py")], json.dumps(job).encode("utf-8"))
    return json.loads(p.stdout.decode("utf-8"))


def main():
    failures = []

    # ---- 1. guard 的拒绝 / 放行 ----
    cases = [
        ("import socket\n", False, "import socket"),
        ("import subprocess as sp\n", False, "import subprocess"),
        ("with open('x.txt') as f:\n    pass\n", False, "open()"),
        ("y = eval('1+1')\n", False, "eval()"),
        ("import ctypes\n", False, "import ctypes"),
        ("import numpy as np\nimport scipy.stats as st\n", True, "numpy+scipy"),
    ]
    for src, expect_ok, label in cases:
        r = guard(src)
        if r["ok"] != expect_ok:
            failures.append(f"guard[{label}]: 期望 ok={expect_ok}，实际 {r}")
        print(f"[{'ok' if r['ok'] == expect_ok else 'FAIL'}] guard: {label} -> ok={r['ok']}")

    # ---- 2. 每个 Core Instrument：guard 通过 + 全部测试通过 ----
    for f in sorted((HERE / "instruments").glob("*.py")):
        code = f.read_text(encoding="utf-8")
        g = guard(code)
        if not g["ok"]:
            failures.append(f"{f.name}: guard 拒绝 -> {g['violations']}")
            print(f"[FAIL] {f.name}: guard {g['violations']}")
            continue
        t = runner({"mode": "test", "code": code, "tests_code": ""})
        if not t.get("ok"):
            failures.append(f"{f.name}: runner error -> {t.get('error')}")
            print(f"[FAIL] {f.name}: runner {t.get('error', '')[:200]}")
            continue
        bad = [x for x in t["tests"] if not x["passed"]]
        total = len(t["tests"])
        print(f"[{'ok' if not bad else 'FAIL'}] {f.name}: {total - len(bad)}/{total} tests passed")
        for x in bad:
            failures.append(f"{f.name}::{x['name']}: {x['error']}")

    # ---- 3. 确定性：同输入两次运行 ----
    code = (HERE / "instruments" / "basic_statistics.py").read_text(encoding="utf-8")
    data = {"columns": {"x": [1.0, 2.0, 3.0, 4.0, 5.0]}}
    r1 = runner({"mode": "run", "code": code, "data": data, "params": {"columns": ["x"]}})
    r2 = runner({"mode": "run", "code": code, "data": data, "params": {"columns": ["x"]}})
    if not (r1.get("ok") and r2.get("ok")):
        failures.append(f"确定性运行失败: {r1} / {r2}")
    elif r1["result"] != r2["result"]:
        failures.append("确定性被破坏：同输入两次运行结果不一致")
        print("[FAIL] determinism")
    else:
        print("[ok] determinism: 同输入两次运行输出逐字节一致")

    print()
    if failures:
        print("FAILURES:")
        for x in failures:
            print(" -", x)
        sys.exit(1)
    print("ALL SANDBOX SELFTESTS PASSED")


if __name__ == "__main__":
    main()
