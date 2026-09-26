/**
 * PlantIdeaDialog —— 花园的一级动作：种下一个新的研究想法。
 *
 * Garden 是首页，但「种新花」原先只能绕道对话里完成，
 * 这让「这是我的科研花园」这句话站不住。这里把它放回花园本身。
 */
import { useState } from 'react';
import { Sprout } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useGardenStore } from '../../stores/gardenStore';
import { useSoulStore } from '../../stores/soulStore';

const EXAMPLES = [
  '用不确定性估计动态决定 action horizon，降低推理延迟',
  '把 VLA 的视觉 backbone 按任务相关性剪枝，压到机载设备能跑',
  '让 policy 在推理时自适应时间尺度，跨不同控制频率复用',
];

export function PlantIdeaDialog() {
  const open = useGardenStore((s) => s.plantOpen);
  const closePlant = useGardenStore((s) => s.closePlant);
  const openKeeper = useGardenStore((s) => s.openKeeper);
  const backToGarden = useGardenStore((s) => s.backToGarden);

  const structureIdea = useSoulStore((s) => s.structureIdea);
  const agentStatus = useSoulStore((s) => s.agentStatus);

  const [text, setText] = useState('');
  const busy = agentStatus === 'thinking';

  const submit = () => {
    const raw = text.trim();
    if (!raw || busy) return;
    setText('');
    closePlant();
    backToGarden();
    // Idea Analyst 先把它拆成可证伪的研究结构，用户在卡片上确认后才真正种下
    void structureIdea(raw, true);
    openKeeper();
  };

  return (
    <Modal
      open={open}
      title="种下一个新的研究想法"
      subtitle="它会先经过 Idea Analyst，变成可证伪的研究结构，再由你决定是否种下"
      onClose={closePlant}
      width={560}
      footer={
        <>
          <button className="btn" onClick={closePlant}>
            取消
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={!text.trim() || busy}>
            <Sprout size={14} /> {busy ? 'Idea Analyst 正在拆解…' : '交给 Idea Analyst'}
          </button>
        </>
      }
    >
      <textarea
        className="w-full rounded-xl p-3.5 text-[13px]"
        rows={5}
        autoFocus
        placeholder="用一两句话说清楚你想验证什么。模糊也没关系 —— 这正是 Idea Analyst 要处理的部分。"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
        }}
        style={{
          background: 'rgba(11,59,46,0.8)',
          border: '1px solid rgba(134,239,172,0.2)',
          color: 'var(--text-primary)',
          lineHeight: 1.7,
        }}
      />

      <div className="mt-4">
        <div className="text-[10.5px] uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>
          或者从这些开始
        </div>
        <div className="space-y-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              className="plant-example"
              onClick={() => setText(ex)}
              type="button"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
