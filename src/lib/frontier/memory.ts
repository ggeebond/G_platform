/**
 * Soul Lab — Research Memory & Novelty Gate（FR-M12）
 *
 * 「不能每天重复推 Diffusion Policy」的地基：系统必须知道用户已经看过什么。
 *   · 论文级去重：paperId 已在记忆 → 不生成新 Signal
 *   · 机制级去重：keyMechanism 已见于记忆 → 不标记为「新信息」
 *
 * 纯确定性，可单测。语义判断（这篇到底值不值得看）由上层 Agent 负责，
 * 但「是否新」永远先过这道确定性闸门。
 */
import type { SoulDoc } from '../types';
import type { PaperMatch } from '../../../shared/schemas';
import type { NoveltyDecision, ResearchMemory } from './types';

export function emptyMemory(): ResearchMemory {
  return { seenPaperIds: [], knownMechanisms: [], pushedSignalIds: [] };
}

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/** 从现有 SoulDocs 建立 / 补全研究记忆：所有出现过的论文 + 已加入记忆的机制 */
export function memoryFromDocs(docs: SoulDoc[], base: ResearchMemory = emptyMemory()): ResearchMemory {
  const seen = new Set(base.seenPaperIds);
  const mechanisms = new Set(base.knownMechanisms);

  for (const doc of docs) {
    for (const p of doc.papers) {
      seen.add(p.paperId);
      if (p.inMemory && p.keyMechanism) mechanisms.add(norm(p.keyMechanism));
    }
  }

  return {
    seenPaperIds: [...seen],
    knownMechanisms: [...mechanisms],
    pushedSignalIds: [...base.pushedSignalIds],
  };
}

/** Novelty Gate：逐条候选给出「是否新」的确定性判定 */
export function evaluateNovelty(candidates: PaperMatch[], memory: ResearchMemory): NoveltyDecision[] {
  const seen = new Set(memory.seenPaperIds);
  const mechanisms = new Set(memory.knownMechanisms);

  return candidates.map((c) => {
    if (seen.has(c.paperId)) {
      return { paperId: c.paperId, novel: false, reason: '已在 Research Memory 中，不重复推送' };
    }
    if (c.keyMechanism && mechanisms.has(norm(c.keyMechanism))) {
      return { paperId: c.paperId, novel: false, reason: `该机制已存在：${c.keyMechanism}` };
    }
    return { paperId: c.paperId, novel: true, reason: '新论文，且机制未见于 Research Memory' };
  });
}

/** 把一次扫描的产出并入记忆（下一次扫描即不会重复） */
export function absorbIntoMemory(memory: ResearchMemory, paperIds: string[], mechanisms: string[]): ResearchMemory {
  return {
    seenPaperIds: [...new Set([...memory.seenPaperIds, ...paperIds])],
    knownMechanisms: [...new Set([...memory.knownMechanisms, ...mechanisms.map(norm)])],
    pushedSignalIds: [...memory.pushedSignalIds],
  };
}
