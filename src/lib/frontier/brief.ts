/**
 * Soul Lab — Morning Research Brief（FR-M15）
 *
 * 界面是花园，但 Agent 每天生成一份 Brief：按 Soul 汇总前沿信号计数与「最有用下一步动作」。
 * 关键：无实质变化时明说「No meaningful frontier change today」，不为推送而推送。
 */
import type { SoulDoc } from '../types';
import type { BriefSoulLine, FrontierScanResult, MorningBrief } from './types';

export const QUIET_LABEL = 'No meaningful frontier change today';

export function generateBrief(docs: SoulDoc[], scan: FrontierScanResult): MorningBrief {
  const lines: BriefSoulLine[] = docs.map((doc) => {
    const signals = scan.signals.filter((s) => s.soulId === doc.soul.id);
    const highPriority = signals.filter((s) => s.level === 'HIGH').length;
    const challenges = signals.filter((s) => s.orbIdentity === 'challenge').length;
    const possibleBaselines = signals.filter((s) => s.whatToDo.type === 'add_baseline').length;
    const relatedPapers = doc.papers.filter((p) => !p.inMemory).length;

    // 无 Signal 且无待归档新论文 → 今天对这张花没有实质变化
    const quiet = signals.length === 0 && relatedPapers === 0;
    const top = signals.find((s) => s.level === 'HIGH') ?? signals[0] ?? null;

    return {
      soulId: doc.soul.id,
      soulTitle: doc.soul.title,
      highPriority,
      signals: signals.length,
      relatedPapers,
      challenges,
      possibleBaselines,
      mostUsefulNext: quiet ? null : (top?.whatToDo.detail ?? null),
      quiet,
    };
  });

  return {
    generatedAt: Date.now(),
    totals: { scanned: scan.scanned, relevant: scan.relevant, affecting: scan.affecting },
    lines,
  };
}
