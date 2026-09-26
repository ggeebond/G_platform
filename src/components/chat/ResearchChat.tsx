import { useEffect, useRef, useState } from 'react';
import { Send, Sparkles, FlaskConical, BookOpen } from 'lucide-react';
import { useSoulStore } from '../../stores/soulStore';
import { ErrorInline } from './AgentHeader';
import { ExperimentCard } from './ExperimentCard';
import { IdeaCard } from './IdeaCard';
import { PaperHitCard } from './PaperHitCard';
import { VerdictCard } from './VerdictCard';
import { SOUL_STATUS_LABEL } from '../../lib/state/visual';

export function ResearchChat() {
  const doc = useSoulStore((s) => s.doc);
  const chat = useSoulStore((s) => s.chat);
  const focus = useSoulStore((s) => s.focus);
  const mode = useSoulStore((s) => s.mode);
  const agentStatus = useSoulStore((s) => s.agentStatus);
  const ask = useSoulStore((s) => s.askSoulKeeper);
  const scanPapers = useSoulStore((s) => s.scanPapers);
  const structureIdea = useSoulStore((s) => s.structureIdea);

  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [chat.length, agentStatus]);

  const send = () => {
    const text = input.trim();
    if (!text || agentStatus === 'thinking') return;
    setInput('');
    void ask(text);
  };

  const focusLabel =
    focus?.type === 'petal'
      ? `Petal · ${focus.label}`
      : focus?.type === 'leaf'
        ? `Yellow Leaf · ${focus.label}`
        : focus?.type === 'paper'
          ? `Paper · ${focus.label}`
          : focus?.type === 'root'
            ? `Baseline · ${focus.label}`
            : focus?.type === 'stem'
              ? 'Stem · Mechanism Chain'
              : 'Bud · Core Hypothesis';

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Context Strip — 永远显示 */}
      <div
        className="px-4 py-2 flex items-center gap-2 flex-wrap text-[11.5px]"
        style={{ borderBottom: '1px solid rgba(134,239,172,0.12)', background: 'rgba(16,37,31,0.4)' }}
      >
        <span className="chip chip-soul">Soul: {doc.soul.title}</span>
        <span className="chip">Focus: {focusLabel}</span>
        <span className="chip">Mode: {mode}</span>
        <span className="chip" style={{ borderColor: 'rgba(101,201,140,0.4)', color: 'var(--leaf-green)' }}>
          {SOUL_STATUS_LABEL[doc.soul.status] ?? doc.soul.status}
        </span>
      </div>

      {/* Conversation */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5 min-h-0">
        {chat.map((m) => (
          <div key={m.id} className={`card-in ${m.role === 'user' ? 'flex justify-end' : ''}`}>
            {m.role === 'user' ? (
              <div
                className="max-w-[86%] rounded-2xl rounded-br-md px-3.5 py-2.5 text-[13px]"
                style={{ background: 'rgba(121,222,248,0.14)', border: '1px solid rgba(121,222,248,0.28)', color: 'var(--text-primary)' }}
              >
                {m.text}
              </div>
            ) : (
              <div className="max-w-[96%] space-y-2.5">
                {m.text && (
                  <div className="text-[12.8px]" style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                    {m.text}
                  </div>
                )}
                {m.card?.kind === 'idea' && <IdeaCard idea={m.card.data} />}
                {m.card?.kind === 'design' && (
                  <ExperimentCard verdict={m.card.data} experimentId={m.card.experimentId} />
                )}
                {m.card?.kind === 'verdict' && (
                  <VerdictCard verdict={m.card.data} experimentId={m.card.experimentId} />
                )}
                {m.card?.kind === 'papers' && <PaperHitCard papers={m.card.data} />}
                {m.card?.kind === 'error' && <ErrorInline message={m.card.data.message} detail={m.card.data.detail} />}
              </div>
            )}
          </div>
        ))}

        {agentStatus === 'thinking' && (
          <div className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--text-muted)' }}>
            <span className="w-1.5 h-1.5 rounded-full dot-pulse" style={{ background: 'var(--soul-core)' }} />
            Lab Keeper 正在路由专家并生成结构化结果…
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="px-4 py-3" style={{ borderTop: '1px solid rgba(134,239,172,0.12)' }}>
        <div className="flex items-center gap-2 mb-2">
          <button className="btn !px-2.5 !py-1 text-[11px]" onClick={() => structureIdea(doc.soul.rawIdea)}>
            <Sparkles size={12} /> 结构化想法
          </button>
          <button
            className="btn !px-2.5 !py-1 text-[11px]"
            onClick={() => scanPapers('manual_scan', doc.soul.mainGap || doc.soul.title, null)}
          >
            <BookOpen size={12} /> Scan Frontier
          </button>
          <button
            className="btn !px-2.5 !py-1 text-[11px]"
            onClick={() =>
              setInput(
                `我想把 ${doc.baselines[0]?.name ?? 'Fixed Horizon'} = ${doc.baselines[0]?.value ?? '16'} 作为 baseline，再做一组 treatment，比较 ${doc.soul.dependentMetrics.join(' 和 ')}。`,
              )
            }
          >
            <FlaskConical size={12} /> 实验模板
          </button>
        </div>
        <div
          className="rounded-xl px-3 py-2 flex items-end gap-2"
          style={{ background: 'rgba(16,37,31,0.7)', border: '1px solid rgba(134,239,172,0.18)' }}
        >
          <textarea
            className="flex-1 bg-transparent outline-none resize-none text-[13px]"
            rows={2}
            placeholder="告诉 Soul Keeper 你想验证什么…（例如：我想把 fixed horizon=16 作为 baseline，再做 8~24 的动态 horizon，比较 success_rate 和 latency_ms）"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            style={{ color: 'var(--text-primary)', minHeight: 44 }}
          />
          <button className="btn btn-primary !px-3" onClick={send} disabled={!input.trim() || agentStatus === 'thinking'}>
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
