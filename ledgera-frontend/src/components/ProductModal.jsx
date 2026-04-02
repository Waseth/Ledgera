import { useState } from 'react';
import Modal from './Modal';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';

const UNITS = ['piece', 'kg', 'litre', 'packet', 'box', 'bundle', 'pair'];

export default function ProductModal({ open, onClose, onSuccess }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: '', quantity: '', buying_price: '', selling_price: '', unit: 'piece',
  });
  const [loading, setLoading] = useState(false);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.name || !form.quantity || !form.buying_price || !form.selling_price) {
      toast('All fields are required.', 'warning');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/products', {
        name: form.name.trim(),
        quantity: parseInt(form.quantity),
        buying_price: parseFloat(form.buying_price),
        selling_price: parseFloat(form.selling_price),
        unit: form.unit,
      });
      toast(res.message || 'Product saved!', 'success');
      setForm({ name: '', quantity: '', buying_price: '', selling_price: '', unit: 'piece' });
      onSuccess?.();
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const margin = form.buying_price && form.selling_price
    ? (((parseFloat(form.selling_price) - parseFloat(form.buying_price)) / parseFloat(form.selling_price)) * 100).toFixed(1)
    : null;

  return (
    <Modal open={open} onClose={onClose} title="➕ Add / Restock Product">
      <div className="form-group">
        <label className="form-label">Product Name</label>
        <input className="form-input" placeholder="e.g. Sugar" value={form.name} onChange={set('name')} autoFocus />
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
          If this product already exists, its stock will be increased.
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Quantity</label>
          <input className="form-input" type="number" min="0" placeholder="0" value={form.quantity} onChange={set('quantity')} />
        </div>
        <div className="form-group">
          <label className="form-label">Unit</label>
          <select className="form-select" value={form.unit} onChange={set('unit')}>
            {UNITS.map(u => <option key={u}>{u}</option>)}
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Buying Price (KSh)</label>
          <input className="form-input" type="number" min="0" step="0.01" placeholder="0.00" value={form.buying_price} onChange={set('buying_price')}
            style={{ fontFamily: "'DM Mono', monospace" }} />
        </div>
        <div className="form-group">
          <label className="form-label">Selling Price (KSh)</label>
          <input className="form-input" type="number" min="0" step="0.01" placeholder="0.00" value={form.selling_price} onChange={set('selling_price')}
            style={{ fontFamily: "'DM Mono', monospace" }} />
        </div>
      </div>

      {/* Live margin preview */}
      {margin !== null && (
        <div style={{
          background: parseFloat(margin) > 0 ? 'var(--accent-green-dim)' : 'var(--accent-red-dim)',
          border: `1px solid ${parseFloat(margin) > 0 ? 'var(--accent-green)' : 'var(--accent-red)'}`,
          borderRadius: 6, padding: '0.55rem 0.875rem',
          marginBottom: '1rem',
          display: 'flex', justifyContent: 'space-between',
        }}>
          <span style={{ fontFamily: "'Barlow Condensed'", fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
            Profit Margin
          </span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 500, color: parseFloat(margin) > 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
            {margin}%
          </span>
        </div>
      )}

      <div className="modal-footer">
        <button className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
          {loading ? 'Saving…' : 'Save Product'}
        </button>
      </div>
    </Modal>
  );
}