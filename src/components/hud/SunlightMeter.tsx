/**
 * SunlightMeter —— 阳光机制的可见入口。
 *
 * 花园里的阳光不是氛围参数：它等于「这座花园现在有多少条论证被证据照亮」。
 * 这里把公式摊开给研究者看，让它成为一个可以被 argue 的机制，而不是玄学。
 */
import { useState } from 'react';
import { Sun } from 'lucide-react';
import { useGardenSunlight } from '../../lib/garden/useSunlight';

export function SunlightMeter() {
  const sun = useGardenSunlight();
  const [open, setOpen] = useState(false);
  const percent = Math.round(sun.level * 100);

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div className="sun-meter">
        <Sun size={14} style={{ color: '#FDE047' }} />
        <div className="flex items-baseline gap-1.5">
          <span className="sun-meter-label">Sunlight</span>
          <span className="sun-meter-value num">{percent}%</span>
        </div>
        <div className="sun-meter-track">
          <div className="sun-meter-fill" style={{ width: `${Math.max(4, percent)}%` }} />
        </div>
        <span className="sun-meter-phase">{sun.phaseLabel}</span>
      </div>

      {open && (
        <div className="sun-tip">
          <div className="sun-tip-title">
            阳光 {percent}% · {sun.phaseLabel}
          </div>
          <div className="sun-tip-hint">{sun.hint}</div>
          {sun.contributors.map((c) => (
            <div key={c.label} className="sun-tip-row">
              <span>{c.label}</span>
              <span className="num" style={{ color: c.delta >= 0 ? '#A3E635' : '#FBBF24' }}>
                {c.delta >= 0 ? '+' : ''}
                {c.delta.toFixed(2)}
              </span>
            </div>
          ))}
          <div className="sun-tip-formula">{sun.formula}</div>
        </div>
      )}
    </div>
  );
}
