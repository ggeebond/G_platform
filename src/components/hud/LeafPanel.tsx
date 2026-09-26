/**
 * LeafPanel —— 黄叶详情。
 *
 * 黄叶不是惩罚，而是研究边界：显示失败条件、AI 判断、用户判断与后续实验建议。
 * 用户可以把这片叶子标记为「已理解」，它会变成金绿色而不是恢复鲜绿。
 */
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Check } from 'lucide-react';
import { useGardenStore } from '../../stores/gardenStore';
import { useSoulStore } from '../../stores/soulStore';

export function LeafPanel() {
  const cameraMode = useGardenStore((s) => s.cameraMode);
  const soulId = useGardenStore((s) => s.soulId);
  const leafId = useGardenStore((s) => s.leafId);
  const back = useGardenStore((s) => s.back);

  const docs = useSoulStore((s) => s.docs);
  const resolveLeaf = useSoulStore((s) => s.resolveLeaf);

  const [note, setNote] = useState('');

  const doc = soulId ? docs[soulId] : null;
  const leaf = doc?.leaves.find((l) => l.id === leafId) ?? null;
  const exp = leaf ? doc?.experiments.find((e) => e.id === leaf.experimentId) : null;

  const open = cameraMode === 'petal' && !!leaf;

  return (
    <AnimatePresence>
      {open && leaf && (
        <motion.aside
          className="focus-panel"
          initial={{ x: -40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -40, opacity: 0 }}
          transition={{ duration: 0.32, ease: [0.2, 0.8, 0.3, 1] }}
        >
          <header className="focus-head">
            <button className="btn !px-2 !py-1" onClick={back}>
              <ArrowLeft size={13} /> 回到花
            </button>
            <span className="focus-index leaf">Yellow Leaf</span>
          </header>

          <div className="focus-title">{leaf.label}</div>
          <div className="focus-status" data-status={leaf.status === 'warning' ? 'leaf' : 'solid'}>
            {leaf.status === 'warning'
              ? 'Weakens the claim · 研究边界'
              : leaf.status === 'resolved'
                ? 'Understood · 已理解这个失败'
                : 'Archived'}
          </div>

          <div className="focus-section">
            <Section label="失败条件" value={leaf.failureCondition} />
            <Section label="AI 判断" value={leaf.aiJudgement} />
            {leaf.userJudgement && <Section label="你的判断" value={leaf.userJudgement} />}
            <Section label="后续实验建议" value={leaf.nextSteps} />
            {exp && <Section label="来源实验" value={exp.title} />}
          </div>

          {leaf.status === 'warning' && (
            <div className="focus-actions">
              <textarea
                className="w-full rounded-lg p-2.5 text-[12px]"
                rows={2}
                placeholder="写下你为什么认为这条边界已经被理解…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                style={{
                  background: 'rgba(11,59,46,0.8)',
                  border: '1px solid rgba(134,239,172,0.2)',
                  color: 'var(--text-primary)',
                }}
              />
              <button
                className="btn btn-primary"
                disabled={!note.trim()}
                onClick={() => {
                  resolveLeaf(leaf.id, note);
                  setNote('');
                }}
              >
                <Check size={14} /> 标记为已理解
              </button>
              <div className="focus-hint">
                标记后叶片会变成金绿色 —— 它不会恢复成鲜绿，因为失败已经被写进研究里了。
              </div>
            </div>
          )}
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
