#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
self_cleaning.py — 一个"退出即清理"的 Python 脚本模板（跨平台，重点照顾 Windows）。

无论你是：
  - 正常跑完退出
  - 按 Ctrl+C（SIGINT）
  - 被 SIGTERM 终止
都会保证：
  1) 终止本脚本启动的所有子进程（含整棵进程树，不会留下孤儿进程占着端口）
  2) 删除本脚本创建的所有临时目录 / 文件
  3) 关闭本脚本打开的服务器 / 释放端口

用法：
  python self_cleaning.py
  （可用环境变量 SELF_CLEAN_PORT 改端口，默认 8888，已避开 8000）

想把它改成"启动你自己的服务然后干净退出"？看文件底部 [你的命令区]。
"""

import atexit
import os
import signal
import shutil
import subprocess
import sys
import tempfile
import threading
import time
from http.server import HTTPServer, SimpleHTTPRequestHandler

# ============================================================
# 1. 资源登记：所有"垃圾"都先登记到这里，退出时统一回收
# ============================================================
REGISTRY = {
    "temp_dirs": [],   # 本脚本创建的临时目录
    "children": [],    # 本脚本启动的子进程（subprocess.Popen）
    "servers": [],     # 本脚本启动的 HTTP 服务器
}
_CLEANED = False
_LOCK = threading.Lock()


def log(msg: str) -> None:
    print(f"[self-clean] {msg}", flush=True)


# ============================================================
# 2. 进程树清理（Windows 用 taskkill /T /F；POSIX 用 SIGTERM）
# ============================================================
def kill_proc_tree(pid: int) -> None:
    if pid <= 0:
        return
    if os.name == "nt":
        # /T = 杀整棵进程树（含子进程）；/F = 强制
        subprocess.run(
            ["taskkill", "/F", "/T", "/PID", str(pid)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
    else:
        try:
            os.kill(pid, signal.SIGTERM)
        except ProcessLookupError:
            pass  # 已经没了


def _stop_children() -> None:
    for p in list(REGISTRY["children"]):
        if p.poll() is None:
            log(f"终止子进程 pid={p.pid}")
            kill_proc_tree(p.pid)
        try:
            p.wait(timeout=5)
        except Exception:
            pass


def _stop_servers() -> None:
    for srv in list(REGISTRY["servers"]):
        log("关闭 HTTP 服务器，释放端口")
        try:
            srv.shutdown()
        except Exception:
            pass


def _remove_temp_dirs() -> None:
    for d in list(REGISTRY["temp_dirs"]):
        if os.path.isdir(d):
            try:
                shutil.rmtree(d)
                log(f"已删除临时目录: {d}")
            except Exception as exc:  # 极少数权限问题：至少告诉你手动清
                log(f"删除失败（请手动清理）: {d} -> {exc}")


def cleanup() -> None:
    """统一的清理入口，幂等（多次调用只做一次）。"""
    global _CLEANED
    with _LOCK:
        if _CLEANED:
            return
        _CLEANED = True
    log("开始清理资源…")
    _stop_children()
    _stop_servers()
    _remove_temp_dirs()
    log("清理完成，无残留。")


# 注册到 atexit：覆盖正常退出 + 绝大多数异常退出
atexit.register(cleanup)


# ============================================================
# 3. 信号处理器：Ctrl+C / SIGTERM 时优雅退出（触发 atexit）
# ============================================================
def _on_signal(signum, _frame):
    log(f"收到信号 {signum}，准备退出…")
    # 不在信号处理里做重活；sys.exit 会走到 atexit.cleanup
    sys.exit(0)


signal.signal(signal.SIGINT, _on_signal)
signal.signal(signal.SIGTERM, _on_signal)


# ============================================================
# 4. 演示内容：创建"垃圾"资源（临时目录 + 本地服务器）
# ============================================================
def main() -> None:
    # --- 临时目录（退出时会被删）---
    td = tempfile.mkdtemp(prefix="soul_lab_")
    REGISTRY["temp_dirs"].append(td)
    log(f"创建临时目录: {td}")
    with open(os.path.join(td, "hello.txt"), "w", encoding="utf-8") as f:
        f.write("我会在脚本退出时被删除。\n")

    # --- 本地 HTTP 服务器（避开 8000；可用 SELF_CLEAN_PORT 改）---
    port = int(os.environ.get("SELF_CLEAN_PORT", "8888"))
    httpd = HTTPServer(("127.0.0.1", port), SimpleHTTPRequestHandler)
    REGISTRY["servers"].append(httpd)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    log(f"本地服务器已启动: http://127.0.0.1:{port}  （Ctrl+C 退出）")

    # ============================================================
    # [你的命令区] 想让它启动你自己的服务？把下面取消注释并改命令即可：
    #
    # child = subprocess.Popen(
    #     ["npm", "run", "dev:server"],
    #     cwd=r"C:\Users\xzd13\LearnBuddy\2026-09-19-22-55-24\soul-lab",
    # )
    # REGISTRY["children"].append(child)
    # log(f"已启动子进程 pid={child.pid}")
    #
    # 退出时 kill_proc_tree 会把它的整棵树一起杀掉，不会留下占端口的孤儿。
    # ============================================================

    # 自检出口：设了 SELF_CLEAN_AUTOEXIT 秒数后自动正常退出（用于验证清理，也便于无头运行）
    auto = os.environ.get("SELF_CLEAN_AUTOEXIT")
    if auto:
        try:
            secs = float(auto)
        except ValueError:
            secs = 5.0
        log(f"SELF_CLEAN_AUTOEXIT={secs}s 后自动退出（用于验证清理）")
        time.sleep(secs)
        return  # 正常返回 -> atexit.cleanup 运行

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        log("KeyboardInterrupt")
    # 无论怎么退出，atexit.cleanup 都会再跑一遍，保证清理


if __name__ == "__main__":
    main()
