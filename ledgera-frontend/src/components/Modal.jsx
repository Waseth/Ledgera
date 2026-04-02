import { AnimatePresence, motion } from 'framer-motion';

export default function Modal({ open, onClose, title, children, maxWidth = 460 }) {
  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            className="modal-box"
            style={{ maxWidth }}
            initial={{ opacity: 0, scale: 0.93, y: 14 }}
            animate={{ opacity: 1, scale: 1,    y: 0 }}
            exit={{    opacity: 0, scale: 0.93, y: 8  }}
            transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
          >
            <button className="modal-close" onClick={onClose}>✕</button>
            {title && <div className="modal-title">{title}</div>}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}