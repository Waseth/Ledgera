import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { FiBox, FiPackage, FiAlertCircle, FiRefreshCw, FiSearch, FiEdit2, FiPlus, FiTrash2 } from 'react-icons/fi';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

import ProductModal from '../components/ProductModal';
import EditProductModal from '../components/EditProductModal';
import Modal from '../components/Modal';

const fmt = n => Number(n || 0).toLocaleString('en-KE', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const rowVariant = {
  hidden: { opacity: 0, x: -8 },
  show: { opacity: 1, x: 0, transition: { duration: 0.28 } },
};

export default function ProductsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [modal, setModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const isAdmin = user?.role === 'admin';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [prods, low] = await Promise.all([
        api.get('/products'),
        api.get('/products/low-stock'),
      ]);
      setProducts(Array.isArray(prods) ? prods : []);
      setLowStock(Array.isArray(low) ? low : []);
    } catch (err) {
      toast(err.message, 'error');
      setProducts([]);
      setLowStock([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const handleEdit = (product) => {
    setSelectedProduct(product);
    setEditModal(true);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    try {
      await api.delete(`/products/${deleteConfirm.id}`);
      toast(`Product "${deleteConfirm.name}" deleted successfully!`, 'success');
      setDeleteConfirm(null);
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const safeProducts = Array.isArray(products) ? products : [];
  const safeLowStock = Array.isArray(lowStock) ? lowStock : [];

  const displayed = safeProducts
    .filter(p => {
      if (filter === 'low') return p.quantity <= 5;
      return true;
    })
    .filter(p => p.name?.toLowerCase().includes(search.toLowerCase()));

  const totalValue = safeProducts.reduce((s, p) => s + (p.selling_price * p.quantity), 0);
  const totalItems = safeProducts.reduce((s, p) => s + p.quantity, 0);

  return (
    <div className="page-wrapper">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.875rem', marginBottom: '1.5rem' }}
      >
        <div>
          <h1 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800, fontSize: '1.9rem', letterSpacing: '0.04em' }}>
            Products
          </h1>
          <p style={{ fontFamily: 'Poppins, sans-serif', fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            <FiPackage size={12} style={{ display: 'inline', marginRight: '0.25rem' }} />
            {safeProducts.length} products · {totalItems.toLocaleString()} units in stock
          </p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setModal(true)} style={{ color: '#0F172A' }}>
            <FiPlus size={14} /> Add Product
          </button>
        )}
      </motion.div>

      {/* Responsive KPI Cards */}
      <motion.div
        className="kpi-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '0.875rem',
          marginBottom: '1.5rem'
        }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
      >
        {[
          { label: 'Total Products', value: safeProducts.length, icon: FiPackage, color: 'var(--text-primary)' },
          { label: 'Stock Value', value: `KSh ${fmt(totalValue)}`, icon: FiPackage, color: 'var(--accent-teal)' },
          { label: 'Low Stock Alerts', value: safeLowStock.length, icon: FiAlertCircle, color: safeLowStock.length > 0 ? 'var(--accent-red)' : 'var(--accent-green)' },
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

      {/* Low Stock Alert */}
      {safeLowStock.length > 0 && (
        <div
          style={{
            background: 'var(--accent-red-dim)',
            border: '1.5px solid var(--accent-red)',
            borderRadius: 8,
            padding: '0.75rem 1rem',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <FiAlertCircle color="var(--accent-red)" size={20} />
          <span style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '0.82rem', color: 'var(--accent-red)', flex: 1 }}>
            {safeLowStock.length} item{safeLowStock.length > 1 ? 's' : ''} need restocking:
            {safeLowStock.map(p => p.name).join(', ')}
          </span>
        </div>
      )}

      {/* Responsive search and filter section */}
      <div style={{
        display: 'flex',
        gap: '0.65rem',
        marginBottom: '1rem',
        flexWrap: 'wrap',
        alignItems: 'center',
        flexDirection: 'row'
      }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 260, minWidth: '180px' }}>
          <FiSearch style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={14} />
          <input
            className="form-input"
            style={{ paddingLeft: '2rem', fontFamily: 'Poppins, sans-serif', width: '100%' }}
            placeholder="Search products..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button
            className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilter('all')}
            style={{ fontFamily: 'Poppins, sans-serif', color: filter === 'all' ? '#0F172A' : undefined }}
          >
            All ({safeProducts.length})
          </button>
          <button
            className={`btn btn-sm ${filter === 'low' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilter('low')}
            style={{ fontFamily: 'Poppins, sans-serif', color: filter === 'low' ? '#0F172A' : undefined }}
          >
            Low Stock ({safeLowStock.length})
          </button>
        </div>
        <button className="btn btn-outline btn-sm" onClick={load} style={{ marginLeft: 'auto' }}>
          <FiRefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Scrollable table wrapper */}
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
                <th style={{ fontFamily: 'Poppins, sans-serif' }}>Product</th>
                <th style={{ fontFamily: 'Poppins, sans-serif' }}>Stock</th>
                <th style={{ fontFamily: 'Poppins, sans-serif' }}>Unit</th>
                <th style={{ fontFamily: 'Poppins, sans-serif' }}>Buying (KSh)</th>
                <th style={{ fontFamily: 'Poppins, sans-serif' }}>Selling (KSh)</th>
                <th style={{ fontFamily: 'Poppins, sans-serif' }}>Margin</th>
                <th style={{ fontFamily: 'Poppins, sans-serif' }}>Stock Value</th>
                {isAdmin && <th style={{ fontFamily: 'Poppins, sans-serif' }}>Actions</th>}
              </tr>
            </thead>
            <motion.tbody variants={container} initial="hidden" animate="show">
              {loading && (
                [...Array(6)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(isAdmin ? 8 : 7)].map((__, j) => (
                      <td key={j}><div className="skeleton" style={{ height: 16, width: '80%', borderRadius: 4 }} /></td>
                    ))}
                  </tr>
                ))
              )}
              {!loading && displayed.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} style={{ textAlign: 'center' }}>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '3rem 1rem',
                      textAlign: 'center',
                    }}>
                      <FiPackage size={48} style={{ opacity: 0.4, marginBottom: '1rem', color: 'var(--text-muted)' }} />
                      <p style={{ fontFamily: 'Poppins, sans-serif', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                        {search ? 'No products match your search' : 'No products yet'}
                      </p>
                      {isAdmin && !search && (
                        <button className="btn btn-primary btn-sm" onClick={() => setModal(true)} style={{ marginTop: '0.5rem', color: '#0F172A' }}>
                          <FiPlus size={14} /> Add Your First Product
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
              {!loading && displayed.map(p => {
                const margin = p.selling_price > 0
                  ? (((p.selling_price - p.buying_price) / p.selling_price) * 100).toFixed(1)
                  : '0.0';
                const isLow = p.quantity <= 5;
                return (
                  <motion.tr key={p.id} variants={rowVariant} style={isLow ? { background: 'var(--accent-red-dim)' } : {}}>
                    <td style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {p.name}
                      {isLow && (
                        <span style={{
                          marginLeft: '0.4rem',
                          background: 'var(--accent-red)',
                          color: '#fff',
                          borderRadius: 3,
                          padding: '1px 6px',
                          fontSize: '0.68rem',
                          fontFamily: 'Poppins, sans-serif',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                        }}>LOW</span>
                      )}
                    </td>
                    <td className="td-mono" style={{ color: isLow ? 'var(--accent-red)' : 'inherit', fontWeight: isLow ? 700 : 400, whiteSpace: 'nowrap' }}>
                      {p.quantity}
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem', fontFamily: 'Poppins, sans-serif', whiteSpace: 'nowrap' }}>{p.unit}</td>
                    <td className="td-mono" style={{ whiteSpace: 'nowrap' }}>{fmt(p.buying_price)}</td>
                    <td className="td-mono" style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{fmt(p.selling_price)}</td>
                    <td>
                      <span style={{
                        fontFamily: 'Poppins, sans-serif',
                        fontSize: '0.8rem',
                        color: parseFloat(margin) > 20 ? 'var(--accent-green)' : parseFloat(margin) > 0 ? 'var(--accent-amber)' : 'var(--accent-red)',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}>
                        {margin}%
                      </span>
                    </td>
                    <td className="td-mono" style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {fmt(p.selling_price * p.quantity)}
                    </td>
                    {isAdmin && (
                      <td style={{ whiteSpace: 'nowrap', display: 'flex', gap: '0.5rem' }}>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => handleEdit(p)}
                          style={{
                            padding: '0.25rem 0.5rem',
                            fontFamily: 'Poppins, sans-serif',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                          }}
                        >
                          <FiEdit2 size={12} /> Edit
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => setDeleteConfirm(p)}
                          style={{
                            padding: '0.25rem 0.5rem',
                            fontFamily: 'Poppins, sans-serif',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                          }}
                        >
                          <FiTrash2 size={12} /> Delete
                        </button>
                      </td>
                    )}
                  </motion.tr>
                );
              })}
            </motion.tbody>
          </table>
        </div>
      </motion.div>

      <ProductModal open={modal} onClose={() => setModal(false)} onSuccess={load} />
      <EditProductModal
        open={editModal}
        onClose={() => { setEditModal(false); setSelectedProduct(null); }}
        product={selectedProduct}
        onSuccess={load}
      />

      {/* Custom Delete Confirmation Modal */}
      <Modal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Confirm Delete"
        maxWidth={400}
      >
        {deleteConfirm && (
          <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'var(--accent-red-dim)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem auto',
            }}>
              <FiTrash2 size={24} color="var(--accent-red)" />
            </div>
            <h3 style={{
              fontFamily: 'Poppins, sans-serif',
              fontWeight: 600,
              fontSize: '1.1rem',
              marginBottom: '0.5rem',
              color: 'var(--text-primary)',
            }}>
              Delete Product?
            </h3>
            <p style={{
              fontFamily: 'Poppins, sans-serif',
              fontSize: '0.85rem',
              color: 'var(--text-muted)',
              marginBottom: '0.5rem',
            }}>
              Are you sure you want to delete <strong style={{ color: 'var(--accent-red)' }}>{deleteConfirm.name}</strong>?
            </p>
            <p style={{
              fontFamily: 'Poppins, sans-serif',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              marginBottom: '1.5rem',
            }}>
              This action cannot be undone. The product will be permanently removed from inventory.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                className="btn btn-outline"
                onClick={() => setDeleteConfirm(null)}
                style={{ fontFamily: 'Poppins, sans-serif' }}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleDelete}
                style={{ fontFamily: 'Poppins, sans-serif' }}
              >
                Yes, Delete
              </button>
            </div>
          </div>
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