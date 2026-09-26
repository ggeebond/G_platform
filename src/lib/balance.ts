/**
 * Soul Lab — 数值平衡表（Balance Sheet）
 *
 * 所有「可调数值」的唯一来源。与 state/visual.ts、garden/layout.ts、garden/sunlight.ts 同权：
 * 这里是产品规范，不是随手调的参数；AI 不参与，代码可 review，调整只改这一处。
 *
 * 原则：本次重构「集中数值、不改变行为」——下述数字与重构前逐字一致，
 * 调参请在视觉确认后只改本文件（见 PRD v0.2 §4 的再平衡建议）。
 */

export const BALANCE_VERSION = 'v0.2';

/* ==================== 植物生命周期阈值 ==================== */
export const STAGE = {
  /** bloomed：论证自洽，可以写成论文 */
  bloomedMinSolid: 3,
  bloomedMaxCandidates: 0,
  bloomedMaxOpenLeaves: 1,
  /** mature：论证结构基本成型 */
  matureMinSolid: 2,
  matureAltSolid: 1,
  matureAltAcceptedReviews: 2,
} as const;

/* ==================== 花园阳光（= 论证被证据照亮的程度） ==================== */
export const SUNLIGHT = {
  base: 0.34,
  perSolidPetal: 0.12,
  perWaitingExperiment: 0.05,
  perMemoryPaper: 0.06,
  perResolvedLeaf: 0.04,
  perOpenLeaf: -0.06,
  perWithdrawnPetal: -0.1,
  /** 最低天光：再暗也不会全黑 */
  floor: 0.18,
  /** 阶段门限 */
  phaseMorning: 0.45,
  phaseNoon: 0.65,
  phaseGolden: 0.85,
} as const;

/* ==================== 黄叶严重程度阈值（|deltaPercent| 最不利指标） ==================== */
export const LEAF_SEVERITY = {
  refutationAt: 15,
  weakeningAt: 5,
} as const;

/* ==================== Paper Orbit 预算 ==================== */
export const ORB = {
  /** 单朵花最多渲染多少个知识球（超出进入远端聚合） */
  perSoulMax: 12,
  /** 整座花园同时渲染上限（性能预算） */
  globalMax: 60,
  shellBase: 1.55,
  shellStep: 0.15,
} as const;

/** 供 HUD / 调试展示：人类可读的阳光公式 */
export function sunlightFormula(): string {
  const s = SUNLIGHT;
  return `阳光 = ${s.base} + ${s.perSolidPetal}×实体花瓣 + ${s.perWaitingExperiment}×等待中实验 + ${s.perMemoryPaper}×记忆论文 + ${s.perResolvedLeaf}×已解决黄叶 − ${Math.abs(s.perOpenLeaf)}×未解决黄叶 − ${Math.abs(s.perWithdrawnPetal)}×撤回花瓣`;
}
