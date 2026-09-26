/**
 * Soul Lab — Paper Orb 身份（PRD FR-M4）
 *
 * 身份由论文自身状态**确定性**派生（AI 不参与），四类对应四种颜色与行为：
 *   related     紫  普通相关论文，远处漂浮
 *   signal      金  Frontier Signal，近期新出现且可能影响当前研究
 *   challenge   橙  可能挑战现有结论
 *   opportunity 绿  可能填补当前 Gap
 */
import type { PaperInsight } from '../types';
import type { OrbIdentity } from '../frontier/types';

export const ORB_IDENTITY_META: Record<
  OrbIdentity,
  { label: string; color: string; hint: string; ring: string | null }
> = {
  related: { label: 'Paper', color: '#B5A2FF', hint: '外部论文，远处漂浮', ring: null },
  signal: { label: 'Frontier Paper', color: '#FFD44D', hint: '近 7–30 天的新论文，可能影响当前研究', ring: '#FFE9A8' },
  challenge: { label: 'Boundary', color: '#FB923C', hint: '可能挑战现有结论（研究边界）', ring: '#FFCB9A' },
  opportunity: { label: 'Open Question', color: '#B6E64D', hint: '可能填补当前 Open Question', ring: '#D8F29A' },
};

/** 新近窗口：24 小时内的 supporting 论文视为 Frontier Signal */
const FRESH_MS = 24 * 60 * 60 * 1000;

export function orbIdentityOf(paper: PaperInsight): OrbIdentity {
  if (paper.relationType === 'conflicting') return 'challenge';
  if (paper.relationType === 'method') return 'opportunity';
  const fresh = Date.now() - paper.discoveredAt < FRESH_MS;
  if (paper.relationType === 'supporting' && fresh) return 'signal';
  return 'related';
}
