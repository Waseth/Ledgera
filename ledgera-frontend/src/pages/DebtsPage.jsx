import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';

const fmt = n => Number(n || 0).toLocaleString('en-KE', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const rowVariant = {
  hidden: { opacity: 0, x: -8 },
  show:   { opacity: 1, x: 0, transition: { duration: 0.28 } },
};

export default function DebtsPage() {
  const { toast } = useToast();
  const [debts,    setDebts]    = useState([]);
  const [summary,  setSummary]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [showPaid, setShowPaid] = useState(false);
  const [search,   setSearch]   = useState('');
  const [confirm,  setConfirm]  = useState(null); // debt id to confirm pay

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, s] = await Promise.all([
        api.get(`/debts${showPaid ? '?paid=1' : ''}`),
        api.get('/debts/summary'),
      ]);
      setDebts(d);
      setSummary(s);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [toast, showPaid]);

  useEffect(() => { load(); }, [load]);

  const markPaid = async (id) => {
    try {
      await api.post(`/debts/${id}/pay`, {});
      toast('Debt marked as paid ✓', 'success');
      setConfirm(null);
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const displayed = debts.filter(d =>
    d.customer_name.toLowerCase().includes(search.toLowerCase()) ||
    d.customer_phone.includes(search) ||
    (d.product_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const confirmDebt = debts.find(d => d.id === confirm);

  return (
    <div className="page-wrapper">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: '1.5rem' }}
      >
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: '1.9rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Debts
        </div>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
          Track and collect outstanding customer payments
        </div>
      </motion.div>

      {/* Summary cards */}
      {summary && (
        <motion.div
          style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.875rem', marginBottom: '1.5rem' }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.07 }}
        >
          <motion.div
            className={`card stat-card ${summary.outstanding_amount > 0 ? 'card-accent' : 'card-accent-green'}`}
            whileHover={{ y: -2, boxShadow: 'var(--shadow-lg)' }}
          >
            <div style={{
              fontFamily: "'DM Mono', monospace",
              fontWeight: 500,
              fontSize: '1.9rem',
              color: summary.outstanding_amount > 0 ? 'var(--accent-amber)' : 'var(--accent-green)',
              lineHeight: 1,
            }}>
              KSh {fmt(summary.outstanding_amount)}
            </div>
            <div className="stat-label">Outstanding Amount</div>
          </motion.div>

          <motion.div
            className={`card stat-card ${summary.outstanding_count > 0 ? 'card-accent' : 'card-accent-green'}`}
            whileHover={{ y: -2, boxShadow: 'var(--shadow-lg)' }}
          >
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 800,
              fontSize: '2.6rem',
              color: summary.outstanding_count > 0 ? 'var(--accent-rust)' : 'var(--accent-green)',
              lineHeight: 1,
            }}>
              {summary.outstanding_count}
            </div>
            <div className="stat-label">Unpaid Debts</div>
          </motion.div>
        </motion.div>
      )}

      {/* Controls */}
      <div style={{ display: 'flex', gap: '0.65rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="form-input"
          style={{ maxWidth: 280, flex: 1 }}
          placeholder="Search by name, phone or product…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button
            className={`btn btn-sm ${!showPaid ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setShowPaid(false)}
          >
            Unpaid ({summary?.outstanding_count ?? '…'})
          </button>
          <button
            className={`btn btn-sm ${showPaid ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setShowPaid(true)}
          >
            All Debts
          </button>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={load} style={{ marginLeft: 'auto' }}>↻ Refresh</button>
      </div>

      {/* Table */}
      <motion.div
        className="table-wrap"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Phone</th>
              <th>Product</th>
              <th>Amount (KSh)</th>
              <th>Date</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <motion.tbody variants={container} initial="hidden" animate="show">
            {loading && (
              [...Array(5)].map((_, i) => (
                <tr key={i}>
                  {[...Array(7)].map((__, j) => (
                    <td key={j}><div className="skeleton" style={{ height: 14, width: '75%', borderRadius: 4 }} /></td>
                  ))}
                </tr>
              ))
            )}
            {!loading && displayed.length === 0 && (
              <tr><td colSpan={7}>
                <div className="empty-state">
                  <div className="empty-state-icon">✓</div>
                  <p>{search ? 'No matching debts' : showPaid ? 'No debts recorded' : 'No unpaid debts'}</p>
                </div>
              </td></tr>
            )}
            {!loading && displayed.map(d => (
              <motion.tr
                key={d.id}
                variants={rowVariant}
                style={d.is_paid ? { opacity: 0.55 } : {}}
              >
                <td style={{ fontWeight: 600 }}>{d.customer_name}</td>
                <td>
                  <a
                    href={`tel:${d.customer_phone}`}
                    style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.82rem', color: 'var(--accent-teal)', textDecoration: 'none' }}
                  >
                    {d.customer_phone}
                  </a>
                </td>
                <td style={{ color: 'var(--text-secondary)' }}>{d.product_name}</td>
                <td className="td-mono" style={{ fontWeight: 600, color: d.is_paid ? 'var(--accent-green)' : 'var(--accent-amber)' }}>
                  {fmt(d.amount)}
                </td>
                <td className="td-mono" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  {d.created_at?.substring(0, 10)}
                </td>
                <td>
                  <span className={`badge ${d.is_paid ? 'badge-cash' : 'badge-debt'}`}>
                    {d.is_paid ? `Paid ${d.paid_at?.substring(0, 10) || ''}` : 'Unpaid'}
                  </span>
                </td>
                <td>
                  {!d.is_paid && (
                    <button
                      className="btn btn-green btn-sm"
                      onClick={() => setConfirm(d.id)}
                    >
                      Mark Paid
                    </button>
                  )}
                </td>
              </motion.tr>
            ))}
          </motion.tbody>
        </table>
      </motion.div>

      {/* Confirm pay modal */}
      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title="Confirm Payment"
        maxWidth={380}
      >
        {confirmDebt && (
          <>
            <div style={{
              background: 'var(--bg-surface)',
              borderRadius: 8,
              padding: '1rem',
              marginBottom: '1.25rem',
              display: 'grid',
              gap: '0.5rem',
            }}>
              {[
                { label: 'Customer',  value: confirmDebt.customer_name  },
                { label: 'Phone',     value: confirmDebt.customer_phone  },
                { label: 'Product',   value: confirmDebt.product_name    },
                { label: 'Amount',    value: `KSh ${fmt(confirmDebt.amount)}` },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--text-secondary)', fontFamily: "'Barlow Condensed'", fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    {row.label}
                  </span>
                  <span style={{ fontFamily: row.label === 'Amount' ? "'DM Mono', monospace" : 'inherit', fontWeight: row.label === 'Amount' ? 600 : 400, color: row.label === 'Amount' ? 'var(--accent-green)' : 'var(--text-primary)' }}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              This action cannot be undone. The debt will be permanently marked as paid.
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setConfirm(null)}>Cancel</button>
              <button className="btn btn-green" onClick={() => markPaid(confirm)}>
                ✓ Confirm Payment
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}