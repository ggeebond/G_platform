/**
 * FrontierPulse —— 首页科研情报（FR-M2）
 *
 * 不是新闻栏。只显示「今天科研世界变了什么、其中哪件事可能改变你正在养的花」，
 * 计数全部经过 Novelty Gate（不会重复推送你已经看过的内容）。
 *
 * 数据由 store 的 Frontier Loop 产出；「已记 N 篇」即 Research Memory 的大小
 * （持久化在 Dexie，刷新后仍在）。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSoulStore } from '../../stores/soulStore';
import { frontierDemoPool, generateBrief, QUIET_LABEL, type SignalLevel } from '../../lib/frontier';

const LEVEL_COLOR: Record<SignalLevel, string> = {
  HIGH: '#FB923C',
  MEDIUM: '#FBBF24',
  LOW: '#94A3B8',
};

export function FrontierPulse() {
  const docs = useSoulStore((s) => s.docs);
  const order = useSoulStore((s) => s.order);
  const scan = useSoulStore((s) => s.frontierScan);
  const memory = useSoulStore((s) => s.frontierMemory);
  const refreshFrontier = useSoulStore((s) => s.refreshFrontier);
  const resetFrontierMemory = useSoulStore((s) => s.resetFrontierMemory);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  // StrictMode 下 effect 会被双调用；用 ref 保证「首次自动扫描」只跑一次
  const autoScanned = useRef(false);

  // 首次挂载自动跑一次（演示用静态候选池；真实链路传空数组走后端检索）
  useEffect(() => {
    if (autoScanned.current) return;
    autoScanned.current = true;
    if (!scan) void refreshFrontier(frontierDemoPool);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const brief = useMemo(() => {
    if (!scan) return null;
    const list = order.map((id) => docs[id]).filter(Boolean);
    return generateBrief(list, scan);
  }, [scan, docs, order]);

  const runScan = async () => {
    setBusy(true);
    await refreshFrontier(frontierDemoPool);
    setBusy(false);
  };

  return (
    <div className="absolute top-4 right-4 z-20 select-none" style={{ width: open ? 340 : 'auto' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg px-3 py-2 text-left"
        style={{
          background: 'rgba(9,23,19,0.72)',
          border: '1px solid rgba(120,221,246,0.25)',
          color: 'var(--text-primary)',
        }}
      >
        <div className="text-[11px] tracking-wide" style={{ color: 'var(--soul-highlight)' }}>
          FRONTIER PULSE · Today
        </div>
        <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          {scan
            ? `${scan.scanned} scanned · ${scan.relevant} relevant · ${scan.affecting} may affect a Soul`
            : 'Scanning frontier…'}
        </div>
        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
          研究记忆 {memory.seenPaperIds.length} 篇 · 已知机制 {memory.knownMechanisms.length} 个
        </div>
      </button>

      {open && (
        <div
          className="mt-2 rounded-lg p-3 text-[11px]"
          style={{
            maxHeight: 300,
            overflowY: 'auto',
            background: 'rgba(9,23,19,0.86)',
            border: '1px solid rgba(120,221,246,0.2)',
            color: 'var(--text-primary)',
          }}
        >
          <div className="mb-2 flex gap-2">
            <button onClick={runScan} disabled={busy} className="btn-mini">
              {busy ? 'Scanning…' : 'Scan Frontier'}
            </button>
            <button onClick={() => void resetFrontierMemory()} className="btn-mini">
              Reset memory
            </button>
          </div>

          {scan && scan.signals.length === 0 && (
            <div style={{ color: 'var(--text-muted)' }}>{QUIET_LABEL}</div>
          )}

          {scan?.signals.slice(0, 3).map((s) => (
            <div key={s.id} className="mb-2 pb-2" style={{ borderBottom: '1px solid rgba(120,221,246,0.12)' }}>
              <div className="flex items-center gap-2">
                <span style={{ color: LEVEL_COLOR[s.level] }}>SIGNAL · {s.level}</span>
                <span style={{ color: 'var(--soul-highlight)' }}>{s.title}</span>
              </div>
              <div style={{ color: 'var(--text-muted)' }}>影响 {s.whyMatters.label}</div>
              <div style={{ color: 'var(--text-muted)' }}>Why now：{s.whyNow.detail}</div>
              <div>建议：{s.whatToDo.detail}</div>
            </div>
          ))}

          {brief && (
            <div className="mt-1" style={{ color: 'var(--text-muted)' }}>
              {brief.lines
                .map(
                  (l) =>
                    `${l.soulTitle}：${l.quiet ? '无实质变化' : `${l.signals} signals / ${l.relatedPapers} new papers`}`,
                )
                .join(' ｜ ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
