/**
 * Soul Lab — 语义 → 文案映射
 *
 * 视觉数值不再放在这里：
 *  · 3D 形态 / 布局 / 光照 → lib/garden/*（layout.ts、sunlight.ts、animation.ts）
 *  · 每株花的颜色语义     → components/garden/parts/*（按状态决定金/青柠/灰绿）
 *
 * 本文件只保留「状态 → 人话」，供 HUD 与 3D hover 状态牌使用。
 */
import type { PetalStatus } from '../types';

export const PETAL_STATUS_LABEL: Record<PetalStatus, string> = {
  candidate: 'Experiment Proposed · Waiting for result',
  solid: 'Evidence Accepted · Solidified',
  insufficient: 'Evidence Insufficient · Still ghost',
  withdrawn: 'Withdrawn by Researcher',
};

export const SOUL_STATUS_LABEL: Record<string, string> = {
  Growing: 'Growing',
  WaitingForResult: 'Waiting for Result',
  ReviewNeeded: 'Review Needed',
  PaperReady: 'Paper Ready',
  Archived: 'Archived',
};
