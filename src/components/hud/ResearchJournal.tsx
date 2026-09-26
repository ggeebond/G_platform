/**
 * ResearchJournal —— 取代原来的底部 TIMELINE 调试条。
 *
 * 默认收起为左下角一个 📖 计数按钮；点击后从底部拉出研究日志。
 * 内部保留技术事件，但默认只展示人话。
 */
import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, X } from 'lucide-react';
import { useGardenStore } from '../../stores/gardenStore';
import { useSoulStore } from '../../stores/soulStore';
import { groupByDay, toJournal } from '../../lib/garden/journal';

export function ResearchJournal() {
  const open = useGardenStore((s) => s.journalOpen);
  const toggle = useGardenStore((s) => s.toggleJournal);
  const doc = useSoulStore((s) => s.doc);
  const [showTechnical, setShowTechnical] = useState(false);

  const entries = useMemo(() => toJournal(doc.timeline), [doc.timeline]);
  const groups = useMemo(() => groupByDay(entries), [entries]);

  return (
    <>
      {/* 收起态：左下角一个安静的书页计数 */}
      {!open && (
        <button className="journal-pill" onClick={toggle} title="Research Journal">
          <BookOpen size={14} />
          <span className="num">{entries.length}</span>
        </button>
      )}

      <AnimatePresence>
        {open && (
          <motion.aside
            className="journal-drawer"
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.2, 0.8, 0.3, 1] }}
          >
            <header className="journal-head">
              <div>
                <div className="journal-title">
                  {doc.soul.title} · Research Journal
                </div>
                <div className="journal-sub">
                  这里是这株花经历过的事，不是系统日志
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="btn !px-2 !py-1 text-[10.5px]"
                  onClick={() => setShowTechnical((v) => !v)}
                  title="显示技术事件 ID"
                >
                  {showTechnical ? '通俗' : '技术'}
                </button>
                <button className="btn !px-2 !py-1" onClick={toggle} aria-label="close journal">
                  <X size={13} />
                </button>
              </div>
            </header>

            <div className="journal-body">
              {groups.length === 0 && (
                <div className="journal-empty">还没有记录。做一次实验，这里就会开始生长。</div>
              )}
              {groups.map((g) => (
                <div key={g.label} className="journal-group">
                  <div className="journal-day">{g.label}</div>
                  {g.items.map((e) => (
                    <div key={e.id} className="journal-item">
                      <span className="journal-glyph" style={{ color: e.color }}>
                        {e.glyph}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="journal-text">{e.text}</div>
                        {showTechnical && (
                          <div className="journal-tech">
                            {e.technicalType} · {e.actor}
                          </div>
                        )}
                      </div>
                      <span className="journal-time num">
                        {new Date(e.at).toLocaleTimeString('zh-CN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
