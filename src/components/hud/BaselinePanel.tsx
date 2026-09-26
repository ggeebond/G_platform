/**
 * BaselinePanel —— Baseline Inspector。
 *
 * 根的粗细代表对照关系是否清楚，但「为什么选这个 baseline」只能在这里回答：
 * 来源、配置、选择原因、关联论文、关联实验。
 * 不推镜头，原位弹出 —— 根系细而分散，频繁大幅移动镜头会让人失去方位感。
 */
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, FlaskConical, X } from 'lucide-react';
import { useGardenStore } from '../../stores/gardenStore';
import { useSoulStore } from '../../stores/soulStore';

export function BaselinePanel() {
  const soulId = useGardenStore((s) => s.soulId);
  const baselineId = useGardenStore((s) => s.baselineId);
  const close = () => useGardenStore.setState({ baselineId: null });
  const focusPaper = useGardenStore((s) => s.focusPaper);
  const focusPetal = useGardenStore((s) => s.focusPetal);
  const openKeeper = useGardenStore((s) => s.openKeeper);

  const docs = useSoulStore((s) => s.docs);
  const setFocus = useSoulStore((s) => s.setFocus);

  const doc = soulId ? docs[soulId] : null;
  const baseline = doc?.baselines.find((b) => b.id === baselineId) ?? null;

  // 关联论文：baseline 绑定的来源论文
  const sourcePaper = baseline?.sourcePaperId
    ? doc?.papers.find((p) => p.paperId === baseline.sourcePaperId) ?? null
    : null;

  // 关联实验：以这个 baseline 作为对照、或作为处理组参照的实验
  const relatedExperiments = doc
    ? doc.experiments.filter(
        (e) => e.baseline.name === baseline?.name || e.baseline.name === baseline?.value,
      )
    : [];

  return (
    <AnimatePresence>
      {baseline && doc && (
        <motion.aside
          className="focus-panel"
          initial={{ x: -40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -40, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.2, 0.8, 0.3, 1] }}
        >
          <header className="focus-head">
            <span className="focus-index root">Baseline · Root</span>
            <button className="btn !px-2 !py-1" onClick={close} aria-label="close baseline">
              <X size={13} />
            </button>
          </header>

          <div className="focus-title">
            {baseline.name}
            <span className="num text-[13px] ml-2" style={{ color: 'var(--text-secondary)' }}>
              {baseline.value}
            </span>
          </div>
          <div className="focus-status" data-status={baseline.bound ? 'solid' : 'withdrawn'}>
            {baseline.bound ? '已绑定论文 / 协议 · 对照关系明确' : '尚未绑定 · 根系短而淡'}
          </div>

          <div className="focus-section">
            <Section label="选择原因" value={baseline.reason} />
            <Section label="实验配置" value={baseline.protocol || '还没有写下协议。绑定后根系会变粗并显示标签。'} />
          </div>

          {/* 关联论文 */}
          <div className="focus-section">
            <div className="focus-section-title">关联论文（{sourcePaper ? 1 : 0}）</div>
            {sourcePaper ? (
              <button
                className="focus-row"
                onClick={() => {
                  focusPaper(doc.soul.id, sourcePaper.paperId);
                  close();
                }}
              >
                <BookOpen size={13} style={{ color: 'var(--paper-orb)', flexShrink: 0 }} />
                <span className="flex-1 text-left">
                  <span className="text-[12.3px]" style={{ color: 'var(--text-primary)' }}>
                    {sourcePaper.title}
                  </span>
                  <span className="text-[10.5px] block num mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {sourcePaper.year} · {sourcePaper.source}
                    {sourcePaper.inMemory ? ' · Soul Memory' : ' · 未归档'}
                  </span>
                </span>
              </button>
            ) : (
              <div className="focus-hint">
                这条根还没有绑定来源论文 —— 这正是它对应对照关系最弱的地方。
              </div>
            )}
          </div>

          {/* 关联实验 */}
          <div className="focus-section">
            <div className="focus-section-title">关联实验（{relatedExperiments.length}）</div>
            {relatedExperiments.length === 0 && (
              <div className="focus-hint">还没有实验使用这个对照。</div>
            )}
            {relatedExperiments.map((e) => {
              const petal = doc.petals.find((p) => p.experimentId === e.id);
              return (
                <button
                  key={e.id}
                  className="focus-row"
                  onClick={() => {
                    if (petal) focusPetal(doc.soul.id, petal.id);
                    else {
                      setFocus({ type: 'petal', id: e.id, label: e.title });
                      openKeeper();
                      close();
                    }
                  }}
                >
                  <FlaskConical size={13} style={{ color: 'var(--petal-solid)', flexShrink: 0 }} />
                  <span className="flex-1 text-left text-[12.3px]" style={{ color: 'var(--text-secondary)' }}>
                    {e.title}
                  </span>
                  <span className="text-[10px] num" style={{ color: 'var(--text-muted)' }}>
                    {petal ? petal.status : e.status}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="focus-actions">
            <button
              className="btn"
              onClick={() => {
                setFocus({ type: 'root', id: baseline.id, label: baseline.name });
                openKeeper();
                close();
              }}
            >
              和 Soul Keeper 讨论这个对照
            </button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function Section({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="mb-3">
      <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        {label}
      </div>
      <div className="text-[12.5px] mt-0.5" style={{ color: 'var(--text-secondary)', lineHeight: 1.65 }}>
        {value}
      </div>
    </div>
  );
}
