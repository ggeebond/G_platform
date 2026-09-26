/**
 * GardenHUD —— 花园的顶栏与状态角标。
 *
 * 一切都为了一个印象服务：用户打开的是一座会生长的科研花园，
 * 而不是「左边可视化 + 右边聊天」的 AI 后台。
 */
import { useMemo } from 'react';
import { Leaf, Radar, RotateCcw, Sprout, Wrench } from 'lucide-react';
import { useGardenStore } from '../../stores/gardenStore';
import { useSoulStore } from '../../stores/soulStore';
import { buildGarden, plotAlert, STAGE_LABEL } from '../../lib/garden/garden';
import { SunlightMeter } from './SunlightMeter';

export function GardenHUD() {
  const docs = useSoulStore((s) => s.docs);
  const order = useSoulStore((s) => s.order);
  const adapter = useSoulStore((s) => s.adapter);
  const agentStatus = useSoulStore((s) => s.agentStatus);
  const resetSoul = useSoulStore((s) => s.resetSoul);
  const setAdapterKind = useSoulStore((s) => s.setAdapterKind);
  const scanPapers = useSoulStore((s) => s.scanPapers);

  const cameraMode = useGardenStore((s) => s.cameraMode);
  const soulId = useGardenStore((s) => s.soulId);
  const backToGarden = useGardenStore((s) => s.backToGarden);
  const openKeeper = useGardenStore((s) => s.openKeeper);
  const openPlant = useGardenStore((s) => s.openPlant);
  const toggleWorkshop = useGardenStore((s) => s.toggleWorkshop);

  const garden = useMemo(
    () => buildGarden(order.map((id) => docs[id]).filter(Boolean)),
    [docs, order],
  );

  const focused = soulId ? docs[soulId] : null;

  // 花园级待办：让用户在顶栏就知道哪里有东西在等他
  const attention = useMemo(
    () => garden.plots.filter((p) => plotAlert(p) !== null).length,
    [garden.plots],
  );

  const scanTarget = focused ?? docs[order[0]];

  return (
    <>
      <header className="hud-top">
        <div className="flex items-center gap-3 pointer-events-auto">
          <div className="hud-mark">
            <Leaf size={15} />
          </div>
          <div>
            <div className="text-[14px] font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
              Soul Lab
            </div>
            <div className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>
              {cameraMode === 'garden'
                ? `${garden.plots.length} Souls · ${garden.clusters.length} Research Plots`
                : focused
                  ? `${STAGE_LABEL[garden.plots.find((p) => p.id === soulId)?.stage ?? 'bud']} · ${focused.soul.title}`
                  : 'Research Garden'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          {/* 阳光机制：整座花园被证据照亮的程度 */}
          <SunlightMeter />
          {/* Instrument Workshop：研究自己的实验数据（数学仪器层） */}
          <button className="btn" onClick={toggleWorkshop} title="科研仪器工坊 · Mathematical Instrument Layer">
            <Wrench size={13} /> Workshop
          </button>
          {/* 一级入口必须有它最主要的动作：种下一个新的研究想法 */}
          <button className="btn btn-primary" onClick={openPlant}>
            <Sprout size={13} /> 种下新想法
          </button>
          {cameraMode !== 'garden' && (
            <button className="btn" onClick={backToGarden}>
              返回花园
            </button>
          )}
          {attention > 0 && cameraMode === 'garden' && (
            <span className="chip chip-attention">
              <span className="dot-pulse">●</span> {attention} 株需要你
            </span>
          )}
          <button
            className="chip"
            onClick={() => setAdapterKind(adapter === 'learnbuddy' ? 'mock' : 'learnbuddy')}
            style={{
              borderColor: adapter === 'learnbuddy' ? 'rgba(163,230,53,0.5)' : 'rgba(251,191,36,0.55)',
              color: adapter === 'learnbuddy' ? 'var(--soul-core)' : 'var(--leaf-warning)',
            }}
            title="切换 Agent 适配器"
          >
            {adapter === 'learnbuddy' ? 'LearnBuddy Agent' : 'Mock（仅演示）'}
          </button>
          <span className="chip">
            {agentStatus === 'offline' ? '离线浏览' : agentStatus === 'thinking' ? 'Agent 思考中' : '就绪'}
          </span>
          <button
            className="btn"
            onClick={() => {
              if (scanTarget) void scanPapers('manual_scan', scanTarget.soul.mainGap || scanTarget.soul.title, null);
              openKeeper();
            }}
          >
            <Radar size={13} /> Scan Frontier ✦
          </button>
          <button className="btn" onClick={() => void resetSoul()} title="重置整座花园为 Seed 剧本">
            <RotateCcw size={13} />
          </button>
        </div>
      </header>

      {cameraMode === 'garden' && (
        <div className="hud-hint">
          <div>拖动浏览花园 · 悬停看状态 · 点击花朵进入</div>
          <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>
            花瓣 = 实验论证 · 黄叶 = 研究边界 · 知识球 = 正在进入轨道的外部论文
          </div>
        </div>
      )}
    </>
  );
}
