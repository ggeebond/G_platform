/**
 * Soul Lab — Garden 导航 / 镜头 / HUD 状态
 *
 * 与 soulStore 分离的原因：镜头与 hover 会高频变化，
 * 放在这里可以让 3D 场景订阅它而不惊动对话与领域状态。
 */
import { create } from 'zustand';

export type CameraMode = 'garden' | 'flower' | 'petal';

/**
 * 右侧 Research Inspector 的三态模型（优先级从高到低）：
 *   selectedNode（点击锁定 → 完整 Detail）
 *   hoveredNode （悬停 → 轻量 Preview，移开即消失）
 *   workspaceFocus（都没发生时 → Overview / 列表）
 */
export type ResearchNode =
  | { kind: 'claim'; id: string }
  | { kind: 'experiment'; id: string }
  | { kind: 'paper'; id: string }
  | { kind: 'boundary'; id: string };

/** 无选中、无悬停时右侧展示的总览 / 列表 */
export type WorkspaceFocus =
  | { kind: 'overview' }
  | { kind: 'claims' }
  | { kind: 'experiments' }
  | { kind: 'frontier' };

interface GardenStore {
  /** 镜头叙事状态：花园 → 一株花 → 一片花瓣 */
  cameraMode: CameraMode;
  /** 当前被聚焦的 Soul */
  soulId: string | null;
  /** Petal Focus 中的花瓣 */
  petalId: string | null;
  leafId: string | null;
  paperId: string | null;
  /** Baseline Inspector 打开的根系 */
  baselineId: string | null;
  /** 种下新想法的入口 */
  plantOpen: boolean;
  /** Research Workspace 当前展示对象（无选中/悬停时生效） */
  workspaceFocus: WorkspaceFocus;
  /** 悬停预览对象：只做反馈，鼠标移开立即清空 */
  hoveredNode: ResearchNode | null;
  /** 点击锁定的对象：锁住右侧 Detail，只有再点别的 / ESC / 空白处才清除 */
  selectedNode: ResearchNode | null;

  hoveredSoulId: string | null;
  hoveredPetalId: string | null;
  hoveredOrbId: string | null;

  /** Soul Keeper 辅助面板：默认只是一颗球 */
  keeperOpen: boolean;
  journalOpen: boolean;
  /** Instrument Workshop（科研仪器工坊）浮层 */
  workshopOpen: boolean;

  /** EvidenceFlow 弹窗绑定的 experiment */
  evidenceExperimentId: string | null;
  /** submit = 提交流程；archive = 只读查看已归档证据 */
  evidenceMode: 'submit' | 'archive';

  /** 花瓣实体化瞬间的镜头脉冲（时间戳，0 表示无） */
  celebrationAt: number;
  /** 刚被发现的 Lineage 藤蔓，短暂高亮 */
  lineageFlashId: string | null;

  enterSoul: (id: string) => void;
  focusPetal: (soulId: string, petalId: string) => void;
  focusLeaf: (soulId: string, leafId: string) => void;
  focusPaper: (soulId: string, paperId: string) => void;
  /** 点开一条根系 → Baseline Inspector */
  focusBaseline: (soulId: string, baselineId: string) => void;
  /** 逐级返回：花瓣 → 整株花 → 花园 */
  back: () => void;
  backToGarden: () => void;

  openPlant: () => void;
  closePlant: () => void;
  /** 点 Orb → 右侧 Workspace 切换内容 */
  selectWorkspace: (focus: WorkspaceFocus) => void;
  /** 悬停某个研究对象（花瓣 / 球 / 叶片）→ 右侧 Preview */
  setHoveredNode: (node: ResearchNode | null) => void;
  /** 点击某个研究对象 → 右侧完整 Detail 并锁住 */
  selectNode: (node: ResearchNode) => void;
  /** 退出当前选择（ESC / 点空白）→ 回到 Overview */
  clearSelection: () => void;

  hoverSoul: (id: string | null) => void;
  hoverPetal: (id: string | null) => void;
  hoverOrb: (id: string | null) => void;

  openKeeper: () => void;
  closeKeeper: () => void;
  toggleJournal: () => void;
  toggleWorkshop: () => void;

  openEvidence: (experimentId: string, mode?: 'submit' | 'archive') => void;
  closeEvidence: () => void;

  celebrate: () => void;
  flashLineage: (edgeId: string | null) => void;
}

export const useGardenStore = create<GardenStore>((set, get) => ({
  cameraMode: 'garden',
  soulId: null,
  petalId: null,
  leafId: null,
  paperId: null,
  baselineId: null,
  plantOpen: false,
  workspaceFocus: { kind: 'overview' },
  hoveredNode: null,
  selectedNode: null,

  hoveredSoulId: null,
  hoveredPetalId: null,
  hoveredOrbId: null,

  keeperOpen: false,
  journalOpen: false,
  workshopOpen: false,

  evidenceExperimentId: null,
  evidenceMode: 'submit',
  celebrationAt: 0,
  lineageFlashId: null,

  enterSoul: (id) =>
    set({
      cameraMode: 'flower',
      soulId: id,
      petalId: null,
      leafId: null,
      paperId: null,
      baselineId: null,
      hoveredSoulId: null,
      workspaceFocus: { kind: 'overview' },
      hoveredNode: null,
      selectedNode: null,
    }),

  focusPetal: (soulId, petalId) =>
    set({ cameraMode: 'petal', soulId, petalId, leafId: null, paperId: null, baselineId: null }),

  focusLeaf: (soulId, leafId) =>
    set({ cameraMode: 'petal', soulId, leafId, petalId: null, paperId: null, baselineId: null }),

  focusPaper: (soulId, paperId) => set({ soulId, paperId }),

  // 根系细而分散，不推镜头，只在原位弹出 Inspector，避免画面频繁大幅移动
  focusBaseline: (soulId, baselineId) => set({ soulId, baselineId, paperId: null }),

  back: () => {
    const { cameraMode, baselineId } = get();
    if (baselineId) {
      set({ baselineId: null });
      return;
    }
    if (cameraMode === 'petal') {
      set({ cameraMode: 'flower', petalId: null, leafId: null });
      return;
    }
    if (cameraMode === 'flower') {
      set({ cameraMode: 'garden', soulId: null, paperId: null, hoveredPetalId: null });
    }
  },

  backToGarden: () =>
    set({
      cameraMode: 'garden',
      soulId: null,
      petalId: null,
      leafId: null,
      paperId: null,
      baselineId: null,
      hoveredSoulId: null,
      hoveredPetalId: null,
      hoveredOrbId: null,
      workspaceFocus: { kind: 'overview' },
      hoveredNode: null,
      selectedNode: null,
    }),

  openPlant: () => set({ plantOpen: true }),
  closePlant: () => set({ plantOpen: false }),

  selectWorkspace: (focus) => set({ workspaceFocus: focus, selectedNode: null }),

  setHoveredNode: (node) => set({ hoveredNode: node }),

  selectNode: (node) => set({ selectedNode: node, hoveredNode: null }),

  clearSelection: () => set({ selectedNode: null, hoveredNode: null }),

  hoverSoul: (id) => set({ hoveredSoulId: id }),
  hoverPetal: (id) => set({ hoveredPetalId: id }),
  hoverOrb: (id) => set({ hoveredOrbId: id }),

  openKeeper: () => set({ keeperOpen: true }),
  closeKeeper: () => set({ keeperOpen: false }),
  toggleJournal: () => set((s) => ({ journalOpen: !s.journalOpen })),
  toggleWorkshop: () => set((s) => ({ workshopOpen: !s.workshopOpen })),

  openEvidence: (experimentId, mode = 'submit') =>
    set({ evidenceExperimentId: experimentId, evidenceMode: mode }),
  closeEvidence: () => set({ evidenceExperimentId: null }),

  celebrate: () => set({ celebrationAt: Date.now() }),
  flashLineage: (edgeId) => set({ lineageFlashId: edgeId }),
}));
