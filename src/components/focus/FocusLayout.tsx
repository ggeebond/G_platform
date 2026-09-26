/**
 * FocusLayout —— 聚焦态主体：62 / 38
 *
 * 左 Research Focus Space：以花为中心，周围是研究对象（Claim / Experiment /
 * Baseline / Boundary / Paper / Frontier Paper / Open Question / Metric）。
 * 左侧 3D 世界不放任何文字遮挡 —— 悬停只做视觉反馈，信息全部走右侧 Inspector。
 *
 * 交互契约（与右侧三态一一对应）：
 *   hover  → setHoveredNode → 右侧轻量 PREVIEW，移开即恢复
 *   click  → selectNode     → 右侧完整 Detail 并锁住
 */
import { useGardenStore, type ResearchNode } from '../../stores/gardenStore';
import { useSoulStore } from '../../stores/soulStore';
import { ORB_IDENTITY_META, orbIdentityOf } from '../../lib/garden/orbIdentity';
import { FocusWorkspace } from './FocusWorkspace';
import type { FrontierSignal } from '../../lib/frontier';

/** 节点语义配色（与 W3 的球状网络共用同一套） */
const NODE = {
  claim: '#FFD95A',
  experiment: '#5BC8E8',
  baseline: '#C9A46B',
  boundary: '#FB923C',
  metric: '#7FE3B0',
  openq: '#B6E64D',
  frontier: '#FFD44D',
} as const;

const tag = (n: number) => `#${String(n).padStart(2, '0')}`;

/** 轨道上的一个研究对象：hover 只反馈，click 才锁定 */
function RailNode({
  color,
  text,
  node,
  active,
}: {
  color: string;
  text: string;
  node?: ResearchNode;
  active?: boolean;
}) {
  const selectNode = useGardenStore((s) => s.selectNode);
  const setHoveredNode = useGardenStore((s) => s.setHoveredNode);

  if (!node) {
    return (
      <div className="orb-chip" style={{ cursor: 'default' }}>
        <span className="orb-dot" style={{ background: color }} />
        <span className="orb-chip-text">{text}</span>
      </div>
    );
  }

  return (
    <button
      className="orb-chip"
      data-active={!!active}
      onMouseEnter={() => setHoveredNode(node)}
      onMouseLeave={() => setHoveredNode(null)}
      onClick={() => selectNode(node)}
    >
      <span className="orb-dot" style={{ background: color }} />
      <span className="orb-chip-text">{text}</span>
    </button>
  );
}

export function FocusLayout() {
  const soulId = useGardenStore((s) => s.soulId);
  const focus = useGardenStore((s) => s.workspaceFocus);
  const selected = useGardenStore((s) => s.selectedNode);
  const hovered = useGardenStore((s) => s.hoveredNode);
  const selectWorkspace = useGardenStore((s) => s.selectWorkspace);
  const setHoveredNode = useGardenStore((s) => s.setHoveredNode);

  const docs = useSoulStore((s) => s.docs);
  const activeDoc = useSoulStore((s) => s.doc);
  const scan = useSoulStore((s) => s.frontierScan);

  const doc = (soulId ? docs[soulId] : null) ?? activeDoc;
  if (!doc) return null;

  const signals: FrontierSignal[] = scan ? scan.signals.filter((s) => s.soulId === doc.soul.id) : [];
  const metrics = [...new Set(doc.experiments.flatMap((e) => e.metrics))].slice(0, 6);

  const isSel = (kind: ResearchNode['kind'], id: string) =>
    selected?.kind === kind && selected.id === id;
  const isHov = (kind: ResearchNode['kind'], id: string) =>
    hovered?.kind === kind && hovered.id === id;

  return (
    <div className="focus-layout">
      <div className="focus-left">
        <div className="orb-rail">
          <button
            className="orb-chip"
            data-active={!selected && focus.kind === 'overview'}
            onMouseEnter={() => setHoveredNode(null)}
            onClick={() => selectWorkspace({ kind: 'overview' })}
          >
            <span className="orb-dot" style={{ background: NODE.claim }} />
            <span className="orb-chip-text">Research Overview</span>
          </button>

          <div className="orb-rail-group">Orbit 1 · 论证结构</div>

          {doc.petals.map((p, i) => (
            <RailNode
              key={p.id}
              color={NODE.claim}
              text={`Claim ${tag(i + 1)} · ${p.label}`}
              node={{ kind: 'claim', id: p.id }}
              active={isSel('claim', p.id) || isHov('claim', p.id)}
            />
          ))}

          {doc.experiments.map((e, i) => (
            <RailNode
              key={e.id}
              color={NODE.experiment}
              text={`Experiment ${tag(i + 1)} · ${e.title}`}
              node={{ kind: 'experiment', id: e.id }}
              active={isSel('experiment', e.id) || isHov('experiment', e.id)}
            />
          ))}

          {doc.baselines.map((b) => (
            <RailNode
              key={b.id}
              color={NODE.baseline}
              text={`Baseline · ${b.name}${b.value ? ` = ${b.value}` : ''}`}
            />
          ))}

          {doc.leaves
            .filter((l) => l.status === 'warning')
            .map((l) => (
              <RailNode
                key={l.id}
                color={NODE.boundary}
                text={`Boundary · ${l.label}`}
                node={{ kind: 'boundary', id: l.id }}
                active={isSel('boundary', l.id) || isHov('boundary', l.id)}
              />
            ))}

          <div className="orb-rail-group">Orbit 2 · 外部知识与指标</div>

          {doc.papers.map((p) => {
            const meta = ORB_IDENTITY_META[orbIdentityOf(p)];
            return (
              <RailNode
                key={p.paperId}
                color={meta.color}
                text={`${meta.label} · ${p.title}`}
                node={{ kind: 'paper', id: p.paperId }}
                active={isSel('paper', p.paperId) || isHov('paper', p.paperId)}
              />
            );
          })}

          {doc.soul.openQuestions.map((q, i) => (
            <RailNode key={i} color={NODE.openq} text={`Open Q · ${q}`} />
          ))}

          {metrics.map((m) => (
            <RailNode key={m} color={NODE.metric} text={`Metric · ${m}`} />
          ))}

          {signals.length > 0 && (
            <>
              <div className="orb-rail-group">Frontier</div>
              {signals.map((s) => (
                <RailNode key={s.id} color={NODE.frontier} text={s.title} />
              ))}
            </>
          )}
        </div>
      </div>

      <FocusWorkspace doc={doc} signals={signals} />
    </div>
  );
}
