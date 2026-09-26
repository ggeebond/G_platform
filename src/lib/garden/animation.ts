/**
 * Soul Lab — 动画时序规范（毫秒）
 *
 * 所有动画都必须代表科研状态变化，禁止纯装饰爆炸与彩带。
 * 这些数值是产品规范，不是随手调的参数。
 */

export const GHOST_BIRTH = {
  /** 花心变亮 */
  coreGlow: 0,
  /** 流光沿花茎移动到花心 */
  streamStart: 120,
  streamEnd: 350,
  /** 花瓣出现并展开 */
  petalScaleStart: 350,
  petalScaleEnd: 750,
  /** 进入呼吸 */
  breathingStart: 900,
  total: 900,
} as const;

export const SOLIDIFY = {
  /** 停止呼吸 */
  stopBreathing: 0,
  /** 花瓣中心出现亮点 */
  coreSpark: 150,
  /** opacity .26 → .72 */
  opacityStart: 350,
  opacityEnd: 650,
  /** 内部叶脉出现 */
  veinsStart: 650,
  /** stroke 变亮 */
  strokeGlow: 900,
  /** 稳定 */
  settle: 1200,
  /** 花粉粒子 */
  pollenStart: 400,
  pollenEnd: 1400,
  total: 1600,
} as const;

export const YELLOW_LEAF_BIRTH = {
  /** 小芽出现 */
  sprout: 0,
  /** 叶片展开 */
  unfoldStart: 300,
  unfoldEnd: 500,
  /** 暂时绿色 */
  greenUntil: 500,
  /** 过渡黄绿 */
  transitionStart: 900,
  /** 完全枯黄 */
  ochreAt: 1200,
  /** 下垂 8° */
  droopAt: 1200,
  total: 1400,
} as const;

export const WITHDRAW = {
  glowOff: 0,
  opacityDrop: 200,
  strokeGrey: 500,
  foldBack: 700,
  total: 900,
} as const;

export const CAMERA = {
  /** Garden → Flower 推近 */
  dollyGardenToFlower: 800,
  /** Flower → Petal 推近 */
  pushToPetal: 900,
  /** 花瓣实体化时镜头轻微拉远 */
  celebrationPullback: 1600,
  celebrationDistance: 0.85,
  /** 阻尼系数（越大越快） */
  damping: 3.2,
  dampingFast: 4.6,
  /** Focus 顶栏 crossfade / 布局 morph 时长（ms），220–300 之间 */
  headerCrossfade: 260,
  /**
   * Focus 态横向偏移（视距的比例）：把花推到左侧 Research Focus Space 的中心，
   * 右侧 38% 留给 Research Workspace。约 0.17 ≈ 让花落在左侧 62% 的中线。
   */
  focusLateral: 0.17,
} as const;

/** 生命感：每株花的自主行为都不同步 */
export const IDLE = {
  /** 茎左右摆动 ±1.5° */
  stemAmplitude: 0.026,
  stemPeriodMin: 5.0,
  stemPeriodMax: 8.0,
  /** 花瓣呼吸 scale 1.00 ↔ 1.018 */
  petalBreathAmplitude: 0.018,
  petalBreathPeriodMin: 3.5,
  petalBreathPeriodMax: 6.0,
  /** 叶片独立摆动 rotationZ ±2° */
  leafSwayAmplitude: 0.035,
  leafSwayPeriodMin: 4.0,
  leafSwayPeriodMax: 7.0,
  /** 花心朝鼠标方向倾斜 */
  attentionTilt: 0.09,
} as const;

/** 统一的缓动 */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/** 把 0~1 的进度映射到某个时间段内的进度 */
export function phase(elapsed: number, start: number, end: number): number {
  if (end <= start) return elapsed >= end ? 1 : 0;
  return clamp01((elapsed - start) / (end - start));
}
