import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  FiShoppingCart, FiPackage, FiUser, FiPhone, FiDollarSign,
  FiRefreshCw, FiTrendingUp
} from 'react-icons/fi';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

const fmt = n => Number(n || 0).toLocaleString('en-KE', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});

export default function SalesPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const lastSubmit = useRef(0);

  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    product_id: '',
    quantity_sold: '1',
    payment_type: 'cash',
    customer_name: '',
    customer_phone: '',
  });

  const set = k => v => setForm(f => ({ ...f, [k]: v }));

  const loadAll = useCallback(async () => {
    try {
      const [prods, s] = await Promise.all([
        api.get('/products'),
        api.get('/sales/today'),
      ]);
      setProducts(prods);
      setSales(s);

      if (prods.length > 0 && !form.product_id) {
        setForm(f => ({ ...f, product_id: prods[0].id }));
      }
    } catch (err) {
      toast(err.message, 'error');
    }
  }, [toast, form.product_id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const selectedProduct = Array.isArray(products)
    ? products.find(p => p.id === parseInt(form.product_id))
    : null;

  const handleSale = async () => {
    const now = Date.now();
    if (now - lastSubmit.current < 1500) return;
    lastSubmit.current = now;

    const quantity = parseInt(form.quantity_sold);

    if (!form.product_id) {
      toast('Select a product.', 'warning');
      return;
    }

    if (!quantity || quantity < 1) {
      toast('Quantity must be at least 1.', 'warning');
      return;
    }

    if (form.payment_type === 'debt' && (!form.customer_name.trim() || !form.customer_phone.trim())) {
      toast('Customer name and phone required for debt sales.', 'warning');
      return;
    }

    setLoading(true);
    try {
      const body = {
        product_id: parseInt(form.product_id),
        quantity_sold: quantity,
        payment_type: form.payment_type,
      };

      if (form.payment_type === 'debt') {
        body.customer_name = form.customer_name.trim();
        body.customer_phone = form.customer_phone.trim();
      }

      const res = await api.post('/sales', body);

      toast(`Sale recorded! KSh ${fmt(res.total_price)}`, 'success');

      setForm(f => ({
        ...f,
        quantity_sold: '1',
        customer_name: '',
        customer_phone: ''
      }));

      loadAll();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const todayRevenue = Array.isArray(sales) ? sales.reduce((s, x) => s + x.total_price, 0) : 0;
  const todayProfit = Array.isArray(sales) ? sales.reduce((s, x) => s + x.profit, 0) : 0;

  return (
    <div className="page-wrapper">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}
      >
        <div>
          <h1 style={{ fontFamily: 'Poppins, sans-serif', fontSize: '1.75rem', fontWeight: 700 }}>Point of Sale</h1>
          <p style={{ fontFamily: 'Poppins, sans-serif', color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Record sales and manage transactions
          </p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={loadAll}>
          <FiRefreshCw size={14} /> Refresh
        </button>
      </motion.div>

      {/* KPI Cards */}
      <motion.div
        className="kpi-grid"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ staggerChildren: 0.1 }}
        style={{ marginBottom: '1.5rem' }}
      >
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
          <div className="card stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="stat-label" style={{ fontFamily: 'Poppins, sans-serif' }}>Today's Revenue</div>
                <div className="stat-value" style={{ fontFamily: 'Poppins, sans-serif' }}>KSh {fmt(todayRevenue)}</div>
              </div>
              <FiDollarSign size={28} color="var(--primary-blue)" style={{ opacity: 0.7 }} />
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
          <div className="card stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="stat-label" style={{ fontFamily: 'Poppins, sans-serif' }}>Today's Profit</div>
                <div className="stat-value" style={{ fontFamily: 'Poppins, sans-serif' }}>KSh {fmt(todayProfit)}</div>
              </div>
              <FiTrendingUp size={28} color="var(--accent-green)" style={{ opacity: 0.7 }} />
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
          <div className="card stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="stat-label" style={{ fontFamily: 'Poppins, sans-serif' }}>Total Sales</div>
                <div className="stat-value" style={{ fontFamily: 'Poppins, sans-serif' }}>{Array.isArray(sales) ? sales.length : 0}</div>
              </div>
              <FiShoppingCart size={28} color="var(--accent-teal)" style={{ opacity: 0.7 }} />
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Main Grid */}
      <div className="sales-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '1.5rem', marginTop: '1.5rem' }}>

        {/* New Sale Form */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="card"
          style={{ padding: '1.5rem' }}
        >
          <h3 style={{ fontFamily: 'Poppins, sans-serif', fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FiShoppingCart size={18} /> New Sale
          </h3>

          <div className="form-group">
            <label className="form-label" style={{ fontFamily: 'Poppins, sans-serif' }}>Product</label>
            <select
              className="form-select"
              value={form.product_id}
              onChange={e => set('product_id')(e.target.value)}
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              <option value="">Select a product...</option>
              {Array.isArray(products) && products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} - KSh {p.selling_price} (Stock: {p.quantity} {p.unit})
                </option>
              ))}
            </select>
          </div>

          {selectedProduct && (
            <div style={{
              background: 'var(--primary-blue-dim)',
              borderRadius: 'var(--radius-md)',
              padding: '0.75rem',
              marginBottom: '1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Available Stock</span>
              <span style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '1rem' }}>{selectedProduct.quantity} {selectedProduct.unit}</span>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" style={{ fontFamily: 'Poppins, sans-serif' }}>Quantity</label>
            <input
              className="form-input"
              type="number"
              min="1"
              value={form.quantity_sold}
              onChange={e => set('quantity_sold')(e.target.value)}
              style={{ fontFamily: 'Poppins, sans-serif' }}
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontFamily: 'Poppins, sans-serif' }}>Payment Type</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className={`btn ${form.payment_type === 'cash' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => set('payment_type')('cash')}
                style={{ flex: 1, fontFamily: 'Poppins, sans-serif', color: '#0F172A' }}
              >
                <FiDollarSign size={14} /> Cash
              </button>
              <button
                className={`btn ${form.payment_type === 'debt' ? 'btn-secondary' : 'btn-outline'}`}
                onClick={() => set('payment_type')('debt')}
                style={{ flex: 1, fontFamily: 'Poppins, sans-serif' }}
              >
                <FiUser size={14} /> Debt
              </button>
            </div>
          </div>

          {form.payment_type === 'debt' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.3 }}
            >
              <div className="form-group">
                <label className="form-label" style={{ fontFamily: 'Poppins, sans-serif' }}><FiUser size={12} /> Customer Name</label>
                <input
                  className="form-input"
                  value={form.customer_name}
                  onChange={e => set('customer_name')(e.target.value)}
                  placeholder="Enter customer name"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontFamily: 'Poppins, sans-serif' }}><FiPhone size={12} /> Phone Number</label>
                <input
                  className="form-input"
                  value={form.customer_phone}
                  onChange={e => set('customer_phone')(e.target.value)}
                  placeholder="e.g., 0712345678"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                />
              </div>
            </motion.div>
          )}

          {selectedProduct && parseInt(form.quantity_sold) > 0 && (
            <div style={{
              marginTop: '1rem',
              padding: '0.75rem',
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-medium)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontFamily: 'Poppins, sans-serif' }}>Total Price:</span>
                <span style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700 }}>KSh {fmt(selectedProduct.selling_price * parseInt(form.quantity_sold))}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'Poppins, sans-serif' }}>Profit:</span>
                <span style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, color: 'var(--accent-green)' }}>
                  KSh {fmt((selectedProduct.selling_price - selectedProduct.buying_price) * parseInt(form.quantity_sold))}
                </span>
              </div>
            </div>
          )}

          <button
            className="btn btn-primary"
            onClick={handleSale}
            disabled={loading}
            style={{ width: '100%', marginTop: '1rem', padding: '0.75rem', fontFamily: 'Poppins, sans-serif', color: '#0F172A' }}
          >
            {loading ? 'Processing...' : 'Record Sale'}
          </button>
        </motion.div>

        {/* Recent Sales Table */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className="card"
          style={{ padding: '1.5rem', overflow: 'hidden' }}
        >
          <h3 style={{ fontFamily: 'Poppins, sans-serif', fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FiPackage size={18} /> Recent Sales
          </h3>

          <div style={{
            overflowX: 'auto',
            overflowY: 'visible',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'thin',
          }}>
            <div style={{ minWidth: '500px' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ fontFamily: 'Poppins, sans-serif' }}>Product</th>
                    <th style={{ fontFamily: 'Poppins, sans-serif' }}>Qty</th>
                    <th style={{ fontFamily: 'Poppins, sans-serif' }}>Amount</th>
                    <th style={{ fontFamily: 'Poppins, sans-serif' }}>Type</th>
                    <th style={{ fontFamily: 'Poppins, sans-serif' }}>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(sales) && sales.length === 0 && (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontFamily: 'Poppins, sans-serif' }}>
                        No sales recorded today
                      </td>
                    </tr>
                  )}
                  {Array.isArray(sales) && sales.map(s => (
                    <tr key={s.id}>
                      <td style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 500, whiteSpace: 'nowrap' }}>{s.product_name}</td>
                      <td style={{ fontFamily: 'Poppins, sans-serif' }}>{s.quantity_sold}</td>
                      <td style={{ fontFamily: 'Poppins, sans-serif', whiteSpace: 'nowrap' }}>KSh {fmt(s.total_price)}</td>
                      <td>
                        <span className={`badge ${s.payment_type === 'cash' ? 'badge-success' : 'badge-warning'}`} style={{ fontFamily: 'Poppins, sans-serif', whiteSpace: 'nowrap' }}>
                          {s.payment_type === 'cash' ? 'Cash' : 'Debt'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'Poppins, sans-serif', whiteSpace: 'nowrap' }}>
                        {new Date(s.timestamp).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Responsive CSS */}
      <style>{`
        @media (max-width: 768px) {
          .sales-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}