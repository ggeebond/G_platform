import { Check, AlertTriangle, XCircle, HelpCircle } from 'lucide-react';
import { useSoulStore } from '../../stores/soulStore';
import type { EvidenceVerdict } from '../../../shared/schemas';

const VERDICT_META: Record<
  EvidenceVerdict['verdict'],
  { label: string; tone: string; color: string; icon: typeof Check; state: string; cta: string }
> = {
  accepted: {
    label: 'Accepted',
    tone: 'good',
    color: '#73DDF7',
    icon: Check,
    state: '结果足以支持假设',
    cta: 'Solidify Petal',
  },
  insufficient: {
    label: 'Insufficient',
    tone: 'wait',
    color: '#D8B652',
    icon: HelpCircle,
    state: '证据还不足以支持结论',
    cta: '保持虚幻',
  },
  contradictory: {
    label: 'Contradictory',
    tone: 'bad',
    color: '#F87171',
    icon: AlertTriangle,
    state: '结果削弱了原结论',
    cta: '生成黄叶',
  },
  invalid: {
    label: 'Invalid',
    tone: 'mute',
    color: '#8A8F8C',
    icon: XCircle,
    state: '这次实验无效',
    cta: '仅保留实验记录',
  },
};

interface VerdictCardProps {
  verdict: EvidenceVerdict;
  experimentId: string;
  onApply?: (v: EvidenceVerdict) => void;
}

/** Evidence Review 判定卡：Data Brief → AI View → Verdict → 由用户决定的动作 */
export function VerdictCard({ verdict, experimentId, onApply }: VerdictCardProps) {
  const applyVerdict = useSoulStore((s) => s.applyVerdict);
  const meta = VERDICT_META[verdict.verdict];
  const Icon = meta.icon;

  const apply = () => {
    if (onApply) onApply(verdict);
    else applyVerdict(experimentId, verdict, '');
  };

  return (
    <div className="rcard" data-tone={meta.tone}>
      <div className="rcard-head">
        <span className="rcard-type">Evidence Verdict</span>
        <span className="chip num">confidence {verdict.confidence.toFixed(2)}</span>
      </div>

      <div className="rcard-body">
        <div className="flex items-center gap-2.5">
          <Icon size={18} style={{ color: meta.color }} />
          <span className="rcard-lead" style={{ color: meta.color }}>
            {meta.label}
          </span>
        </div>

        <div className="rcard-state" data-ok={verdict.verdict === 'accepted'}>
          <span className="rcard-state-dot" />
          {meta.state}
        </div>

        <div className="rcard-facts">
          <span className="rcard-fact-k">Data Brief</span>
          <span className="rcard-fact-v">{verdict.dataBrief}</span>

          <span className="rcard-fact-k">AI View</span>
          <span className="rcard-fact-v">{verdict.aiView}</span>

          <span className="rcard-fact-k">Rationale</span>
          <span className="rcard-fact-v" style={{ color: 'var(--text-primary)' }}>
            {verdict.rationale}
          </span>
        </div>

        {verdict.conditions.length > 0 && (
          <div className="mt-3">
            <div className="rcard-fact-k mb-1.5">结论成立条件</div>
            <div className="flex flex-wrap gap-1.5">
              {verdict.conditions.map((c) => (
                <span key={c} className="chip">{c}</span>
              ))}
            </div>
          </div>
        )}

        {verdict.suggestedNext && (
          <details className="rcard-more">
            <summary>下一步建议</summary>
            <div className="rcard-more-body">
              <div className="rcard-fact-v">{verdict.suggestedNext}</div>
            </div>
          </details>
        )}

        <div className="rcard-cta">
          <button className="btn btn-primary" onClick={apply}>
            {meta.cta}
          </button>
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            AI 不会自动改变花的状态，必须由你确认
          </span>
        </div>
      </div>
    </div>
  );
}
