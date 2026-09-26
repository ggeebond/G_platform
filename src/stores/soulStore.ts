/**
 * Soul Lab — 全局领域状态（Zustand）
 *
 * 多 Soul：花园里每一株花是一个独立 SoulDoc。
 * UI 只派发事件；所有持久化状态变更都由 State Engine 完成，且需用户确认。
 */
import { create } from 'zustand';
import { applyEvent, petalAngles } from '../lib/state/soul-machine';
import { soulDB } from '../lib/data/db';
import { createSeedDoc, createSeedGarden } from '../lib/data/seed';
import { uid } from '../lib/utils/id';
import { getBridge, setAdapter, type AdapterKind } from '../lib/agent';
import { ContractViolationError, NetworkError, type SoulContext } from '../lib/agent/types';
import { statsToBrief } from '../lib/stats/experiment';
import { evidencePackageToBrief } from '../lib/math/evidenceBrief';
import type { EvidencePackage } from '../../shared/schemas';
import type { MathProgressEvent } from '../lib/agent/types';
import { playCue } from '../lib/audio/cues';
import { absorbIntoMemory, emptyMemory, memoryFromDocs } from '../lib/frontier';
import type { FrontierScanResult, ResearchMemory } from '../lib/frontier';
import { useGardenStore } from './gardenStore';
import type {
  Experiment,
  ExperimentResult,
  ResultMapping,
  SoulDoc,
  SoulEvent,
  EvidenceLeaf,
} from '../lib/types';
import type { EvidenceVerdict, IdeaResult, PaperMatch } from '../../shared/schemas';
import type { AgentMode, ChatMessage, Focus } from '../lib/chat';

export type AgentStatus = 'idle' | 'thinking' | 'offline';

interface SoulStore {
  /** 花园：所有 Soul */
  docs: Record<string, SoulDoc>;
  /** 花园中的稳定顺序 */
  order: string[];
  activeId: string;
  /** 当前 Soul（= docs[activeId]），保留此字段让对话层无需关心多 Soul */
  doc: SoulDoc;

  chat: ChatMessage[];
  chatBySoul: Record<string, ChatMessage[]>;
  focus: Focus;
  mode: AgentMode;
  agentStatus: AgentStatus;
  adapter: AdapterKind;
  hydrated: boolean;

  /** Frontier 层：研究记忆（已看过 / 已知机制，持久化在 Dexie） */
  frontierMemory: ResearchMemory;
  /** 最近一次 Frontier 扫描结果 */
  frontierScan: FrontierScanResult | null;

  hydrate: () => Promise<void>;
  setActive: (id: string) => void;
  dispatch: (event: SoulEvent) => void;
  pushMessage: (msg: Omit<ChatMessage, 'id' | 'at'>) => ChatMessage;
  setFocus: (focus: Focus) => void;
  setMode: (mode: AgentMode) => void;
  setAdapterKind: (kind: AdapterKind) => void;
  resetSoul: () => Promise<void>;
  /** 从结构化想法种下一株新花，返回新 Soul id */
  plantSoul: (idea: IdeaResult) => string;

  askSoulKeeper: (text: string) => Promise<void>;
  structureIdea: (rawIdea: string, echo?: boolean) => Promise<void>;
  proposeExperiment: (proposal: string, echo?: boolean) => Promise<void>;
  confirmDesign: (experimentId: string) => void;
  submitResult: (experimentId: string, result: ExperimentResult) => void;
  /** Instrument Workshop：对已解析的数据跑数学仪器调查（SSE 进度回调） */
  runMathInvestigation: (
    experimentId: string,
    rows: Array<Record<string, unknown>>,
    mapping: ResultMapping,
    fileName: string,
    humanView: string,
    onEvent?: (ev: MathProgressEvent) => void,
  ) => Promise<EvidencePackage | null>;
  reviewEvidence: (experimentId: string, humanView: string) => Promise<EvidenceVerdict | null>;
  applyVerdict: (experimentId: string, verdict: EvidenceVerdict, humanView: string) => void;
  withdrawPetal: (petalId: string, reason: string) => void;
  resolveLeaf: (leafId: string, note: string) => void;
  scanPapers: (
    trigger: 'soul_created' | 'ghost_petal' | 'yellow_leaf' | 'manual_scan',
    focusLabel: string,
    relatedPetalId?: string | null,
  ) => Promise<void>;
  addPaperToMemory: (paperId: string, note?: string) => void;

  /** FR-M11：跑一次 Frontier Loop；source 为空时走真实检索链路 */
  refreshFrontier: (source?: PaperMatch[]) => Promise<void>;
  /** 清空研究记忆（用于演示「不重复推送」的前后对比） */
  resetFrontierMemory: () => Promise<void>;
}

const INTRO = (title: string) =>
  `我是 Soul Keeper。当前 Soul：${title}。你可以让我审议一个新的实验设计，或点击候选花瓣上传实验结果。`;

export function buildSoulContext(doc: SoulDoc): SoulContext {
  return {
    soulId: doc.soul.id,
    title: doc.soul.title,
    rawIdea: doc.soul.rawIdea,
    researchQuestion: doc.soul.researchQuestion,
    hypothesis: doc.soul.hypothesis,
    independentVariable: doc.soul.independentVariable,
    dependentMetrics: doc.soul.dependentMetrics,
    mainGap: doc.soul.mainGap,
    openQuestions: doc.soul.openQuestions,
    mechanismChain: doc.soul.mechanismChain,
    baselines: doc.baselines.map((b) => ({ name: b.name, value: b.value, bound: b.bound })),
    experiments: doc.experiments.map((e) => ({
      id: e.id,
      title: e.title,
      status: e.status,
      metrics: e.metrics,
      baseline: `${e.baseline.name} = ${e.baseline.value}`,
      treatment: `${e.treatment.name} ${e.treatment.value}`,
    })),
    petals: doc.petals.map((p) => ({ id: p.id, label: p.label, status: p.status })),
    leaves: doc.leaves.map((l) => ({ id: l.id, label: l.label, failureCondition: l.failureCondition })),
    memoryPaperIds: doc.papers.filter((p) => p.inMemory).map((p) => p.paperId),
  };
}

function experimentContext(doc: SoulDoc, exp: Experiment) {
  return {
    id: exp.id,
    title: exp.title,
    hypothesis: exp.hypothesis,
    baseline: `${exp.baseline.name} = ${exp.baseline.value}`,
    treatment: `${exp.treatment.name} ${exp.treatment.value}`,
    metrics: exp.metrics,
    expectedObservation: exp.expectedObservation,
    mainRisk: exp.mainRisk,
  };
}

function toMap(docs: SoulDoc[]): Record<string, SoulDoc> {
  const map: Record<string, SoulDoc> = {};
  docs.forEach((d) => {
    map[d.soul.id] = d;
  });
  return map;
}

const PRIMARY_ID = 'soul_adaptive_horizon';

/** 初始状态只构造一次，保证 doc 与 docs[activeId] 是同一个对象引用 */
const PRIMARY_SEED = createSeedDoc();

export const useSoulStore = create<SoulStore>((set, get) => ({
  docs: { [PRIMARY_ID]: PRIMARY_SEED },
  order: [PRIMARY_ID],
  activeId: PRIMARY_ID,
  doc: PRIMARY_SEED,

  chat: [],
  chatBySoul: {},
  focus: null,
  mode: 'Experiment Design',
  agentStatus: 'idle',
  adapter: 'learnbuddy',
  hydrated: false,

  frontierMemory: emptyMemory(),
  frontierScan: null,

  hydrate: async () => {
    const recs = await soulDB.loadAll();
    const persistedMemory = await soulDB.loadMemory();
    if (recs.length > 0) {
      const docs = recs.map((r) => r.doc);
      const map = toMap(docs);
      const activeId = map[PRIMARY_ID] ? PRIMARY_ID : docs[0].soul.id;
      const chatBySoul: Record<string, ChatMessage[]> = {};
      docs.forEach((d) => {
        chatBySoul[d.soul.id] = [
          { id: uid('msg'), role: 'agent', at: Date.now(), text: INTRO(d.soul.title) },
        ];
      });
      set({
        docs: map,
        order: docs.map((d) => d.soul.id),
        activeId,
        doc: map[activeId],
        chatBySoul,
        chat: chatBySoul[activeId] ?? [],
        frontierMemory: memoryFromDocs(docs, persistedMemory),
        hydrated: true,
      });
      return;
    }

    const seeded = createSeedGarden();
    await soulDB.saveMany(seeded);
    const map = toMap(seeded);
    const chatBySoul: Record<string, ChatMessage[]> = {};
    seeded.forEach((d) => {
      chatBySoul[d.soul.id] = [
        { id: uid('msg'), role: 'agent', at: Date.now(), text: INTRO(d.soul.title) },
      ];
    });
    set({
      docs: map,
      order: seeded.map((d) => d.soul.id),
      activeId: PRIMARY_ID,
      doc: map[PRIMARY_ID],
      chatBySoul,
      chat: chatBySoul[PRIMARY_ID] ?? [],
      frontierMemory: memoryFromDocs(seeded, persistedMemory),
      hydrated: true,
    });
  },

  setActive: (id) => {
    const { docs, chatBySoul } = get();
    const doc = docs[id];
    if (!doc) return;
    const chat = chatBySoul[id] ?? [
      { id: uid('msg'), role: 'agent' as const, at: Date.now(), text: INTRO(doc.soul.title) },
    ];
    set({ activeId: id, doc, chat, chatBySoul: { ...chatBySoul, [id]: chat } });
  },

  dispatch: (event) => {
    const state = get();

    // SOUL_CREATED 在多 Soul 语义下是「种下一株新花」，而不是覆盖当前花
    if (event.type === 'SOUL_CREATED') {
      const next = applyEvent(
        { soul: event.soul, baselines: [], experiments: [], petals: [], leaves: [], papers: [], reviews: [], timeline: [] },
        event,
      );
      const newId = next.soul.id;
      set({
        docs: { ...state.docs, [newId]: next },
        order: [...state.order, newId],
        activeId: newId,
        doc: next,
        chatBySoul: {
          ...state.chatBySoul,
          [newId]: [{ id: uid('msg'), role: 'agent', at: Date.now(), text: INTRO(next.soul.title) }],
        },
        chat: [{ id: uid('msg'), role: 'agent', at: Date.now(), text: INTRO(next.soul.title) }],
      });
      void soulDB.save(next);
      return;
    }

    const current = state.docs[state.activeId];
    if (!current) return;
    const next = applyEvent(current, event);
    if (next === current) return;

    const docs = { ...state.docs, [state.activeId]: next };
    set({ docs, doc: next });
    void soulDB.save(next);

    // 证据判定瞬间：镜头脉冲 + 让 Garden 知道该庆祝了
    if (
      event.type === 'EVIDENCE_ACCEPTED' ||
      event.type === 'EVIDENCE_CONTRADICTORY'
    ) {
      useGardenStore.getState().celebrate();
    }

    // 声音线索：每次状态变化都有对应的听觉反馈
    playCueForEvent(event.type);
  },

  pushMessage: (msg) => {
    const full: ChatMessage = { ...msg, id: uid('msg'), at: Date.now() };
    set((s) => {
      const chat = [...s.chat, full];
      return { chat, chatBySoul: { ...s.chatBySoul, [s.activeId]: chat } };
    });
    return full;
  },

  setFocus: (focus) => set({ focus }),
  setMode: (mode) => set({ mode }),

  setAdapterKind: (kind) => {
    setAdapter(kind);
    set({ adapter: kind, agentStatus: 'idle' });
  },

  resetSoul: async () => {
    const seeded = createSeedGarden();
    await soulDB.clear();
    await soulDB.saveMany(seeded);
    const map = toMap(seeded);
    const chatBySoul: Record<string, ChatMessage[]> = {};
    seeded.forEach((d) => {
      chatBySoul[d.soul.id] = [
        { id: uid('msg'), role: 'agent', at: Date.now(), text: INTRO(d.soul.title) },
      ];
    });
    useGardenStore.getState().backToGarden();
    set({
      docs: map,
      order: seeded.map((d) => d.soul.id),
      activeId: PRIMARY_ID,
      doc: map[PRIMARY_ID],
      chatBySoul,
      chat: chatBySoul[PRIMARY_ID] ?? [],
      focus: null,
      mode: 'Experiment Design',
      agentStatus: 'idle',
      frontierMemory: emptyMemory(),
      frontierScan: null,
    });
  },

  plantSoul: (idea) => {
    const soulId = uid('soul');
    // mechanismChain 属于机制层结论，由后续实验逐步明确，种子阶段留空
    const baseline = idea.baseline;
    get().dispatch({
      type: 'SOUL_CREATED',
      actor: 'user',
      soul: {
        id: soulId,
        title: idea.title,
        rawIdea: idea.researchQuestion || idea.title,
        researchQuestion: idea.researchQuestion,
        hypothesis: idea.hypothesis,
        independentVariable: idea.independentVariable,
        dependentMetrics: idea.dependentMetrics,
        openQuestions: idea.openQuestions,
        mainGap: idea.mainGap,
        mechanismChain: [],
        status: 'Growing',
        createdAt: Date.now(),
      },
      baselines:
        baseline?.name
          ? [
              {
                id: uid('base'),
                soulId,
                index: 0,
                name: baseline.name,
                value: baseline.value,
                reason: '由 Idea Structuring 给出的初始对照。',
                bound: false,
                sourcePaperId: null,
                protocol: '',
              },
            ]
          : [],
    });
    void get().scanPapers('soul_created', idea.mainGap || idea.title, null);
    return soulId;
  },

  /**
   * Soul Keeper 统一入口：路由只是把请求交给合适的专家（Lab Keeper 的语义路由在服务端完成），
   * 路由本身不产生任何状态变更；状态变更仍需用户确认。
   */
  askSoulKeeper: async (text) => {
    const { doc } = get();
    get().pushMessage({ role: 'user', text });
    const wantsPaper = /论文|文献|paper|前沿|related work|检索/i.test(text);
    if (wantsPaper) {
      await get().scanPapers('manual_scan', text.slice(0, 60), null);
      return;
    }
    if (!doc.soul.hypothesis) {
      await get().structureIdea(text, false);
      return;
    }
    await get().proposeExperiment(text, false);
  },

  /* ---------------- Mode A：Idea Structuring ---------------- */
  structureIdea: async (rawIdea, echo = true) => {
    const { doc } = get();
    if (!rawIdea.trim()) return;
    if (echo) get().pushMessage({ role: 'user', text: rawIdea });
    set({ mode: 'Idea Structuring', agentStatus: 'thinking' });
    try {
      const idea = await getBridge().structureIdea({ rawIdea, soul: buildSoulContext(doc) });
      get().pushMessage({
        role: 'agent',
        text: 'Idea Analyst 已把模糊想法拆成可证伪的研究结构。确认后会种下一株新的花。',
        card: { kind: 'idea', data: idea },
      });
      set({ agentStatus: 'idle' });
    } catch (err: any) {
      handleAgentError(get, set, err);
    }
  },

  /* ---------------- Mode B：Experiment Design ---------------- */
  proposeExperiment: async (proposal, echo = true) => {
    const { doc } = get();
    if (!proposal.trim()) return;
    if (echo) get().pushMessage({ role: 'user', text: proposal });
    set({ mode: 'Experiment Design', agentStatus: 'thinking' });
    try {
      const verdict = await getBridge().reviewExperimentDesign({
        soul: buildSoulContext(doc),
        proposal,
      });
      let experimentId: string | undefined;
      if (verdict.accepted) {
        const exp: Experiment = {
          id: uid('exp'),
          soulId: doc.soul.id,
          index: doc.experiments.length,
          title: verdict.title,
          goal: verdict.goal,
          hypothesis: verdict.hypothesis || doc.soul.hypothesis,
          baseline: verdict.baseline,
          treatment: {
            name: verdict.treatment.name,
            value: verdict.treatment.value || verdict.treatment.range.join('~'),
            range: verdict.treatment.range,
          },
          controlledVariables: verdict.controlledVariables,
          metrics: verdict.metrics,
          expectedObservation: verdict.expectedObservation,
          mainRisk: verdict.mainRisk,
          status: 'proposed',
          createdAt: Date.now(),
        };
        experimentId = exp.id;
        get().dispatch({ type: 'EXPERIMENT_PROPOSED', actor: 'user', experiment: exp });
      }
      get().pushMessage({
        role: 'agent',
        text: verdict.accepted
          ? 'Experiment Designer 认为该设计能真正检验假设。确认后会长出一片候选花瓣。'
          : 'Experiment Designer 认为该设计还不能真正检验假设。',
        card: { kind: 'design', data: verdict, proposal, experimentId },
      });
      set({ agentStatus: 'idle' });
    } catch (err: any) {
      handleAgentError(get, set, err);
    }
  },

  /** 用户确认 → DESIGN_ACCEPTED → Ghost Petal（AI 不能自动执行） */
  confirmDesign: (experimentId) => {
    const { doc } = get();
    const exp = doc.experiments.find((e) => e.id === experimentId);
    if (!exp) return;
    const petalCount = doc.petals.length;
    const angles = petalAngles(petalCount + 1);
    get().dispatch({
      type: 'DESIGN_ACCEPTED',
      actor: 'user',
      experimentId,
      petal: {
        id: uid('petal'),
        soulId: doc.soul.id,
        experimentId,
        index: petalCount,
        label: exp.title,
        status: 'candidate',
        angle: angles[petalCount],
      },
    });
    get().pushMessage({
      role: 'agent',
      text: `候选花瓣已生成：${exp.title}。点击花瓣上传实验结果。`,
    });
    void get().scanPapers('ghost_petal', exp.title, null);
  },

  submitResult: (experimentId, result) => {
    get().dispatch({ type: 'RESULT_SUBMITTED', actor: 'user', experimentId, result });
  },

  /* ---------------- Instrument Workshop：数学仪器调查 ---------------- */
  runMathInvestigation: async (experimentId, rows, mapping, fileName, humanView, onEvent) => {
    const { doc } = get();
    const exp = doc.experiments.find((e) => e.id === experimentId);
    if (!exp) return null;
    set({ agentStatus: 'thinking' });
    try {
      const pkg = await getBridge().runMathInvestigation({
        soul: buildSoulContext(doc),
        experiment: {
          id: exp.id,
          title: exp.title,
          hypothesis: exp.hypothesis,
          baseline: `${exp.baseline.name} = ${exp.baseline.value}`,
          treatment: `${exp.treatment.name} ${exp.treatment.value}`,
          metrics: exp.metrics,
        },
        rows,
        mapping: {
          groupColumn: mapping.groupColumn,
          baselineValue: mapping.baselineLabel,
          treatmentValue: mapping.treatmentLabel,
          metricColumns: mapping.metricColumns,
        },
        fileName,
        humanView,
        onEvent,
      });
      set({ agentStatus: 'idle' });
      return pkg;
    } catch (err: any) {
      handleAgentError(get, set, err);
      return null;
    }
  },

  /* ---------------- Mode C：Evidence Review ---------------- */
  reviewEvidence: async (experimentId, humanView) => {
    const { doc } = get();
    const exp = doc.experiments.find((e) => e.id === experimentId);
    if (!exp || !exp.result) return null;
    set({ mode: 'Evidence Review', agentStatus: 'thinking' });
    // 关键变化：有 Evidence Package 时，Reviewer 看到的是仪器层的结构化证据，
    // 不再是原始统计的裸文本（原始数据永远不进 prompt）
    const dataBrief = exp.result.evidencePackage
      ? evidencePackageToBrief(exp.result.evidencePackage)
      : statsToBrief(exp.result.stats, exp.result.mapping, exp.result.rows);
    try {
      const verdict = await getBridge().reviewEvidence({
        soul: buildSoulContext(doc),
        experiment: experimentContext(doc, exp),
        stats: exp.result.stats,
        dataBrief,
        humanView,
        fileName: exp.result.fileName,
      });
      get().pushMessage({
        role: 'agent',
        text: 'Evidence Reviewer 已给出判定。是否采纳由你决定。',
        card: { kind: 'verdict', data: verdict, experimentId },
      });
      set({ agentStatus: 'idle' });
      return verdict;
    } catch (err: any) {
      handleAgentError(get, set, err);
      return null;
    }
  },

  /** 用户采纳判定 → 状态变更（accepted / insufficient / contradictory / invalid） */
  applyVerdict: (experimentId, verdict, humanView) => {
    const { doc } = get();
    const exp = doc.experiments.find((e) => e.id === experimentId);
    if (!exp) return;
    const brief = exp.result
      ? statsToBrief(exp.result.stats, exp.result.mapping, exp.result.rows)
      : '';
    const base = {
      rationale: verdict.rationale,
      dataBrief: verdict.dataBrief || brief,
      aiView: verdict.aiView,
      humanView,
      conditions: verdict.conditions,
      confidence: verdict.confidence,
      suggestedNext: verdict.suggestedNext,
    };

    switch (verdict.verdict) {
      case 'accepted':
        get().dispatch({ type: 'EVIDENCE_ACCEPTED', actor: 'user', experimentId, review: { verdict: 'accepted', ...base } });
        break;
      case 'insufficient':
        get().dispatch({ type: 'EVIDENCE_INSUFFICIENT', actor: 'user', experimentId, review: { verdict: 'insufficient', ...base } });
        break;
      case 'contradictory': {
        const leafCount = doc.leaves.length;
        const leaf: Omit<EvidenceLeaf, 'id' | 'soulId' | 'status' | 'angle' | 'attachY' | 'side' | 'createdAt'> = {
          experimentId,
          index: leafCount,
          label: `${exp.title}：结论被削弱`,
          failureCondition: verdict.rationale,
          aiJudgement: verdict.aiView,
          userJudgement: humanView,
          nextSteps: verdict.suggestedNext || '针对失败条件设计修复实验。',
        };
        get().dispatch({
          type: 'EVIDENCE_CONTRADICTORY',
          actor: 'user',
          experimentId,
          review: { verdict: 'contradictory', ...base },
          leaf,
        });
        void get().scanPapers('yellow_leaf', `${exp.title} 的失败条件`, null);
        break;
      }
      case 'invalid':
        get().dispatch({ type: 'EVIDENCE_INVALID', actor: 'user', experimentId, review: { verdict: 'invalid', ...base } });
        break;
    }
    get().pushMessage({
      role: 'agent',
      text: `已记录判定：${verdict.verdict.toUpperCase()}。所有状态变更均由你确认生效。`,
    });
  },

  withdrawPetal: (petalId, reason) => {
    get().dispatch({ type: 'PETAL_WITHDRAWN', actor: 'user', petalId, reason });
    get().pushMessage({
      role: 'agent',
      text: '花瓣已标记为 Withdrawn by Researcher，历史证据完整保留，不会被删除。',
    });
  },

  resolveLeaf: (leafId, note) => {
    get().dispatch({ type: 'LEAF_RESOLVED', actor: 'user', leafId, note });
  },

  /* ---------------- Mode D：Research Scout ---------------- */
  scanPapers: async (trigger, focusLabel, relatedPetalId = null) => {
    const { doc } = get();
    set({ mode: 'Research Scout', agentStatus: 'thinking' });
    try {
      const matches = await getBridge().searchPapers({
        soul: buildSoulContext(doc),
        trigger,
        focusLabel,
        knownPaperIds: doc.papers.map((p) => p.paperId),
      });
      if (!matches || matches.length === 0) {
        get().pushMessage({ role: 'agent', text: 'Paper Scout 本次没有找到新的相关工作。' });
        set({ agentStatus: 'idle' });
        return;
      }
      const withPetal = relatedPetalId
        ? matches.map((m) => ({ ...m, relatedPetalId: m.relatedPetalId ?? relatedPetalId }))
        : matches;
      get().dispatch({ type: 'PAPER_DISCOVERED', actor: 'agent', papers: withPetal });
      get().pushMessage({
        role: 'agent',
        text: `Paper Scout 找到 ${withPetal.length} 篇与「${focusLabel}」相关的工作。只有你点击 Add to Soul Memory 才会成为长期知识。`,
        card: { kind: 'papers', data: withPetal },
      });
      set({ agentStatus: 'idle' });
    } catch (err: any) {
      handleAgentError(get, set, err);
    }
  },

  addPaperToMemory: (paperId, note) => {
    get().dispatch({ type: 'PAPER_ADDED_TO_MEMORY', actor: 'user', paperId, note });
    const paper = get().doc.papers.find((p) => p.paperId === paperId);
    get().pushMessage({
      role: 'agent',
      text: `Memory Curator 已保存：${paper?.title ?? paperId}。它现在是这个 Soul 的长期知识。`,
    });
  },

  /* ---------------- Frontier Loop（外循环，FR-M11） ---------------- */
  refreshFrontier: async (source = []) => {
    const { docs, order, frontierMemory } = get();
    const list = order.map((id) => docs[id]).filter(Boolean);
    if (list.length === 0) return;

    try {
      const scan = await getBridge().runFrontierLoop({ docs: list, source, memory: frontierMemory });

      // 本次扫描产出的论文与机制一并并入记忆 —— 下一轮不再重复推送
      const absorbed = absorbIntoMemory(
        frontierMemory,
        scan.signals.map((s) => s.paperId),
        scan.signals.map((s) => s.mechanismKey).filter(Boolean),
      );
      await soulDB.saveMemory(absorbed);
      set({ frontierScan: scan, frontierMemory: absorbed });
    } catch (err: any) {
      const isNetwork = err instanceof NetworkError || err?.name === 'NetworkError';
      set({ agentStatus: isNetwork ? 'offline' : 'idle' });
      get().pushMessage({
        role: 'agent',
        text: isNetwork
          ? '前沿检索暂不可用；花园与已有研究记忆仍可浏览。'
          : (err?.message ?? 'Frontier Loop 执行失败'),
      });
    }
  },

  resetFrontierMemory: async () => {
    const memory = emptyMemory();
    await soulDB.saveMemory(memory);
    set({ frontierMemory: memory, frontierScan: null });
  },
}));

/* ---------- 故障降级（F1 / F2 / F4）---------- */
function handleAgentError(
  get: () => SoulStore,
  set: (partial: Partial<SoulStore>) => void,
  err: any,
) {
  const isNetwork = err instanceof NetworkError || err?.name === 'NetworkError';
  const isContract = err instanceof ContractViolationError || err?.name === 'ContractViolationError';
  const code = isNetwork ? 'NETWORK' : isContract ? 'SCHEMA' : 'UNKNOWN';
  const message = isContract
    ? 'Agent 输出未通过结构校验，花的状态没有被改变。'
    : isNetwork
      ? 'LearnBuddy 暂时不可用，已有花、实验与记忆仍可浏览。'
      : (err?.message ?? 'Agent 调用失败');
  get().pushMessage({
    role: 'agent',
    text: message,
    card: { kind: 'error', data: { code, message, detail: err?.detail } },
  });
  set({ agentStatus: isNetwork ? 'offline' : 'idle' });
}

/** 事件 → 声音线索（Cue 表见 lib/audio/cues.ts） */
function playCueForEvent(type: SoulEvent['type']) {
  switch (type) {
    case 'DESIGN_ACCEPTED':
      playCue('design_accepted');
      break;
    case 'EVIDENCE_ACCEPTED':
      playCue('solidify');
      break;
    case 'EVIDENCE_CONTRADICTORY':
      playCue('yellow_leaf');
      break;
    case 'PETAL_WITHDRAWN':
      playCue('withdraw');
      break;
    case 'PAPER_DISCOVERED':
      playCue('frontier_signal');
      break;
    default:
      break;
  }
}

export { toMap };
