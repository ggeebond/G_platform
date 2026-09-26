"""
Core Instrument · basic_statistics —— 基础描述统计

方法：逐列计算 n / mean / std(无偏) / min / 分位数 / max；
     非数值项（如 "n/a"）在配对前被过滤。
输入：{"columns": {name: [values]}}
参数：{"columns": ["success_rate", ...]} —— 缺省 = 全部列
"""
import numpy as np


def run(data, params):
    cols = data.get("columns", {})
    wanted = params.get("columns") or list(cols)
    out = {}
    for name in wanted:
        vals = [v for v in cols.get(name, []) if isinstance(v, (int, float)) and not isinstance(v, bool)]
        if not vals:
            out[name] = {"n": 0}
            continue
        a = np.asarray(vals, dtype=float)
        out[name] = {
            "n": int(a.size),
            "mean": float(a.mean()),
            "std": float(a.std(ddof=1)) if a.size > 1 else 0.0,
            "min": float(a.min()),
            "q25": float(np.percentile(a, 25)),
            "median": float(np.percentile(a, 50)),
            "q75": float(np.percentile(a, 75)),
            "max": float(a.max()),
        }
    return {"per_column": out}


def test_known_mean():
    r = run({"columns": {"x": [1.0, 2.0, 3.0, 4.0]}}, {"columns": ["x"]})["per_column"]["x"]
    assert abs(r["mean"] - 2.5) < 1e-12
    assert abs(r["std"] - 1.2909944487358056) < 1e-9
    assert r["n"] == 4


def test_empty_column():
    r = run({"columns": {"x": []}}, {"columns": ["x"]})["per_column"]["x"]
    assert r["n"] == 0


def test_non_numeric_filtered():
    r = run({"columns": {"x": [1.0, "n/a", 3.0, None]}}, {"columns": ["x"]})["per_column"]["x"]
    assert r["n"] == 2
    assert abs(r["mean"] - 2.0) < 1e-12
