/**
 * Soul Lab — 阳光机制（Garden Sunlight Engine）
 *
 * 花园的阳光不是装饰，而是「这座花园里现在有多少条论证真正被证据照亮」的确定性函数。
 * 它和 lib/state/visual.ts、lib/garden/layout.ts 同权：把语义状态映射为视觉数值，
 * AI 不参与，也不输出任何光照常量。
 *
 * 规则（可被 review，而不是藏在模型权重里）：
 *   阳光 = 0.34
 *        + 0.12 × 实体花瓣        （证据被保留）
 *        + 0.05 × 等待结果的实验  （正在推进）
 *        + 0.06 × Soul Memory 论文（知识沉淀）
 *        + 0.04 × 已解决黄叶      （边界被消化）
 *        − 0.06 × 未解决黄叶      （悬而未决的失败边界会遮光）
 *        − 0.10 × 撤回花瓣        （被研究者收回的结论）
 */

import type { SoulDoc } from '../types';
import { SUNLIGHT, sunlightFormula } from '../balance';

export type SunPhase = 'dawn' | 'morning' | 'noon' | 'golden';

export interface SunContributor {
  label: string;
  delta: number;
}

export interface GardenSunlight {
  /** 0 ~ 1，整座花园的光照强度 */
  level: number;
  phase: SunPhase;
  phaseLabel: string;
  hint: string;
  contributors: SunContributor[];
  formula: string;

  /* ---------- 渲染数值（唯一映射点） ---------- */
  skyColor: string;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  groundColor: string;

  sunColor: string;
  sunIntensity: number;
  /** 太阳方向：决定阴影落向，随阶段缓慢移动 */
  sunPosition: [number, number, number];

  hemisphereSky: string;
  hemisphereGround: string;
  hemisphereIntensity: number;

  ambientColor: string;
  ambientIntensity: number;

  fillColor: string;
  fillIntensity: number;

  /** 地面光斑：阳光打在花圃上的可见痕迹 */
  lightPoolColor: string;
  lightPoolOpacity: number;

  dustColor: string;
  dustOpacity: number;
  dustSize: number;

  mistColor: string;
  mistOpacity: number;
}

const PHASES: Array<{ key: SunPhase; label: string; min: number; hint: string; sun: string }> = [
  { key: 'dawn', label: '晨曦', min: 0, hint: '研究刚起步，花园只有微弱的天光。', sun: '#FFC98A' },
  { key: 'morning', label: '上午', min: SUNLIGHT.phaseMorning, hint: '第一条证据链被照亮，阳光开始稳定。', sun: '#FFD76A' },
  { key: 'noon', label: '正午', min: SUNLIGHT.phaseNoon, hint: '论证结构清晰，花园处在充足光照下。', sun: '#FFE9A8' },
  { key: 'golden', label: '金色时刻', min: SUNLIGHT.phaseGolden, hint: '多条证据链同时成立，整座花园被金色照亮。', sun: '#FFD44D' },
];

export function phaseOf(level: number) {
  let picked = PHASES[0];
  for (const p of PHASES) if (level >= p.min) picked = p;
  return picked;
}

/* ---------- 颜色插值 ---------- */

function toRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function mixHex(a: string, b: string, t: number): string {
  const [r1, g1, b1] = toRgb(a);
  const [r2, g2, b2] = toRgb(b);
  const k = Math.max(0, Math.min(1, t));
  const to = (x: number, y: number) => Math.round(x + (y - x) * k).toString(16).padStart(2, '0');
  return `#${to(r1, r2)}${to(g1, g2)}${to(b1, b2)}`;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/* ---------- 主函数 ---------- */

export function computeGardenSunlight(docs: SoulDoc[]): GardenSunlight {
  const petals = docs.flatMap((d) => d.petals);
  const solid = petals.filter((p) => p.status === 'solid').length;
  const withdrawn = petals.filter((p) => p.status === 'withdrawn').length;
  const waiting = docs.flatMap((d) => d.experiments).filter((e) => e.status === 'designAccepted').length;
  const memory = docs.flatMap((d) => d.papers).filter((p) => p.inMemory).length;
  const openLeaf = docs.flatMap((d) => d.leaves).filter((l) => l.status === 'warning').length;
  const resolvedLeaf = docs.flatMap((d) => d.leaves).filter((l) => l.status === 'resolved').length;

  const contributors: SunContributor[] = [
    { label: '基础天光', delta: SUNLIGHT.base },
    { label: `实体花瓣 × ${solid}`, delta: SUNLIGHT.perSolidPetal * solid },
    { label: `等待结果的实验 × ${waiting}`, delta: SUNLIGHT.perWaitingExperiment * waiting },
    { label: `Soul Memory 论文 × ${memory}`, delta: SUNLIGHT.perMemoryPaper * memory },
    { label: `已解决黄叶 × ${resolvedLeaf}`, delta: SUNLIGHT.perResolvedLeaf * resolvedLeaf },
    { label: `未解决黄叶 × ${openLeaf}`, delta: SUNLIGHT.perOpenLeaf * openLeaf },
    { label: `撤回花瓣 × ${withdrawn}`, delta: SUNLIGHT.perWithdrawnPetal * withdrawn },
  ];

  const raw = contributors.reduce((sum, c) => sum + c.delta, 0);
  const level = clamp01(raw) < SUNLIGHT.floor ? SUNLIGHT.floor : clamp01(raw);
  const phase = phaseOf(level);

  // 光照越强：天空更亮、雾更远、地表更绿
  // 分层原则：大面积（天空 / 草地）必须压暗，最亮颜色只留给小面积科研状态，
  // 否则地面会吃掉画面里所有信息（相机俯视时地面占画幅 ~85%）。
  const skyColor = mixHex('#0A4438', '#0E5B48', level); // 天空 / 远背景
  const fogColor = mixHex('#0E5B48', '#2FA85B', level * 0.35); // 雾 → 向草地过渡
  const groundColor = mixHex('#123D28', '#2FA85B', level * 0.5); // 草地：大面积 → 压暗

  // 太阳位置随阶段移动 —— 阴影方向因此会缓慢变化
  const t = (level - SUNLIGHT.floor) / (1 - SUNLIGHT.floor);
  const sunPosition: [number, number, number] = [
    -11 + 20 * t,
    7 + 9 * t,
    8 - 15 * t,
  ];

  return {
    level,
    phase: phase.key,
    phaseLabel: phase.label,
    hint: phase.hint,
    contributors,
    formula: sunlightFormula(),

    skyColor,
    fogColor,
    fogNear: 16 - 4 * t,
    fogFar: 46 - 6 * t,
    groundColor,

    sunColor: phase.sun,
    sunIntensity: 0.7 + 0.85 * level,
    sunPosition,

    hemisphereSky: phase.sun,
    hemisphereGround: mixHex('#123D28', '#2FA85B', level * 0.5),
    hemisphereIntensity: 0.45 + 0.6 * level,

    ambientColor: level >= 0.65 ? '#FFF2C2' : '#FFD76A',
    ambientIntensity: 0.22 + 0.4 * level,

    // 低光照时补光偏暖橙（黄昏感），高光照时补 Soul light，避免整场偏色
    fillColor: level < 0.55 ? '#FFB870' : '#B9F59A',
    fillIntensity: 0.62 - 0.3 * level,

    lightPoolColor: '#72D96B',
    lightPoolOpacity: 0.07 + 0.3 * level,

    dustColor: '#FFE9A8',
    dustOpacity: 0.2 + 0.5 * level,
    dustSize: 0.032 + 0.016 * level,

    mistColor: '#72D96B',
    mistOpacity: 0.03 + 0.07 * level,
  };
}
