import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';

export default function NotifPanel({ onClose }) {
  const { toast } = useToast();
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/notifications').then(d => { setNotifs(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const markAll = async () => {
    await api.post('/notifications/read', {}).catch(() => {});
    setNotifs([]);
    toast('All notifications cleared', 'success');
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(2px)', zIndex: 799,
        }}
      />
      {/* Panel */}
      <motion.div
        className="notif-panel"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <div className="notif-panel-head">
          <h3>🔔 Alerts</h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {notifs.length > 0 && (
              <button className="btn btn-sm btn-teal" onClick={markAll}>
                Clear All
              </button>
            )}
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="notif-panel-body">
          {loading && (
            [1,2,3].map(i => (
              <div key={i} className="skeleton" style={{ height: 64, borderRadius: 8 }} />
            ))
          )}
          {!loading && notifs.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">✓</div>
              <p>All caught up</p>
            </div>
          )}
          {notifs.map((n, i) => (
            <motion.div
              key={n.id}
              className={`notif-item ${n.category}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <div>{n.message}</div>
              <div className="notif-item-date">
                {new Date(n.created_at).toLocaleString('en-KE', {
                  month: 'short', day: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </>
  );
}