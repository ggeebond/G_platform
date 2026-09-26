import { Sparkles, AlertTriangle } from 'lucide-react';
import type { AgentStatus } from '../../stores/soulStore';
import type { AgentMode } from '../../lib/chat';

interface AgentHeaderProps {
  status: AgentStatus;
  mode: AgentMode;
  adapter: 'learnbuddy' | 'mock';
  onToggleAdapter: () => void;
}

export function AgentHeader({ status, mode, adapter, onToggleAdapter }: AgentHeaderProps) {
  const dotColor =
    status === 'thinking' ? 'var(--soul-core)' : status === 'offline' ? 'var(--leaf-warning)' : 'var(--leaf-green)';

  return (
    <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(134,239,172,0.14)' }}>
      <div className="flex items-center gap-2.5">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: 'linear-gradient(180deg, rgba(121,222,248,0.22), rgba(121,222,248,0.06))', border: '1px solid rgba(121,222,248,0.35)' }}
        >
          <Sparkles size={14} style={{ color: 'var(--soul-highlight)' }} />
        </div>
        <div>
          <div className="text-[13px] font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
            Soul Keeper
          </div>
          <div className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            <span className="w-1.5 h-1.5 rounded-full dot-pulse" style={{ background: dotColor }} />
            {status === 'thinking'
              ? 'Lab Keeper 正在路由专家…'
              : status === 'offline'
                ? 'LearnBuddy 不可用 · 离线浏览'
                : '在线 · Lab Keeper 待命'}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="chip chip-soul">{mode}</span>
        <button className="btn !px-2 !py-1 text-[11px]" onClick={onToggleAdapter} title="切换智能来源">
          {adapter === 'learnbuddy' ? 'LearnBuddy' : 'Mock (演示)'}
        </button>
      </div>
    </div>
  );
}

export function ErrorInline({ message, detail }: { message: string; detail?: string }) {
  return (
    <div
      className="rounded-xl p-3 flex items-start gap-2"
      style={{ border: '1px solid rgba(226,120,120,0.4)', background: 'rgba(226,120,120,0.08)' }}
    >
      <AlertTriangle size={14} className="mt-0.5" style={{ color: 'var(--conflict)' }} />
      <div>
        <div className="text-[12.5px]" style={{ color: '#FCA5A5' }}>{message}</div>
        {detail && (
          <div className="text-[11px] mt-1 num" style={{ color: 'var(--text-muted)' }}>
            {detail.slice(0, 220)}
          </div>
        )}
      </div>
    </div>
  );
}
