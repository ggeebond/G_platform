import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
  footer?: React.ReactNode;
}

export function Modal({ open, title, subtitle, onClose, children, width = 720, footer }: ModalProps) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(4, 10, 9, 0.72)', backdropFilter: 'blur(3px)' }}
            onClick={onClose}
          />
          <motion.div
            className="relative panel rounded-2xl overflow-hidden flex flex-col"
            style={{ width, maxHeight: '86vh', boxShadow: '0 24px 70px rgba(0,0,0,0.55)' }}
            initial={{ opacity: 0, y: 18, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.99 }}
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.3, 1] }}
          >
            <div className="flex items-start justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(134,239,172,0.14)' }}>
              <div>
                <div className="text-[15px] font-semibold" style={{ color: 'var(--soul-highlight)' }}>{title}</div>
                {subtitle && <div className="text-[12px] mt-1" style={{ color: 'var(--text-muted)' }}>{subtitle}</div>}
              </div>
              <button className="btn !px-2 !py-1" onClick={onClose} aria-label="close">
                <X size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
            {footer && (
              <div className="px-5 py-3 flex items-center justify-end gap-2" style={{ borderTop: '1px solid rgba(134,239,172,0.14)' }}>
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
