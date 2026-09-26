/**
 * Soul Lab — Research Journal
 *
 * Timeline 事件是给机器看的（SOUL_CREATED / DESIGN_ACCEPTED …）。
 * 这里把它们翻译成人话，让底部不再是 debugging UI。
 * 技术事件 ID 仍然保留，但默认不展示给研究者。
 */
import type { SoulEventType, TimelineEvent } from '../types';

export interface JournalEntry {
  id: string;
  at: number;
  /** 人话正文 */
  text: string;
  /** 事件色 */
  color: string;
  /** 图标语义 */
  glyph: string;
  actor: 'user' | 'agent';
  /** 保留技术事件，供调试面板使用 */
  technicalType: SoulEventType;
}

const META: Record<SoulEventType, { color: string; glyph: string }> = {
  SOUL_CREATED: { color: '#A3E635', glyph: '❦' },
  BASELINE_ADDED: { color: '#C08A3E', glyph: '⌇' },
  EXPERIMENT_PROPOSED: { color: '#C7F0D6', glyph: '◇' },
  DESIGN_ACCEPTED: { color: '#86EFAC', glyph: '❋' },
  DESIGN_REJECTED: { color: '#F87171', glyph: '◇' },
  RESULT_SUBMITTED: { color: '#FEF3C7', glyph: '⇪' },
  EVIDENCE_ACCEPTED: { color: '#FDE047', glyph: '✿' },
  EVIDENCE_INSUFFICIENT: { color: '#FBBF24', glyph: '◌' },
  EVIDENCE_CONTRADICTORY: { color: '#FB923C', glyph: '❧' },
  EVIDENCE_INVALID: { color: '#7FB79B', glyph: '×' },
  PETAL_WITHDRAWN: { color: '#7E9C8A', glyph: '↩' },
  LEAF_RESOLVED: { color: '#4ADE80', glyph: '✓' },
  PAPER_DISCOVERED: { color: '#A78BFA', glyph: '✦' },
  PAPER_ADDED_TO_MEMORY: { color: '#DDD6FE', glyph: '❖' },
};

/** 面向研究者的叙述，而不是状态机日志 */
const NARRATIVE: Record<SoulEventType, (e: TimelineEvent) => string> = {
  SOUL_CREATED: (e) => `种下了一个想法：${e.summary.replace(/^研究想法诞生：/, '')}`,
  BASELINE_ADDED: (e) => e.summary.replace(/^Baseline 根系延伸：/, '根系延伸，对照明确：'),
  EXPERIMENT_PROPOSED: (e) => e.summary.replace(/^实验提案：/, '提出了一个实验：'),
  DESIGN_ACCEPTED: (e) => `候选花瓣长出来了 · ${e.summary.split('：').slice(1).join('：') || '实验设计成立'}`,
  DESIGN_REJECTED: (e) => `这个设计还不能真正检验假设：${e.summary.split('：').slice(1).join('：')}`,
  RESULT_SUBMITTED: (e) => `上传了实验结果（${e.summary.match(/\d+/)?.[0] ?? '?'} 行数据）`,
  EVIDENCE_ACCEPTED: () => '证据通过审议，花瓣实体化',
  EVIDENCE_INSUFFICIENT: () => '证据还不足以支持结论，花瓣保持虚幻',
  EVIDENCE_CONTRADICTORY: (e) =>
    `发现了一条研究边界 · ${e.summary.split('：').slice(1).join('：') || '结论被削弱'}`,
  EVIDENCE_INVALID: () => '这次实验无效，只保留了实验记录',
  PETAL_WITHDRAWN: (e) => `你撤回了一片花瓣：${e.summary.split('：').slice(1).join('：') || ''}`,
  LEAF_RESOLVED: (e) => `理解了这个失败：${e.summary.split('：').slice(1).join('：') || ''}`,
  PAPER_DISCOVERED: (e) => `知识球飘入轨道 · ${e.summary.replace(/^Paper Scout 检索到/, '检索到')}`,
  PAPER_ADDED_TO_MEMORY: (e) => `加入长期记忆：${e.summary.split('：').slice(1).join('：') || ''}`,
};

export function toJournal(events: TimelineEvent[]): JournalEntry[] {
  return [...events]
    .sort((a, b) => a.at - b.at)
    .map((e) => ({
      id: e.id,
      at: e.at,
      text: (NARRATIVE[e.type] ?? (() => e.summary))(e),
      color: META[e.type]?.color ?? '#9BB6AA',
      glyph: META[e.type]?.glyph ?? '·',
      actor: e.actor,
      technicalType: e.type,
    }));
}

export function journalDateLabel(at: number): string {
  const d = new Date(at);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const y = new Date(today.getTime() - 86400000);
  const isYesterday = d.toDateString() === y.toDateString();
  if (isToday) return '今天';
  if (isYesterday) return '昨天';
  return d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
}

/** 按天分组，供 Journal 抽屉渲染 */
export function groupByDay(entries: JournalEntry[]): Array<{ label: string; items: JournalEntry[] }> {
  const groups: Array<{ label: string; items: JournalEntry[] }> = [];
  for (const e of entries) {
    const label = journalDateLabel(e.at);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(e);
    else groups.push({ label, items: [e] });
  }
  return groups;
}
