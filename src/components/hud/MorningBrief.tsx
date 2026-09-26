/**
 * MorningBrief —— 每日科研简报（FR-M15）
 *
 * 界面是花园，Brief 必须「不遮挡花园」：默认只显示一行摘要，点击才展开完整列表，
 * 展开后也限制高度并内部滚动。
 * 关键分支：无实质变化时明说 QUIET_LABEL，不为推送而推送。
 */
import { useMemo, useState } from 'react';
import { useSoulStore } from '../../stores/soulStore';
import { generateBrief, QUIET_LABEL } from '../../lib/frontier';

export function MorningBrief() {
  const docs = useSoulStore((s) => s.docs);
  const order = useSoulStore((s) => s.order);
  const scan = useSoulStore((s) => s.frontierScan);
  const [open, setOpen] = useState(false);

  const brief = useMemo(() => {
    if (!scan) return null;
    const list = order.map((id) => docs[id]).filter(Boolean);
    return generateBrief(list, scan);
  }, [scan, docs, order]);

  const total = brief?.lines.length ?? 0;
  const quiet = brief?.lines.filter((l) => l.quiet).length ?? 0;
  const withSignal = total - quiet;

  return (
    <div
      className="absolute bottom-4 z-20 rounded-lg text-[11px] select-none"
      style={{
        left: 72,
        maxWidth: 300,
        background: 'rgba(9,23,19,0.72)',
        border: '1px solid rgba(120,221,246,0.2)',
        color: 'var(--text-primary)',
      }}
    >
      <button onClick={() => setOpen((v) => !v)} className="w-full px-3 py-2 text-left">
        <div className="tracking-wide" style={{ color: 'var(--soul-highlight)' }}>
          Morning Research Brief · Today
        </div>
        <div style={{ color: 'var(--text-muted)' }}>
          {!brief
            ? '尚未运行 Frontier Loop'
            : `${total} Souls · ${withSignal} 有信号 · ${quiet} 无实质变化`}
        </div>
      </button>

      {open && brief && (
        <div className="px-3 pb-3" style={{ maxHeight: 200, overflowY: 'auto' }}>
          {brief.lines.length === 0 && <div style={{ color: 'var(--text-muted)' }}>{QUIET_LABEL}</div>}

          {brief.lines.map((l) => (
            <div key={l.soulId} className="mt-2">
              <div style={{ fontWeight: 500 }}>{l.soulTitle}</div>
              {l.quiet ? (
                <div style={{ color: 'var(--text-muted)' }}>{QUIET_LABEL}</div>
              ) : (
                <div style={{ color: 'var(--text-muted)' }}>
                  {l.highPriority} high-priority · {l.relatedPapers} new papers · {l.challenges} challenge ·{' '}
                  {l.possibleBaselines} possible baseline
                </div>
              )}
              {l.mostUsefulNext && <div>Next：{l.mostUsefulNext}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
