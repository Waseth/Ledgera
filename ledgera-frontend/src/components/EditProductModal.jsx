import { useState, useEffect } from 'react';
import { FiPackage, FiSave, FiX } from 'react-icons/fi';
import Modal from './Modal';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';

const UNITS = ['piece', 'kg', 'litre', 'packet', 'box', 'bundle', 'pair'];

export default function EditProductModal({ open, onClose, product, onSuccess }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: '',
    quantity: '',
    buying_price: '',
    selling_price: '',
    unit: 'piece',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (product && open) {
      setForm({
        name: product.name || '',
        quantity: product.quantity || '',
        buying_price: product.buying_price || '',
        selling_price: product.selling_price || '',
        unit: product.unit || 'piece',
      });
    }
  }, [product, open]);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.name || !form.quantity || !form.buying_price || !form.selling_price) {
      toast('All fields are required.', 'warning');
      return;
    }
    setLoading(true);
    try {
      await api.put(`/products/${product.id}`, {
        name: form.name.trim(),
        quantity: parseInt(form.quantity),
        buying_price: parseFloat(form.buying_price),
        selling_price: parseFloat(form.selling_price),
        unit: form.unit,
      });
      toast('Product updated successfully!', 'success');
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
    <Modal open={open} onClose={onClose} title="Edit Product">
      <div className="form-group">
        <label className="form-label" style={{ fontFamily: 'Poppins, sans-serif' }}>Product Name</label>
        <input
          className="form-input"
          placeholder="Product name"
          value={form.name}
          onChange={set('name')}
          autoFocus
          style={{ fontFamily: 'Poppins, sans-serif' }}
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label" style={{ fontFamily: 'Poppins, sans-serif' }}>Quantity</label>
          <input
            className="form-input"
            type="number"
            min="0"
            placeholder="0"
            value={form.quantity}
            onChange={set('quantity')}
            style={{ fontFamily: 'Poppins, sans-serif' }}
          />
        </div>
        <div className="form-group">
          <label className="form-label" style={{ fontFamily: 'Poppins, sans-serif' }}>Unit</label>
          <select
            className="form-select"
            value={form.unit}
            onChange={set('unit')}
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            {UNITS.map(u => <option key={u}>{u}</option>)}
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label" style={{ fontFamily: 'Poppins, sans-serif' }}>Buying Price (KSh)</label>
          <input
            className="form-input"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={form.buying_price}
            onChange={set('buying_price')}
            style={{ fontFamily: 'Poppins, sans-serif' }}
          />
        </div>
        <div className="form-group">
          <label className="form-label" style={{ fontFamily: 'Poppins, sans-serif' }}>Selling Price (KSh)</label>
          <input
            className="form-input"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={form.selling_price}
            onChange={set('selling_price')}
            style={{ fontFamily: 'Poppins, sans-serif' }}
          />
        </div>
      </div>

      {margin !== null && (
        <div style={{
          background: parseFloat(margin) > 0 ? 'var(--accent-green-dim)' : 'var(--accent-red-dim)',
          border: `1px solid ${parseFloat(margin) > 0 ? 'var(--accent-green)' : 'var(--accent-red)'}`,
          borderRadius: 6, padding: '0.55rem 0.875rem',
          marginBottom: '1rem',
          display: 'flex', justifyContent: 'space-between',
        }}>
          <span style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
            Profit Margin
          </span>
          <span style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 500, color: parseFloat(margin) > 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
            {margin}%
          </span>
        </div>
      )}

      <div className="modal-footer">
        <button
          className="btn btn-outline"
          onClick={onClose}
          disabled={loading}
          style={{ fontFamily: 'Poppins, sans-serif' }}
        >
          Cancel
        </button>
        <button
          className="btn btn-primary"
          onClick={handleSubmit}
          disabled={loading}
          style={{ fontFamily: 'Poppins, sans-serif', color: '#0F172A' }}
        >
          <FiSave size={14} /> {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </Modal>
  );
}