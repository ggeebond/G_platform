/**
 * Soul Lab — Research Garden 领域模型
 *
 * 一级语义：一篇正在形成的 Paper = 一株植物（Soul Flower）。
 * 花园不是「一个 Soul 的可视化」，而是「多个 Soul 构成的研究世界」。
 */
import type { SoulDoc } from '../types';

/** 植物生命周期：Idea → 实验累积 → 证据完整 → Paper 成型 */
export type SoulStage = 'bud' | 'growing' | 'mature' | 'bloomed';

/** 花圃：同一技术路线自然聚成一块研究区域 */
export interface GardenCluster {
  id: string;
  label: string;
  /** 花圃在世界坐标中的锚点 */
  anchor: [number, number, number];
  soulIds: string[];
}

/** 一株花：由一个真实的 SoulDoc 驱动，不含任何手写视觉常量 */
export interface GardenPlot {
  id: string;
  title: string;
  stage: SoulStage;
  /** 该花主题色（不同 Soul 不同花色，远处即可区分项目） */
  accent: string;
  clusterId: string;
  /** 世界坐标，由 layout 确定性计算 */
  position: [number, number, number];

  // —— 由 SoulDoc 派生的计数（供 HUD / 标签 / 花形使用）——
  solid: number;
  candidate: number;
  insufficient: number;
  withdrawn: number;
  leaves: number;
  leafResolved: number;
  baselines: number;
  memoryPapers: number;
  freshPapers: number;
}

/** 两株花之间的 Research Lineage */
export interface LineageEdge {
  id: string;
  from: string;
  to: string;
  relation: 'extends' | 'related' | 'contradicts';
  /** 0~1，决定藤蔓亮度与粒子密度 */
  strength: number;
  reason: string;
}

export interface GardenModel {
  plots: GardenPlot[];
  clusters: GardenCluster[];
  lineages: LineageEdge[];
  /** soulId → doc，渲染层按需读取 */
  byId: Record<string, SoulDoc>;
}

/** 花蕾的核心视觉参数（确定性，AI 不参与） */
export interface FlowerMetrics {
  /** 环状花瓣总数（含所有状态） */
  petalCount: number;
  leafCount: number;
  /** 0~1 开花程度，驱动花瓣外张角 */
  openness: number;
}
