/**
 * FocusWorkspace —— 右侧 Research Inspector
 *
 * 三态（优先级从高到低），这是本交互的核心，避免右侧乱跳：
 *   1. selectedNode（点击锁定）→ 完整 Detail，移开鼠标也不消失
 *   2. hoveredNode （悬停经过）→ 轻量 PREVIEW，移开立即恢复
 *   3. 都没有            → Overview / Claims / Experiments / Frontier 列表
 *
 * 左侧 3D 世界一律不出现文字遮挡；所有文字信息都到这里。
 */
import { useGardenStore, type ResearchNode } from '../../stores/gardenStore';
import { useSoulStore } from '../../stores/soulStore';
import { LEAF_SEVERITY_META, leafSeverity } from '../../lib/garden/garden';
import { ORB_IDENTITY_META, orbIdentityOf } from '../../lib/garden/orbIdentity';
import { QUIET_LABEL, type FrontierSignal } from '../../lib/frontier';
import type { SoulDoc } from '../../lib/types';

const TABS: Array<{ key: string; label: string; focus: { kind: 'overview' | 'claims' | 'experiments' | 'frontier' } }> = [
  { key: 'overview', label: 'Overview', focus: { kind: 'overview' } },
  { key: 'claims', label: 'Claims', focus: { kind: 'claims' } },
  { key: 'experiments', label: 'Experiments', focus: { kind: 'experiments' } },
  { key: 'frontier', label: 'Frontier', focus: { kind: 'frontier' } },
];

const tag = (n: number) => `#${String(n).padStart(2, '0')}`;
const nodeKey = (n: ResearchNode | null) => (n ? `${n.kind}:${n.id}` : 'none');

export function FocusWorkspace({ doc, signals }: { doc: SoulDoc; signals: FrontierSignal[] }) {
  const focus = useGardenStore((s) => s.workspaceFocus);
  const hovered = useGardenStore((s) => s.hoveredNode);
  const selected = useGardenStore((s) => s.selectedNode);
  const selectWorkspace = useGardenStore((s) => s.selectWorkspace);
  const clearSelection = useGardenStore((s) => s.clearSelection);

  const node = selected ?? hovered;
  const mode: 'detail' | 'preview' | 'list' = selected ? 'detail' : hovered ? 'preview' : 'list';

  return (
    <section className="focus-workspace">
      <div className="ws-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className="ws-tab"
            data-active={mode === 'list' && focus.kind === t.key}
            onClick={() => selectWorkspace(t.focus)}
          >
            {t.label}
          </button>
        ))}
        {selected && (
          <button className="ws-clear" onClick={clearSelection} title="退出当前选择（ESC）">
            ✕ 退出选择
          </button>
        )}
      </div>

      <div className="ws-body">
        {/* key 变化即重播 160ms 的淡入上移，避免"网页跳页"感 */}
        <div key={`${mode}|${nodeKey(node)}|${focus.kind}`} className={`ws-anim ws-anim-${mode}`}>
          {mode === 'preview' && node && <NodePreview doc={doc} signals={signals} node={node} />}
          {mode === 'detail' && node && <NodeDetail doc={doc} signals={signals} node={node} />}

          {mode === 'list' && focus.kind === 'overview' && <Overview doc={doc} signals={signals} />}
          {mode === 'list' && focus.kind === 'claims' && <ClaimList doc={doc} />}
          {mode === 'list' && focus.kind === 'experiments' && <ExperimentList doc={doc} />}
          {mode === 'list' && focus.kind === 'frontier' && <FrontierList signals={signals} />}
        </div>
      </div>
    </section>
  );
}

/* ==================== Preview（悬停） ==================== */

function NodePreview({ doc, signals, node }: { doc: SoulDoc; signals: FrontierSignal[]; node: ResearchNode }) {
  return (
    <>
      <div className="ws-preview-tag">PREVIEW</div>

      {node.kind === 'claim' && (() => {
        const i = doc.petals.findIndex((p) => p.id === node.id);
        const petal = doc.petals[i];
        if (!petal) return null;
        const exp = doc.experiments.find((e) => e.id === petal.experimentId);
        const related = signals.filter((s) => s.whyMatters.id === petal.id).length;
        return (
          <>
            <div className="ws-title">CLAIM {tag(i + 1)}</div>
            <div className="ws-sub">{petal.label}</div>
            <div className="ws-section">
              <div className="ws-kv">
                <div className="ws-k">Status</div>
                <div className="ws-v">{petal.status}</div>
                <div className="ws-k">Evidence Gap</div>
                <div className="ws-v">{doc.soul.mainGap || '待补充'}</div>
                <div className="ws-k">Experiment</div>
                <div className="ws-v">
                  {exp ? `${tag(doc.experiments.findIndex((e) => e.id === exp.id) + 1)} · ${exp.title}` : '—'}
                </div>
                <div className="ws-k">Related Frontier</div>
                <div className="ws-v">{related} paper{related === 1 ? '' : 's'}</div>
              </div>
            </div>
          </>
        );
      })()}

      {node.kind === 'experiment' && (() => {
        const i = doc.experiments.findIndex((e) => e.id === node.id);
        const exp = doc.experiments[i];
        if (!exp) return null;
        return (
          <>
            <div className="ws-title">EXPERIMENT {tag(i + 1)}</div>
            <div className="ws-sub">{exp.title}</div>
            <div className="ws-section">
              <div className="ws-kv">
                <div className="ws-k">Status</div>
                <div className="ws-v">{exp.status}</div>
                <div className="ws-k">Baseline</div>
                <div className="ws-v">{exp.baseline.name} = {exp.baseline.value}</div>
                <div className="ws-k">Treatment</div>
                <div className="ws-v">{exp.treatment.name} {exp.treatment.value}</div>
                <div className="ws-k">Metrics</div>
                <div className="ws-v">{exp.metrics.join(' · ') || '—'}</div>
              </div>
            </div>
          </>
        );
      })()}

      {node.kind === 'paper' && (() => {
        const paper = doc.papers.find((p) => p.paperId === node.id);
        if (!paper) return null;
        const meta = ORB_IDENTITY_META[orbIdentityOf(paper)];
        return (
          <>
            <div className="ws-title">{paper.title}</div>
            <div className="ws-sub">
              {paper.authors.slice(0, 2).join(', ') || 'Unknown'} · {paper.year} · {meta.label}
            </div>
            <div className="ws-section">
              <div className="ws-v">{paper.abstract}</div>
            </div>
          </>
        );
      })()}

      {node.kind === 'boundary' && (() => {
        const leaf = doc.leaves.find((l) => l.id === node.id);
        if (!leaf) return null;
        const sev = leafSeverity(doc, leaf);
        const meta = LEAF_SEVERITY_META[sev];
        return (
          <>
            <div className="ws-title">{leaf.label}</div>
            <div className="ws-sub" style={{ color: meta.color }}>{meta.label}</div>
            <div className="ws-section">
              <div className="ws-v">{leaf.failureCondition}</div>
            </div>
          </>
        );
      })()}
    </>
  );
}

/* ==================== Detail（点击锁定） ==================== */

function NodeDetail({ doc, signals, node }: { doc: SoulDoc; signals: FrontierSignal[]; node: ResearchNode }) {
  if (node.kind === 'claim') return <ClaimDetail doc={doc} signals={signals} id={node.id} />;
  if (node.kind === 'experiment') return <ExperimentDetail doc={doc} id={node.id} />;
  if (node.kind === 'paper') return <PaperDetail doc={doc} id={node.id} />;
  return <BoundaryDetail doc={doc} id={node.id} />;
}

/* ==================== Overview / 列表 ==================== */

function Overview({ doc, signals }: { doc: SoulDoc; signals: FrontierSignal[] }) {
  const supported = doc.petals.filter((p) => p.status === 'solid').length;
  const waiting = doc.experiments.filter((e) => e.status === 'designAccepted').length;
  const boundary = doc.leaves.filter((l) => l.status === 'warning').length;
  const related = doc.papers.filter((p) => p.inMemory).length;
  const latestReview = doc.reviews[doc.reviews.length - 1];

  const gaps = [
    ...(doc.soul.mainGap ? [doc.soul.mainGap] : []),
    ...doc.soul.openQuestions,
    ...doc.experiments
      .filter((e) => e.status === 'designAccepted')
      .map((e) => `实验「${e.title}」等待结果，尚不能支撑结论`),
  ];

  return (
    <>
      <div className="ws-title">{doc.soul.title}</div>
      <div className="ws-sub">{doc.soul.researchQuestion || doc.soul.rawIdea}</div>

      <div className="ws-section">
        <div className="ws-section-title">Research Overview</div>
        <div className="ws-overview-grid">
          <Count n={doc.petals.length} l="Claims" />
          <Count n={doc.experiments.length} l="Experiments" />
          <Count n={supported} l="Supported" />
          <Count n={waiting} l="Waiting" />
          <Count n={boundary} l="Boundary" />
          <Count n={signals.length} l="Frontier Signals" />
        </div>
      </div>

      <div className="ws-section">
        <div className="ws-section-title">Current Evidence Gap</div>
        {gaps.length === 0 && <div className="ws-v">暂无明显缺口；继续累积证据。</div>}
        {gaps.map((g, i) => (
          <div key={i} className="ws-item">
            <div className="ws-v">{g}</div>
          </div>
        ))}
      </div>

      {related > 0 && (
        <div className="ws-section">
          <div className="ws-section-title">Soul Memory</div>
          <div className="ws-v">{related} 篇论文已沉淀为长期知识</div>
        </div>
      )}

      {latestReview?.suggestedNext && (
        <div className="ws-section">
          <div className="ws-section-title">Suggested Next Step</div>
          <div className="ws-v">{latestReview.suggestedNext}</div>
        </div>
      )}
    </>
  );
}

function Count({ n, l }: { n: number; l: string }) {
  return (
    <div className="ws-count">
      <div className="ws-count-n">{n}</div>
      <div className="ws-count-l">{l}</div>
    </div>
  );
}

function ClaimList({ doc }: { doc: SoulDoc }) {
  const selectNode = useGardenStore((s) => s.selectNode);
  if (doc.petals.length === 0) return <div className="ws-v">还没有 Claim —— 先提出一个有对照的实验设计。</div>;
  return (
    <>
      <div className="ws-title">Claims</div>
      <div className="ws-sub">{doc.petals.length} 条结论主张</div>
      <div className="ws-section">
        {doc.petals.map((p, i) => (
          <button key={p.id} className="ws-item w-full text-left" onClick={() => selectNode({ kind: 'claim', id: p.id })}>
            <div className="ws-v">Claim {tag(i + 1)} · {p.label}</div>
            <div className="ws-k" style={{ marginTop: 3 }}>{p.status}</div>
          </button>
        ))}
      </div>
    </>
  );
}

function ExperimentList({ doc }: { doc: SoulDoc }) {
  const selectNode = useGardenStore((s) => s.selectNode);
  if (doc.experiments.length === 0) return <div className="ws-v">还没有实验。向 Soul Keeper 描述一个实验设计即可。</div>;
  return (
    <>
      <div className="ws-title">Experiments</div>
      <div className="ws-sub">{doc.experiments.length} 个实验</div>
      <div className="ws-section">
        {doc.experiments.map((e, i) => (
          <button key={e.id} className="ws-item w-full text-left" onClick={() => selectNode({ kind: 'experiment', id: e.id })}>
            <div className="ws-v">Experiment {tag(i + 1)} · {e.title}</div>
            <div className="ws-k" style={{ marginTop: 3 }}>{e.status}</div>
          </button>
        ))}
      </div>
    </>
  );
}

function FrontierList({ signals }: { signals: FrontierSignal[] }) {
  if (signals.length === 0) return <div className="ws-v">{QUIET_LABEL}</div>;
  return (
    <>
      <div className="ws-title">Frontier Intelligence</div>
      <div className="ws-sub">{signals.length} 条可能影响这株花的信号</div>
      <div className="ws-section">
        {signals.map((s) => (
          <div key={s.id} className="ws-item">
            <div className="ws-v" style={{ color: 'var(--soul-highlight)' }}>{s.level} · {s.title}</div>
            <div className="ws-v" style={{ marginTop: 4 }}>影响 {s.whyMatters.label}</div>
            <div className="ws-k" style={{ marginTop: 3 }}>Why now：{s.whyNow.detail}</div>
            <div className="ws-v" style={{ marginTop: 3 }}>建议：{s.whatToDo.detail}</div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ==================== Claim Detail ==================== */

function ClaimDetail({ doc, signals, id }: { doc: SoulDoc; signals: FrontierSignal[]; id: string }) {
  const petal = doc.petals.find((p) => p.id === id);
  if (!petal) return <div className="ws-v">该 Claim 已不存在。</div>;

  const idx = doc.petals.findIndex((p) => p.id === id) + 1;
  const internal = doc.experiments.filter((e) => e.id === petal.experimentId);
  const external = doc.papers.filter(
    (p) => p.relatedPetalId === id || p.relationType === 'supporting' || p.relationType === 'conflicting',
  );
  const review = doc.reviews.find((r) => r.targetId === petal.experimentId && r.targetType === 'evidence');
  const relatedFrontier = signals.filter((s) => s.whyMatters.id === petal.id);

  return (
    <>
      <div className="ws-title">CLAIM {tag(idx)}</div>
      <div className="ws-sub">{petal.label}</div>

      <div className="ws-section">
        <div className="ws-kv">
          <div className="ws-k">Status</div>
          <div className="ws-v">
            <span className="ws-status-dot" data-status={petal.status} /> {petal.status}
          </div>
          <div className="ws-k">Evidence Gap</div>
          <div className="ws-v">{doc.soul.mainGap || '待补充'}</div>
        </div>
      </div>

      <div className="ws-section">
        <div className="ws-section-title">Internal Evidence</div>
        {internal.length === 0 && <div className="ws-v">暂无内部实验证据。</div>}
        {internal.map((e) => (
          <div key={e.id} className="ws-item">
            <div className="ws-v">Experiment {tag(doc.experiments.findIndex((x) => x.id === e.id) + 1)} · {e.title}</div>
            <div className="ws-k" style={{ marginTop: 3 }}>{e.status}</div>
          </div>
        ))}
      </div>

      <div className="ws-section">
        <div className="ws-section-title">External Evidence</div>
        {external.length === 0 && <div className="ws-v">暂无外部论文证据。</div>}
        {external.map((p) => (
          <div key={p.paperId} className="ws-item">
            <div className="ws-v">{p.title}</div>
            <div className="ws-k" style={{ marginTop: 3 }}>{p.year} · {p.relationType}</div>
          </div>
        ))}
      </div>

      <div className="ws-section">
        <div className="ws-section-title">Related Frontier</div>
        {relatedFrontier.length === 0 && <div className="ws-v">没有直接命中这条 Claim 的前沿信号。</div>}
        {relatedFrontier.map((s) => (
          <div key={s.id} className="ws-item">
            <div className="ws-v" style={{ color: 'var(--soul-highlight)' }}>{s.level} · {s.title}</div>
            <div className="ws-k" style={{ marginTop: 3 }}>{s.whyNow.detail}</div>
          </div>
        ))}
      </div>

      {review?.suggestedNext && (
        <div className="ws-section">
          <div className="ws-section-title">Next Action</div>
          <div className="ws-v">{review.suggestedNext}</div>
        </div>
      )}
    </>
  );
}

/* ==================== Experiment Detail ==================== */

function ExperimentDetail({ doc, id }: { doc: SoulDoc; id: string }) {
  const openEvidence = useGardenStore((s) => s.openEvidence);
  const exp = doc.experiments.find((e) => e.id === id);
  if (!exp) return <div className="ws-v">该实验已不存在。</div>;

  const idx = doc.experiments.findIndex((e) => e.id === id) + 1;
  const review = doc.reviews.find((r) => r.targetId === exp.id && r.targetType === 'evidence');
  const stats = exp.result?.stats ?? [];

  return (
    <>
      <div className="ws-title">EXPERIMENT {tag(idx)}</div>
      <div className="ws-sub">{exp.title}</div>

      <div className="ws-section">
        <div className="ws-kv">
          <div className="ws-k">Hypothesis</div>
          <div className="ws-v">{exp.hypothesis}</div>
          <div className="ws-k">Baseline</div>
          <div className="ws-v">{exp.baseline.name} = {exp.baseline.value}</div>
          <div className="ws-k">Treatment</div>
          <div className="ws-v">{exp.treatment.name} {exp.treatment.value}</div>
          <div className="ws-k">Controlled</div>
          <div className="ws-v">{exp.controlledVariables.join(' · ') || '—'}</div>
          <div className="ws-k">Metrics</div>
          <div className="ws-v">{exp.metrics.join(' · ') || '—'}</div>
        </div>
      </div>

      <div className="ws-section">
        <div className="ws-section-title">Results</div>
        {stats.length === 0 && <div className="ws-v">尚未上传结果数据。</div>}
        {stats.map((s) => (
          <div key={s.metric} className="ws-item">
            <div className="ws-k">{s.metric}</div>
            <div className="ws-v" style={{ marginTop: 3 }}>
              baseline {s.baseline.mean.toFixed(2)}（n={s.baseline.n}） → treatment {s.treatment.mean.toFixed(2)}（n={s.treatment.n}）
            </div>
            <div className="ws-v" style={{ color: s.deltaPercent <= 0 ? 'var(--soul-highlight)' : 'var(--leaf-warning)' }}>
              Δ {s.delta.toFixed(3)}（{s.deltaPercent.toFixed(1)}%）
            </div>
          </div>
        ))}
      </div>

      {exp.result?.humanView && (
        <div className="ws-section">
          <div className="ws-section-title">Human Interpretation</div>
          <div className="ws-v">{exp.result.humanView}</div>
        </div>
      )}

      {review && (
        <div className="ws-section">
          <div className="ws-section-title">Soul Keeper Review</div>
          <div className="ws-item">
            <div className="ws-v" style={{ color: 'var(--soul-highlight)' }}>{review.verdict}</div>
            <div className="ws-v" style={{ marginTop: 4 }}>{review.rationale}</div>
          </div>
        </div>
      )}

      <div className="ws-actions">
        <button className="btn" onClick={() => openEvidence(exp.id, 'submit')}>Upload More Evidence</button>
        <button className="btn" disabled title="需要新增标记完成的事件（W4 契约）">Mark as Complete</button>
      </div>
    </>
  );
}

/* ==================== Paper Detail ==================== */

function PaperDetail({ doc, id }: { doc: SoulDoc; id: string }) {
  const openKeeper = useGardenStore((s) => s.openKeeper);
  const addPaperToMemory = useSoulStore((s) => s.addPaperToMemory);
  const paper = doc.papers.find((p) => p.paperId === id);
  if (!paper) return <div className="ws-v">该论文已不在轨道中。</div>;

  const identity = orbIdentityOf(paper);
  const meta = ORB_IDENTITY_META[identity];

  return (
    <>
      <div className="ws-title">{paper.title}</div>
      <div className="ws-sub">
        {paper.authors.join(', ') || 'Unknown authors'} · {paper.year} · {paper.source}
      </div>

      <div className="ws-section">
        <div className="ws-kv">
          <div className="ws-k">Orb</div>
          <div className="ws-v" style={{ color: meta.color }}>{meta.label} — {meta.hint}</div>
          <div className="ws-k">Related to</div>
          <div className="ws-v">{paper.matchedGap || '—'}</div>
          <div className="ws-k">Key mechanism</div>
          <div className="ws-v">{paper.keyMechanism || '—'}</div>
          <div className="ws-k">In Soul Memory</div>
          <div className="ws-v">{paper.inMemory ? '已加入' : '未加入'}</div>
        </div>
      </div>

      {paper.reason && (
        <div className="ws-section">
          <div className="ws-section-title">Why it matters</div>
          <div className="ws-v">{paper.reason}</div>
        </div>
      )}

      {paper.abstract && (
        <div className="ws-section">
          <div className="ws-section-title">Abstract</div>
          <div className="ws-v">{paper.abstract}</div>
        </div>
      )}

      <div className="ws-actions">
        <button className="btn" disabled title="链接必须来自检索结果（arxivUrl / doiUrl / openAlexUrl），W4 契约">Open arXiv</button>
        <button className="btn" disabled title="同上（W4）">DOI</button>
        <button className="btn" disabled title="同上（W4）">OpenAlex</button>
        <button className="btn" onClick={openKeeper}>Discuss with Soul Keeper</button>
        <button className="btn" disabled={paper.inMemory} onClick={() => addPaperToMemory(paper.paperId)}>
          {paper.inMemory ? 'In Soul Memory' : 'Attach to Soul'}
        </button>
      </div>
    </>
  );
}

/* ==================== Boundary Detail ==================== */

function BoundaryDetail({ doc, id }: { doc: SoulDoc; id: string }) {
  const leaf = doc.leaves.find((l) => l.id === id);
  if (!leaf) return <div className="ws-v">该边界已不存在。</div>;
  const sev = leafSeverity(doc, leaf);
  const meta = LEAF_SEVERITY_META[sev];

  return (
    <>
      <div className="ws-title">{leaf.label}</div>
      <div className="ws-sub" style={{ color: meta.color }}>{meta.label} — {meta.hint}</div>
      <div className="ws-section">
        <div className="ws-kv">
          <div className="ws-k">失败条件</div>
          <div className="ws-v">{leaf.failureCondition || '—'}</div>
          <div className="ws-k">AI 判断</div>
          <div className="ws-v">{leaf.aiJudgement || '—'}</div>
          <div className="ws-k">研究者判断</div>
          <div className="ws-v">{leaf.userJudgement || '—'}</div>
          <div className="ws-k">后续建议</div>
          <div className="ws-v">{leaf.nextSteps || '—'}</div>
        </div>
      </div>
    </>
  );
}
