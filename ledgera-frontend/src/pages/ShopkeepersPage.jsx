import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const cardVariant = {
  hidden: { opacity: 0, y: 14 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

export default function ShopkeepersPage() {
  const { toast } = useToast();
  const [shopkeepers, setShopkeepers] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [modal,       setModal]       = useState(false);
  const [form,        setForm]        = useState({ name: '', email: '', password: '' });
  const [submitting,  setSubmitting]  = useState(false);
  const [showPwd,     setShowPwd]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/auth/shopkeepers');
      setShopkeepers(data);
    } catch (err) {
      toast(err.message, 'error');
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
        name:     form.name.trim(),
        email:    form.email.trim().toLowerCase(),
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

  const activeCount   = shopkeepers.filter(s => s.is_active).length;
  const inactiveCount = shopkeepers.filter(s => !s.is_active).length;

  return (
    <div className="page-wrapper">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.875rem', marginBottom: '1.5rem' }}
      >
        <div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: '1.9rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Staff
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            {shopkeepers.length} shopkeeper{shopkeepers.length !== 1 ? 's' : ''} registered
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal(true)}>
          ➕ Add Shopkeeper
        </button>
      </motion.div>

      {/* Summary */}
      <motion.div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.875rem', marginBottom: '1.5rem' }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.07 }}
      >
        {[
          { label: 'Total Staff',     value: shopkeepers.length, color: 'var(--text-primary)' },
          { label: 'Active',          value: activeCount,        color: 'var(--accent-green)', accent: 'card-accent-green' },
          { label: 'Inactive',        value: inactiveCount,      color: inactiveCount > 0 ? 'var(--accent-red)' : 'var(--text-muted)', accent: inactiveCount > 0 ? 'card-accent-red' : '' },
        ].map((c, i) => (
          <motion.div
            key={c.label}
            className={`card stat-card ${c.accent || ''}`}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 * i }}
            whileHover={{ y: -2, boxShadow: 'var(--shadow-lg)' }}
          >
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: '2.4rem', color: c.color, lineHeight: 1 }}>{c.value}</div>
            <div className="stat-label">{c.label}</div>
          </motion.div>
        ))}
      </motion.div>

      {/* Cards grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.875rem' }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 140, borderRadius: 12 }} />
          ))}
        </div>
      ) : shopkeepers.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">👤</div>
          <p>No shopkeepers yet — add one to get started</p>
        </div>
      ) : (
        <motion.div
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.875rem' }}
          variants={container}
          initial="hidden"
          animate="show"
        >
          {shopkeepers.map(s => (
            <motion.div
              key={s.id}
              className={`card ${s.is_active ? 'card-accent-teal' : 'card-accent-red'}`}
              style={{ padding: '1.25rem 1.35rem' }}
              variants={cardVariant}
              whileHover={{ y: -3, boxShadow: 'var(--shadow-lg)' }}
            >
              {/* Avatar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '1rem' }}>
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: s.is_active ? 'var(--accent-teal-dim)' : 'var(--accent-red-dim)',
                  border: `2px solid ${s.is_active ? 'var(--accent-teal)' : 'var(--accent-red)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 800,
                  fontSize: '1.2rem',
                  color: s.is_active ? 'var(--accent-teal)' : 'var(--accent-red)',
                  flexShrink: 0,
                }}>
                  {s.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.name}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: "'DM Mono', monospace", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.email}
                  </div>
                </div>
                <span className={`badge ${s.is_active ? 'badge-cash' : 'badge-danger'}`}>
                  {s.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              {/* Details */}
              <div style={{ display: 'grid', gap: '0.4rem' }}>
                {[
                  { label: 'Role',    value: 'Shopkeeper' },
                  { label: 'Joined',  value: new Date(s.created_at).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' }) },
                ].map(r => (
                  <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                    <span style={{ fontFamily: "'Barlow Condensed'", fontWeight: 700, fontSize: '0.73rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      {r.label}
                    </span>
                    <span style={{ color: 'var(--text-secondary)', fontFamily: "'DM Mono', monospace" }}>{r.value}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Create modal */}
      <Modal open={modal} onClose={() => { setModal(false); setForm({ name: '', email: '', password: '' }); }} title="➕ Add Shopkeeper">
        <div className="form-group">
          <label className="form-label">Full Name</label>
          <input className="form-input" placeholder="Jane Wanjiku" value={form.name} onChange={set('name')} autoFocus />
        </div>
        <div className="form-group">
          <label className="form-label">Email Address</label>
          <input className="form-input" type="email" placeholder="jane@shop.com" value={form.email} onChange={set('email')} />
        </div>
        <div className="form-group">
          <label className="form-label">Password</label>
          <div style={{ position: 'relative' }}>
            <input
              className="form-input"
              type={showPwd ? 'text' : 'password'}
              placeholder="Min 6 characters"
              value={form.password}
              onChange={set('password')}
              style={{ paddingRight: '2.5rem' }}
            />
            <button
              onClick={() => setShowPwd(v => !v)}
              style={{
                position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '0.8rem', color: 'var(--text-muted)',
                fontFamily: "'Barlow Condensed'", fontWeight: 700, letterSpacing: '0.06em',
              }}
            >
              {showPwd ? 'HIDE' : 'SHOW'}
            </button>
          </div>
          {form.password && form.password.length < 6 && (
            <div style={{ fontSize: '0.75rem', color: 'var(--accent-red)', marginTop: '0.3rem' }}>
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
        }}>
          <span style={{ flexShrink: 0 }}>ℹ</span>
          <span>This account will have shopkeeper access: can open/close days, record sales, manage debts and restock products.</span>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={() => setModal(false)} disabled={submitting}>Cancel</button>
          <button className="btn btn-primary" onClick={handleCreate} disabled={submitting}>
            {submitting ? 'Creating…' : 'Create Account'}
          </button>
        </div>
      </Modal>
    </div>
  );
}