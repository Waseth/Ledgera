import { useState } from 'react';
import { FiDollarSign, FiPlus, FiX, FiTruck, FiWifi, FiDatabase, FiHome, FiZap, FiMoreHorizontal } from 'react-icons/fi';
import Modal from './Modal';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';

const EXPENSE_CATEGORIES = [
  { value: 'transport', label: 'Transport', icon: FiTruck },
  { value: 'wifi', label: 'WiFi / Internet', icon: FiWifi },
  { value: 'database_hosting', label: 'Database Hosting', icon: FiDatabase },
  { value: 'rent', label: 'Rent', icon: FiHome },
  { value: 'electricity', label: 'Electricity', icon: FiZap },
  { value: 'other', label: 'Other', icon: FiMoreHorizontal }
];

export default function ExpenseModal({ open, onClose, onSuccess }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    description: '',
    amount: '',
    category: 'other'
  });
  const [loading, setLoading] = useState(false);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.description.trim()) {
      toast('Please enter a description', 'warning');
      return;
    }
    if (!form.amount || parseFloat(form.amount) <= 0) {
      toast('Please enter a valid amount', 'warning');
      return;
    }

    setLoading(true);
    try {
      await api.post('/expenses', {
        description: form.description.trim(),
        amount: parseFloat(form.amount),
        category: form.category
      });
      toast('Expense added successfully!', 'success');
      setForm({ description: '', amount: '', category: 'other' });
      onSuccess?.();
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const selectedCategory = EXPENSE_CATEGORIES.find(c => c.value === form.category);
  const SelectedIcon = selectedCategory?.icon || FiMoreHorizontal;

  return (
    <Modal open={open} onClose={onClose} title="Add Expense">
      <div className="form-group">
        <label className="form-label" style={{ fontFamily: 'Poppins, sans-serif' }}>Category</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', marginBottom: '0.5rem' }}>
          {EXPENSE_CATEGORIES.map(cat => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.value}
                type="button"
                onClick={() => setForm(f => ({ ...f, category: cat.value }))}
                className={`btn btn-sm ${form.category === cat.value ? 'btn-primary' : 'btn-outline'}`}
                style={{
                  fontFamily: 'Poppins, sans-serif',
                  justifyContent: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  color: form.category === cat.value ? '#0F172A' : undefined
                }}
              >
                <Icon size={14} />
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="form-group">
        <label className="form-label" style={{ fontFamily: 'Poppins, sans-serif' }}>Description</label>
        <input
          className="form-input"
          placeholder={`Enter ${selectedCategory?.label.toLowerCase()} expense details...`}
          value={form.description}
          onChange={set('description')}
          autoFocus
          style={{ fontFamily: 'Poppins, sans-serif' }}
        />
      </div>

      <div className="form-group">
        <label className="form-label" style={{ fontFamily: 'Poppins, sans-serif' }}>Amount (KSh)</label>
        <input
          className="form-input"
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={form.amount}
          onChange={set('amount')}
          style={{ fontFamily: 'Poppins, sans-serif' }}
        />
      </div>

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
          <FiPlus size={14} /> {loading ? 'Adding...' : 'Add Expense'}
        </button>
      </div>
    </Modal>
  );
}