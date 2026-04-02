import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiBell, FiCheckCircle, FiAlertCircle, FiInfo, FiX } from 'react-icons/fi';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';

export default function NotifPanel({ open, onClose, onRead }) {
  const { toast } = useToast();
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    api.get('/reports/notifications')
      .then(data => {
        const notifsArray = Array.isArray(data) ? data : [];
        setNotifs(notifsArray);
        setLoading(false);
      })
      .catch(() => {
        setNotifs([]);
        setLoading(false);
      });
  }, [open]);

  const markAll = async () => {
    await api.post('/reports/notifications/read-all', {}).catch(() => {});
    setNotifs([]);
    onRead?.();
    toast('All notifications cleared', 'success');
    onClose();
  };

  const getIcon = (category) => {
    switch(category) {
      case 'success': return <FiCheckCircle color="var(--accent-green)" />;
      case 'warning': return <FiAlertCircle color="var(--accent-amber)" />;
      case 'danger': return <FiAlertCircle color="var(--accent-red)" />;
      default: return <FiInfo color="var(--primary-blue)" />;
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(4px)', zIndex: 799,
            }}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{
              position: 'fixed', top: 0, right: 0, bottom: 0,
              width: '380px', maxWidth: '100vw',
              background: 'var(--bg-card)',
              borderLeft: '1px solid var(--border-medium)',
              boxShadow: 'var(--shadow-lg)',
              zIndex: 800,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{
              padding: '1.25rem',
              borderBottom: '1px solid var(--border-medium)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <h3 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '1.1rem' }}>
                <FiBell style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
                Notifications
              </h3>
              <button onClick={onClose} style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', fontSize: '1.2rem',
              }}><FiX /></button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
              {loading && (
                [1,2,3].map(i => (
                  <div key={i} className="skeleton" style={{ height: 80, marginBottom: '0.75rem', borderRadius: 'var(--radius-md)' }} />
                ))
              )}
              {!loading && notifs.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  <FiBell size={40} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                  <p>No notifications</p>
                </div>
              )}
              {notifs.map((n, i) => (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  style={{
                    padding: '0.75rem',
                    marginBottom: '0.75rem',
                    background: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-md)',
                    borderLeft: `3px solid ${n.category === 'danger' ? 'var(--accent-red)' : n.category === 'warning' ? 'var(--accent-amber)' : 'var(--primary-blue)'}`,
                  }}
                >
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                    {getIcon(n.category)}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{n.message}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        {new Date(n.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {notifs.length > 0 && (
              <div style={{ padding: '1rem', borderTop: '1px solid var(--border-medium)' }}>
                <button className="btn btn-outline btn-sm" onClick={markAll} style={{ width: '100%' }}>
                  Clear All
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}