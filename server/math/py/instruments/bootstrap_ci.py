"""
Core Instrument · bootstrap_ci —— 均值差的 Bootstrap 置信区间

方法：对 baseline / treatment 两组做重抽样（固定种子 → 确定性），
     报告均值差的双侧 95% CI 与是否包含 0。
输入：{"groups": {"baseline": {col: [...]}, "treatment": {col: [...]}}}
参数：{"column": "success_rate", "iterations": 2000}
"""
import numpy as np


def run(data, params):
    groups = data.get("groups", {})
    col = params.get("column", "")
    iters = int(params.get("iterations", 2000))
    iters = max(200, min(iters, 20000))

    def _vals(name):
        raw = groups.get(name, {}).get(col, [])
        return np.asarray(
            [float(v) for v in raw if isinstance(v, (int, float)) and not isinstance(v, bool)],
            dtype=float,
        )

    b = _vals("baseline")
    t = _vals("treatment")
    if b.size < 2 or t.size < 2:
        return {"n_baseline": int(b.size), "n_treatment": int(t.size),
                "note": "任一组样本 <2，无法 bootstrap"}

    rng = np.random.default_rng(42)  # 固定种子：同一输入永远得到同一 CI
    diffs = np.empty(iters)
    for i in range(iters):
        db = b[rng.integers(0, b.size, b.size)]
        dt = t[rng.integers(0, t.size, t.size)]
        diffs[i] = dt.mean() - db.mean()

    lo, hi = float(np.percentile(diffs, 2.5)), float(np.percentile(diffs, 97.5))
    return {
        "n_baseline": int(b.size), "n_treatment": int(t.size),
        "observed_delta": float(t.mean() - b.mean()),
        "ci95": [lo, hi],
        "ci_excludes_zero": bool(lo > 0 or hi < 0),
    }


def test_shifted_groups_ci_excludes_zero():
    data = {"groups": {"baseline": {"s": [0.0] * 8}, "treatment": {"s": [1.0] * 8}}}
    r = run(data, {"column": "s", "iterations": 1000})
    assert r["ci_excludes_zero"] is True
    assert r["ci95"][0] > 0.9


def test_identical_groups_ci_contains_zero():
    data = {"groups": {"baseline": {"s": [1.0, 2.0, 3.0]}, "treatment": {"s": [1.0, 2.0, 3.0]}}}
    r = run(data, {"column": "s", "iterations": 1000})
    assert r["ci_excludes_zero"] is False
    assert r["ci95"][0] <= 0.0 <= r["ci95"][1]


def test_deterministic():
    data = {"groups": {"baseline": {"s": [0.2, 0.4, 0.3, 0.5]},
                       "treatment": {"s": [0.6, 0.8, 0.7, 0.9]}}}
    r1 = run(data, {"column": "s", "iterations": 500})
    r2 = run(data, {"column": "s", "iterations": 500})
    assert r1["ci95"] == r2["ci95"]
