import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import ProductModal from '../components/ProductModal';

const fmt = n => Number(n || 0).toLocaleString('en-KE', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const rowVariant = {
  hidden: { opacity: 0, x: -8 },
  show:   { opacity: 1, x: 0, transition: { duration: 0.28 } },
};

export default function ProductsPage() {
  const { toast } = useToast();
  const [products,  setProducts]  = useState([]);
  const [lowStock,  setLowStock]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [filter,    setFilter]    = useState('all'); // 'all' | 'low'
  const [modal,     setModal]     = useState(false);
  const [sortBy,    setSortBy]    = useState('name'); // 'name' | 'qty' | 'price'
  const [sortDir,   setSortDir]   = useState('asc');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [prods, low] = await Promise.all([
        api.get('/products'),
        api.get('/products/low-stock'),
      ]);

      // 🔍 Debug logs
      console.log('Products API response:', prods);
      console.log('Low stock API response:', low);

      // 🛡️ Safe extraction - ensure products is an array
      let productsArray = [];
      if (Array.isArray(prods)) {
        productsArray = prods;
      } else if (prods && typeof prods === 'object') {
        // Try common response formats
        productsArray = prods.data || prods.products || prods.items || [];
        // If it's a single product object
        if (!Array.isArray(productsArray) && prods.id) {
          productsArray = [prods];
        }
      }

      // 🛡️ Safe extraction for low stock
      let lowStockArray = [];
      if (Array.isArray(low)) {
        lowStockArray = low;
      } else if (low && typeof low === 'object') {
        lowStockArray = low.data || low.products || low.items || [];
        if (!Array.isArray(lowStockArray) && low.id) {
          lowStockArray = [low];
        }
      }

      console.log('Processed products array:', productsArray);
      console.log('Processed low stock array:', lowStockArray);

      setProducts(productsArray);
      setLowStock(lowStockArray);
    } catch (err) {
      console.error('Load error:', err);
      toast(err.message, 'error');
      setProducts([]);
      setLowStock([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  const sortIcon = (col) => {
    if (sortBy !== col) return <span style={{ opacity: 0.3 }}>↕</span>;
    return sortDir === 'asc' ? '↑' : '↓';
  };

  // 🛡️ Safe calculations - ensure products is an array
  const safeProducts = Array.isArray(products) ? products : [];
  const safeLowStock = Array.isArray(lowStock) ? lowStock : [];

  const displayed = safeProducts
    .filter(p => {
      if (filter === 'low') return p.quantity <= 5;
      return true;
    })
    .filter(p => p.name?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let va, vb;
      if (sortBy === 'name')  { va = a.name; vb = b.name; }
      if (sortBy === 'qty')   { va = a.quantity; vb = b.quantity; }
      if (sortBy === 'price') { va = a.selling_price; vb = b.selling_price; }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

  const totalValue = safeProducts.reduce((s, p) => s + (p.selling_price * p.quantity), 0);
  const totalItems = safeProducts.reduce((s, p) => s + p.quantity, 0);

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
            Products
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            {safeProducts.length} products · {totalItems.toLocaleString()} units in stock
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal(true)}>
          ➕ Add / Restock
        </button>
      </motion.div>

      {/* Summary cards */}
      <motion.div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.875rem', marginBottom: '1.5rem' }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
      >
        {[
          { label: 'Total Products',   value: safeProducts.length,      mono: false, color: 'var(--text-primary)' },
          { label: 'Stock Value',      value: `KSh ${fmt(totalValue)}`, mono: true, color: 'var(--accent-teal)' },
          { label: 'Low Stock Alerts', value: safeLowStock.length,      mono: false, color: safeLowStock.length > 0 ? 'var(--accent-red)' : 'var(--accent-green)', accent: safeLowStock.length > 0 ? 'card-accent-red' : 'card-accent-green' },
        ].map((c, i) => (
          <motion.div
            key={c.label}
            className={`card stat-card ${c.accent || ''}`}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 * i }}
            whileHover={{ y: -2, boxShadow: 'var(--shadow-lg)' }}
          >
            <div style={{
              fontFamily: c.mono ? "'DM Mono', monospace" : "'Barlow Condensed', sans-serif",
              fontWeight: 800,
              fontSize: '1.8rem',
              color: c.color,
              lineHeight: 1,
            }}>{c.value}</div>
            <div className="stat-label">{c.label}</div>
          </motion.div>
        ))}
      </motion.div>

      {/* Low stock alert banner */}
      {safeLowStock.length > 0 && (
        <motion.div
          initial={{ opacity: 0, scaleY: 0.85 }}
          animate={{ opacity: 1, scaleY: 1 }}
          style={{ transformOrigin: 'top' }}
        >
          <div style={{
            background: 'var(--accent-red-dim)',
            border: '1.5px solid var(--accent-red)',
            borderRadius: 8,
            padding: '0.75rem 1rem',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            flexWrap: 'wrap',
          }}>
            <span style={{ fontFamily: "'Barlow Condensed'", fontWeight: 700, fontSize: '0.82rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent-red)', flex: 1 }}>
              ⚠ {safeLowStock.length} item{safeLowStock.length > 1 ? 's' : ''} need restocking:
              {' '}{safeLowStock.map(p => p.name).join(', ')}
            </span>
            <button className="btn btn-sm btn-primary" onClick={() => setModal(true)}>Restock Now</button>
          </div>
        </motion.div>
      )}

      {/* Filter + search bar */}
      <div style={{ display: 'flex', gap: '0.65rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="form-input"
          style={{ maxWidth: 260, flex: 1 }}
          placeholder="Search products…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {[
            { key: 'all', label: `All (${safeProducts.length})` },
            { key: 'low', label: `Low Stock (${safeLowStock.length})` },
          ].map(f => (
            <button
              key={f.key}
              className={`btn btn-sm ${filter === f.key ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
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
        <table className="table">
          <thead>
            <tr>
              <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('name')}>
                Product {sortIcon('name')}
              </th>
              <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('qty')}>
                Stock {sortIcon('qty')}
              </th>
              <th>Unit</th>
              <th>Buying (KSh)</th>
              <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('price')}>
                Selling (KSh) {sortIcon('price')}
              </th>
              <th>Margin</th>
              <th>Stock Value</th>
            </tr>
          </thead>
          <motion.tbody variants={container} initial="hidden" animate="show">
            {loading && (
              [...Array(6)].map((_, i) => (
                <tr key={i}>
                  {[...Array(7)].map((__, j) => (
                    <td key={j}><div className="skeleton" style={{ height: 16, width: '80%', borderRadius: 4 }} /></td>
                  ))}
                </tr>
              ))
            )}
            {!loading && displayed.length === 0 && (
              <tr><td colSpan={7}>
                <div className="empty-state">
                  <div className="empty-state-icon">📦</div>
                  <p>{search ? 'No products match your search' : 'No products yet'}</p>
                </div>
              </td></tr>
            )}
            {!loading && displayed.map(p => {
              const margin = p.selling_price > 0
                ? (((p.selling_price - p.buying_price) / p.selling_price) * 100).toFixed(1)
                : '0.0';
              const isLow = p.quantity <= 5;
              return (
                <motion.tr key={p.id} variants={rowVariant} style={isLow ? { background: 'var(--accent-red-dim)' } : {}}>
                  <td style={{ fontWeight: 600 }}>
                    {p.name}
                    {isLow && (
                      <span style={{
                        marginLeft: '0.4rem',
                        background: 'var(--accent-red)',
                        color: '#fff',
                        borderRadius: 3,
                        padding: '1px 6px',
                        fontSize: '0.68rem',
                        fontFamily: "'Barlow Condensed'",
                        fontWeight: 700,
                        letterSpacing: '0.07em',
                        textTransform: 'uppercase',
                        verticalAlign: 'middle',
                      }}>LOW</span>
                    )}
                  </td>
                  <td className="td-mono" style={{ color: isLow ? 'var(--accent-red)' : 'inherit', fontWeight: isLow ? 700 : 400 }}>
                    {p.quantity}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{p.unit}</td>
                  <td className="td-mono">{fmt(p.buying_price)}</td>
                  <td className="td-mono" style={{ fontWeight: 600 }}>{fmt(p.selling_price)}</td>
                  <td>
                    <span style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: '0.8rem',
                      color: parseFloat(margin) > 20 ? 'var(--accent-green)' : parseFloat(margin) > 0 ? 'var(--accent-amber)' : 'var(--accent-red)',
                      fontWeight: 600,
                    }}>
                      {margin}%
                    </span>
                  </td>
                  <td className="td-mono" style={{ color: 'var(--text-secondary)' }}>
                    {fmt(p.selling_price * p.quantity)}
                  </td>
                </motion.tr>
              );
            })}
          </motion.tbody>
        </table>
      </motion.div>

      <ProductModal open={modal} onClose={() => setModal(false)} onSuccess={load} />
    </div>
  );
}