import { useState } from 'react';
import { Sprout } from 'lucide-react';
import { useSoulStore } from '../../stores/soulStore';
import type { DesignVerdict } from '../../../shared/schemas';

interface ExperimentCardProps {
  verdict: DesignVerdict;
  experimentId?: string;
}

/**
 * Mode B — Experiment Design。
 *
 * 不是「AI 说这个实验合理」，而是一张可以按下去的卡：
 * 只讲假设、对照、指标三件事，然后给一个明确的动作 —— 长出一片候选花瓣。
 */
export function ExperimentCard({ verdict, experimentId }: ExperimentCardProps) {
  const confirmDesign = useSoulStore((s) => s.confirmDesign);
  const [done, setDone] = useState(false);

  return (
    <div className="rcard" data-tone={verdict.accepted ? 'good' : 'wait'}>
      <div className="rcard-head">
        <span className="rcard-type">Experiment Candidate</span>
        <span
          className="chip"
          style={{
            borderColor: verdict.accepted ? 'rgba(129,241,255,0.5)' : 'rgba(216,182,82,0.5)',
            color: verdict.accepted ? 'var(--soul-highlight)' : 'var(--leaf-warning)',
          }}
        >
          {verdict.accepted ? 'Design Accepted' : 'Not Testable Yet'}
        </span>
      </div>

      <div className="rcard-body">
        <div className="rcard-lead">{verdict.hypothesis || verdict.title}</div>
        {verdict.goal && <div className="rcard-sub">{verdict.goal}</div>}

        <div className="rcard-facts">
          <span className="rcard-fact-k">Baseline</span>
          <span className="rcard-fact-v">
            {verdict.baseline.name} = {verdict.baseline.value}
          </span>

          <span className="rcard-fact-k">Treatment</span>
          <span className="rcard-fact-v">
            {verdict.treatment.name} {verdict.treatment.value || verdict.treatment.range.join('~')}
          </span>

          <span className="rcard-fact-k">Metrics</span>
          <span className="rcard-fact-v">{verdict.metrics.join(' · ')}</span>

          <span className="rcard-fact-k">Controls</span>
          <span className="rcard-fact-v">{verdict.controlledVariables.join(' · ')}</span>
        </div>

        <div className="rcard-state" data-ok={verdict.accepted}>
          <span className="rcard-state-dot" />
          {verdict.accepted ? '这个设计能真正检验假设' : '这个设计还检验不了假设'}
        </div>

        {/* 细节收进折叠区，卡片先要像一张卡 */}
        <details className="rcard-more">
          <summary>设计细节与风险</summary>
          <div className="rcard-more-body">
            <Fact k="Expected" v={verdict.expectedObservation} />
            <Fact k="Main Risk" v={verdict.mainRisk} />
            <Fact k="Reason" v={verdict.reason} />
          </div>
        </details>

        {verdict.missingControls.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {verdict.missingControls.map((m) => (
              <span
                key={m}
                className="chip"
                style={{ borderColor: 'rgba(216,182,82,0.45)', color: 'var(--leaf-warning)' }}
              >
                缺失：{m}
              </span>
            ))}
          </div>
        )}

        <div className="rcard-cta">
          {verdict.accepted && experimentId && !done ? (
            <button
              className="btn btn-primary"
              onClick={() => {
                confirmDesign(experimentId);
                setDone(true);
              }}
            >
              <Sprout size={13} /> 长出候选花瓣
            </button>
          ) : done ? (
            <span className="text-[11.5px]" style={{ color: 'var(--leaf-green)' }}>
              候选花瓣已经长出来了，Paper Scout 正在检索相关工作。
            </span>
          ) : (
            <span className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
              补齐缺失的控制变量后再试一次。
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  if (!v) return null;
  return (
    <div className="grid grid-cols-[92px_1fr] gap-3 mb-2">
      <span className="rcard-fact-k">{k}</span>
      <span className="rcard-fact-v">{v}</span>
    </div>
  );
}
