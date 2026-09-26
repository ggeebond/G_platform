import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { Upload, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { MetricChart } from './MetricChart';
import { VerdictCard } from '../chat/VerdictCard';
import { useSoulStore } from '../../stores/soulStore';
import { computeStats, formatNumber, ParseError, StatsError, statsToBrief } from '../../lib/stats/experiment';
import type { ExperimentResult, MetricStat, ResultMapping } from '../../lib/types';
import type { EvidencePackage, EvidenceVerdict } from '../../../shared/schemas';
import type { MathProgressEvent } from '../../lib/agent/types';

type Row = Record<string, any>;
type Step = 'upload' | 'map' | 'stats' | 'verdict';

interface EvidenceFlowProps {
  open: boolean;
  experimentId: string | null;
  onClose: () => void;
  /**
   * submit（默认）：上传 → 列映射 → 统计 → Evidence Review
   * archive：只读展示已归档的证据，不允许重新提交
   */
  mode?: 'submit' | 'archive';
}

async function parseFile(file: File): Promise<Row[]> {
  if (/\.(xlsx|xls|xlsm)$/i.test(file.name)) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) throw new ParseError('工作表为空');
    return XLSX.utils.sheet_to_json<Row>(ws, { defval: '' });
  }
  const text = await file.text();
  const res = Papa.parse<Row>(text, { header: true, skipEmptyLines: true });
  if (res.errors?.length && res.data.length === 0) throw new ParseError(res.errors[0].message);
  return res.data;
}

/**
 * Instrument Ledger —— 数学仪器层的逐轮台账
 *
 * 这里展示的是「这个数字是怎么算出来的」：用了/造了哪个仪器、试验是否通过、
 * 每次运行的 code_hash。用户看到的是可追溯的测量记录，而不是 AI 的魔法。
 */
function InstrumentLedger({
  events,
  pkg,
  busy,
  onRerun,
}: {
  events: MathProgressEvent[];
  pkg: EvidencePackage | null;
  busy: boolean;
  onRerun: () => void;
}) {
  const status = busy ? '调查中…' : pkg ? `完成 · ${pkg.rounds.length} 次测量` : '未运行';
  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ border: '1px solid rgba(255,215,106,0.28)', background: 'rgba(255,215,106,0.05)' }}
    >
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid rgba(134,239,172,0.14)' }}>
        <div className="flex items-center gap-2">
          <span className="text-[11px] tracking-wide uppercase" style={{ color: 'var(--soul-highlight)' }}>
            Mathematical Instrument Layer
          </span>
          <span className="chip" style={{ fontSize: 10.5 }}>{status}</span>
          {busy && <span className="dot-pulse" style={{ color: 'var(--soul-core)' }}>●</span>}
        </div>
        <button className="btn-mini" onClick={onRerun} disabled={busy}>
          {busy ? '调查中…' : '重跑仪器层'}
        </button>
      </div>

      <div className="px-3 py-2.5 space-y-1.5" style={{ fontSize: 11.5 }}>
        {events.length === 0 && !busy && (
          <div style={{ color: 'var(--text-muted)' }}>
            还没有测量记录。确认列映射后会自动把原始数据交给仪器层。
          </div>
        )}

        {events.map((ev, i) => (
          <div key={i} className="flex items-start gap-2">
            <span
              className="mt-1 flex-shrink-0"
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                background:
                  ev.type === 'tool_rejected' || ev.type === 'fallback' ? '#FB923C'
                    : ev.type === 'tool_verified' || ev.type === 'finding' ? '#FFD95A'
                      : ev.type === 'tool_call' || ev.type === 'tool_result' ? '#5BC8E8'
                        : 'var(--text-muted)',
              }}
            />
            <span style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{describeEvent(ev)}</span>
          </div>
        ))}

        {pkg?.fallback && (
          <div className="mt-1 pt-1.5" style={{ borderTop: '1px dashed rgba(134,239,172,0.18)', color: '#FCD34D' }}>
            注意：本次由 Core Instruments 确定性计算（Mathematical Scientist 未参与），标注为 fallback。
          </div>
        )}

        {pkg && pkg.rounds.length > 0 && (
          <div className="mt-2 pt-2" style={{ borderTop: '1px solid rgba(134,239,172,0.14)' }}>
            <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>
              溯源 · Provenance
            </div>
            {pkg.rounds.map((r, i) => (
              <div key={i} className="num" style={{ color: 'var(--text-muted)', lineHeight: 1.7 }}>
                {r.tool_id} v{r.tool_version} · code_hash {r.code_hash || '—'} · {r.note}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function describeEvent(ev: MathProgressEvent): string {
  switch (ev.type) {
    case 'plan':
      return `分析计划：${ev.question}`;
    case 'round_start':
      return `第 ${ev.round} 轮调查`;
    case 'tool_call':
      return `调用仪器 ${ev.tool_id}（参数 ${JSON.stringify(ev.params).slice(0, 80)}）`;
    case 'tool_result':
      return `${ev.tool_id} 输出：${JSON.stringify(ev.outputs).slice(0, 160)}`;
    case 'tool_generating':
      return `Toolsmith 正在造新仪器：${ev.goal}`;
    case 'tool_verified':
      return `新仪器 ${ev.tool_id} v${ev.version} 通过验证（${ev.testsPassed}/${ev.testsTotal} 测试）`;
    case 'tool_rejected':
      return `仪器未放行：${ev.detail.slice(0, 160)}`;
    case 'finding':
      return `结论：${ev.finding}`;
    case 'fallback':
      return `LLM 不可用，降级为确定性 Core 仪器（${ev.reason.slice(0, 80)}）`;
    case 'error':
      return `错误：${ev.message}`;
    default:
      return '';
  }
}

function ArchivedField({ label, text }: { label: string; text: string }) {  if (!text) return null;
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        {label}
      </div>
      <div className="text-[12.5px] mt-0.5" style={{ color: 'var(--text-secondary)', lineHeight: 1.65 }}>
        {text}
      </div>
    </div>
  );
}

export function EvidenceFlow({ open, experimentId, onClose, mode = 'submit' }: EvidenceFlowProps) {
  const doc = useSoulStore((s) => s.doc);
  const submitResult = useSoulStore((s) => s.submitResult);
  const reviewEvidence = useSoulStore((s) => s.reviewEvidence);
  const applyVerdict = useSoulStore((s) => s.applyVerdict);
  const runMathInvestigation = useSoulStore((s) => s.runMathInvestigation);

  const exp = doc.experiments.find((e) => e.id === experimentId) ?? null;
  const review = useMemo(
    () => doc.reviews.find((r) => r.targetId === experimentId && r.targetType === 'evidence') ?? null,
    [doc.reviews, experimentId],
  );
  const isArchive = mode === 'archive' && !!exp?.result;

  const [step, setStep] = useState<Step>('upload');
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState('');
  const [mapping, setMapping] = useState<ResultMapping>({
    groupColumn: '',
    baselineLabel: '',
    treatmentLabel: '',
    metricColumns: [],
  });
  const [stats, setStats] = useState<MetricStat[]>([]);
  const [humanView, setHumanView] = useState('');
  const [verdict, setVerdict] = useState<EvidenceVerdict | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [manualText, setManualText] = useState('');

  /** Instrument Workshop：仪器台账（逐轮 SSE 事件）与最终 Evidence Package */
  const [ledger, setLedger] = useState<MathProgressEvent[]>([]);
  const [evidencePackage, setEvidencePackage] = useState<EvidencePackage | null>(null);
  const [mathBusy, setMathBusy] = useState(false);

  const columns = useMemo(() => (rows.length ? Object.keys(rows[0]) : []), [rows]);

  /**
   * 归档模式：直接把已提交的结果装进状态，落到统计步骤，不重走上传向导。
   * 依赖里刻意不放 exp —— 提交结果后 doc 会变，那会把向导重置回第一步。
   */
  useEffect(() => {
    if (!open) return;
    if (mode === 'archive') {
      const target = doc.experiments.find((e) => e.id === experimentId);
      if (target?.result) {
        setMapping(target.result.mapping);
        setStats(target.result.stats);
        setHumanView(target.result.humanView ?? '');
        setFileName(target.result.fileName ?? '');
        setEvidencePackage(target.result.evidencePackage ?? null);
        setLedger([]);
        setVerdict(null);
        setError(null);
        setStep('stats');
        return;
      }
    }
    setStep('upload');
    setRows([]);
    setStats([]);
    setVerdict(null);
    setError(null);
    setHumanView('');
    setManualText('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, experimentId, mode]);

  const groupValues = useMemo(() => {
    if (!mapping.groupColumn || !rows.length) return [];
    return Array.from(new Set(rows.map((r) => String(r[mapping.groupColumn])))).slice(0, 12);
  }, [mapping.groupColumn, rows]);

  const numericColumns = useMemo(() => {
    if (!rows.length) return [];
    return columns.filter((c) => {
      const sample = rows.slice(0, 12).map((r) => Number(r[c]));
      return sample.filter((n) => Number.isFinite(n)).length >= Math.ceil(sample.length * 0.7);
    });
  }, [columns, rows]);

  const onDrop = useCallback(async (accepted: File[]) => {
    const file = accepted[0];
    if (!file) return;
    setError(null);
    try {
      const parsed = await parseFile(file);
      if (!parsed.length) throw new ParseError('没有解析到任何数据行');
      setRows(parsed);
      setFileName(file.name);
      const cols = Object.keys(parsed[0] ?? {});
      const numeric = cols.filter((c) => {
        const sample = parsed.slice(0, 12).map((r) => Number(r[c]));
        return sample.filter((n) => Number.isFinite(n)).length >= Math.ceil(sample.length * 0.7);
      });
      const guessGroup =
        cols.find((c) => /group|policy|arm|method|condition|setting/i.test(c)) ??
        cols.find((c) => !numeric.includes(c)) ??
        cols[0];
      const values = Array.from(new Set(parsed.map((r) => String(r[guessGroup]))));
      setMapping({
        groupColumn: guessGroup,
        baselineLabel: values[0] ?? '',
        treatmentLabel: values[1] ?? values[0] ?? '',
        metricColumns: numeric.slice(0, 3),
      });
      setStats([]);
      setStep('map');
    } catch (e: any) {
      setError(
        e instanceof ParseError
          ? `解析失败：${e.message}。你可以改用下方手工输入（粘贴 CSV）继续。`
          : `解析失败：${e?.message ?? '未知错误'}。你可以改用下方手工输入继续。`,
      );
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
    },
    multiple: false,
  });

  const handleManual = () => {
    setError(null);
    try {
      const res = Papa.parse<Row>(manualText, { header: true, skipEmptyLines: true });
      if (!res.data.length) throw new ParseError('没有解析到数据');
      setRows(res.data);
      setFileName('手工输入.csv');
      const cols = Object.keys(res.data[0] ?? {});
      setMapping({
        groupColumn: cols[0] ?? '',
        baselineLabel: '',
        treatmentLabel: '',
        metricColumns: cols.slice(1, 4),
      });
      setStep('map');
    } catch (e: any) {
      setError(`手工输入解析失败：${e?.message ?? '未知错误'}`);
    }
  };

  const confirmMapping = () => {
    setError(null);
    try {
      const computed = computeStats(rows, mapping);
      setStats(computed);
      setStep('stats');
      // 列映射确认后自动进入数学仪器层（Raw Data → Instruments → Evidence Package）
      void startInvestigation();
    } catch (e: any) {
      const msg = e instanceof StatsError ? e.message : e?.message ?? '统计失败';
      setError(msg);
    }
  };

  /**
   * Instrument Workshop：把原始数据交给数学仪器层。
   * 逐轮事件刷新仪器台账；最终 Evidence Package 会随结果一起提交，
   * Evidence Reviewer 看到的是它而不是原始数据。
   */
  const startInvestigation = async () => {
    if (!exp || rows.length === 0) return;
    setMathBusy(true);
    setLedger([]);
    setEvidencePackage(null);
    try {
      const pkg = await runMathInvestigation(
        exp.id,
        rows as Array<Record<string, unknown>>,
        mapping,
        fileName,
        humanView,
        (ev) => setLedger((prev) => [...prev, ev]),
      );
      setEvidencePackage(pkg);
      if (!pkg) setError('仪器层没有返回 Evidence Package（Agent 不可用或结构校验失败），可点「重跑仪器层」再试。');
    } finally {
      setMathBusy(false);
    }
  };

  const runReview = async () => {
    if (!exp) return;
    setBusy(true);
    setError(null);
    const result: ExperimentResult = {
      fileName,
      rows: rows.length,
      mapping,
      stats,
      humanView,
      submittedAt: Date.now(),
      evidencePackage: evidencePackage ?? undefined,
    };
    submitResult(exp.id, result);
    const v = await reviewEvidence(exp.id, humanView);
    setBusy(false);
    if (v) {
      setVerdict(v);
      setStep('verdict');
    } else {
      setError('Evidence Reviewer 没有返回合法结果，花的状态没有被改变。');
    }
  };

  const reset = () => {
    setStep('upload');
    setRows([]);
    setStats([]);
    setVerdict(null);
    setError(null);
    setHumanView('');
    setManualText('');
    setLedger([]);
    setEvidencePackage(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  if (!exp) return null;

  return (
    <Modal
      open={open}
      title={`提交实验结果 · ${exp.title}`}
      subtitle={`${exp.baseline.name} = ${exp.baseline.value} → ${exp.treatment.name} ${exp.treatment.value}`}
      onClose={close}
      width={760}
      footer={
        <>
          {step === 'map' && (
            <>
              <button className="btn" onClick={() => setStep('upload')}>
                重新上传
              </button>
              <button className="btn btn-primary" onClick={confirmMapping}>
                确认列含义并计算统计量
              </button>
            </>
          )}
          {step === 'stats' &&
            (isArchive ? (
              <button className="btn btn-primary" onClick={close}>
                完成
              </button>
            ) : (
              <>
                <button className="btn" onClick={() => setStep('map')}>
                  修改列映射
                </button>
                <button className="btn btn-primary" onClick={runReview} disabled={busy}>
                  {busy ? 'Evidence Review 进行中…' : '提交结果 · 进入 Evidence Review'}
                </button>
              </>
            ))}
          {step === 'verdict' && (
            <button className="btn btn-primary" onClick={close}>
              完成
            </button>
          )}
        </>
      }
    >
      {/* Step 1 — 上传 */}
      {step === 'upload' && (
        <div className="space-y-3">
          <div
            {...getRootProps()}
            className="rounded-xl p-8 text-center"
            style={{
              border: `1px dashed ${isDragActive ? 'rgba(121,222,248,0.7)' : 'rgba(134,239,172,0.3)'}`,
              background: isDragActive ? 'rgba(121,222,248,0.07)' : 'rgba(16,37,31,0.5)',
              cursor: 'pointer',
            }}
          >
            <input {...getInputProps()} />
            <Upload size={22} className="mx-auto mb-3" style={{ color: 'var(--soul-core)' }} />
            <div className="text-[13px]" style={{ color: 'var(--text-primary)' }}>
              拖入 .xlsx / .xls / .csv，或点击选择文件
            </div>
            <div className="text-[11.5px] mt-1" style={{ color: 'var(--text-muted)' }}>
              解析后的 mean / std / delta / n 由确定性代码计算，不经过 AI
            </div>
          </div>

          {error && (
            <div
              className="rounded-lg p-3 text-[12px] flex items-start gap-2"
              style={{ border: '1px solid rgba(216,182,82,0.45)', background: 'rgba(216,182,82,0.08)', color: '#FDE68A' }}
            >
              <AlertTriangle size={14} className="mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-2">
            <div className="text-[12px] mb-2" style={{ color: 'var(--text-secondary)' }}>
              解析失败？直接粘贴 CSV（F3 降级通道）
            </div>
            <textarea
              className="w-full rounded-lg p-3 text-[12px] num"
              rows={5}
              placeholder={'policy,success_rate,latency_ms\nfixed_16,0.81,148\nadaptive,0.80,122'}
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              style={{ background: 'rgba(11,59,46,0.8)', border: '1px solid rgba(134,239,172,0.2)', color: 'var(--text-primary)' }}
            />
            <button className="btn mt-2" onClick={handleManual} disabled={!manualText.trim()}>
              解析手工输入
            </button>
          </div>
        </div>
      )}

      {/* Step 2 — 列映射 */}
      {step === 'map' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-[12.5px]" style={{ color: 'var(--text-secondary)' }}>
            <FileSpreadsheet size={14} />
            <span>
              {fileName} · <span className="num">{rows.length}</span> 行 · <span className="num">{columns.length}</span> 列
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <label className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
              分组列（baseline / treatment）
              <select
                className="mt-1 w-full rounded-lg px-2 py-2 text-[12.5px]"
                value={mapping.groupColumn}
                onChange={(e) => setMapping({ ...mapping, groupColumn: e.target.value })}
                style={{ background: 'rgba(11,59,46,0.9)', border: '1px solid rgba(134,239,172,0.2)', color: 'var(--text-primary)' }}
              >
                {columns.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
              对照组取值（Baseline）
              <select
                className="mt-1 w-full rounded-lg px-2 py-2 text-[12.5px]"
                value={mapping.baselineLabel}
                onChange={(e) => setMapping({ ...mapping, baselineLabel: e.target.value })}
                style={{ background: 'rgba(11,59,46,0.9)', border: '1px solid rgba(134,239,172,0.2)', color: 'var(--text-primary)' }}
              >
                <option value="">—</option>
                {groupValues.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </label>
            <label className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
              实验组取值（Treatment）
              <select
                className="mt-1 w-full rounded-lg px-2 py-2 text-[12.5px]"
                value={mapping.treatmentLabel}
                onChange={(e) => setMapping({ ...mapping, treatmentLabel: e.target.value })}
                style={{ background: 'rgba(11,59,46,0.9)', border: '1px solid rgba(134,239,172,0.2)', color: 'var(--text-primary)' }}
              >
                <option value="">—</option>
                {groupValues.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <div className="text-[11.5px] mb-2" style={{ color: 'var(--text-muted)' }}>
              指标列（mean / std / delta 将按这些列计算）
            </div>
            <div className="flex flex-wrap gap-2">
              {columns.map((c) => {
                const on = mapping.metricColumns.includes(c);
                return (
                  <button
                    key={c}
                    className="btn"
                    onClick={() =>
                      setMapping((m) => ({
                        ...m,
                        metricColumns: on ? m.metricColumns.filter((x) => x !== c) : [...m.metricColumns, c],
                      }))
                    }
                    style={{
                      borderColor: on ? 'rgba(121,222,248,0.6)' : undefined,
                      color: on ? 'var(--soul-highlight)' : undefined,
                      background: on ? 'rgba(121,222,248,0.10)' : undefined,
                    }}
                  >
                    {c}
                    {numericColumns.includes(c) && <span style={{ color: 'var(--text-muted)' }}>·num</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(134,239,172,0.14)' }}>
            <table className="w-full text-[11.5px]">
              <thead style={{ background: 'rgba(16,37,31,0.8)' }}>
                <tr>
                  {columns.slice(0, 8).map((c) => (
                    <th key={c} className="text-left px-3 py-2" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((r, i) => (
                  <tr key={i} style={{ borderTop: '1px solid rgba(134,239,172,0.08)' }}>
                    {columns.slice(0, 8).map((c) => (
                      <td key={c} className="px-3 py-1.5 num" style={{ color: 'var(--text-secondary)' }}>
                        {String(r[c])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {error && <div className="text-[12px]" style={{ color: '#FCA5A5' }}>{error}</div>}
        </div>
      )}

      {/* Step 3 — 数学仪器层 + 人类判断 */}
      {step === 'stats' && (
        <div className="space-y-4">
          <InstrumentLedger
            events={ledger}
            pkg={evidencePackage}
            busy={mathBusy}
            onRerun={() => void startInvestigation()}
          />

          <div className="rounded-lg p-3 text-[12px]" style={{ background: 'rgba(16,37,31,0.6)', border: '1px solid rgba(134,239,172,0.14)' }}>
            <div style={{ color: 'var(--text-muted)' }}>Data Brief（确定性计算 · 由仪器层结果构成）</div>
            <div className="mt-1 num" style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              {statsToBrief(stats, mapping, rows.length)}
            </div>
          </div>

          <MetricChart stats={stats} baselineLabel={mapping.baselineLabel} treatmentLabel={mapping.treatmentLabel} />

          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(134,239,172,0.14)' }}>
            <table className="w-full text-[12px]">
              <thead style={{ background: 'rgba(16,37,31,0.8)' }}>
                <tr>
                  {['metric', 'baseline', 'treatment', 'delta', 'Δ%'].map((h) => (
                    <th key={h} className="text-left px-3 py-2" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => (
                  <tr key={s.metric} style={{ borderTop: '1px solid rgba(134,239,172,0.08)' }}>
                    <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{s.metric}</td>
                    <td className="px-3 py-2 num" style={{ color: 'var(--text-secondary)' }}>
                      {formatNumber(s.baseline.mean)} ± {formatNumber(s.baseline.std)} (n={s.baseline.n})
                    </td>
                    <td className="px-3 py-2 num" style={{ color: 'var(--text-secondary)' }}>
                      {formatNumber(s.treatment.mean)} ± {formatNumber(s.treatment.std)} (n={s.treatment.n})
                    </td>
                    <td className="px-3 py-2 num" style={{ color: s.delta >= 0 ? '#86EFAC' : '#FCA5A5' }}>
                      {s.delta >= 0 ? '+' : ''}{formatNumber(s.delta)}
                    </td>
                    <td className="px-3 py-2 num" style={{ color: s.deltaPercent >= 0 ? '#86EFAC' : '#FCA5A5' }}>
                      {s.deltaPercent >= 0 ? '+' : ''}{s.deltaPercent.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 归档模式：展示当时写下的判断与审议结论，不提供重新提交 */}
          {isArchive ? (
            <div className="space-y-3">
              {review && (
                <div
                  className="rounded-xl p-3.5 space-y-2.5"
                  style={{ border: '1px solid rgba(134,239,172,0.18)', background: 'rgba(16,37,31,0.55)' }}
                >
                  <div className="flex items-center justify-between">
                    <span className="chip chip-soul">{review.verdict.toUpperCase()}</span>
                    <span className="chip num">confidence {review.confidence?.toFixed(2) ?? '—'}</span>
                  </div>
                  <ArchivedField label="AI View" text={review.aiView ?? ''} />
                  <ArchivedField label="Rationale" text={review.rationale} />
                  {review.conditions?.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {review.conditions.map((c) => (
                        <span key={c} className="chip">{c}</span>
                      ))}
                    </div>
                  ) : null}
                  <ArchivedField label="Suggested Next" text={review.suggestedNext ?? ''} />
                </div>
              )}
              <div>
                <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                  Human View（你当时的判断）
                </div>
                <div className="text-[12.5px] mt-1" style={{ color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                  {humanView || '当时没有写下判断。'}
                </div>
              </div>
              <div className="focus-hint">
                这份证据已经归档。要补充数据请回到花瓣，那里的入口会重新开启提交流程。
              </div>
            </div>
          ) : (
            <div>
              <div className="text-[12px] mb-2" style={{ color: 'var(--text-secondary)' }}>
                Human View — 先由你判断：这些结果是否足以支撑原来的实验假设？
              </div>
              <textarea
                className="w-full rounded-lg p-3 text-[12.5px]"
                rows={3}
                value={humanView}
                onChange={(e) => setHumanView(e.target.value)}
                placeholder="例如：latency 降 17.9% 超过阈值，success rate 只掉 0.6pp，我认为足以支撑假设。"
                style={{ background: 'rgba(11,59,46,0.8)', border: '1px solid rgba(134,239,172,0.2)', color: 'var(--text-primary)' }}
              />
            </div>
          )}

          {error && <div className="text-[12px]" style={{ color: '#FCA5A5' }}>{error}</div>}
        </div>
      )}

      {/* Step 4 — Verdict：由用户决定是否改变花的状态 */}
      {step === 'verdict' && verdict && (
        <div className="space-y-3">
          <VerdictCard
            verdict={verdict}
            experimentId={exp.id}
            onApply={(v) => {
              applyVerdict(exp.id, v, humanView);
              close();
            }}
          />
        </div>
      )}
    </Modal>
  );
}
