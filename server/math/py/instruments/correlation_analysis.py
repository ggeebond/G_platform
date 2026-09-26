"""
Core Instrument · correlation_analysis —— 两列相关分析（Pearson + Spearman）

方法：先按行配对并过滤非数值，再计算 Pearson（线性）与 Spearman（秩）相关。
输入：{"columns": {name: [values]}}
参数：{"x": "pruning_ratio", "y": "success_rate"}
"""
import numpy as np
from scipy import stats as sps


def _paired(data, params):
    cols = data.get("columns", {})
    xs_raw = cols.get(params.get("x", ""), [])
    ys_raw = cols.get(params.get("y", ""), [])
    pairs = [
        (float(a), float(b))
        for a, b in zip(xs_raw, ys_raw)
        if isinstance(a, (int, float)) and not isinstance(a, bool)
        and isinstance(b, (int, float)) and not isinstance(b, bool)
    ]
    return pairs


def run(data, params):
    pairs = _paired(data, params)
    if len(pairs) < 3:
        return {"n": len(pairs), "note": "配对样本不足（<3），无法计算相关"}
    xs = np.array([p[0] for p in pairs], dtype=float)
    ys = np.array([p[1] for p in pairs], dtype=float)
    if xs.std() == 0 or ys.std() == 0:
        return {"n": len(pairs), "note": "某一列恒定（方差为 0），相关无定义"}

    pr, pp = sps.pearsonr(xs, ys)
    sr, sp = sps.spearmanr(xs, ys)
    return {
        "n": int(len(pairs)),
        "pearson_r": float(pr), "pearson_p": float(pp),
        "spearman_r": float(sr), "spearman_p": float(sp),
    }


def test_perfect_linear():
    xs = [1.0, 2.0, 3.0, 4.0, 5.0]
    r = run({"columns": {"x": xs, "y": [2 * v for v in xs]}}, {"x": "x", "y": "y"})
    assert abs(r["pearson_r"] - 1.0) < 1e-12


def test_symmetric_parabola_low_pearson():
    # y = x²，x 对称 → 线性相关应接近 0（这是"线性 vs 非线性"的判别样例）
    xs = [-3.0, -2.0, -1.0, 0.0, 1.0, 2.0, 3.0]
    r = run({"columns": {"x": xs, "y": [v * v for v in xs]}}, {"x": "x", "y": "y"})
    assert abs(r["pearson_r"]) < 0.15


def test_unpaired_filtered():
    r = run({"columns": {"x": [1.0, "n/a", 3.0, 4.0, 5.0], "y": [1.0, 2.0, 3.0, 4.0, 5.0]}},
            {"x": "x", "y": "y"})
    assert r["n"] == 4
