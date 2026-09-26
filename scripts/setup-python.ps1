# ============================================================
# Soul Lab · Scientific Sandbox 环境引导
#
# 重建沙箱 Python 虚拟环境（.venv，不入库），并装白名单库 + 跑沙箱自检。
# 用法：在 soul-lab 目录下执行
#   powershell -ExecutionPolicy Bypass -File scripts\setup-python.ps1
#   （可用参数 -Python 指定基础解释器，默认取 PATH 里的 python）
# ============================================================
param(
    [string]$Python = "python"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot   # soul-lab/
$venv = Join-Path $root ".venv"

Write-Host "== 1/3 创建 venv：$venv"
if (-not (Test-Path $venv)) {
    & $Python -m venv $venv
    if ($LASTEXITCODE -ne 0) { throw "venv 创建失败：请确认机器上有 Python 3.10+" }
}

$venvPy = Join-Path $venv "Scripts\python.exe"

Write-Host "== 2/3 安装白名单库（numpy / scipy / scikit-learn）"
& $venvPy -m pip install --disable-pip-version-check numpy scipy scikit-learn
if ($LASTEXITCODE -ne 0) { throw "pip 安装失败" }

Write-Host "== 3/3 沙箱自检"
& $venvPy (Join-Path $root "server\math\py\selftest.py")
if ($LASTEXITCODE -ne 0) { throw "沙箱自检未通过" }

Write-Host ""
Write-Host "完成。服务端会自动使用 $venvPy"
Write-Host "（也可用环境变量 MATH_SANDBOX_PYTHON 指定其他解释器）"
