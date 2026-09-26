import { useState } from 'react';
import { BookMarked, Search } from 'lucide-react';
import { useSoulStore } from '../../stores/soulStore';
import type { PaperMatch } from '../../../shared/schemas';

const RELATION: Record<PaperMatch['relationType'], { label: string; color: string }> = {
  background: { label: '背景知识', color: '#94A3B8' },
  supporting: { label: '支持当前结论', color: '#A78BFA' },
  conflicting: { label: '与结论冲突', color: '#F87171' },
  method: { label: '方法相关', color: '#A78BFA' },
};

interface PaperHitCardProps {
  papers: PaperMatch[];
}

/** Mode D — Research Scout：论文命中卡。只有用户点 Add to Soul Memory 才成为长期知识。 */
export function PaperHitCard({ papers }: PaperHitCardProps) {
  const addPaperToMemory = useSoulStore((s) => s.addPaperToMemory);
  const scanPapers = useSoulStore((s) => s.scanPapers);
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});

  return (
    <div className="space-y-2">
      {papers.map((p) => {
        const rel = RELATION[p.relationType];
        if (dismissed[p.paperId]) return null;
        return (
          <div key={p.paperId} className="rcard" data-tone="paper">
            <div className="rcard-head">
              <span className="rcard-type">Knowledge Pollen</span>
              <span className="chip" style={{ borderColor: `${rel.color}80`, color: rel.color, whiteSpace: 'nowrap' }}>
                {rel.label}
              </span>
            </div>

            <div className="rcard-body">
              <div className="rcard-lead">{p.title}</div>
              <div className="rcard-sub">
                {p.authors.slice(0, 3).join(', ')}
                {p.authors.length > 3 ? ' et al.' : ''} · <span className="num">{p.year}</span> · {p.source}
              </div>

              <div className="rcard-facts">
                <span className="rcard-fact-k">Why</span>
                <span className="rcard-fact-v">{p.reason}</span>

                <span className="rcard-fact-k">Gap</span>
                <span className="rcard-fact-v">{p.matchedGap}</span>
              </div>

              <details className="rcard-more">
                <summary>摘要与关键机制</summary>
                <div className="rcard-more-body">
                  {p.abstract && <div className="rcard-fact-v mb-2">{p.abstract}</div>}
                  {p.keyMechanism && (
                    <div className="grid grid-cols-[92px_1fr] gap-3">
                      <span className="rcard-fact-k">Mechanism</span>
                      <span className="rcard-fact-v">{p.keyMechanism}</span>
                    </div>
                  )}
                </div>
              </details>

              <div className="rcard-cta">
                <button
                  className="btn"
                  onClick={() =>
                    scanPapers('manual_scan', `${p.title} 与当前 Soul 的关系`, p.relatedPetalId ?? null)
                  }
                >
                  <Search size={13} /> Ask AI
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    addPaperToMemory(p.paperId, p.matchedGap);
                    setDismissed((d) => ({ ...d, [p.paperId]: true }));
                  }}
                >
                  <BookMarked size={13} /> Add to Soul Memory
                </button>
                <button className="btn" onClick={() => setDismissed((d) => ({ ...d, [p.paperId]: true }))}>
                  Ignore
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
