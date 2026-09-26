/**
 * Instrument Workshop —— 科研仪器工坊（数学仪器层的可见界面）
 *
 * Garden 研究生命，Frontier Observatory 观察外部世界，
 * **Workshop 研究自己的实验数据**；Soul Keeper 把两边联系起来。
 *
 * 两类仪器（科研诚信：绝不把 AI 临时生成的代码与成熟工具等价）：
 *   Core（Verified）        —— 出厂仪器，仓库内测试保证
 *   Generated(Experimental) —— Toolsmith 动态生成，验证通过后入库
 *   Generated(Trusted)      —— 多次成功运行 / 用户显式 promote
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { X, Wrench, FlaskConical, BadgeCheck, ChevronRight } from 'lucide-react';

interface ToolItem {
  tool_id: string;
  version: number;
  status: 'core' | 'experimental' | 'trusted';
  scientific_question: string;
  method: string;
  input_schema?: Record<string, string>;
  output_schema?: Record<string, string>;
  assumptions?: string[];
  dependencies?: string[];
  code_hash: string;
  core: boolean;
}

interface RunItem {
  run_id: string;
  tool_id: string;
  tool_version: number;
  params_json: string;
  input_summary: string;
  duration_ms: number;
  status: string;
  created_at: string;
  code_hash: string;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  core: { label: 'Core · Verified', color: '#FFD95A' },
  experimental: { label: 'Generated · Experimental', color: '#FB923C' },
  trusted: { label: 'Generated · Trusted', color: '#5BC8E8' },
};

export function WorkshopPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tools, setTools] = useState<ToolItem[]>([]);
  const [health, setHealth] = useState<{ ok: boolean; version?: string; error?: string } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [runs, setRuns] = useState<Record<string, RunItem[]>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [tRes, hRes] = await Promise.all([
        fetch('/api/math/tools').then((r) => r.json()),
        fetch('/api/math/health').then((r) => r.json()),
      ]);
      if (tRes?.ok) setTools(tRes.data.tools as ToolItem[]);
      else setError('无法读取工具库');
      setHealth(hRes?.data ?? null);
    } catch (e: any) {
      setError(`后端不可用：${e?.message ?? '未知错误'}`);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const toggleRuns = async (toolId: string) => {
    if (expanded === toolId) {
      setExpanded(null);
      return;
    }
    setExpanded(toolId);
    if (!runs[toolId]) {
      try {
        const r = await fetch(`/api/math/tools/${toolId}/runs`).then((x) => x.json());
        if (r?.ok) setRuns((prev) => ({ ...prev, [toolId]: r.data.runs as RunItem[] }));
      } catch {
        /* 溯源读取失败不阻塞主流程 */
      }
    }
  };

  const promote = async (toolId: string) => {
    try {
      const res = await fetch(`/api/math/tools/${toolId}/promote`, { method: 'POST' });
      if (res.ok) await load();
    } catch {
      /* 忽略：状态未变 */
    }
  };

  if (!open) return null;

  const core = tools.filter((t) => t.core);
  const generated = tools.filter((t) => !t.core);

  return (
    <div
      className="panel"
      style={{
        position: 'absolute',
        top: 68,
        right: 22,
        width: 540,
        maxHeight: '76vh',
        borderRadius: 16,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 34,
        // 背景做实：避免花园里的 cluster 标签透过半透明面板
        background: 'linear-gradient(180deg, rgba(16,79,65,0.99), rgba(10,68,56,1))',
        boxShadow: '0 20px 56px rgba(0,0,0,0.5)',
      }}
    >
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid rgba(134,239,172,0.16)' }}
      >
        <div>
          <div className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: 'var(--soul-highlight)' }}>
            <Wrench size={14} /> Instrument Workshop
          </div>
          <div className="text-[10.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            科研仪器工坊 · 研究自己的实验数据
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="chip" style={{ fontSize: 10.5 }}>
            {health?.ok ? `Sandbox OK · py ${health.version ?? ''}` : 'Sandbox 不可用'}
          </span>
          <button className="btn !px-2 !py-1" onClick={onClose} aria-label="close">
            <X size={13} />
          </button>
        </div>
      </div>

      <div className="px-4 py-3 overflow-y-auto" style={{ fontSize: 12 }}>
        {error && (
          <div className="mb-3 rounded-lg p-2.5" style={{ border: '1px solid rgba(251,146,60,0.45)', color: '#FCD34D' }}>
            {error}
          </div>
        )}

        <Section title={`Core Instruments · ${core.length}`} hint="出厂仪器，仓库内测试保证">
          {core.map((t) => (
            <ToolCard
              key={t.tool_id}
              tool={t}
              runs={runs[t.tool_id]}
              expanded={expanded === t.tool_id}
              onToggle={() => void toggleRuns(t.tool_id)}
              onPromote={undefined}
            />
          ))}
        </Section>

        <Section
          title={`Generated Instruments · ${generated.length}`}
          hint="Toolsmith 按需制造；Experimental 与成熟工具不等价"
        >
          {generated.length === 0 && (
            <div style={{ color: 'var(--text-muted)', lineHeight: 1.7 }}>
              还没有动态生成的仪器。当 Mathematical Scientist 发现现有仪器不够用时，
              它会发出 Tool Requirement，由 Toolsmith 生成、Verifier 验证后入库。
            </div>
          )}
          {generated.map((t) => (
            <ToolCard
              key={t.tool_id}
              tool={t}
              runs={runs[t.tool_id]}
              expanded={expanded === t.tool_id}
              onToggle={() => void toggleRuns(t.tool_id)}
              onPromote={t.status === 'experimental' ? () => void promote(t.tool_id) : undefined}
            />
          ))}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        {title}
      </div>
      <div className="text-[10.5px] mb-2" style={{ color: 'var(--text-muted)', opacity: 0.8 }}>
        {hint}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function ToolCard({
  tool,
  runs,
  expanded,
  onToggle,
  onPromote,
}: {
  tool: ToolItem;
  runs?: RunItem[];
  expanded: boolean;
  onToggle: () => void;
  onPromote?: () => void;
}) {
  const meta = STATUS_META[tool.status] ?? STATUS_META.core;
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(134,239,172,0.16)', background: 'rgba(20,98,76,0.35)' }}>
      <button className="w-full text-left px-3 py-2.5" onClick={onToggle}>
        <div className="flex items-center gap-2">
          {tool.core ? <BadgeCheck size={13} style={{ color: meta.color }} /> : <FlaskConical size={13} style={{ color: meta.color }} />}
          <span className="num text-[12px]" style={{ color: 'var(--text-primary)' }}>
            {tool.tool_id} <span style={{ color: 'var(--text-muted)' }}>v{tool.version}</span>
          </span>
          <span className="chip" style={{ fontSize: 10, color: meta.color }}>{meta.label}</span>
          <ChevronRight
            size={13}
            style={{ marginLeft: 'auto', color: 'var(--text-muted)', transform: expanded ? 'rotate(90deg)' : 'none' }}
          />
        </div>
        <div className="mt-1.5 text-[11.5px]" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {tool.scientific_question}
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
          <div className="pt-2" style={{ borderTop: '1px solid rgba(134,239,172,0.14)' }}>
            <Row k="Method" v={tool.method} />
            {tool.input_schema && Object.keys(tool.input_schema).length > 0 && (
              <Row k="Input" v={Object.entries(tool.input_schema).map(([a, b]) => `${a}: ${b}`).join(' · ')} />
            )}
            {tool.output_schema && Object.keys(tool.output_schema).length > 0 && (
              <Row k="Output" v={Object.entries(tool.output_schema).map(([a, b]) => `${a}: ${b}`).join(' · ')} />
            )}
            {tool.assumptions && tool.assumptions.length > 0 && <Row k="Assumptions" v={tool.assumptions.join('；')} />}
            {tool.dependencies && tool.dependencies.length > 0 && <Row k="Deps" v={tool.dependencies.join(', ')} />}
            <Row k="Code hash" v={tool.code_hash} mono />
          </div>

          <div className="mt-2 pt-2" style={{ borderTop: '1px dashed rgba(134,239,172,0.18)' }}>
            <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>
              Provenance · 最近运行
            </div>
            {!runs && <div style={{ color: 'var(--text-muted)' }}>读取中…</div>}
            {runs && runs.length === 0 && <div style={{ color: 'var(--text-muted)' }}>还没有运行记录。</div>}
            {runs?.slice(0, 5).map((r) => (
              <div key={r.run_id} className="num" style={{ color: 'var(--text-muted)', lineHeight: 1.7 }}>
                {r.status === 'ok' ? '✓' : '✗'} {new Date(r.created_at).toLocaleString('zh-CN')} · {r.duration_ms}ms ·{' '}
                {r.input_summary.slice(0, 60)}
              </div>
            ))}
          </div>

          {onPromote && (
            <button className="btn-mini mt-2" onClick={onPromote}>
              标记为 Trusted（多次验证后）
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex gap-2 py-0.5">
      <span style={{ color: 'var(--text-muted)', minWidth: 78, flexShrink: 0 }}>{k}</span>
      <span className={mono ? 'num' : undefined} style={{ lineHeight: 1.6 }}>{v}</span>
    </div>
  );
}
