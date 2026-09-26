/**
 * PaperCardOverlay —— 点击知识球后的悬浮卡。
 *
 * 不打开新页面：卡片悬浮在花园之上，关闭后知识球飞回轨道。
 * 只有点击 Add to Soul Memory，这篇论文才成为当前 Soul 的长期知识。
 */
import { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookMarked, EyeOff, MessageSquare, X } from 'lucide-react';
import { useGardenStore } from '../../stores/gardenStore';
import { useSoulStore } from '../../stores/soulStore';

const RELATION: Record<string, { label: string; color: string }> = {
  background: { label: '背景知识', color: '#8E86A8' },
  supporting: { label: '支持当前结论', color: '#BFA7FF' },
  conflicting: { label: '与当前结论冲突', color: '#FF8E9E' },
  method: { label: '方法相关', color: '#A78BFA' },
};

export function PaperCardOverlay() {
  const soulId = useGardenStore((s) => s.soulId);
  const paperId = useGardenStore((s) => s.paperId);
  const closePaper = () => useGardenStore.setState({ paperId: null });
  const openKeeper = useGardenStore((s) => s.openKeeper);

  const docs = useSoulStore((s) => s.docs);
  const addPaperToMemory = useSoulStore((s) => s.addPaperToMemory);
  const setFocus = useSoulStore((s) => s.setFocus);

  const doc = soulId ? docs[soulId] : null;
  const paper = useMemo(
    () => doc?.papers.find((p) => p.paperId === paperId) ?? null,
    [doc, paperId],
  );
  const petal = paper?.relatedPetalId
    ? doc?.petals.find((p) => p.id === paper.relatedPetalId)
    : null;

  const rel = paper ? RELATION[paper.relationType] ?? RELATION.method : null;

  return (
    <AnimatePresence>
      {paper && rel && (
        <motion.div
          className="paper-float"
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ duration: 0.28, ease: [0.2, 0.8, 0.3, 1] }}
        >
          <header className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[14px] font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>
                {paper.title}
              </div>
              <div className="text-[11px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
                {paper.authors.slice(0, 3).join(', ')}
                {paper.authors.length > 3 ? ' et al.' : ''} · <span className="num">{paper.year}</span> ·{' '}
                {paper.source}
              </div>
            </div>
            <button className="btn !px-2 !py-1" onClick={closePaper} aria-label="close paper">
              <X size={13} />
            </button>
          </header>

          <div className="flex items-center gap-2 mt-3">
            <span className="chip" style={{ borderColor: `${rel.color}80`, color: rel.color }}>
              {rel.label}
            </span>
            {paper.inMemory && <span className="chip chip-soul">Soul Memory</span>}
            {petal && <span className="chip">影响 · {petal.label}</span>}
          </div>

          {paper.abstract && (
            <p className="paper-abstract">{paper.abstract}</p>
          )}

          <div className="paper-why">
            <div className="paper-why-label">Why it matters</div>
            <div className="paper-why-text">{paper.reason}</div>
          </div>

          {paper.keyMechanism && (
            <div className="paper-why">
              <div className="paper-why-label">关键机制</div>
              <div className="paper-why-text">{paper.keyMechanism}</div>
            </div>
          )}

          <div className="paper-actions">
            <button
              className="btn"
              onClick={() => {
                setFocus({ type: 'paper', id: paper.paperId, label: paper.title });
                openKeeper();
                closePaper();
              }}
            >
              <MessageSquare size={13} /> Discuss with Soul Keeper
            </button>
            {!paper.inMemory && (
              <button
                className="btn btn-primary"
                onClick={() => {
                  addPaperToMemory(paper.paperId, paper.matchedGap);
                  closePaper();
                }}
              >
                <BookMarked size={13} /> Attach to this Soul
              </button>
            )}
            {!paper.inMemory && (
              <button
                className="btn"
                onClick={closePaper}
                title="不加入长期记忆。它仍会留在轨道上，之后可以再决定。"
              >
                <EyeOff size={13} /> Ignore
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
