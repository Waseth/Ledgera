import { useState } from 'react';
import { motion } from 'framer-motion';
import Modal from './Modal';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';

const fmt = n => Number(n || 0).toLocaleString('en-KE', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});

export default function DayModal({ mode, onClose, onSuccess }) {
  const { toast } = useToast();
  const [cash,    setCash]    = useState('');
  const [loading, setLoading] = useState(false);
  const [mismatch, setMismatch] = useState(null); // {expected, actual, diff}

  const isOpen  = mode === 'open';
  const isClose = mode === 'close';

  const handleSubmit = async () => {
    const cashVal = parseFloat(cash);
    if (isNaN(cashVal) || cashVal < 0) {
      toast('Please enter a valid cash amount.', 'warning');
      return;
    }
    setLoading(true);
    try {
      if (isOpen) {
        await api.post('/days/open', { opening_cash: cashVal });
        toast('Day opened successfully!', 'success');
        onSuccess?.();
        onClose();
      } else {
        const res = await api.post('/days/close', { actual_cash: cashVal });
        if (res.mismatch !== 0) {
          setMismatch({
            expected: res.expected_cash,
            actual:   res.actual_cash,
            diff:     res.mismatch,
          });
        } else {
          toast('Day closed. Cash balanced ✓', 'success');
          onSuccess?.();
          onClose();
        }
      }
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleMismatchAck = () => {
    toast(`Day closed. Mismatch of KSh ${fmt(Math.abs(mismatch.diff))} recorded.`, 'warning');
    onSuccess?.();
    onClose();
    setMismatch(null);
  };

  return (
    <Modal
      open={!!mode}
      onClose={() => { onClose(); setMismatch(null); setCash(''); }}
      title={isOpen ? '📅 Open Day' : '🔒 Close Day'}
    >
      {mismatch ? (
        /* Mismatch result screen */
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="mismatch-banner" style={{ marginBottom: '1.25rem' }}>
            ⚠ Cash Mismatch Detected
          </div>
          <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '1.25rem' }}>
            {[
              { label: 'Expected Cash', value: mismatch.expected },
              { label: 'Actual Cash',   value: mismatch.actual   },
              { label: 'Difference',    value: mismatch.diff, isKey: true },
            ].map(row => (
              <div key={row.label} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.6rem 0.875rem',
                background: row.isKey ? 'var(--accent-red-dim)' : 'var(--bg-surface)',
                borderRadius: 8,
                border: row.isKey ? '1px solid var(--accent-red)' : '1px solid var(--border-subtle)',
              }}>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>{row.label}</span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 500, color: row.isKey ? 'var(--accent-red)' : 'var(--text-primary)' }}>
                  KSh {fmt(Math.abs(row.value))}{row.isKey ? (row.value < 0 ? ' SHORT' : ' OVER') : ''}
                </span>
              </div>
            ))}
          </div>
          <div className="modal-footer">
            <button className="btn btn-danger" onClick={handleMismatchAck}>
              Acknowledge &amp; Close Day
            </button>
          </div>
        </motion.div>
      ) : (
        <>
          <div className="form-group">
            <label className="form-label">
              {isOpen ? 'Opening Cash in Drawer (KSh)' : 'Actual Cash in Drawer (KSh)'}
            </label>
            <input
              className="form-input"
              type="number"
              min="0"
              step="0.01"
              value={cash}
              onChange={e => setCash(e.target.value)}
              placeholder="0.00"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
              style={{ fontFamily: "'DM Mono', monospace", fontSize: '1.2rem' }}
            />
          </div>
          {isClose && (
            <div style={{
              fontSize: '0.8rem', color: 'var(--text-muted)',
              background: 'var(--bg-surface)',
              borderRadius: 6, padding: '0.6rem 0.875rem',
              marginBottom: '1rem',
            }}>
              Count all cash in the drawer including the opening float.
            </div>
          )}
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
            <button
              className={`btn ${isOpen ? 'btn-teal' : 'btn-danger'}`}
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? 'Processing…' : isOpen ? 'Open Day' : 'Close Day'}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}