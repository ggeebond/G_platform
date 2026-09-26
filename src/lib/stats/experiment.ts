/**
 * Soul Lab — 确定性统计（不经过 AI）
 * 上传结果后，mean / std / delta / n 全部由这里计算。
 */
import { mean, standardDeviation } from 'simple-statistics';
import type { MetricStat, ResultMapping } from '../types';

export class StatsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StatsError';
  }
}

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseError';
  }
}

type Row = Record<string, unknown>;

function toNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const n = Number(v.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function computeStats(rows: Row[], mapping: ResultMapping): MetricStat[] {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new StatsError('数据表为空，无法计算统计量');
  }
  const { groupColumn, baselineLabel, treatmentLabel, metricColumns } = mapping;
  if (!groupColumn || !baselineLabel || !treatmentLabel) {
    throw new StatsError('列映射不完整：缺少分组列或对照组/实验组取值');
  }
  if (!metricColumns || metricColumns.length === 0) {
    throw new StatsError('未选择任何指标列');
  }
  if (!(groupColumn in (rows[0] as object))) {
    throw new StatsError(`分组列「${groupColumn}」不存在于数据中`);
  }

  const baselineRows = rows.filter((r) => String(r[groupColumn]).trim() === baselineLabel);
  const treatmentRows = rows.filter((r) => String(r[groupColumn]).trim() === treatmentLabel);

  if (baselineRows.length === 0) throw new StatsError(`未找到对照组数据：${baselineLabel}`);
  if (treatmentRows.length === 0) throw new StatsError(`未找到实验组数据：${treatmentLabel}`);

  return metricColumns.map((metric) => {
    if (!(metric in (rows[0] as object))) {
      throw new StatsError(`指标列「${metric}」不存在于数据中`);
    }
    const b = baselineRows.map((r) => toNumber(r[metric])).filter((n): n is number => n !== null);
    const t = treatmentRows.map((r) => toNumber(r[metric])).filter((n): n is number => n !== null);
    if (b.length === 0 || t.length === 0) {
      throw new StatsError(`指标列「${metric}」没有可解析的数值`);
    }
    const bMean = mean(b);
    const tMean = mean(t);
    const delta = tMean - bMean;
    return {
      metric,
      baseline: { mean: bMean, std: b.length > 1 ? standardDeviation(b) : 0, n: b.length },
      treatment: { mean: tMean, std: t.length > 1 ? standardDeviation(t) : 0, n: t.length },
      delta,
      deltaPercent: bMean !== 0 ? (delta / bMean) * 100 : 0,
    };
  });
}

/** 把统计量转成给 Evidence Reviewer 看的确定性文本（AI 只做语义判断） */
export function statsToBrief(stats: MetricStat[], mapping: ResultMapping, rows: number): string {
  const head = `样本量 ${rows} 行；对照组「${mapping.baselineLabel}」 vs 实验组「${mapping.treatmentLabel}」。`;
  const body = stats
    .map((s) => {
      const dir = s.delta >= 0 ? '+' : '';
      return `${s.metric}: baseline ${s.baseline.mean.toFixed(3)} ± ${s.baseline.std.toFixed(3)} (n=${s.baseline.n}) → treatment ${s.treatment.mean.toFixed(3)} ± ${s.treatment.std.toFixed(3)} (n=${s.treatment.n})，delta ${dir}${s.delta.toFixed(3)} (${dir}${s.deltaPercent.toFixed(1)}%)`;
    })
    .join('；');
  return `${head}${body}。`;
}

export function formatNumber(v: number, digits = 3): string {
  if (!Number.isFinite(v)) return '—';
  return v.toFixed(digits);
}
