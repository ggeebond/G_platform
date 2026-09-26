/**
 * FocusHeader —— 聚焦态顶栏（W2）
 *
 * 直接**替换** Garden 顶栏，不新增第二层（叠层会立刻产生 Dashboard 感）。
 * 左：返回花园 · 当前 Soul · 研究状态
 * 右：Frontier Pulse 计数 · Research Journal · Soul Keeper
 * Sunlight / 调光 / 种下新想法 这些「管理花园」的操作在聚焦态一律不出现。
 */
import { ArrowLeft, BookOpen, Bot, Wrench } from 'lucide-react';
import { useGardenStore } from '../../stores/gardenStore';
import { useSoulStore } from '../../stores/soulStore';
import { stageOf, STAGE_LABEL } from '../../lib/garden/garden';

export function FocusHeader() {
  const soulId = useGardenStore((s) => s.soulId);
  const backToGarden = useGardenStore((s) => s.backToGarden);
  const toggleJournal = useGardenStore((s) => s.toggleJournal);
  const openKeeper = useGardenStore((s) => s.openKeeper);
  const toggleWorkshop = useGardenStore((s) => s.toggleWorkshop);

  const docs = useSoulStore((s) => s.docs);
  const scan = useSoulStore((s) => s.frontierScan);

  const doc = soulId ? docs[soulId] : null;
  const stage = doc ? STAGE_LABEL[stageOf(doc)] : '';
  const frontierCount = scan ? scan.signals.filter((s) => s.soulId === soulId).length : 0;

  return (
    <header className="hud-top">
      <div className="flex items-center gap-3 pointer-events-auto">
        <button className="btn" onClick={backToGarden}>
          <ArrowLeft size={13} /> 花园
        </button>
        <div>
          <div className="text-[14px] font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
            {doc?.soul.title ?? 'Research Focus'}
          </div>
          <div className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>
            {stage ? `Research Focus · ${stage}` : 'Research Focus'}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 pointer-events-auto">
        <span className="focus-status-chip">Frontier {frontierCount}</span>
        <button className="btn" onClick={toggleWorkshop}>
          <Wrench size={13} /> Workshop
        </button>
        <button className="btn" onClick={toggleJournal}>
          <BookOpen size={13} /> Journal
        </button>
        <button className="btn" onClick={openKeeper}>
          <Bot size={13} /> Soul Keeper
        </button>
      </div>
    </header>
  );
}
