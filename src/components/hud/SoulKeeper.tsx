/**
 * SoulKeeper —— 对话不再是半个屏幕。
 *
 * 默认只是一颗悬浮的球（右下角）。点击展开 380px Drawer；
 * 进入 Evidence Review 时自动展开到 480px。
 */
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';
import { useGardenStore } from '../../stores/gardenStore';
import { useSoulStore } from '../../stores/soulStore';
import { ResearchChat } from '../chat/ResearchChat';

export function SoulKeeper() {
  const open = useGardenStore((s) => s.keeperOpen);
  const openKeeper = useGardenStore((s) => s.openKeeper);
  const closeKeeper = useGardenStore((s) => s.closeKeeper);
  const mode = useSoulStore((s) => s.mode);
  const agentStatus = useSoulStore((s) => s.agentStatus);

  const width = mode === 'Evidence Review' ? 480 : 380;
  const busy = agentStatus === 'thinking';

  return (
    <>
      {/* 悬浮球：Soul Keeper 在场，但不占注意力 */}
      <AnimatePresence>
        {!open && (
          <motion.button
            className="keeper-orb"
            onClick={openKeeper}
            title="Soul Keeper — 你的科研助手"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Sparkles size={19} />
            {busy && <span className="keeper-orb-pulse" />}
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.aside
            className="keeper-drawer"
            style={{ width }}
            initial={{ x: width + 24, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: width + 24, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.2, 0.8, 0.3, 1] }}
          >
            <div className="keeper-head">
              <div className="flex items-center gap-2">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    background: busy ? 'var(--leaf-warning)' : 'var(--soul-core)',
                    boxShadow: '0 0 8px currentColor',
                  }}
                />
                <span className="text-[12.5px] font-medium" style={{ color: 'var(--soul-highlight)' }}>
                  Soul Keeper
                </span>
                <span className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>
                  {mode}
                </span>
              </div>
              <button className="btn !px-2 !py-1" onClick={closeKeeper} aria-label="collapse keeper">
                <X size={13} />
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <ResearchChat />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
