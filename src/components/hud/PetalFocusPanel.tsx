/**
 * PetalFocusPanel —— Petal Focus Mode 的左侧证据面板。
 *
 * 点击一片花瓣后，镜头把花瓣推到面前，这张面板滑入。
 * 背景 Garden 仍然可见（轻微虚化），用户始终知道自己还在花园里。
 */
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, FileSpreadsheet, Undo2, FlaskConical } from 'lucide-react';
import { useGardenStore } from '../../stores/gardenStore';
import { useSoulStore } from '../../stores/soulStore';
import { formatNumber } from '../../lib/stats/experiment';
import { PETAL_STATUS_LABEL } from '../../lib/state/visual';

export function PetalFocusPanel() {
  const cameraMode = useGardenStore((s) => s.cameraMode);
  const soulId = useGardenStore((s) => s.soulId);
  const petalId = useGardenStore((s) => s.petalId);
  const back = useGardenStore((s) => s.back);
  const openEvidence = useGardenStore((s) => s.openEvidence);
  const openKeeper = useGardenStore((s) => s.openKeeper);

  const docs = useSoulStore((s) => s.docs);
  const withdrawPetal = useSoulStore((s) => s.withdrawPetal);

  const doc = soulId ? docs[soulId] : null;
  const petal = doc?.petals.find((p) => p.id === petalId) ?? null;
  const exp = petal ? doc?.experiments.find((e) => e.id === petal.experimentId) : null;

  const open = cameraMode === 'petal' && !!petal;

  return (
    <AnimatePresence>
      {open && petal && exp && (
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
            <span className="focus-index num">
              Experiment #{String(exp.index).padStart(2, '0')}
            </span>
          </header>

          <div className="focus-title">{exp.title}</div>
          <div className="focus-status" data-status={petal.status}>
            {PETAL_STATUS_LABEL[petal.status]}
          </div>

          <div className="focus-section">
            <Field label="Hypothesis" value={exp.hypothesis} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Baseline" value={`${exp.baseline.name} = ${exp.baseline.value}`} />
              <Field
                label="Treatment"
                value={`${exp.treatment.name} ${exp.treatment.value}`}
              />
            </div>
            <Field label="Metrics" value={exp.metrics.join(' · ')} />
            <Field label="Controlled" value={exp.controlledVariables.join(' · ')} />
            <Field label="Expected" value={exp.expectedObservation} />
            <Field label="Main Risk" value={exp.mainRisk} />
          </div>

          {/* 已提交的数据摘要 */}
          {exp.result && (
            <div className="focus-section">
              <div className="focus-section-title">Data Brief（确定性计算）</div>
              <div className="focus-stats">
                {exp.result.stats.map((s) => (
                  <div key={s.metric} className="focus-stat">
                    <div className="focus-stat-metric">{s.metric}</div>
                    <div className="focus-stat-row num">
                      <span style={{ color: 'var(--root-light)' }}>{formatNumber(s.baseline.mean)}</span>
                      <span style={{ color: 'var(--text-muted)' }}>→</span>
                      <span style={{ color: 'var(--petal-solid-light)' }}>{formatNumber(s.treatment.mean)}</span>
                    </div>
                    <div
                      className="focus-stat-delta num"
                      style={{ color: s.delta >= 0 ? '#86EFAC' : '#FCA5A5' }}
                    >
                      {s.delta >= 0 ? '+' : ''}
                      {s.deltaPercent.toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>
              <div className="focus-foot num">
                {exp.result.fileName} · {exp.result.rows} 行
              </div>
            </div>
          )}

          <div className="focus-actions">
            {petal.status === 'candidate' && (
              <>
                <button className="btn btn-primary" onClick={() => openEvidence(exp.id, 'submit')}>
                  <FileSpreadsheet size={14} /> 上传实验结果
                </button>
                <div className="focus-hint">
                  上传后先由确定性代码计算 mean / std / delta / n，再交给 Evidence Reviewer 审议。
                </div>
              </>
            )}

            {petal.status === 'solid' && (
              <>
                <button className="btn" onClick={() => openEvidence(exp.id, 'archive')}>
                  <FlaskConical size={14} /> 查看证据档案
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => {
                    withdrawPetal(petal.id, 'Withdrawn by Researcher');
                    back();
                    openKeeper();
                  }}
                  title="撤回不删除历史，只把花瓣标记为 Withdrawn"
                >
                  <Undo2 size={14} /> Withdraw
                </button>
              </>
            )}

            {petal.status === 'insufficient' && (
              <>
                <button className="btn btn-primary" onClick={() => openEvidence(exp.id, 'submit')}>
                  <FileSpreadsheet size={14} /> 补充数据
                </button>
                <div className="focus-hint">证据不足，花瓣保持虚幻。它还在等一个更有力的实验。</div>
              </>
            )}

            {petal.status === 'withdrawn' && (
              <div className="focus-hint">
                这片花瓣已被撤回，历史证据完整保留。{petal.withdrawnReason ? `原因：${petal.withdrawnReason}` : ''}
              </div>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

export function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="mb-2.5">
      <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        {label}
      </div>
      <div className="text-[12.5px] mt-0.5" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        {value}
      </div>
    </div>
  );
}
