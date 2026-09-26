/**
 * Soul Lab —— 一座会生长的科研花园。
 *
 * 一级入口永远是 Garden（3D 场景占满画布）。
 * Soul Keeper 退居右下角浮动球，实验、论文、审议全部藏在花园的交互之中。
 */
import { useEffect } from 'react';
import { GardenScene } from './components/garden/GardenScene';
import { GardenHUD } from './components/hud/GardenHUD';
import { SoulKeeper } from './components/hud/SoulKeeper';
import { ResearchJournal } from './components/hud/ResearchJournal';
import { PetalFocusPanel } from './components/hud/PetalFocusPanel';
import { LeafPanel } from './components/hud/LeafPanel';
import { FlowerPanel } from './components/hud/FlowerPanel';
import { BaselinePanel } from './components/hud/BaselinePanel';
import { PaperCardOverlay } from './components/hud/PaperCardOverlay';
import { PlantIdeaDialog } from './components/hud/PlantIdeaDialog';
import { FrontierPulse } from './components/hud/FrontierPulse';
import { MorningBrief } from './components/hud/MorningBrief';
import { FocusHeader } from './components/focus/FocusHeader';
import { FocusLayout } from './components/focus/FocusLayout';
import { WorkshopPanel } from './components/workshop/WorkshopPanel';
import { EvidenceFlow } from './components/experiment/EvidenceFlow';
import { useSoulStore } from './stores/soulStore';
import { useGardenStore } from './stores/gardenStore';
import { unlockAudio } from './lib/audio/cues';

export default function App() {
  const hydrate = useSoulStore((s) => s.hydrate);
  const hydrated = useSoulStore((s) => s.hydrated);
  const evidenceExperimentId = useGardenStore((s) => s.evidenceExperimentId);
  const evidenceMode = useGardenStore((s) => s.evidenceMode);
  const closeEvidence = useGardenStore((s) => s.closeEvidence);
  const cameraMode = useGardenStore((s) => s.cameraMode);
  const workshopOpen = useGardenStore((s) => s.workshopOpen);
  const toggleWorkshop = useGardenStore((s) => s.toggleWorkshop);

  /** 聚焦态：不再显示 Garden 顶栏，改由 Focus 顶栏接管 */
  const focused = cameraMode !== 'garden';

  // 3D 里的 hover / click 已由各部件直接写入 hoveredNode / selectedNode，
  // 这里不再做二次映射（否则右侧会被两套逻辑来回改，出现"乱跳"）。

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // 空间键退出当前聚焦层级（花瓣 → 花 → 花园）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const g = useGardenStore.getState();
      if (g.evidenceExperimentId) {
        g.closeEvidence();
        return;
      }
      // 先退出右侧 Inspector 的锁定选择，再逐级退回（花瓣 → 花 → 花园）
      if (g.selectedNode) {
        g.clearSelection();
        return;
      }
      if (g.paperId) {
        useGardenStore.setState({ paperId: null });
        return;
      }
      if (g.journalOpen) {
        g.toggleJournal();
        return;
      }
      if (g.cameraMode !== 'garden') g.back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // 浏览器策略：第一次交互时解锁音频上下文（声音线索见 lib/audio/cues.ts）
  useEffect(() => {
    const onFirst = () => unlockAudio();
    window.addEventListener('pointerdown', onFirst, { once: true });
    return () => window.removeEventListener('pointerdown', onFirst);
  }, []);

  // 仅 DEV：把「进入 / 退出聚焦」挂到 window，便于自动化验证与录屏（不改业务逻辑）
  useEffect(() => {
    const meta = import.meta as unknown as { env?: { DEV?: boolean } };
    if (!meta.env?.DEV) return;
    const w = window as unknown as Record<string, unknown>;
    w.__soulLabFocus = (id: string) => useGardenStore.getState().enterSoul(id);
    w.__soulLabBack = () => useGardenStore.getState().backToGarden();
    w.__soulLabWorkshop = () => useGardenStore.getState().toggleWorkshop();
    // 演示/走查用：直接打开第一个实验的证据提交流程（跳过点花这一步）
    w.__soulLabDemoEvidence = () => {
      const exp = useSoulStore.getState().doc.experiments[0];
      if (exp) useGardenStore.getState().openEvidence(exp.id, 'submit');
    };
  }, []);

  if (!hydrated) {
    return (
      <div className="h-full w-full flex items-center justify-center garden-bg">
        <div className="text-center">
          <div className="text-[13px]" style={{ color: 'var(--soul-highlight)' }}>
            正在培育花园…
          </div>
          <div className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>
            从 IndexedDB 恢复你的 Souls
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="garden-root" data-focus={focused ? 'on' : 'off'}>
      {/* Garden 是产品本体：3D 场景占满画布。聚焦时它降权但不消失 */}
      <GardenScene />

      {/* 聚焦时给场景加一层极轻的暗角，而不是把花园藏起来 */}
      <FocusVeil />

      {/* 顶栏：Garden ↔ Focus 直接替换（crossfade，不叠层） */}
      <div className="hud-layer" data-active={!focused}>
        <GardenHUD />
      </div>
      <div className="hud-layer" data-active={focused}>
        <FocusHeader />
      </div>

      {/* 聚焦态主体：左 Research Focus Space + 右 Research Workspace */}
      {focused && <FocusLayout />}

      {/* Instrument Workshop：Garden 与 Focus 两态都可打开（研究自己的数据） */}
      <WorkshopPanel open={workshopOpen} onClose={toggleWorkshop} />

      {/* 花园级浮层：只在 Garden 态出现 */}
      {!focused && (
        <>
          <FlowerPanel />
          <PetalFocusPanel />
          <LeafPanel />
          <BaselinePanel />
          <PaperCardOverlay />
          <FrontierPulse />
          <MorningBrief />
        </>
      )}

      <ResearchJournal />
      <SoulKeeper />
      <PlantIdeaDialog />

      <EvidenceFlow
        open={evidenceExperimentId !== null}
        experimentId={evidenceExperimentId}
        mode={evidenceMode}
        onClose={closeEvidence}
      />
    </div>
  );
}

/** 聚焦时给场景加一层极轻的暗角与虚化，而不是把花园藏起来 */
function FocusVeil() {
  const cameraMode = useGardenStore((s) => s.cameraMode);
  const keeperOpen = useGardenStore((s) => s.keeperOpen);
  const dim = cameraMode !== 'garden' || keeperOpen;
  return <div className="focus-veil" data-dim={dim ? 'on' : 'off'} />;
}
