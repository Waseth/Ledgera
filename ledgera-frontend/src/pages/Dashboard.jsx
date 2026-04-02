import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  FiDollarSign, FiTrendingUp, FiTrendingDown, FiActivity,
  FiRefreshCw, FiPlus, FiCalendar, FiLock, FiAlertCircle
} from 'react-icons/fi';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, ReferenceLine
} from 'recharts';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import ProductModal from '../components/ProductModal';

const fmt = n => Number(n || 0).toLocaleString('en-KE', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});

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
        <p style={{ fontFamily: 'Poppins, sans-serif', color: 'var(--primary-blue)' }}>Revenue: KSh {fmt(payload[0]?.value)}</p>
        <p style={{ fontFamily: 'Poppins, sans-serif', color: 'var(--accent-green)' }}>Profit: KSh {fmt(payload[1]?.value)}</p>
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [weekly, setWeekly] = useState(null);
  const [loading, setLoading] = useState(true);
  const [prodModal, setProdModal] = useState(false);

  const load = useCallback(async () => {
    try {
      const [dash, wk] = await Promise.all([
        api.get('/reports/dashboard'),
        api.get('/reports/weekly'),
      ]);
      setData(dash);
      setWeekly(wk);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="page-wrapper">
      <div className="kpi-grid">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 120, borderRadius: 'var(--radius-lg)' }} />
        ))}
      </div>
    </div>
  );

  // Prepare chart data with gradient effect
  const chartData = weekly?.daily_breakdown?.map(day => ({
    date: new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' }),
    fullDate: day.date,
    revenue: day.revenue,
    profit: day.profit,
    sales: day.sale_count,
  })) || [];

  // Find today's data point for highlighting
  const todayStr = new Date().toISOString().split('T')[0];
  const todayIndex = chartData.findIndex(d => d.fullDate === todayStr);

  return (
    <div className="page-wrapper">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}
      >
        <div>
          <h1 style={{ fontFamily: 'Poppins, sans-serif', fontSize: '1.75rem', fontWeight: 700 }}>Dashboard</h1>
          <p style={{ fontFamily: 'Poppins, sans-serif', color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button className="btn btn-outline btn-sm" onClick={load}>
            <FiRefreshCw size={14} /> Refresh
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setProdModal(true)}
            style={{ color: '#0F172A' }}
          >
            <FiPlus size={14} /> Add Product
          </button>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <motion.div
        className="kpi-grid"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ staggerChildren: 0.1 }}
      >
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
          <div className="card stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="stat-label" style={{ fontFamily: 'Poppins, sans-serif' }}>Today's Revenue</div>
                <div className="stat-value" style={{ fontFamily: 'Poppins, sans-serif' }}>KSh {fmt(data?.today?.revenue)}</div>
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
                <div className="stat-value" style={{ fontFamily: 'Poppins, sans-serif' }}>KSh {fmt(data?.today?.net_profit)}</div>
              </div>
              <FiTrendingUp size={28} color="var(--accent-green)" style={{ opacity: 0.7 }} />
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
          <div className="card stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="stat-label" style={{ fontFamily: 'Poppins, sans-serif' }}>Week Revenue</div>
                <div className="stat-value" style={{ fontFamily: 'Poppins, sans-serif' }}>KSh {fmt(data?.week?.revenue)}</div>
              </div>
              <FiActivity size={28} color="var(--accent-teal)" style={{ opacity: 0.7 }} />
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}>
          <div className="card stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="stat-label" style={{ fontFamily: 'Poppins, sans-serif' }}>Outstanding Debt</div>
                <div className="stat-value" style={{ fontFamily: 'Poppins, sans-serif' }}>KSh {fmt(data?.outstanding_debt)}</div>
              </div>
              <FiTrendingDown size={28} color="var(--accent-amber)" style={{ opacity: 0.7 }} />
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Revenue & Profit Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
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
              <div style={{ width: 12, height: 12, background: 'var(--primary-blue)', borderRadius: 2 }} />
              <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: '0.7rem' }}>Revenue</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <div style={{ width: 12, height: 12, background: 'var(--accent-green)', borderRadius: 2 }} />
              <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: '0.7rem' }}>Profit</span>
            </div>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--primary-blue)" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="var(--primary-blue)" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--accent-green)" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="var(--accent-green)" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
            <XAxis dataKey="date" tick={{ fontFamily: 'Poppins, sans-serif', fill: 'var(--text-muted)', fontSize: 11 }} />
            <YAxis tick={{ fontFamily: 'Poppins, sans-serif', fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={(v) => `KSh ${(v/1000).toFixed(0)}k`} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="revenue" stroke="var(--primary-blue)" fill="url(#revenueGradient)" strokeWidth={2} />
            <Area type="monotone" dataKey="profit" stroke="var(--accent-green)" fill="url(#profitGradient)" strokeWidth={2} />
            <Line type="monotone" dataKey="revenue" stroke="var(--primary-blue)" strokeWidth={2} dot={{ r: 4, fill: 'var(--primary-blue)' }} activeDot={{ r: 6 }} />
            <Line type="monotone" dataKey="profit" stroke="var(--accent-green)" strokeWidth={2} dot={{ r: 4, fill: 'var(--accent-green)' }} activeDot={{ r: 6 }} />
            {todayIndex >= 0 && (
              <ReferenceLine x={chartData[todayIndex]?.date} stroke="var(--accent-amber)" strokeDasharray="3 3" label={{ value: 'Today', fill: 'var(--accent-amber)', fontSize: 10 }} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Sales Bar Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="chart-container"
        style={{ marginTop: '1.5rem' }}
      >
        <div style={{ marginBottom: '1rem' }}>
          <h3 style={{ fontFamily: 'Poppins, sans-serif', fontSize: '1rem', fontWeight: 600 }}>Daily Sales Count</h3>
          <p style={{ fontFamily: 'Poppins, sans-serif', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Number of transactions per day</p>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
            <XAxis dataKey="date" tick={{ fontFamily: 'Poppins, sans-serif', fill: 'var(--text-muted)', fontSize: 11 }} />
            <YAxis tick={{ fontFamily: 'Poppins, sans-serif', fill: 'var(--text-muted)', fontSize: 11 }} />
            <Tooltip contentStyle={{ fontFamily: 'Poppins, sans-serif' }} />
            <Bar dataKey="sales" fill="var(--accent-teal)" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Low Stock Alert */}
      {data?.low_stock_count > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            marginTop: '1.5rem',
            background: 'var(--accent-red-dim)',
            border: '1px solid var(--accent-red)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <FiAlertCircle color="var(--accent-red)" size={24} />
            <span style={{ fontFamily: 'Poppins, sans-serif' }}>{data.low_stock_count} product(s) need restocking</span>
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setProdModal(true)}
            style={{ color: '#0F172A' }}
          >
            Restock Now
          </button>
        </motion.div>
      )}

      <ProductModal open={prodModal} onClose={() => setProdModal(false)} onSuccess={load} />
    </div>
  );
}