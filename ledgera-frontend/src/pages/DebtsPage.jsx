import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { FiDollarSign, FiUsers, FiSearch, FiRefreshCw, FiCheckCircle, FiAlertCircle, FiEdit2 } from 'react-icons/fi';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
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
  const { user } = useAuth();
  const [debts, setDebts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPaid, setShowPaid] = useState(false);
  const [search, setSearch] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, s] = await Promise.all([
        api.get(`/debts${showPaid ? '?paid=1' : ''}`),
        api.get('/debts/summary'),
      ]);

      let debtsArray = [];
      if (Array.isArray(d)) {
        debtsArray = d;
      } else if (d && typeof d === 'object') {
        debtsArray = d.data || d.debts || d.items || [];
        if (!Array.isArray(debtsArray) && d.id) {
          debtsArray = [d];
        }
        if (!Array.isArray(debtsArray) && typeof d === 'object') {
          const values = Object.values(d);
          if (values.length > 0 && values[0] && typeof values[0] === 'object') {
            debtsArray = values;
          }
        }
      }

      setDebts(debtsArray);
      setSummary(s);
    } catch (err) {
      console.error('Failed to load debts:', err);
      toast(err.message, 'error');
      setDebts([]);
    } finally {
      setLoading(false);
    }
  }, [toast, showPaid]);

  useEffect(() => { load(); }, [load]);

  const handleMarkPaid = async (id) => {
    const debt = debts.find(d => d.id === id);
    if (!debt) return;

    const amountPaid = parseFloat(paymentAmount) || debt.amount;

    if (amountPaid <= 0) {
      toast('Amount must be greater than 0.', 'warning');
      return;
    }
    if (amountPaid > debt.amount) {
      toast(`Amount cannot exceed remaining balance of KSh ${fmt(debt.amount)}`, 'warning');
      return;
    }

    try {
      if (amountPaid === debt.amount) {
        await api.post(`/debts/${id}/pay`, {});
        toast('Debt fully paid ✓', 'success');
      } else {
        await api.post(`/debts/${id}/partial-pay`, { amount_paid: amountPaid });
        toast(`Payment of KSh ${fmt(amountPaid)} recorded. Remaining: KSh ${fmt(debt.amount - amountPaid)}`, 'success');
      }
      setConfirm(null);
      setPaymentAmount('');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const safeDebts = Array.isArray(debts) ? debts : [];

  const displayed = safeDebts.filter(d =>
    d.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    d.customer_phone?.includes(search) ||
    (d.product_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const confirmDebt = safeDebts.find(d => d.id === confirm);

  const openPaymentModal = (debtId) => {
    const debt = safeDebts.find(d => d.id === debtId);
    if (debt) {
      setPaymentAmount(String(debt.amount));
      setConfirm(debtId);
    }
  };

  return (
    <div className="page-wrapper">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: '1.5rem' }}
      >
        <h1 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800, fontSize: '1.9rem', letterSpacing: '0.04em' }}>
          Debts
        </h1>
        <p style={{ fontFamily: 'Poppins, sans-serif', fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
          <FiDollarSign size={12} style={{ display: 'inline', marginRight: '0.25rem' }} />
          Track and collect outstanding customer payments
        </p>
      </motion.div>

      {summary && (
        <motion.div
          className="kpi-grid"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.875rem', marginBottom: '1.5rem' }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.07 }}
        >
          <motion.div
            className={`card stat-card ${summary.outstanding_amount > 0 ? 'card-accent' : 'card-accent-green'}`}
            whileHover={{ y: -2, boxShadow: 'var(--shadow-lg)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="stat-label" style={{ fontFamily: 'Poppins, sans-serif' }}>Outstanding Amount</div>
                <div className="stat-value" style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontSize: '1.9rem',
                  fontWeight: 700,
                  color: summary.outstanding_amount > 0 ? 'var(--accent-amber)' : 'var(--accent-green)'
                }}>
                  KSh {fmt(summary.outstanding_amount)}
                </div>
              </div>
              <FiDollarSign size={28} color={summary.outstanding_amount > 0 ? 'var(--accent-amber)' : 'var(--accent-green)'} style={{ opacity: 0.7 }} />
            </div>
          </motion.div>

          <motion.div
            className={`card stat-card ${summary.outstanding_count > 0 ? 'card-accent' : 'card-accent-green'}`}
            whileHover={{ y: -2, boxShadow: 'var(--shadow-lg)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="stat-label" style={{ fontFamily: 'Poppins, sans-serif' }}>Unpaid Debts</div>
                <div className="stat-value" style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontSize: '1.9rem',
                  fontWeight: 700,
                  color: summary.outstanding_count > 0 ? 'var(--accent-rust)' : 'var(--accent-green)'
                }}>
                  {summary.outstanding_count}
                </div>
              </div>
              <FiUsers size={28} color={summary.outstanding_count > 0 ? 'var(--accent-rust)' : 'var(--accent-green)'} style={{ opacity: 0.7 }} />
            </div>
          </motion.div>
        </motion.div>
      )}

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.65rem',
        marginBottom: '1rem'
      }}>
        <div style={{
          display: 'flex',
          gap: '0.65rem',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <FiSearch style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={14} />
            <input
              className="form-input"
              style={{ paddingLeft: '2rem', fontFamily: 'Poppins, sans-serif', width: '100%' }}
              placeholder="Search by name, phone or product..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button className="btn btn-outline btn-sm" onClick={load} style={{ fontFamily: 'Poppins, sans-serif', whiteSpace: 'nowrap' }}>
            <FiRefreshCw size={14} /> Refresh
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button
            className={`btn btn-sm ${!showPaid ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setShowPaid(false)}
            style={{
              fontFamily: 'Poppins, sans-serif',
              ...(!showPaid ? { color: '#0F172A' } : {})
            }}
          >
            Unpaid ({summary?.outstanding_count ?? '…'})
          </button>
          <button
            className={`btn btn-sm ${showPaid ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setShowPaid(true)}
            style={{
              fontFamily: 'Poppins, sans-serif',
              ...(showPaid ? { color: '#0F172A' } : {})
            }}
          >
            All Debts
          </button>
        </div>
      </div>

      <motion.div
        className="table-wrap"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        style={{
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div style={{ minWidth: '800px' }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ fontFamily: 'Poppins, sans-serif' }}>Customer</th>
                <th style={{ fontFamily: 'Poppins, sans-serif' }}>Phone</th>
                <th style={{ fontFamily: 'Poppins, sans-serif' }}>Product</th>
                <th style={{ fontFamily: 'Poppins, sans-serif' }}>Amount (KSh)</th>
                <th style={{ fontFamily: 'Poppins, sans-serif' }}>Paid (KSh)</th>
                <th style={{ fontFamily: 'Poppins, sans-serif' }}>Date</th>
                <th style={{ fontFamily: 'Poppins, sans-serif' }}>Status</th>
                <th style={{ fontFamily: 'Poppins, sans-serif' }}>Action</th>
              </tr>
            </thead>
            <motion.tbody variants={container} initial="hidden" animate="show">
              {loading && (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(8)].map((__, j) => (
                      <td key={j}><div className="skeleton" style={{ height: 14, width: '75%', borderRadius: 4 }} /></td>
                    ))}
                  </tr>
                ))
              )}
              {!loading && displayed.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '3rem 1rem',
                      textAlign: 'center',
                    }}>
                      <FiCheckCircle size={48} style={{ opacity: 0.4, marginBottom: '1rem', color: 'var(--text-muted)' }} />
                      <p style={{ fontFamily: 'Poppins, sans-serif', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                        {search ? 'No matching debts' : showPaid ? 'No debts recorded' : 'No unpaid debts'}
                      </p>
                    </div>
                   </td>
                 </tr>
              )}
              {!loading && displayed.map(d => (
                <motion.tr
                  key={d.id}
                  variants={rowVariant}
                  style={d.is_paid ? { opacity: 0.55 } : {}}
                >
                  <td style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, whiteSpace: 'nowrap' }}>{d.customer_name}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <a
                      href={`tel:${d.customer_phone}`}
                      style={{ fontFamily: 'Poppins, sans-serif', fontSize: '0.82rem', color: 'var(--accent-teal)', textDecoration: 'none' }}
                    >
                      {d.customer_phone}
                    </a>
                  </td>
                  <td style={{ fontFamily: 'Poppins, sans-serif', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{d.product_name}</td>
                  <td className="td-mono" style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, color: d.is_paid ? 'var(--accent-green)' : 'var(--accent-amber)', whiteSpace: 'nowrap' }}>
                    {fmt(d.amount)}
                  </td>
                  <td className="td-mono" style={{ fontFamily: 'Poppins, sans-serif', color: 'var(--accent-green)', whiteSpace: 'nowrap' }}>
                    {fmt(d.amount_paid || 0)}
                  </td>
                  <td className="td-mono" style={{ fontFamily: 'Poppins, sans-serif', color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                    {d.created_at?.substring(0, 10)}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <span className={`badge ${d.is_paid ? 'badge-success' : 'badge-warning'}`} style={{ fontFamily: 'Poppins, sans-serif' }}>
                      {d.is_paid ? `Paid ${d.paid_at?.substring(0, 10) || ''}` : 'Unpaid'}
                    </span>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {!d.is_paid && user?.role === 'shopkeeper' && (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => openPaymentModal(d.id)}
                        style={{ fontFamily: 'Poppins, sans-serif', color: '#0F172A' }}
                      >
                        <FiEdit2 size={12} style={{ marginRight: '0.25rem' }} /> Pay
                      </button>
                    )}
                  </td>
                </motion.tr>
              ))}
            </motion.tbody>
          </table>
        </div>
      </motion.div>

      <Modal
        open={!!confirm}
        onClose={() => {
          setConfirm(null);
          setPaymentAmount('');
        }}
        title="Record Payment"
        maxWidth={420}
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
                { label: 'Customer', value: confirmDebt.customer_name },
                { label: 'Phone', value: confirmDebt.customer_phone },
                { label: 'Product', value: confirmDebt.product_name },
                { label: 'Total Amount', value: `KSh ${fmt(confirmDebt.initial_amount || confirmDebt.amount)}` },
                { label: 'Already Paid', value: `KSh ${fmt(confirmDebt.amount_paid || 0)}` },
                { label: 'Remaining Balance', value: `KSh ${fmt(confirmDebt.amount)}`, color: 'var(--accent-amber)' },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                  <span style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                    {row.label}
                  </span>
                  <span style={{
                    fontFamily: 'Poppins, sans-serif',
                    fontWeight: row.label === 'Remaining Balance' ? 700 : 400,
                    color: row.color || 'var(--text-primary)'
                  }}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontFamily: 'Poppins, sans-serif' }}>
                <FiDollarSign size={12} style={{ display: 'inline', marginRight: '0.25rem' }} />
                Amount to Pay (KSh)
              </label>
              <input
                className="form-input"
                type="number"
                min="0.01"
                step="0.01"
                value={paymentAmount}
                onChange={e => setPaymentAmount(e.target.value)}
                style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600 }}
              />
              <div style={{
                marginTop: '0.5rem',
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                fontFamily: 'Poppins, sans-serif'
              }}>
                {parseFloat(paymentAmount) < confirmDebt.amount && parseFloat(paymentAmount) > 0 && (
                  <span style={{ color: 'var(--accent-amber)' }}>
                    Partial payment: Remaining will be KSh {fmt(confirmDebt.amount - parseFloat(paymentAmount))}
                  </span>
                )}
                {parseFloat(paymentAmount) === confirmDebt.amount && confirmDebt.amount > 0 && (
                  <span style={{ color: 'var(--accent-green)' }}>
                    ✓ Full payment - Debt will be marked as paid
                  </span>
                )}
                {parseFloat(paymentAmount) > confirmDebt.amount && (
                  <span style={{ color: 'var(--accent-red)' }}>
                    ⚠️ Amount exceeds remaining balance!
                  </span>
                )}
                {(!paymentAmount || parseFloat(paymentAmount) === 0) && (
                  <span style={{ color: 'var(--text-muted)' }}>
                    Enter the amount the customer is paying
                  </span>
                )}
              </div>
            </div>

            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1.25rem', fontFamily: 'Poppins, sans-serif' }}>
              {parseFloat(paymentAmount) === confirmDebt.amount ? (
                'This will mark the debt as fully paid.'
              ) : parseFloat(paymentAmount) > 0 && parseFloat(paymentAmount) < confirmDebt.amount ? (
                'This will reduce the remaining balance.'
              ) : (
                'Enter the amount the customer is paying.'
              )}
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-outline"
                onClick={() => {
                  setConfirm(null);
                  setPaymentAmount('');
                }}
                style={{ fontFamily: 'Poppins, sans-serif' }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={() => handleMarkPaid(confirm)}
                disabled={!paymentAmount || parseFloat(paymentAmount) <= 0 || parseFloat(paymentAmount) > confirmDebt.amount}
                style={{ fontFamily: 'Poppins, sans-serif', color: '#0F172A' }}
              >
                <FiCheckCircle size={14} />
                {parseFloat(paymentAmount) === confirmDebt.amount ? 'Confirm Full Payment' : 'Confirm Payment'}
              </button>
            </div>
          </>
        )}
      </Modal>

      <style>{`
        @media (max-width: 768px) {
          .kpi-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}