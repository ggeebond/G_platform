"""
Core Instrument · change_point —— 单变量均值变点检测

方法：穷举分割点，最大化两侧均值差（每侧最少 min_side 个样本）。
     返回变点索引、前后均值与位移量。
输入：{"columns": {name: [values]}}
参数：{"column": "success_rate", "min_side": 3}
"""
import numpy as np


def run(data, params):
    col = params.get("column", "")
    min_side = max(2, int(params.get("min_side", 3)))
    raw = data.get("columns", {}).get(col, [])
    vals = [float(v) for v in raw if isinstance(v, (int, float)) and not isinstance(v, bool)]
    a = np.asarray(vals, dtype=float)

    if a.size < 2 * min_side:
        return {"n": int(a.size), "note": f"样本不足（需 ≥ {2 * min_side}），无法检测变点"}

    best_k, best_shift = min_side, 0.0
    for k in range(min_side, a.size - min_side + 1):
        shift = abs(a[:k].mean() - a[k:].mean())
        if shift > best_shift:
            best_shift, best_k = shift, k

    # 恒定序列：没有任何位移 → 显式报告，而不是崩溃
    if best_shift == 0.0:
        return {"n": int(a.size), "changepoint_index": None, "shift": 0.0,
                "note": "序列无均值位移（可能恒定）"}

    return {
        "n": int(a.size),
        "changepoint_index": int(best_k),
        "mean_before": float(a[:best_k].mean()),
        "mean_after": float(a[best_k:].mean()),
        "shift": float(best_shift),
    }


def test_clear_shift():
    vals = [5.0] * 6 + [1.0] * 6
    r = run({"columns": {"s": vals}}, {"column": "s"})
    assert r["changepoint_index"] == 6
    assert abs(r["mean_before"] - 5.0) < 1e-12
    assert abs(r["mean_after"] - 1.0) < 1e-12


def test_constant_series_has_zero_shift():
    r = run({"columns": {"s": [2.0] * 10}}, {"column": "s"})
    assert abs(r["shift"]) < 1e-12


def test_too_few_samples():
    r = run({"columns": {"s": [1.0, 2.0]}}, {"column": "s"})
    assert "note" in r
