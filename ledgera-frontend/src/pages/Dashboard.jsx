import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  FiDollarSign, FiTrendingUp, FiTrendingDown, FiActivity,
  FiRefreshCw, FiPlus, FiAlertCircle, FiPackage, FiCalendar, FiClock, FiDollarSign as FiExpense,
  FiTruck, FiWifi, FiDatabase, FiHome, FiZap, FiMoreHorizontal, FiBarChart2, FiUser
} from 'react-icons/fi';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, ReferenceLine
} from 'recharts';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import ProductModal from '../components/ProductModal';
import ExpenseModal from '../components/ExpenseModal';

const fmt = n => Number(n || 0).toLocaleString('en-KE', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});

const formatYAxis = (value) => {
  return `KSh ${value.toLocaleString()}`;
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-medium)',
        borderRadius: 'var(--radius-md)',
        padding: '0.5rem 1rem',
        boxShadow: 'var(--shadow-md)',
      }}>
        <p style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, marginBottom: '0.25rem' }}>{label}</p>
        <p style={{ fontFamily: 'Poppins, sans-serif', color: '#3B82F6' }}>Revenue: KSh {fmt(payload[0]?.value)}</p>
        <p style={{ fontFamily: 'Poppins, sans-serif', color: '#F59E0B' }}>Profit: KSh {fmt(payload[1]?.value)}</p>
      </div>
    );
  }
  return null;
};

// Helper function to get expense icon based on category
const getExpenseIcon = (category, size = 16, color = '#EF4444') => {
  const iconProps = { size, color, style: { flexShrink: 0 } };
  switch (category) {
    case 'transport':
      return <FiTruck {...iconProps} />;
    case 'wifi':
      return <FiWifi {...iconProps} />;
    case 'database_hosting':
      return <FiDatabase {...iconProps} />;
    case 'rent':
      return <FiHome {...iconProps} />;
    case 'electricity':
      return <FiZap {...iconProps} />;
    default:
      return <FiMoreHorizontal {...iconProps} />;
  }
};

export default function Dashboard() {
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [weekly, setWeekly] = useState(null);
  const [weeklyByMonth, setWeeklyByMonth] = useState(null);
  const [dailyReport, setDailyReport] = useState(null);
  const [monthlyReport, setMonthlyReport] = useState(null);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [recentExpenses, setRecentExpenses] = useState([]);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(true);
  const [prodModal, setProdModal] = useState(false);
  const [expenseModal, setExpenseModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dash, wk, daily, monthly, low, expenses, weeklyMonth] = await Promise.all([
        api.get('/reports/dashboard'),
        api.get('/reports/weekly'),
        api.get('/reports/daily'),
        api.get('/reports/monthly'),
        api.get('/products/low-stock'),
        api.get('/expenses'),
        api.get(`/reports/weekly-by-month?month=${selectedMonth}`),
      ]);
      setData(dash);
      setWeekly(wk);
      setDailyReport(daily);
      setMonthlyReport(monthly);
      setLowStockProducts(Array.isArray(low) ? low : []);
      setRecentExpenses(Array.isArray(expenses) ? expenses.slice(0, 5) : []);
      setWeeklyByMonth(weeklyMonth);

      const todayTotal = Array.isArray(expenses)
        ? expenses.reduce((sum, e) => sum + e.amount, 0)
        : 0;
      setTotalExpenses(todayTotal);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [toast, selectedMonth]);

  useEffect(() => { load(); }, [load, selectedMonth]);

  if (loading) return (
    <div className="page-wrapper">
      <div className="kpi-grid">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 120, borderRadius: 'var(--radius-lg)' }} />
        ))}
      </div>
    </div>
  );

  const chartData = weekly?.daily_breakdown?.map(day => ({
    date: new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' }),
    fullDate: day.date,
    revenue: day.revenue,
    profit: day.profit,
    sales: day.sale_count,
  })) || [];

  const todayStr = new Date().toISOString().split('T')[0];
  const todayIndex = chartData.findIndex(d => d.fullDate === todayStr);

  const todayExpectedCash = dailyReport?.cash_revenue || 0;
  const monthExpectedCash = monthlyReport?.total_revenue || 0;

  // Debt profit breakdown values
  const todayCashProfit = data?.today?.cash_profit || 0;
  const todayDebtProfit = data?.today?.debt_profit || 0;
  const todayTotalProfit = data?.today?.profit || 0;
  const collectionRate = data?.today?.collection_rate || 0;

  // Handle month change for weekly breakdown
  const handleMonthChange = (e) => {
    setSelectedMonth(e.target.value);
  };

  return (
    <div className="page-wrapper">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}
      >
        <div>
          <h1 style={{ fontFamily: 'Poppins, sans-serif', fontSize: '1.75rem', fontWeight: 700 }}>Admin Dashboard</h1>
          <p style={{ fontFamily: 'Poppins, sans-serif', color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            <FiCalendar size={12} style={{ display: 'inline', marginRight: '0.25rem' }} />
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button className="btn btn-outline btn-sm" onClick={load}>
            <FiRefreshCw size={14} /> Refresh
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setExpenseModal(true)} style={{ color: '#0F172A' }}>
            <FiExpense size={14} /> Add Expense
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setProdModal(true)} style={{ color: '#0F172A' }}>
            <FiPlus size={14} /> Add Product
          </button>
        </div>
      </motion.div>

      {/* Expected Cash Summary Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        style={{ marginBottom: '1.5rem' }}
      >
        <h3 style={{ fontFamily: 'Poppins, sans-serif', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Expected Cash (Based on Sales)
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
          <div className="card stat-card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              <FiDollarSign size={14} style={{ display: 'inline', marginRight: '0.25rem' }} />
              Today's Expected Cash
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#3B82F6' }}>KSh {fmt(todayExpectedCash)}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Cash sales recorded today
            </div>
          </div>
          <div className="card stat-card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              <FiBarChart2 size={14} style={{ display: 'inline', marginRight: '0.25rem' }} />
              Month's Expected Cash
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#10B981' }}>KSh {fmt(monthExpectedCash)}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Total cash sales (current month)
            </div>
          </div>
        </div>
      </motion.div>

      {/* Profit Breakdown Cards - NEW SECTION */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        style={{ marginBottom: '1.5rem' }}
      >
        <h3 style={{ fontFamily: 'Poppins, sans-serif', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Profit Breakdown
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div className="card stat-card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              <FiTrendingUp size={14} style={{ display: 'inline', marginRight: '0.25rem' }} />
              Total Profit
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#10B981' }}>KSh {fmt(todayTotalProfit)}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              From all sales (cash + debt)
            </div>
          </div>
          <div className="card stat-card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              <FiDollarSign size={14} style={{ display: 'inline', marginRight: '0.25rem' }} />
              Cash Profit
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#3B82F6' }}>KSh {fmt(todayCashProfit)}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              From cash sales (collected)
            </div>
          </div>
          <div className="card stat-card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              <FiUser size={14} style={{ display: 'inline', marginRight: '0.25rem' }} />
              Debt Profit
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#F59E0B' }}>KSh {fmt(todayDebtProfit)}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              From debt sales (pending)
            </div>
          </div>
          <div className="card stat-card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              <FiActivity size={14} style={{ display: 'inline', marginRight: '0.25rem' }} />
              Collection Rate
            </div>
            <div style={{
              fontSize: '1.8rem',
              fontWeight: 700,
              color: collectionRate > 70 ? '#10B981' : collectionRate > 30 ? '#F59E0B' : '#EF4444'
            }}>
              {collectionRate}%
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Cash collected vs total sales
            </div>
          </div>
        </div>
      </motion.div>

      {/* KPI Cards with auto-height - Week Revenue card removed from here */}
      <motion.div
        className="kpi-grid"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ staggerChildren: 0.1 }}
        style={{ marginBottom: '1.5rem', alignItems: 'stretch' }}
      >
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} style={{ height: 'auto' }}>
          <div className="card stat-card" style={{ height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="stat-label" style={{ fontFamily: 'Poppins, sans-serif' }}>Today's Revenue</div>
                <div className="stat-value" style={{ fontFamily: 'Poppins, sans-serif' }}>KSh {fmt(data?.today?.revenue)}</div>
              </div>
              <FiDollarSign size={28} color="#3B82F6" style={{ opacity: 0.7 }} />
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} style={{ height: 'auto' }}>
          <div className="card stat-card" style={{ height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="stat-label" style={{ fontFamily: 'Poppins, sans-serif' }}>Today's Expenses</div>
                <div className="stat-value" style={{ fontFamily: 'Poppins, sans-serif', color: '#EF4444' }}>KSh {fmt(totalExpenses)}</div>
              </div>
              <FiExpense size={28} color="#EF4444" style={{ opacity: 0.7 }} />
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} style={{ height: 'auto' }}>
          <div className="card stat-card" style={{ height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="stat-label" style={{ fontFamily: 'Poppins, sans-serif' }}>Today's Net Profit</div>
                <div className="stat-value" style={{ fontFamily: 'Poppins, sans-serif', color: (data?.today?.net_profit - totalExpenses) >= 0 ? '#10B981' : '#EF4444' }}>
                  KSh {fmt((data?.today?.net_profit || 0) - totalExpenses)}
                </div>
              </div>
              <FiTrendingUp size={28} color={(data?.today?.net_profit - totalExpenses) >= 0 ? '#10B981' : '#EF4444'} style={{ opacity: 0.7 }} />
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }} style={{ height: 'auto' }}>
          <div className="card stat-card" style={{ height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="stat-label" style={{ fontFamily: 'Poppins, sans-serif' }}>Outstanding Debt</div>
                <div className="stat-value" style={{ fontFamily: 'Poppins, sans-serif' }}>KSh {fmt(data?.outstanding_debt)}</div>
              </div>
              <FiTrendingDown size={28} color="#F59E0B" style={{ opacity: 0.7 }} />
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Weekly Breakdown by Month (Weeks 1-4) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="card"
        style={{ padding: '1.25rem', marginBottom: '1.5rem' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <h3 style={{ fontFamily: 'Poppins, sans-serif', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FiBarChart2 size={16} /> Weekly Performance by Month
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FiCalendar size={14} color="var(--text-muted)" />
            <input
              type="month"
              className="form-input"
              value={selectedMonth}
              onChange={handleMonthChange}
              style={{ width: '160px', fontFamily: 'Poppins, sans-serif', fontSize: '0.85rem' }}
            />
          </div>
        </div>

        {weeklyByMonth?.weeks && weeklyByMonth.weeks.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem',
            alignItems: 'stretch'
          }}>
            {weeklyByMonth.weeks.map(week => (
              <div
                key={week.week}
                className="stat-card"
                style={{
                  background: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.75rem',
                  border: '1px solid var(--border-medium)',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <div style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  color: 'var(--accent-teal)',
                  borderBottom: '1px solid var(--border-medium)',
                  paddingBottom: '0.4rem',
                  marginBottom: '0.5rem'
                }}>
                  {week.week_name} ({week.start.substring(5)} to {week.end.substring(5)})
                </div>
                <div style={{ fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Revenue:</span>
                    <span style={{ fontWeight: 600, color: '#3B82F6' }}>KSh {fmt(week.total_revenue)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Cash Profit:</span>
                    <span style={{ fontWeight: 600, color: '#3B82F6' }}>KSh {fmt(week.cash_profit || 0)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Debt Profit:</span>
                    <span style={{ fontWeight: 600, color: '#F59E0B' }}>KSh {fmt(week.debt_profit || 0)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Total Profit:</span>
                    <span style={{ fontWeight: 600, color: '#10B981' }}>KSh {fmt(week.total_profit)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Net Profit:</span>
                    <span style={{ fontWeight: 600, color: week.net_profit >= 0 ? '#10B981' : '#EF4444' }}>
                      KSh {fmt(week.net_profit)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Sales:</span>
                    <span style={{ fontWeight: 600 }}>{week.sale_count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
            <p>No data available for {weeklyByMonth?.month_name}</p>
          </div>
        )}
      </motion.div>

      {/* Recent Expenses Section */}
      {recentExpenses.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="card"
          style={{ padding: '1.25rem', marginBottom: '1.5rem' }}
        >
          <h3 style={{ fontFamily: 'Poppins, sans-serif', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FiExpense size={16} /> Recent Expenses
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {recentExpenses.map(expense => (
              <div
                key={expense.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.5rem 0.75rem',
                  background: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-md)',
                  flexWrap: 'wrap',
                  gap: '0.5rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {getExpenseIcon(expense.category, 18, '#EF4444')}
                  <div>
                    <div style={{ fontFamily: 'Poppins, sans-serif', fontSize: '0.85rem', fontWeight: 500 }}>
                      {expense.description}
                    </div>
                    <div style={{ fontFamily: 'Poppins, sans-serif', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {new Date(expense.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div style={{ fontFamily: 'Poppins, sans-serif', fontSize: '0.85rem', fontWeight: 600, color: '#EF4444' }}>
                  KSh {fmt(expense.amount)}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Revenue & Profit Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="chart-container"
        style={{ marginTop: '1.5rem' }}
      >
        <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 style={{ fontFamily: 'Poppins, sans-serif', fontSize: '1rem', fontWeight: 600 }}>Revenue & Profit Trend</h3>
            <p style={{ fontFamily: 'Poppins, sans-serif', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Last 7 days performance</p>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <div style={{ width: 12, height: 12, background: '#3B82F6', borderRadius: 2 }} />
              <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: '0.7rem' }}>Revenue</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <div style={{ width: 12, height: 12, background: '#F59E0B', borderRadius: 2 }} />
              <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: '0.7rem' }}>Profit</span>
            </div>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
            <XAxis dataKey="date" tick={{ fontFamily: 'Poppins, sans-serif', fill: 'var(--text-muted)', fontSize: 11 }} />
            <YAxis
              tick={{ fontFamily: 'Poppins, sans-serif', fill: 'var(--text-muted)', fontSize: 11 }}
              tickFormatter={formatYAxis}
              width={80}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="revenue" stroke="#3B82F6" fill="url(#revenueGradient)" strokeWidth={2} />
            <Area type="monotone" dataKey="profit" stroke="#F59E0B" fill="url(#profitGradient)" strokeWidth={2} />
            <Line type="monotone" dataKey="revenue" stroke="#3B82F6" strokeWidth={2} dot={{ r: 4, fill: '#3B82F6' }} activeDot={{ r: 6 }} />
            <Line type="monotone" dataKey="profit" stroke="#F59E0B" strokeWidth={2} dot={{ r: 4, fill: '#F59E0B' }} activeDot={{ r: 6 }} />
            {todayIndex >= 0 && (
              <ReferenceLine x={chartData[todayIndex]?.date} stroke="#F59E0B" strokeDasharray="3 3" label={{ value: 'Today', fill: '#F59E0B', fontSize: 10 }} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Low Stock Alert */}
      {lowStockProducts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            marginTop: '1.5rem',
            background: 'var(--accent-red-dim)',
            border: '1px solid var(--accent-red)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <FiAlertCircle color="var(--accent-red)" size={24} />
            <span style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600 }}>
              Low Stock Alert - Products need restocking:
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {lowStockProducts.map(product => (
              <div
                key={product.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.5rem 0.75rem',
                  background: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-md)',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FiPackage size={16} color="var(--accent-red)" />
                  <span style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 500 }}>
                    {product.name}
                  </span>
                  <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    ({product.unit})
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: '0.85rem' }}>
                    Stock: <strong style={{ color: 'var(--accent-red)' }}>{product.quantity}</strong> / Threshold: 5
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <ProductModal open={prodModal} onClose={() => setProdModal(false)} onSuccess={load} />
      <ExpenseModal open={expenseModal} onClose={() => setExpenseModal(false)} onSuccess={load} />
    </div>
  );
}