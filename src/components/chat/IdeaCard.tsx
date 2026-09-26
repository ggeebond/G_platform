import { useState } from 'react';
import { Sprout } from 'lucide-react';
import { useSoulStore } from '../../stores/soulStore';
import { useGardenStore } from '../../stores/gardenStore';
import type { IdeaResult } from '../../../shared/schemas';

interface IdeaCardProps {
  idea: IdeaResult;
}

/** Mode A — Idea Structuring 结构化卡 */
export function IdeaCard({ idea }: IdeaCardProps) {
  const plantSoul = useSoulStore((s) => s.plantSoul);
  const backToGarden = useGardenStore((s) => s.backToGarden);
  const [adopted, setAdopted] = useState(false);

  const adopt = () => {
    // 想法确认 → 在花园里种下一株新的花
    plantSoul(idea);
    backToGarden();
    setAdopted(true);
  };

  return (
    <div className="rcard" data-tone="good">
      <div className="rcard-head">
        <span className="rcard-type">New Soul · Idea Structured</span>
        <span className="chip chip-soul">{idea.title}</span>
      </div>

      <div className="rcard-body">
        <div className="rcard-lead">{idea.hypothesis || idea.title}</div>
        {idea.researchQuestion && <div className="rcard-sub">{idea.researchQuestion}</div>}

        <div className="rcard-facts">
          <span className="rcard-fact-k">Independent</span>
          <span className="rcard-fact-v">{idea.independentVariable}</span>

          <span className="rcard-fact-k">Metrics</span>
          <span className="rcard-fact-v">{idea.dependentMetrics.join(' · ')}</span>

          <span className="rcard-fact-k">Baseline</span>
          <span className="rcard-fact-v">
            {idea.baseline.name} = {idea.baseline.value}
          </span>

          <span className="rcard-fact-k">Main Gap</span>
          <span className="rcard-fact-v">{idea.mainGap}</span>
        </div>

        <details className="rcard-more">
          <summary>第一个实验与未解决问题</summary>
          <div className="rcard-more-body">
            <Fact k="First Exp" v={idea.firstExperiment} />
            <Fact k="Open" v={idea.openQuestions.join(' / ')} />
          </div>
        </details>

        <div className="rcard-cta">
          {!adopted ? (
            <>
              <button className="btn btn-primary" onClick={adopt}>
                <Sprout size={13} /> 种下这株花
              </button>
              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                它会开在 Garden 的 New Explorations 花圃
              </span>
            </>
          ) : (
            <span className="text-[11.5px]" style={{ color: 'var(--leaf-green)' }}>
              已种下。回到花园就能看到新的花，根系刚刚开始生长。
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
