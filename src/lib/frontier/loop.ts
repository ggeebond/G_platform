/**
 * Soul Lab — Frontier Loop（FR-M11）
 *
 * 后台固定循环的纯函数内核（第 4、5、6、7、8、9、10 步）：
 *   读取 Souls 与状态 → 生成 Query → 拉取论文（由 source 注入）→ 去重
 *   → 机制级筛选 → Novelty Gate → 判断真正新信息 → 映射到具体 Soul → 生成 Frontier Signals
 *
 * 第 4 步「调用 OpenAlex / arXiv MCP 拉取」在真实链路里由后端完成，
 * 这里把已拉取的候选 `source` 作为参数注入，保证内核可测、可离线演示。
 */
import type { SoulDoc } from '../types';
import type { PaperMatch } from '../../../shared/schemas';
import { generateQueries } from './queries';
import { evaluateNovelty } from './memory';
import type {
  FrontierAction,
  FrontierScanResult,
  FrontierSignal,
  FrontierTarget,
  OrbIdentity,
  ResearchMemory,
  SignalLevel,
  WhyNowKind,
} from './types';

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fa5]+/)
    .filter((t) => t.length >= 3);
}

function overlapScore(tokens: string[], bag: Set<string>): number {
  if (tokens.length === 0) return 0;
  let hit = 0;
  for (const t of tokens) if (bag.has(t)) hit += 1;
  return hit / tokens.length;
}

function orbIdentityOf(m: PaperMatch): OrbIdentity {
  if (m.relationType === 'conflicting') return 'challenge';
  if (m.relationType === 'method') return 'opportunity';
  if (m.relationType === 'supporting') return 'signal';
  return 'related';
}

function levelOf(m: PaperMatch): SignalLevel {
  if (m.relationType === 'conflicting') return 'HIGH';
  if (m.relationType === 'method' || m.relationType === 'supporting') return 'MEDIUM';
  return 'LOW';
}

/** Why does it matter to me —— 必须落到具体 Claim / Boundary / Gap */
function targetOf(doc: SoulDoc, m: PaperMatch): FrontierTarget {
  if (m.relationType === 'conflicting' && doc.leaves.length > 0) {
    const leaf = doc.leaves[doc.leaves.length - 1];
    return { type: 'boundary', id: leaf.id, label: `Boundary · ${leaf.label}` };
  }
  if (m.relationType === 'method') {
    return { type: 'gap', id: null, label: `Gap · ${doc.soul.mainGap || '当前空白'}` };
  }
  const claim = doc.petals.find((p) => p.status === 'solid') ?? doc.petals[0];
  return { type: 'claim', id: claim?.id ?? null, label: claim ? `Claim · ${claim.label}` : '当前主张' };
}

/** What should I do —— 每条 Signal 必须产生行动价值 */
function actionOf(m: PaperMatch): FrontierAction {
  if (m.relationType === 'conflicting') {
    return { type: 'verify_long_horizon', detail: '在 long-horizon 任务上补一组验证，确认该反例是否适用于你的设定。' };
  }
  if (m.relationType === 'method') {
    return { type: 'add_ablation', detail: '新增一个以该机制为对照的 ablation，检验它能否补上当前 Gap。' };
  }
  if (m.relationType === 'supporting') {
    return { type: 'add_baseline', detail: '将其作为新增 baseline / 参考方法纳入对照。' };
  }
  return { type: 'read_section', detail: '阅读其 Method 章节，判断机制是否可迁移到你的技术路线。' };
}

/** Why Now —— 为什么是现在，而不是泛泛的「相关」 */
function whyNowOf(m: PaperMatch): { kind: WhyNowKind; detail: string } {
  const thisYear = new Date().getFullYear();
  if (m.relationType === 'conflicting') {
    return { kind: 'conflict', detail: `近期出现与当前结论不一致的结果（${m.year}）。` };
  }
  if (m.relationType === 'method') {
    return { kind: 'first', detail: '直接评估了此前缺少定量证据的机制。' };
  }
  if (m.year >= thisYear - 1) {
    return { kind: 'trend', detail: '近 14 天同类机制聚集出现，而 Research Memory 中此前没有该机制。' };
  }
  return { kind: 'benchmark', detail: '提供了新的评测基准或数据集，可用于对照。' };
}

function toSignal(doc: SoulDoc, m: PaperMatch): FrontierSignal {
  return {
    id: `sig_${doc.soul.id}_${m.paperId}`,
    soulId: doc.soul.id,
    soulTitle: doc.soul.title,
    level: levelOf(m),
    paperId: m.paperId,
    title: m.title,
    orbIdentity: orbIdentityOf(m),
    mechanismKey: m.keyMechanism,
    whatChanged: m.keyMechanism ? `出现新机制：${m.keyMechanism}` : m.abstract.slice(0, 64),
    whyMatters: targetOf(doc, m),
    whatIsDifferent: {
      yours: doc.soul.mechanismChain.join(' → ') || '你的现行机制链',
      theirs: m.keyMechanism || '论文机制',
    },
    whatToDo: actionOf(m),
    whyNow: whyNowOf(m),
  };
}

/**
 * 运行一次 Frontier Loop。幂等：同一批 source + 同一份 memory 得到同一结果，
 * 已在 memory 中的论文不会再次产生 Signal。
 */
export function runFrontierLoop(
  docs: SoulDoc[],
  source: PaperMatch[],
  memory: ResearchMemory,
): FrontierScanResult {
  const queries = docs.map(generateQueries);

  // 第 5 步：论文级去重（同一批 source 内）
  const byId = new Map<string, PaperMatch>();
  for (const p of source) if (!byId.has(p.paperId)) byId.set(p.paperId, p);
  const unique = [...byId.values()];

  const signals: FrontierSignal[] = [];
  // 去重计数：同一篇论文可能影响多张花，但「相关 / 被挡下」应按论文计，而非按 (论文 × Soul) 计
  const relevantIds = new Set<string>();
  const filteredIds = new Set<string>();
  const affectingIds = new Set<string>();

  for (const doc of docs) {
    const plan = queries.find((q) => q.soulId === doc.soul.id);
    const bag = new Set(
      tokenize(
        [
          doc.soul.title,
          doc.soul.researchQuestion,
          doc.soul.mainGap,
          doc.soul.mechanismChain.join(' '),
          plan?.queries.join(' ') ?? '',
        ].join(' '),
      ),
    );

    // 第 6 步：机制级筛选（机制链 / 邻域 Query 的词项重叠，而不是字面关键词包含）
    const candidates = unique.filter((p) => {
      const text = [p.title, p.keyMechanism, p.matchedGap, p.abstract].join(' ');
      return overlapScore(tokenize(text), bag) >= 0.15;
    });
    for (const c of candidates) relevantIds.add(c.paperId);

    // 第 7 步：Novelty Gate（防重复推送）
    const decisions = evaluateNovelty(candidates, memory);
    for (let i = 0; i < candidates.length; i++) {
      if (!decisions[i].novel) filteredIds.add(candidates[i].paperId);
    }
    const novel = candidates.filter((_, i) => decisions[i].novel);

    // 第 8~10 步：判断真正新信息 → 映射到具体 Soul → 生成 Signal
    for (const p of novel) {
      signals.push(toSignal(doc, p));
      affectingIds.add(p.paperId);
    }
  }

  return {
    scanned: unique.length,
    relevant: relevantIds.size,
    affecting: affectingIds.size,
    filtered: filteredIds.size,
    signals,
    queries,
  };
}
