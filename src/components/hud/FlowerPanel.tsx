/**
 * FlowerPanel —— 进入一株花之后的左侧状态面板。
 *
 * 展示这一株花的论证结构：花蕾（假设）、根系（baseline）、
 * 花瓣（已验证结论）、黄叶（研究边界）、以及知识球数量。
 */
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Radar, Sprout } from 'lucide-react';
import { useGardenStore } from '../../stores/gardenStore';
import { useSoulStore } from '../../stores/soulStore';
import { STAGE_HINT, STAGE_LABEL, stageOf } from '../../lib/garden/garden';
import { SOUL_STATUS_LABEL } from '../../lib/state/visual';

export function FlowerPanel() {
  const cameraMode = useGardenStore((s) => s.cameraMode);
  const soulId = useGardenStore((s) => s.soulId);
  const backToGarden = useGardenStore((s) => s.backToGarden);
  const focusPetal = useGardenStore((s) => s.focusPetal);
  const openKeeper = useGardenStore((s) => s.openKeeper);

  const docs = useSoulStore((s) => s.docs);
  const scanPapers = useSoulStore((s) => s.scanPapers);
  const setFocus = useSoulStore((s) => s.setFocus);

  const doc = soulId ? docs[soulId] : null;

  // 注意：不能在 AnimatePresence 之外提前 return，否则离场动画会被跳过
  const open = cameraMode === 'flower' && !!doc;
  const solid = doc ? doc.petals.filter((p) => p.status === 'solid') : [];
  const candidates = doc ? doc.petals.filter((p) => p.status === 'candidate') : [];
  const memory = doc ? doc.papers.filter((p) => p.inMemory).length : 0;
  const fresh = doc ? doc.papers.filter((p) => !p.inMemory).length : 0;
  // 必须与花园用同一个推导函数，否则同一株花在两处会显示不同阶段
  const stage = doc ? stageOf(doc) : 'bud';

  return (
    <AnimatePresence>
      {open && doc && (
      <motion.aside
        className="focus-panel"
        initial={{ x: -40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: -40, opacity: 0 }}
        transition={{ duration: 0.32, ease: [0.2, 0.8, 0.3, 1] }}
      >
        <header className="focus-head">
          <button className="btn !px-2 !py-1" onClick={backToGarden}>
            <ArrowLeft size={13} /> Garden
          </button>
          <span className="focus-index">{STAGE_LABEL[stage]}</span>
        </header>

        <div className="focus-title">{doc.soul.title}</div>
        <div className="focus-status" data-status="solid">
          {SOUL_STATUS_LABEL[doc.soul.status] ?? doc.soul.status}
        </div>
        <div className="focus-hint mt-1.5">{STAGE_HINT[stage]}</div>

        <div className="focus-section">
          <div className="focus-section-title">核心假设</div>
          <div className="text-[12.5px]" style={{ color: 'var(--text-secondary)', lineHeight: 1.65 }}>
            {doc.soul.hypothesis || doc.soul.rawIdea}
          </div>
        </div>

        {/* 根系：Baseline */}
        <div className="focus-section">
          <div className="focus-section-title">根系 · Baseline（{doc.baselines.length}）</div>
          {doc.baselines.length === 0 && <div className="focus-hint">还没有对照，根系短而淡。</div>}
          {doc.baselines.map((b) => (
            <button
              key={b.id}
              className="focus-row"
              onClick={() => {
                setFocus({ type: 'root', id: b.id, label: b.name });
                openKeeper();
              }}
            >
              <span className="focus-dot" style={{ background: b.bound ? 'var(--root-light)' : 'var(--root-main)', opacity: b.bound ? 1 : 0.45 }} />
              <span className="flex-1 text-left">
                <span className="text-[12.5px]" style={{ color: 'var(--text-primary)' }}>
                  {b.name}
                </span>
                <span className="text-[11px] ml-1.5 num" style={{ color: 'var(--text-muted)' }}>
                  {b.value}
                </span>
              </span>
              {!b.bound && <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>未绑定</span>}
            </button>
          ))}
        </div>

        {/* 花瓣 */}
        <div className="focus-section">
          <div className="focus-section-title">
            花瓣 · 已验证结论（{solid.length}）{candidates.length > 0 ? ` · ${candidates.length} 片等待结果` : ''}
          </div>
          {doc.petals.filter((p) => p.status !== 'withdrawn').length === 0 && (
            <div className="focus-hint">还没有花瓣。提出一个可检验的实验，它就会长出来。</div>
          )}
          {doc.petals
            .filter((p) => p.status !== 'withdrawn')
            .map((p) => (
              <button key={p.id} className="focus-row" onClick={() => focusPetal(doc.soul.id, p.id)}>
                <span
                  className="focus-dot"
                  style={{
                    background: p.status === 'solid' ? 'var(--petal-solid)' : 'transparent',
                    border: `1px solid ${p.status === 'solid' ? 'var(--petal-solid)' : 'rgba(121,222,248,0.6)'}`,
                  }}
                />
                <span className="flex-1 text-left text-[12.5px]" style={{ color: 'var(--text-secondary)' }}>
                  {p.label}
                </span>
              </button>
            ))}
        </div>

        {/* 黄叶 */}
        {doc.leaves.length > 0 && (
          <div className="focus-section">
            <div className="focus-section-title">黄叶 · 研究边界（{doc.leaves.length}）</div>
            {doc.leaves.map((l) => (
              <div key={l.id} className="focus-row !cursor-default">
                <span className="focus-dot" style={{ background: 'var(--leaf-warning)' }} />
                <span className="flex-1 text-left text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                  {l.failureCondition}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* 知识球 */}
        <div className="focus-section">
          <div className="focus-section-title">Research Orbit</div>
          <div className="focus-hint">
            {memory} 篇长期记忆{fresh > 0 ? ` · ${fresh} 篇待归档` : ''}
            {doc.papers.length === 0 ? ' · 还没有知识球进入轨道' : ''}
          </div>
        </div>

        <div className="focus-actions">
          <button
            className="btn"
            onClick={() => {
              void scanPapers('manual_scan', doc.soul.mainGap || doc.soul.title, null);
              openKeeper();
            }}
          >
            <Radar size={14} /> Scan Frontier
          </button>
          <button className="btn" onClick={openKeeper}>
            <Sprout size={14} /> 和 Soul Keeper 讨论
          </button>
        </div>
      </motion.aside>
      )}
    </AnimatePresence>
  );
}
