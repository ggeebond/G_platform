/**
 * Soul Lab — 确定性布局引擎
 *
 * 与 lib/state/visual.ts 同权：把语义状态映射为视觉数值。
 * AI 永不输出坐标 / 角度 / 半径。所有随机都来自稳定 hash，刷新后花园不变。
 */
import { forceCollide, forceRadial, forceSimulation, forceX, forceY } from 'd3-force';
import type { PaperInsight } from '../types';
import { ORB } from '../balance';
import type { SoulStage } from './types';

/* ==================== 植株几何常量 ====================
 * 3D 渲染与 CameraDirector 共用同一组常量，保证解析计算的
 * 花瓣世界坐标与实际渲染严格一致。
 */
export const STEM_HEIGHT = 2.15;
export const CORE_Y = STEM_HEIGHT + 0.13;
export const PETAL_RADIUS = 0.4;
export const PETAL_LENGTH = 0.92;
export const PETAL_WIDTH = 0.34;
export const LEAF_BASE_Y = STEM_HEIGHT * 0.3;

/** 花圃锚点：三块研究区域 + 一块新开垦区 */
export const CLUSTER_ANCHORS: Record<string, [number, number, number]> = {
  temporal: [-4.6, 0, 1.4],
  uncertainty: [4.7, 0, 0.5],
  perception: [-0.8, 0, -5.6],
  frontier: [2.0, 0, 5.4],
};

export const CLUSTER_LABELS: Record<string, string> = {
  temporal: 'Temporal Adaptation',
  uncertainty: 'Uncertainty & Robustness',
  perception: '3D Perception & Control',
  frontier: 'New Explorations',
};

/** 花圃在世界中的默认排序，保证布局稳定 */
export const CLUSTER_ORDER = ['temporal', 'uncertainty', 'perception', 'frontier'] as const;

/**
 * 不同 Soul 不同花色：从项目 id 稳定选取，远处即可区分。
 * 全部落在「花园色板」内：青柠 / 新绿 / 金黄 / 嫩绿 / 琥珀。
 */
export const SOUL_ACCENTS = ['#A3E635', '#4ADE80', '#FDE047', '#86EFAC', '#FBBF24'] as const;

/** 稳定 32-bit hash（FNV-1a 变体） */
export function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 由 id 稳定派生 0~1 浮点，用于相位 / 抖动 */
export function hashUnit(input: string, salt = 0): number {
  return (hash(`${input}#${salt}`) % 100000) / 100000;
}

export function accentFor(soulId: string): string {
  return SOUL_ACCENTS[hash(soulId) % SOUL_ACCENTS.length];
}

/* ==================== 植株在花圃内的站位 ==================== */

/**
 * 花圃内站位：最成熟的一株居中，其余按成熟度沿小环铺开。
 * 已按成熟度降序传入，返回顺序与传入一致。
 */
export function plotPosition(
  clusterId: string,
  indexInCluster: number,
  clusterSize: number,
): [number, number, number] {
  const anchor = CLUSTER_ANCHORS[clusterId] ?? CLUSTER_ANCHORS.frontier;
  if (indexInCluster === 0 || clusterSize === 1) {
    return [anchor[0], 0, anchor[2]];
  }
  const ring = indexInCluster - 1;
  const count = Math.max(clusterSize - 1, 1);
  const radius = 1.55 + Math.floor(ring / 6) * 1.15;
  const angle = (ring / count) * Math.PI * 2 + hashUnit(clusterId, ring) * 0.5;
  return [
    anchor[0] + Math.cos(angle) * radius,
    0,
    anchor[2] + Math.sin(angle) * radius,
  ];
}

/* ==================== 花瓣环 ==================== */

/**
 * 花瓣在花心周围的角度（弧度，XZ 平面，自 +X 轴起）。
 * State Engine 决定「有几片」，这里只决定「摆在哪」——纯确定性。
 */
export function petalRingAngle(index: number, total: number): number {
  if (total <= 0) return 0;
  const golden = 2.399963229728653; // 黄金角，避免规整得像齿轮
  // 小样本时用均分更端庄，大样本时用黄金角避免重叠
  if (total <= 6) return (index / total) * Math.PI * 2;
  return (index * golden) % (Math.PI * 2);
}

/** 花瓣外张角：开花程度越高越平展（rad） */
export function petalTilt(openness: number, stage: SoulStage): number {
  const base = stage === 'bud' ? 0.95 : 0.72;
  return base - openness * 0.42;
}

/** 花瓣在花心局部坐标中的位置（未套用 group 旋转） */
export function petalLocalPosition(index: number, total: number): [number, number, number] {
  const a = petalRingAngle(index, total);
  return [Math.cos(a) * PETAL_RADIUS, CORE_Y, Math.sin(a) * PETAL_RADIUS];
}

/* ==================== Petal Focus 镜头位姿 ==================== */

/** 花园默认观察点：决定每株花的「正面」朝向 */
export const GARDEN_EYE: [number, number, number] = [0, 7.6, 13.6];

export interface PetalFocusPose {
  /** 花心需要转到的 Y 旋转，使该花瓣正对镜头 */
  targetRotY: number;
  /** 花瓣旋转后的世界坐标（解析计算，与实际渲染一致） */
  petalWorld: [number, number, number];
  /** 镜头位置 */
  eye: [number, number, number];
  /** 镜头注视点 */
  lookAt: [number, number, number];
  /** 花瓣朝外的方位角 */
  azimuth: number;
}

/**
 * 花瓣主体的取景中心：从花心沿花瓣方向，走到花瓣中段。
 * 花瓣不是从花心长出来的一个点，而是从 PETAL_RADIUS 处再向外伸展 PETAL_LENGTH，
 * 并以 tilt 角上翘 —— 取景必须落在花瓣本体上，而不是它的根部。
 */
const FOCUS_MID = 0.45; // 沿花瓣长度取 45% 处
const FOCUS_TILT = 0.58; // 代表性地外张角（rad），花瓣外张区间很窄，取中值即可

/**
 * 计算 Petal Focus 的完整位姿。
 *
 * Three.js 中把局部 (x,0,z) 绕 Y 旋转 φ 后，向量角度由 θ 变为 θ − φ。
 * 因此要让角度为 θ 的花瓣朝向方位角 α，只需 φ = θ − α。
 * 全程解析求解，不依赖场景图，避免「相机追花瓣、花瓣追相机」的反馈抖动。
 */
export function petalFocusPose(
  plotPos: [number, number, number],
  index: number,
  total: number,
  distance = 2.45,
): PetalFocusPose {
  const theta = petalRingAngle(index, total);
  const dx = GARDEN_EYE[0] - plotPos[0];
  const dz = GARDEN_EYE[2] - plotPos[2];
  const azimuth = Math.atan2(dz, dx);
  const targetRotY = theta - azimuth;

  // 花瓣旋转后会落在方位角 azimuth 上，取其中段作为构图中心
  const reach = PETAL_RADIUS + PETAL_LENGTH * FOCUS_MID * Math.cos(FOCUS_TILT);
  const rise = CORE_Y + PETAL_LENGTH * FOCUS_MID * Math.sin(FOCUS_TILT);

  const lookAt: [number, number, number] = [
    plotPos[0] + Math.cos(azimuth) * reach,
    rise,
    plotPos[2] + Math.sin(azimuth) * reach,
  ];

  const eye: [number, number, number] = [
    lookAt[0] + Math.cos(azimuth) * distance,
    lookAt[1] + 0.5,
    lookAt[2] + Math.sin(azimuth) * distance,
  ];

  return { targetRotY, petalWorld: lookAt, eye, lookAt, azimuth };
}

/** Flower Focus：从花园视角推近到某一株花 */
export function flowerFocusPose(plotPos: [number, number, number]): {
  eye: [number, number, number];
  lookAt: [number, number, number];
} {
  const dx = GARDEN_EYE[0] - plotPos[0];
  const dz = GARDEN_EYE[2] - plotPos[2];
  const len = Math.hypot(dx, dz) || 1;
  const ux = dx / len;
  const uz = dz / len;
  const dist = 4.6;
  return {
    eye: [plotPos[0] + ux * dist, 3.15, plotPos[2] + uz * dist],
    lookAt: [plotPos[0], CORE_Y * 0.86, plotPos[2]],
  };
}

/* ==================== Paper Orbit（d3-force 求目标位置） ==================== */

export interface OrbTarget {
  paperId: string;
  position: [number, number, number];
  /** 轨道壳层半径，供渲染层做轻微的呼吸/漂移 */
  shell: number;
  /** 该知识球是否被吸附到某片花瓣附近 */
  anchoredToPetal: boolean;
}

/**
 * 用 d3-force 在花心周围的球壳上求解互不重叠的知识球位置。
 *
 * d3-force 只负责「算目标位置」，不参与渲染：
 * 先以稳定 hash 撒下初始点，再用 forceRadial 收拢到球壳、forceCollide 排开，
 * 迭代到收敛后把 2D 解映射回 XZ 平面，高度由稳定 hash 决定。
 * 结果是确定性的 —— 同一组论文每次得到同一个花园。
 *
 * @param petalAzimuth 论文 paperId → 关联花瓣的环状方位角（弧度）。
 *   与某片花瓣高度相关的论文会停在那片花瓣附近，而不是均匀绕圈 ——
 *   「这篇工作影响哪片花瓣」在空间上直接可见。
 */
export function computeOrbTargets(
  papers: PaperInsight[],
  center: [number, number, number],
  goldenAngleSeed = 0,
  petalAzimuth: Record<string, number> = {},
): OrbTarget[] {
  if (papers.length === 0) return [];

  const shell = ORB.shellBase + Math.min(papers.length, ORB.perSoulMax) * ORB.shellStep;
  const nodes = papers.map((p, i) => {
    const a = (i / papers.length) * Math.PI * 2 + goldenAngleSeed;
    const jitter = hashUnit(p.paperId, 1) - 0.5;
    return {
      id: p.paperId,
      x: Math.cos(a) * shell * (0.85 + jitter * 0.3),
      y: Math.sin(a) * shell * (0.85 + jitter * 0.3),
    };
  });

  // 被吸附的知识球的落点：沿花瓣方位角、比主壳层更靠外一点，让它悬浮在花瓣外侧
  const anchors: Record<string, { x: number; y: number }> = {};
  for (const p of papers) {
    const az = petalAzimuth[p.paperId];
    if (az === undefined) continue;
    anchors[p.paperId] = { x: Math.cos(az) * shell * 1.12, y: Math.sin(az) * shell * 1.12 };
  }

  const sim = forceSimulation(nodes as any)
    .force('radial', forceRadial(shell, 0, 0).strength(0.9))
    .force('collide', forceCollide(shell * 0.42).strength(0.85))
    .force('x', forceX(0).strength(0.015))
    .force('y', forceY(0).strength(0.015))
    .force('anchor', () => {
      for (const n of nodes as any[]) {
        const a = anchors[n.id];
        if (!a) continue;
        n.vx += (a.x - n.x) * 0.55;
        n.vy += (a.y - n.y) * 0.55;
      }
    })
    .stop();

  sim.tick(260);

  return nodes.map((n, i) => {
    const paper = papers[i];
    const anchored = anchors[paper.paperId] !== undefined;
    // 高度带：让轨道有体积感，而不是一个平面圈。被吸附的球与花瓣同高，视觉上更贴合
    const band = anchored
      ? (hashUnit(paper.paperId, 4) - 0.5) * 0.45
      : (hashUnit(paper.paperId, 2) - 0.5) * 1.35;
    return {
      paperId: paper.paperId,
      position: [
        center[0] + n.x,
        center[1] + band + 0.15,
        center[2] + n.y,
      ] as [number, number, number],
      shell,
      anchoredToPetal: anchored,
    };
  });
}

/** 花圃标牌的锚点高度 */
export const CLUSTER_PLAQUE_Y = 0.06;
