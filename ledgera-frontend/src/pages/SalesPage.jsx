import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import DayModal from '../components/DayModal';
import ProductModal from '../components/ProductModal';

const fmt = n => Number(n || 0).toLocaleString('en-KE', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const rowVariant = {
  hidden: { opacity: 0, x: -10 },
  show:   { opacity: 1, x: 0, transition: { duration: 0.3 } },
};

export default function SalesPage() {
  const { toast } = useToast();
  const lastSubmit = useRef(0);

  const [products,  setProducts]  = useState([]);
  const [sales,     setSales]     = useState([]);
  const [dayStatus, setDayStatus] = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [dayModal,  setDayModal]  = useState(null);
  const [prodModal, setProdModal] = useState(false);

  const [form, setForm] = useState({
    product_id: '',
    quantity_sold: 1,
    payment_type: 'cash',
    customer_name: '',
    customer_phone: '',
  });
  const [lastSale, setLastSale] = useState(null);

  const set = k => v => setForm(f => ({ ...f, [k]: v }));

  const loadAll = useCallback(async () => {
    try {
      const [prods, s, day] = await Promise.all([
        api.get('/products'),
        api.get('/sales/today'),
        api.get('/days/status'),
      ]);

      // 🔍 DEBUG LOGS
      console.log('RAW PRODUCTS RESPONSE:', prods);
      console.log('RAW SALES RESPONSE:', s);
      console.log('RAW DAY STATUS RESPONSE:', day);

      setProducts(prods);
      setSales(s);
      setDayStatus(day);

      // 🛡️ Safe check
      if (Array.isArray(prods) && prods.length > 0 && !form.product_id) {
        setForm(f => ({ ...f, product_id: prods[0].id }));
      }

    } catch (err) {
      toast(err.message, 'error');
    }
  }, []); // eslint-disable-line

  useEffect(() => { loadAll(); }, [loadAll]);

  // 🛡️ Prevent crash if products is not an array
  const selectedProduct = Array.isArray(products)
    ? products.find(p => p.id === parseInt(form.product_id))
    : null;

  const handleSale = async () => {
    const now = Date.now();
    if (now - lastSubmit.current < 1500) return;
    lastSubmit.current = now;

    if (!form.product_id) { toast('Select a product.', 'warning'); return; }
    if (form.quantity_sold < 1) { toast('Quantity must be at least 1.', 'warning'); return; }
    if (dayStatus?.status !== 'open') {
      toast('No open day. Open a day first.', 'warning');
      return;
    }
    if (form.payment_type === 'debt' && (!form.customer_name.trim() || !form.customer_phone.trim())) {
      toast('Customer name and phone required for debt sales.', 'warning');
      return;
    }

    setLoading(true);
    try {
      const body = {
        product_id:    parseInt(form.product_id),
        quantity_sold: parseInt(form.quantity_sold),
        payment_type:  form.payment_type,
      };
      if (form.payment_type === 'debt') {
        body.customer_name  = form.customer_name.trim();
        body.customer_phone = form.customer_phone.trim();
      }
      const res = await api.post('/sales', body);
      setLastSale(res);
      toast(`Sale recorded! KSh ${fmt(res.total_price)}`, 'success');

      setForm(f => ({ ...f, quantity_sold: 1, customer_name: '', customer_phone: '' }));
      loadAll();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const todayRevenue = Array.isArray(sales)
    ? sales.reduce((s, x) => s + x.total_price, 0)
    : 0;

  const todayProfit  = Array.isArray(sales)
    ? sales.reduce((s, x) => s + x.profit, 0)
    : 0;

  return (
    <div className="page-wrapper">

      {dayStatus && dayStatus.status !== 'open' && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: 'var(--accent-amber-dim)',
            border: '1.5px solid var(--accent-amber)',
            borderRadius: 8,
            padding: '0.75rem 1rem',
            marginBottom: '1.25rem',
            display: 'flex',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <span>⚠ {dayStatus.status === 'no_day' ? 'No day open — open a day to start recording sales' : 'Day is closed'}</span>
          <button className="btn btn-sm btn-teal" onClick={() => setDayModal('open')}>Open Day</button>
        </motion.div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem', marginBottom: '1.5rem' }}>
        <div className="card stat-card card-accent-teal">
          <div>KSh {fmt(todayRevenue)}</div>
          <div>Today's Revenue</div>
        </div>
        <div className="card stat-card card-accent-green">
          <div>KSh {fmt(todayProfit)}</div>
          <div>Today's Profit</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '1.25rem' }}>

        <div className="card" style={{ padding: '1.5rem' }}>
          <div>Record Sale</div>

          <select value={form.product_id} onChange={e => set('product_id')(e.target.value)}>
            {Array.isArray(products) && products.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {selectedProduct && (
            <div>
              Stock: {selectedProduct.quantity}
            </div>
          )}

          <input
            type="number"
            value={form.quantity_sold}
            onChange={e => set('quantity_sold')(parseInt(e.target.value) || 1)}
          />

          <button onClick={handleSale} disabled={loading}>
            {loading ? 'Processing...' : 'Record Sale'}
          </button>
        </div>

        <div>
          <div>Today's Sales ({Array.isArray(sales) ? sales.length : 0})</div>

          <table>
            <tbody>
              {Array.isArray(sales) && sales.map(s => (
                <tr key={s.id}>
                  <td>{s.product_name}</td>
                  <td>{s.quantity_sold}</td>
                  <td>KSh {fmt(s.total_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <DayModal mode={dayModal} onClose={() => setDayModal(null)} onSuccess={loadAll} />
      <ProductModal open={prodModal} onClose={() => setProdModal(false)} onSuccess={loadAll} />
    </div>
  );
}