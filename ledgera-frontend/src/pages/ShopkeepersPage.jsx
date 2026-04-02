import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { FiUsers, FiUserPlus, FiUserCheck, FiUserX, FiMail, FiCalendar, FiShield, FiEye, FiEyeOff, FiPlus } from 'react-icons/fi';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const cardVariant = {
  hidden: { opacity: 0, y: 14 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

export default function ShopkeepersPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [shopkeepers, setShopkeepers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/auth/shopkeepers');
      console.log('Raw API response:', data); // Debug log

      let shopkeepersArray = [];
      if (Array.isArray(data)) {
        shopkeepersArray = data;
      } else if (data && typeof data === 'object') {
        shopkeepersArray = data.data || data.shopkeepers || data.users || data.items || [];
        if (!Array.isArray(shopkeepersArray) && data.id) {
          shopkeepersArray = [data];
        }
        if (!Array.isArray(shopkeepersArray) && typeof data === 'object') {
          const values = Object.values(data);
          if (values.length > 0 && values[0] && typeof values[0] === 'object') {
            shopkeepersArray = values;
          }
        }
      }

      console.log('Processed shopkeepers:', shopkeepersArray); // Debug log
      setShopkeepers(shopkeepersArray);
    } catch (err) {
      console.error('Failed to load shopkeepers:', err);
      toast(err.message, 'error');
      setShopkeepers([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleCreate = async () => {
    if (!form.name || !form.email || form.password.length < 6) {
      toast('Name, email, and password (min 6 chars) are required.', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/auth/shopkeepers', {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });
      toast(`Shopkeeper "${form.name}" created!`, 'success');
      setForm({ name: '', email: '', password: '' });
      setModal(false);
      load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const safeShopkeepers = Array.isArray(shopkeepers) ? shopkeepers : [];
  const activeCount = safeShopkeepers.filter(s => s.is_active).length;
  const inactiveCount = safeShopkeepers.filter(s => !s.is_active).length;

  // Only admin can view this page
  if (user?.role !== 'admin') {
    return null;
  }

  return (
    <div className="page-wrapper">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.875rem', marginBottom: '1.5rem' }}
      >
        <div>
          <h1 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800, fontSize: '1.9rem', letterSpacing: '0.04em' }}>
            Staff
          </h1>
          <p style={{ fontFamily: 'Poppins, sans-serif', fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            <FiUsers size={12} style={{ display: 'inline', marginRight: '0.25rem' }} />
            {safeShopkeepers.length} shopkeeper{safeShopkeepers.length !== 1 ? 's' : ''} registered
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setModal(true)}
          style={{ color: '#0F172A' }}
        >
          <FiUserPlus size={14} /> Add Shopkeeper
        </button>
      </motion.div>

      {/* Summary Cards */}
      <motion.div
        className="kpi-grid"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.875rem', marginBottom: '1.5rem' }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.07 }}
      >
        {[
          { label: 'Total Staff', value: safeShopkeepers.length, icon: FiUsers, color: 'var(--text-primary)' },
          { label: 'Active', value: activeCount, icon: FiUserCheck, color: 'var(--accent-green)' },
          { label: 'Inactive', value: inactiveCount, icon: FiUserX, color: inactiveCount > 0 ? 'var(--accent-red)' : 'var(--text-muted)' },
        ].map((c, i) => (
          <motion.div
            key={c.label}
            className="card stat-card"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 * i }}
            whileHover={{ y: -2, boxShadow: 'var(--shadow-lg)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="stat-label" style={{ fontFamily: 'Poppins, sans-serif' }}>{c.label}</div>
                <div className="stat-value" style={{ fontFamily: 'Poppins, sans-serif', color: c.color }}>{c.value}</div>
              </div>
              <c.icon size={28} style={{ opacity: 0.5, color: c.color }} />
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Cards grid */}
      {loading ? (
        <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.875rem' }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 140, borderRadius: 12 }} />
          ))}
        </div>
      ) : safeShopkeepers.length === 0 ? (
        <div className="empty-state" style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '3rem 1rem',
          textAlign: 'center',
        }}>
          <FiUsers size={48} style={{ opacity: 0.4, marginBottom: '1rem', color: 'var(--text-muted)' }} />
          <p style={{ fontFamily: 'Poppins, sans-serif', color: 'var(--text-muted)' }}>No shopkeepers yet — add one to get started</p>
        </div>
      ) : (
        <motion.div
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.875rem' }}
          variants={container}
          initial="hidden"
          animate="show"
        >
          {safeShopkeepers.map(s => (
            <motion.div
              key={s.id}
              className={`card ${s.is_active ? 'card-accent-teal' : 'card-accent-red'}`}
              style={{ padding: '1.25rem' }}
              variants={cardVariant}
              whileHover={{ y: -3, boxShadow: 'var(--shadow-lg)' }}
            >
              {/* Header with Avatar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '1rem' }}>
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: s.is_active ? 'var(--accent-teal-dim)' : 'var(--accent-red-dim)',
                  border: `2px solid ${s.is_active ? 'var(--accent-teal)' : 'var(--accent-red)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'Poppins, sans-serif',
                  fontWeight: 700,
                  fontSize: '1.2rem',
                  color: s.is_active ? 'var(--accent-teal)' : 'var(--accent-red)',
                  flexShrink: 0,
                }}>
                  {s.name?.charAt(0).toUpperCase() || '?'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                    <FiMail size={12} style={{ color: 'var(--text-muted)' }} />
                    <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.email}
                    </span>
                  </div>
                </div>
                <span className={`badge ${s.is_active ? 'badge-success' : 'badge-danger'}`} style={{ fontFamily: 'Poppins, sans-serif' }}>
                  {s.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              {/* Details */}
              <div style={{ display: 'grid', gap: '0.5rem', marginTop: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <FiShield size={14} style={{ color: 'var(--text-muted)' }} />
                    <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)' }}>ROLE</span>
                  </div>
                  <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: '0.8rem', color: 'var(--accent-teal)' }}>Shopkeeper</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <FiCalendar size={14} style={{ color: 'var(--text-muted)' }} />
                    <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)' }}>JOINED</span>
                  </div>
                  <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {new Date(s.created_at).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Create Shopkeeper Modal */}
      <Modal open={modal} onClose={() => { setModal(false); setForm({ name: '', email: '', password: '' }); }} title="Add Shopkeeper">
        <div className="form-group">
          <label className="form-label" style={{ fontFamily: 'Poppins, sans-serif' }}>Full Name</label>
          <input
            className="form-input"
            placeholder="Jane Wanjiku"
            value={form.name}
            onChange={set('name')}
            autoFocus
            style={{ fontFamily: 'Poppins, sans-serif' }}
          />
        </div>
        <div className="form-group">
          <label className="form-label" style={{ fontFamily: 'Poppins, sans-serif' }}>Email Address</label>
          <input
            className="form-input"
            type="email"
            placeholder="jane@shop.com"
            value={form.email}
            onChange={set('email')}
            style={{ fontFamily: 'Poppins, sans-serif' }}
          />
        </div>
        <div className="form-group">
          <label className="form-label" style={{ fontFamily: 'Poppins, sans-serif' }}>Password</label>
          <div style={{ position: 'relative' }}>
            <input
              className="form-input"
              type={showPwd ? 'text' : 'password'}
              placeholder="Min 6 characters"
              value={form.password}
              onChange={set('password')}
              style={{ paddingRight: '2.5rem', fontFamily: 'Poppins, sans-serif' }}
            />
            <button
              onClick={() => setShowPwd(v => !v)}
              style={{
                position: 'absolute',
                right: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
              }}
            >
              {showPwd ? <FiEyeOff size={16} /> : <FiEye size={16} />}
            </button>
          </div>
          {form.password && form.password.length < 6 && (
            <div style={{ fontSize: '0.75rem', color: 'var(--accent-red)', marginTop: '0.3rem', fontFamily: 'Poppins, sans-serif' }}>
              Password must be at least 6 characters
            </div>
          )}
        </div>

        {/* Role note */}
        <div style={{
          background: 'var(--bg-surface)',
          borderRadius: 6,
          padding: '0.6rem 0.875rem',
          fontSize: '0.8rem',
          color: 'var(--text-muted)',
          marginBottom: '0.25rem',
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'flex-start',
          fontFamily: 'Poppins, sans-serif',
        }}>
          <FiShield size={14} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
          <span>This account will have shopkeeper access: Record sales and manage debts.</span>
        </div>

        <div className="modal-footer">
          <button
            className="btn btn-outline"
            onClick={() => setModal(false)}
            disabled={submitting}
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleCreate}
            disabled={submitting}
            style={{ fontFamily: 'Poppins, sans-serif', color: '#0F172A' }}
          >
            <FiPlus size={14} /> {submitting ? 'Creating...' : 'Create Account'}
          </button>
        </div>
      </Modal>

      {/* Responsive CSS */}
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