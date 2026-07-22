import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  FiShoppingCart, FiPackage, FiUser, FiPhone, FiDollarSign,
  FiRefreshCw, FiTrendingUp, FiChevronDown, FiUndo, FiX, FiAlertTriangle
} from 'react-icons/fi';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';

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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [undoing, setUndoing] = useState(null);

  // Undo confirmation modal state
  const [undoModal, setUndoModal] = useState({
    isOpen: false,
    saleId: null,
    saleData: null,
    reason: '',
  });

  const [form, setForm] = useState({
    product_id: '',
    quantity_sold: '1',
    payment_type: 'cash',
    customer_name: '',
    customer_phone: '',
    amount_paid: '',
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
    } catch (err) {
      toast(err.message, 'error');
    }
  }, [toast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

    const totalPrice = selectedProduct ? selectedProduct.selling_price * quantity : 0;

    if (form.payment_type === 'debt') {
      if (!form.customer_name.trim() || !form.customer_phone.trim()) {
        toast('Customer name and phone required for debt sales.', 'warning');
        return;
      }

      const amountPaid = parseFloat(form.amount_paid) || 0;
      if (amountPaid < 0) {
        toast('Amount paid cannot be negative.', 'warning');
        return;
      }
      if (amountPaid > totalPrice) {
        toast('Amount paid cannot exceed total price.', 'warning');
        return;
      }
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
        body.amount_paid = parseFloat(form.amount_paid) || 0;
      }

      const res = await api.post('/sales', body);

      const amountPaid = form.payment_type === 'debt' ? parseFloat(form.amount_paid) || 0 : totalPrice;
      const balance = totalPrice - amountPaid;

      if (form.payment_type === 'debt') {
        if (balance > 0) {
          toast(
            `Debt recorded! KSh ${fmt(amountPaid)} paid, Balance: KSh ${fmt(balance)}`,
            'success'
          );
        } else if (balance === 0 && amountPaid > 0) {
          toast(`Debt fully paid! KSh ${fmt(amountPaid)}`, 'success');
        } else {
          toast(`Debt recorded! Full amount KSh ${fmt(totalPrice)} is outstanding.`, 'success');
        }
      } else {
        toast(`Sale recorded! KSh ${fmt(totalPrice)}`, 'success');
      }

      setForm({
        product_id: '',
        quantity_sold: '1',
        payment_type: 'cash',
        customer_name: '',
        customer_phone: '',
        amount_paid: '',
      });

      setIsDropdownOpen(false);
      loadAll();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Open the custom undo confirmation modal
  const openUndoModal = (saleId) => {
    const sale = sales.find(s => s.id === saleId);
    if (sale) {
      setUndoModal({
        isOpen: true,
        saleId: saleId,
        saleData: sale,
        reason: '',
      });
    }
  };

  // Close the undo modal
  const closeUndoModal = () => {
    setUndoModal({
      isOpen: false,
      saleId: null,
      saleData: null,
      reason: '',
    });
  };

  // Handle the undo confirmation
  const confirmUndo = async () => {
    const { saleId, reason } = undoModal;
    if (!saleId) return;

    setUndoing(saleId);
    try {
      await api.post(`/sales/${saleId}/reverse`, { reason: reason.trim() || 'No reason provided' });
      toast('Sale reversed successfully! Stock restored.', 'success');
      closeUndoModal();
      loadAll();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setUndoing(null);
    }
  };

  // Separate revenue tracking
  const todayCashRevenue = Array.isArray(sales)
    ? sales.filter(s => s.payment_type === 'cash').reduce((s, x) => s + x.total_price, 0)
    : 0;

  const todayDebtSales = Array.isArray(sales)
    ? sales.filter(s => s.payment_type === 'debt').reduce((s, x) => s + x.total_price, 0)
    : 0;

  const todayCashProfit = Array.isArray(sales)
    ? sales.filter(s => s.payment_type === 'cash').reduce((s, x) => s + x.profit, 0)
    : 0;

  const todayTotalProfit = Array.isArray(sales)
    ? sales.reduce((s, x) => s + x.profit, 0)
    : 0;

  const todayDebtProfit = todayTotalProfit - todayCashProfit;
  const todayTotalRevenue = todayCashRevenue + todayDebtSales;

  const getSelectedProductName = () => {
    if (!form.product_id) return 'Select a product...';
    const product = products.find(p => p.id === parseInt(form.product_id));
    return product ? `${product.name} - KSh ${product.selling_price}` : 'Select a product...';
  };

  const totalPrice = selectedProduct ? selectedProduct.selling_price * parseInt(form.quantity_sold || 0) : 0;
  const amountPaid = parseFloat(form.amount_paid) || 0;
  const balance = totalPrice - amountPaid;

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
                <div className="stat-label" style={{ fontFamily: 'Poppins, sans-serif' }}>Today's Total Sales</div>
                <div className="stat-value" style={{ fontFamily: 'Poppins, sans-serif' }}>KSh {fmt(todayTotalRevenue)}</div>
              </div>
              <FiDollarSign size={28} color="var(--primary-blue)" style={{ opacity: 0.7 }} />
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}>
          <div className="card stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="stat-label" style={{ fontFamily: 'Poppins, sans-serif' }}>Cash Revenue</div>
                <div className="stat-value" style={{ fontFamily: 'Poppins, sans-serif', color: 'var(--accent-green)' }}>KSh {fmt(todayCashRevenue)}</div>
              </div>
              <FiDollarSign size={28} color="var(--accent-green)" style={{ opacity: 0.7 }} />
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
          <div className="card stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="stat-label" style={{ fontFamily: 'Poppins, sans-serif' }}>Debt Sales</div>
                <div className="stat-value" style={{ fontFamily: 'Poppins, sans-serif', color: 'var(--accent-amber)' }}>KSh {fmt(todayDebtSales)}</div>
              </div>
              <FiUser size={28} color="var(--accent-amber)" style={{ opacity: 0.7 }} />
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 }}>
          <div className="card stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="stat-label" style={{ fontFamily: 'Poppins, sans-serif' }}>Today's Cash Profit</div>
                <div className="stat-value" style={{ fontFamily: 'Poppins, sans-serif', color: 'var(--accent-green)' }}>KSh {fmt(todayCashProfit)}</div>
              </div>
              <FiTrendingUp size={28} color="var(--accent-green)" style={{ opacity: 0.7 }} />
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

          {/* Dropdown - same as before */}
          <div className="form-group" ref={dropdownRef}>
            <label className="form-label" style={{ fontFamily: 'Poppins, sans-serif' }}>Product</label>
            <div
              style={{ position: 'relative', cursor: 'pointer' }}
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <div
                className="form-select"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontFamily: 'Poppins, sans-serif',
                  color: form.product_id ? 'var(--text-primary)' : 'var(--text-muted)',
                  paddingRight: '2.5rem',
                  userSelect: 'none',
                  background: 'var(--bg-surface)',
                  border: '1.5px solid var(--border-medium)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.6rem 0.85rem',
                }}
              >
                <span>{getSelectedProductName()}</span>
                <FiChevronDown
                  size={18}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    top: '50%',
                    transform: `translateY(-50%) ${isDropdownOpen ? 'rotate(180deg)' : ''}`,
                    transition: 'transform 0.2s',
                    color: 'var(--text-muted)'
                  }}
                />
              </div>

              {isDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '0.25rem',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-lg)',
                    maxHeight: '300px',
                    overflowY: 'auto',
                    zIndex: 50,
                  }}
                >
                  <div
                    style={{
                      padding: '0.5rem 0.75rem',
                      cursor: 'pointer',
                      fontFamily: 'Poppins, sans-serif',
                      color: 'var(--text-muted)',
                      fontSize: '0.85rem',
                      borderBottom: '1px solid var(--border-subtle)',
                      background: 'var(--bg-surface)',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      set('product_id')('');
                      setIsDropdownOpen(false);
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--bg-card-hover)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'var(--bg-surface)';
                    }}
                  >
                    Select a product...
                  </div>
                  {Array.isArray(products) && products.map(p => (
                    <div
                      key={p.id}
                      style={{
                        padding: '0.5rem 0.75rem',
                        cursor: 'pointer',
                        fontFamily: 'Poppins, sans-serif',
                        fontSize: '0.85rem',
                        borderBottom: '1px solid var(--border-subtle)',
                        background: parseInt(form.product_id) === p.id ? 'var(--primary-blue-dim)' : 'var(--bg-surface)',
                        transition: 'background 0.15s',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        set('product_id')(String(p.id));
                        setIsDropdownOpen(false);
                      }}
                      onMouseEnter={(e) => {
                        if (parseInt(form.product_id) !== p.id) {
                          e.currentTarget.style.background = 'var(--bg-card-hover)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (parseInt(form.product_id) !== p.id) {
                          e.currentTarget.style.background = 'var(--bg-surface)';
                        }
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: parseInt(form.product_id) === p.id ? 600 : 400, color: 'var(--text-primary)' }}>
                          {p.name}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          KSh {p.selling_price} | Stock: {p.quantity}
                        </span>
                      </div>
                    </div>
                  ))}
                  {Array.isArray(products) && products.length === 0 && (
                    <div style={{
                      padding: '1rem 0.75rem',
                      textAlign: 'center',
                      color: 'var(--text-muted)',
                      fontFamily: 'Poppins, sans-serif',
                      fontSize: '0.85rem',
                      background: 'var(--bg-surface)',
                    }}>
                      No products available
                    </div>
                  )}
                </motion.div>
              )}
            </div>
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
              <span style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)' }}>{selectedProduct.quantity} {selectedProduct.unit}</span>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" style={{ fontFamily: 'Poppins, sans-serif' }}>Quantity</label>
            <input
              className="form-input"
              type="number"
              min="1"
              value={form.quantity_sold}
              onChange={e => {
                set('quantity_sold')(e.target.value);
                if (form.payment_type === 'debt' && selectedProduct) {
                  const total = selectedProduct.selling_price * parseInt(e.target.value || 0);
                  set('amount_paid')(String(total));
                }
              }}
              style={{ fontFamily: 'Poppins, sans-serif' }}
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontFamily: 'Poppins, sans-serif' }}>Payment Type</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className={`btn ${form.payment_type === 'cash' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => {
                  set('payment_type')('cash');
                  set('amount_paid')('');
                  set('customer_name')('');
                  set('customer_phone')('');
                }}
                style={{ flex: 1, fontFamily: 'Poppins, sans-serif', color: form.payment_type === 'cash' ? '#0F172A' : undefined }}
              >
                <FiDollarSign size={14} /> Cash
              </button>
              <button
                className={`btn ${form.payment_type === 'debt' ? 'btn-secondary' : 'btn-outline'}`}
                onClick={() => {
                  set('payment_type')('debt');
                  if (selectedProduct) {
                    const total = selectedProduct.selling_price * parseInt(form.quantity_sold || 0);
                    set('amount_paid')(String(total));
                  }
                }}
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
              <div className="form-group">
                <label className="form-label" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  <FiDollarSign size={12} /> Amount Paid (KSh)
                </label>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount_paid}
                  onChange={e => set('amount_paid')(e.target.value)}
                  placeholder="Enter amount paid (0 for full debt)"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                />
                {selectedProduct && (
                  <div style={{
                    marginTop: '0.5rem',
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                    fontFamily: 'Poppins, sans-serif'
                  }}>
                    <div>Total: <strong style={{ color: 'var(--text-primary)' }}>KSh {fmt(totalPrice)}</strong></div>
                    {balance > 0 ? (
                      <div style={{ color: 'var(--accent-amber)' }}>
                        Balance: <strong>KSh {fmt(balance)}</strong>
                      </div>
                    ) : balance === 0 && amountPaid > 0 ? (
                      <div style={{ color: 'var(--accent-green)' }}>
                        ✓ Fully Paid
                      </div>
                    ) : balance === 0 && amountPaid === 0 ? (
                      <div style={{ color: 'var(--accent-amber)' }}>
                        Full debt recorded
                      </div>
                    ) : amountPaid > totalPrice ? (
                      <div style={{ color: 'var(--accent-red)' }}>
                        ⚠️ Amount exceeds total!
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {selectedProduct && parseInt(form.quantity_sold) > 0 && (
            <div style={{
              marginTop: '1rem',
              padding: '0.75rem',
              background: 'var(--bg-base)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-medium)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontFamily: 'Poppins, sans-serif', color: 'var(--text-primary)' }}>Total Price:</span>
                <span style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, color: 'var(--text-primary)' }}>KSh {fmt(totalPrice)}</span>
              </div>
              {form.payment_type === 'debt' && amountPaid > 0 && amountPaid <= totalPrice && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontFamily: 'Poppins, sans-serif', color: 'var(--text-primary)' }}>Amount Paid:</span>
                  <span style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, color: 'var(--accent-green)' }}>KSh {fmt(amountPaid)}</span>
                </div>
              )}
              {form.payment_type === 'debt' && balance > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontFamily: 'Poppins, sans-serif', color: 'var(--text-primary)' }}>Balance:</span>
                  <span style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, color: 'var(--accent-amber)' }}>KSh {fmt(balance)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'Poppins, sans-serif', color: 'var(--text-primary)' }}>Cash Profit:</span>
                <span style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, color: 'var(--accent-green)' }}>
                  {form.payment_type === 'cash' ? `KSh ${fmt((selectedProduct.selling_price - selectedProduct.buying_price) * parseInt(form.quantity_sold))}` : 'N/A (Debt)'}
                </span>
              </div>
            </div>
          )}

          <button
            className="btn btn-primary"
            onClick={handleSale}
            disabled={
              loading ||
              !form.product_id ||
              (form.payment_type === 'debt' && (!form.customer_name.trim() || !form.customer_phone.trim())) ||
              (form.payment_type === 'debt' && parseFloat(form.amount_paid) < 0) ||
              (form.payment_type === 'debt' && parseFloat(form.amount_paid) > totalPrice)
            }
            style={{ width: '100%', marginTop: '1rem', padding: '0.75rem', fontFamily: 'Poppins, sans-serif', color: '#0F172A' }}
          >
            {loading ? 'Processing...' : form.payment_type === 'debt' ? 'Record Debt' : 'Record Sale'}
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
            <div style={{ minWidth: '750px' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ fontFamily: 'Poppins, sans-serif' }}>Product</th>
                    <th style={{ fontFamily: 'Poppins, sans-serif' }}>Qty</th>
                    <th style={{ fontFamily: 'Poppins, sans-serif' }}>Amount</th>
                    <th style={{ fontFamily: 'Poppins, sans-serif' }}>Profit</th>
                    <th style={{ fontFamily: 'Poppins, sans-serif' }}>Type</th>
                    <th style={{ fontFamily: 'Poppins, sans-serif' }}>Time</th>
                    <th style={{ fontFamily: 'Poppins, sans-serif' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(sales) && sales.length === 0 && (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontFamily: 'Poppins, sans-serif' }}>
                        No sales recorded today
                      </td>
                    </tr>
                  )}
                  {Array.isArray(sales) && sales.map(s => {
                    const canUndo = s.can_undo || false;
                    const undoRemaining = s.undo_remaining || 0;

                    return (
                      <tr key={s.id}>
                        <td style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 500, whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>{s.product_name}</td>
                        <td style={{ fontFamily: 'Poppins, sans-serif', color: 'var(--text-primary)' }}>{s.quantity_sold}</td>
                        <td style={{ fontFamily: 'Poppins, sans-serif', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>KSh {fmt(s.total_price)}</td>
                        <td style={{ fontFamily: 'Poppins, sans-serif', whiteSpace: 'nowrap', color: s.payment_type === 'cash' ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                          {s.payment_type === 'cash' ? `KSh ${fmt(s.profit)}` : '—'}
                        </td>
                        <td>
                          <span className={`badge ${s.payment_type === 'cash' ? 'badge-success' : 'badge-warning'}`} style={{ fontFamily: 'Poppins, sans-serif', whiteSpace: 'nowrap' }}>
                            {s.payment_type === 'cash' ? 'Cash' : 'Debt'}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'Poppins, sans-serif', whiteSpace: 'nowrap' }}>
                          {new Date(s.timestamp).toLocaleTimeString()}
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {canUndo && (
                            <button
                              className="btn btn-warning btn-sm"
                              onClick={() => openUndoModal(s.id)}
                              disabled={undoing === s.id}
                              style={{
                                fontFamily: 'Poppins, sans-serif',
                                padding: '0.25rem 0.5rem',
                                fontSize: '0.7rem',
                                background: '#F59E0B',
                                color: '#1E293B',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: undoing === s.id ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                opacity: undoing === s.id ? 0.6 : 1,
                              }}
                              title={`Undo sale (${undoRemaining}s remaining)`}
                            >
                              <FiUndo size={12} /> {undoing === s.id ? 'Undoing...' : `Undo (${undoRemaining}s)`}
                            </button>
                          )}
                          {s.is_reversed && (
                            <span style={{
                              fontSize: '0.7rem',
                              color: 'var(--accent-red)',
                              fontFamily: 'Poppins, sans-serif',
                              fontWeight: 600
                            }}>
                              REVERSED
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Custom Undo Confirmation Modal */}
      <Modal
        open={undoModal.isOpen}
        onClose={closeUndoModal}
        title="Confirm Undo Sale"
        maxWidth={420}
      >
        {undoModal.saleData && (
          <div>
            {/* Warning Icon */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              marginBottom: '1rem'
            }}>
              <div style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'rgba(245, 158, 11, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <FiAlertTriangle size={28} color="#F59E0B" />
              </div>
            </div>

            <p style={{
              fontFamily: 'Poppins, sans-serif',
              fontSize: '0.9rem',
              color: 'var(--text-primary)',
              textAlign: 'center',
              marginBottom: '1.25rem'
            }}>
              Are you sure you want to undo this sale?
              <br />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                This will restore stock and remove any debt records.
              </span>
            </p>

            {/* Sale Details */}
            <div style={{
              background: 'var(--bg-surface)',
              borderRadius: 8,
              padding: '1rem',
              marginBottom: '1.25rem',
              border: '1px solid var(--border-medium)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Product</span>
                <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: '0.85rem', fontWeight: 600 }}>{undoModal.saleData.product_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Quantity</span>
                <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: '0.85rem', fontWeight: 600 }}>{undoModal.saleData.quantity_sold}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Amount</span>
                <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: '0.85rem', fontWeight: 600 }}>KSh {fmt(undoModal.saleData.total_price)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Payment Type</span>
                <span className={`badge ${undoModal.saleData.payment_type === 'cash' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.7rem' }}>
                  {undoModal.saleData.payment_type === 'cash' ? 'Cash' : 'Debt'}
                </span>
              </div>
            </div>

            {/* Reason Input */}
            <div className="form-group">
              <label className="form-label" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Reason for Reversal (Optional)
              </label>
              <input
                className="form-input"
                type="text"
                value={undoModal.reason}
                onChange={e => setUndoModal(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="e.g., Wrong product, Customer changed mind..."
                style={{ fontFamily: 'Poppins, sans-serif' }}
              />
            </div>

            {/* Warning Text */}
            <div style={{
              fontSize: '0.75rem',
              color: 'var(--accent-amber)',
              fontFamily: 'Poppins, sans-serif',
              marginBottom: '1.25rem',
              padding: '0.5rem',
              background: 'rgba(245, 158, 11, 0.08)',
              borderRadius: '4px',
              textAlign: 'center'
            }}>
              ⚠️ This action cannot be undone. The sale will be permanently reversed.
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-outline"
                onClick={closeUndoModal}
                style={{ fontFamily: 'Poppins, sans-serif' }}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={confirmUndo}
                disabled={undoing === undoModal.saleId}
                style={{
                  fontFamily: 'Poppins, sans-serif',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  opacity: undoing === undoModal.saleId ? 0.6 : 1,
                  cursor: undoing === undoModal.saleId ? 'not-allowed' : 'pointer',
                }}
              >
                {undoing === undoModal.saleId ? (
                  'Processing...'
                ) : (
                  <>
                    <FiUndo size={14} /> Yes, Undo Sale
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>

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