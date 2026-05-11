import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import { FiDollarSign, FiTrendingUp, FiTrendingDown, FiCalendar, FiPieChart } from 'react-icons/fi';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, ReferenceLine
} from 'recharts';
import MonthlyComparison from '../components/MonthlyComparison';

const fmt = n => Number(n || 0).toLocaleString('en-KE', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});

const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.38 } },
};

const TABS = ['Daily', 'Weekly', 'Monthly'];

// Custom tooltip for charts
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

/* Reusable KPI row */
function KpiRow({ rows }) {
  return (
    <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.875rem', marginBottom: '1.5rem' }}>
      {rows.map((r, i) => (
        <motion.div
          key={r.label}
          className={`card stat-card ${r.accent || ''}`}
          variants={item}
          whileHover={{ y: -2, boxShadow: 'var(--shadow-lg)' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-label" style={{ fontFamily: 'Poppins, sans-serif' }}>{r.label}</div>
              <div className="stat-value" style={{
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 700,
                fontSize: '1.6rem',
                color: r.color || 'var(--text-primary)',
                lineHeight: 1.2
              }}>
                {r.value}
              </div>
              {r.sub && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem', fontFamily: 'Poppins, sans-serif' }}>{r.sub}</div>}
            </div>
            {r.icon && <r.icon size={28} style={{ opacity: 0.5, color: r.color || 'var(--text-muted)' }} />}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

export default function ReportsPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState('Daily');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  const load = useCallback(async () => {
    setLoading(true);
    setData(null);
    try {
      let res;
      if (tab === 'Daily') res = await api.get(`/reports/daily?start=${date}`);
      if (tab === 'Weekly') res = await api.get('/reports/weekly');
      if (tab === 'Monthly') res = await api.get(`/reports/monthly?month=${month}`);
      setData(res);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [tab, date, month, toast]);

  useEffect(() => { load(); }, [load]);

  /* ---------- DAILY ---------- */
  const DailyReport = () => {
    if (!data) return null;
    const d = data;
    return (
      <>
        <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <FiCalendar style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={14} />
            <input
              className="form-input"
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              style={{ maxWidth: 200, paddingLeft: '2rem', fontFamily: 'Poppins, sans-serif' }}
            />
          </div>
        </div>
        <motion.div variants={container} initial="hidden" animate="show">
          <KpiRow rows={[
            { label: 'Revenue', value: `KSh ${fmt(d.revenue)}`, color: 'var(--accent-teal)', icon: FiDollarSign },
            { label: 'Gross Profit', value: `KSh ${fmt(d.profit)}`, color: 'var(--accent-green)', icon: FiTrendingUp },
            { label: 'Expenses', value: `KSh ${fmt(d.expenses)}`, color: 'var(--accent-amber)', icon: FiTrendingDown },
            { label: 'Net Profit', value: `KSh ${fmt(d.net_profit)}`, color: d.net_profit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)', icon: FiPieChart },
            { label: 'Cash Sales', value: `KSh ${fmt(d.cash_revenue)}`, color: 'var(--primary-blue)' },
            { label: 'Debt Sales', value: `KSh ${fmt(d.debt_revenue)}`, color: 'var(--accent-amber)' },
            { label: 'Total Sales', value: d.sale_count, color: 'var(--text-primary)' },
          ]} />
        </motion.div>
      </>
    );
  };

  /* ---------- WEEKLY ---------- */
  const WeeklyReport = () => {
    if (!data) return null;
    const d = data;
    const chartData = (d.daily_breakdown || []).map(r => ({
      date: new Date(r.date).toLocaleDateString('en-US', { weekday: 'short' }),
      fullDate: r.date,
      revenue: r.revenue,
      profit: r.profit,
      sales: r.sale_count,
    }));

    const dateRange = d.start && d.end ? `${d.start} → ${d.end}` : 'Current Week';

    return (
      <motion.div variants={container} initial="hidden" animate="show">
        <KpiRow rows={[
          { label: 'Week Revenue', value: `KSh ${fmt(d.total_revenue || 0)}`, color: 'var(--accent-teal)', icon: FiDollarSign },
          { label: 'Week Profit', value: `KSh ${fmt(d.total_profit || 0)}`, color: 'var(--accent-green)', icon: FiTrendingUp },
          { label: 'Week Expenses', value: `KSh ${fmt(d.total_expenses || 0)}`, color: 'var(--accent-amber)' },
          { label: 'Net Profit', value: `KSh ${fmt(d.net_profit || 0)}`, color: d.net_profit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)', icon: FiPieChart },
          { label: 'Total Sales', value: d.sale_count || 0, sub: dateRange },
        ]} />

        <motion.div variants={item}>
          <div className="section-header" style={{
            fontFamily: 'Poppins, sans-serif',
            fontWeight: 700,
            fontSize: '1rem',
            textAlign: 'center',
            justifyContent: 'center',
            marginBottom: '1rem'
          }}>
            Revenue & Profit Trend
          </div>
          <div className="chart-container" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent-teal)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--accent-teal)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent-green)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--accent-green)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="date" tick={{ fontFamily: 'Poppins, sans-serif', fontSize: 11, fill: 'var(--text-muted)' }} />
                <YAxis tick={{ fontFamily: 'Poppins, sans-serif', fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="revenue" stroke="var(--accent-teal)" fill="url(#revenueGradient)" strokeWidth={2} />
                <Area type="monotone" dataKey="profit" stroke="var(--accent-green)" fill="url(#profitGradient)" strokeWidth={2} />
                <Line type="monotone" dataKey="revenue" stroke="var(--accent-teal)" strokeWidth={2} dot={{ r: 4, fill: 'var(--accent-teal)' }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="profit" stroke="var(--accent-green)" strokeWidth={2} dot={{ r: 4, fill: 'var(--accent-green)' }} />
              </ComposedChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.75rem', justifyContent: 'center' }}>
              {[{ color: 'var(--accent-teal)', label: 'Revenue' }, { color: 'var(--accent-green)', label: 'Profit' }].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} />
                  <span style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600 }}>{l.label}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        <motion.div variants={item}>
          <div className="section-header" style={{
            fontFamily: 'Poppins, sans-serif',
            fontWeight: 700,
            fontSize: '1rem',
            textAlign: 'center',
            justifyContent: 'center',
            marginBottom: '1rem'
          }}>
            Day-by-Day Breakdown
          </div>
          <div className="table-wrap" style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: '500px' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ fontFamily: 'Poppins, sans-serif' }}>Date</th>
                    <th style={{ fontFamily: 'Poppins, sans-serif' }}>Revenue (KSh)</th>
                    <th style={{ fontFamily: 'Poppins, sans-serif' }}>Profit (KSh)</th>
                    <th style={{ fontFamily: 'Poppins, sans-serif' }}>Sales</th>
                  </tr>
                </thead>
                <tbody>
                  {(d.daily_breakdown || []).map(r => (
                    <tr key={r.date}>
                      <td style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600 }}>{r.date}</td>
                      <td style={{ fontFamily: 'Poppins, sans-serif', color: 'var(--accent-teal)' }}>{fmt(r.revenue)}</td>
                      <td style={{ fontFamily: 'Poppins, sans-serif', color: 'var(--accent-green)' }}>{fmt(r.profit)}</td>
                      <td style={{ fontFamily: 'Poppins, sans-serif' }}>{r.sale_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      </motion.div>
    );
  };

  /* ---------- MONTHLY ---------- */
  const MonthlyReport = () => {
    if (!data) return null;
    const d = data;

    const dateRange = d.start && d.end ? `${d.start} → ${d.end}` : 'Current Month';

    return (
      <motion.div variants={container} initial="hidden" animate="show">
        <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <FiCalendar style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={14} />
            <input
              className="form-input"
              type="month"
              value={month}
              onChange={e => setMonth(e.target.value)}
              style={{ maxWidth: 200, paddingLeft: '2rem', fontFamily: 'Poppins, sans-serif' }}
            />
          </div>
        </div>

        <KpiRow rows={[
          { label: 'Month Revenue', value: `KSh ${fmt(d.total_revenue || 0)}`, color: 'var(--accent-teal)', icon: FiDollarSign },
          { label: 'Cash Revenue', value: `KSh ${fmt(d.cash_revenue || 0)}`, color: 'var(--accent-green)' },
          { label: 'Debt Revenue', value: `KSh ${fmt(d.debt_revenue || 0)}`, color: 'var(--accent-amber)' },
          { label: 'Gross Profit', value: `KSh ${fmt(d.total_profit || 0)}`, color: 'var(--accent-green)', icon: FiTrendingUp },
          { label: 'Total Expenses', value: `KSh ${fmt(d.total_expenses || 0)}`, color: 'var(--accent-amber)' },
          { label: 'Net Profit', value: `KSh ${fmt(d.net_profit || 0)}`, color: d.net_profit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)', icon: FiPieChart },
          { label: 'Total Sales', value: d.sale_count || 0, sub: dateRange },
        ]} />

        {d.top_products?.length > 0 && (
          <motion.div variants={item}>
            <div className="section-header" style={{
              fontFamily: 'Poppins, sans-serif',
              fontWeight: 700,
              fontSize: '1rem',
              textAlign: 'center',
              justifyContent: 'center',
              marginBottom: '1rem'
            }}>
              Top 5 Products — {d.month || month}
            </div>
            <div className="table-wrap" style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
              <div style={{ minWidth: '600px' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ fontFamily: 'Poppins, sans-serif' }}>Rank</th>
                      <th style={{ fontFamily: 'Poppins, sans-serif' }}>Product</th>
                      <th style={{ fontFamily: 'Poppins, sans-serif' }}>Units Sold</th>
                      <th style={{ fontFamily: 'Poppins, sans-serif' }}>Revenue (KSh)</th>
                      <th style={{ fontFamily: 'Poppins, sans-serif' }}>Profit (KSh)</th>
                      <th style={{ fontFamily: 'Poppins, sans-serif' }}>Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.top_products.map((p, i) => {
                      const margin = p.revenue > 0 ? ((p.profit / p.revenue) * 100).toFixed(1) : '0.0';
                      return (
                        <tr key={p.name}>
                          <td>
                            <span style={{
                              fontFamily: 'Poppins, sans-serif',
                              fontWeight: 800,
                              fontSize: '1rem',
                              color: i === 0 ? 'var(--accent-rust)' : i === 1 ? 'var(--text-secondary)' : 'var(--text-muted)',
                            }}>
                              #{i + 1}
                            </span>
                          </td>
                          <td style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600 }}>{p.name}</td>
                          <td style={{ fontFamily: 'Poppins, sans-serif' }}>{p.units_sold}</td>
                          <td style={{ fontFamily: 'Poppins, sans-serif', color: 'var(--accent-teal)' }}>{fmt(p.revenue)}</td>
                          <td style={{ fontFamily: 'Poppins, sans-serif', color: 'var(--accent-green)' }}>{fmt(p.profit)}</td>
                          <td>
                            <span style={{
                              fontFamily: 'Poppins, sans-serif',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              color: parseFloat(margin) > 20 ? 'var(--accent-green)' : parseFloat(margin) > 0 ? 'var(--accent-amber)' : 'var(--accent-red)',
                            }}>
                              {margin}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="section-header" style={{
              fontFamily: 'Poppins, sans-serif',
              fontWeight: 700,
              fontSize: '1rem',
              textAlign: 'center',
              justifyContent: 'center',
              marginBottom: '1rem'
            }}>
              Top Products by Revenue
            </div>
            <div className="chart-container" style={{ padding: '1.25rem' }}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={d.top_products.map(p => ({
                    name: p.name.length > 12 ? p.name.slice(0, 12) + '…' : p.name,
                    revenue: p.revenue,
                    profit: p.profit
                  }))}
                  layout="vertical"
                  margin={{ top: 4, right: 30, left: 0, bottom: 0 }}
                >
                  <CartesianGrid horizontal={false} stroke="var(--border-subtle)" />
                  <XAxis
                    type="number"
                    tick={{ fontFamily: 'Poppins, sans-serif', fontSize: 10, fill: 'var(--text-muted)' }}
                    tickFormatter={(value) => `KSh ${value.toLocaleString()}`}
                    width={80}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontFamily: 'Poppins, sans-serif', fontSize: 11, fill: 'var(--text-secondary)' }}
                    width={100}
                  />
                  <Bar dataKey="revenue" fill="var(--accent-teal)" radius={[0, 4, 4, 0]} cursor="default" />
                  <Bar dataKey="profit" fill="var(--accent-green)" radius={[0, 4, 4, 0]} opacity={0.75} cursor="default" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}
      </motion.div>
    );
  };

  return (
    <div className="page-wrapper">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: '1.5rem' }}
      >
        <h1 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800, fontSize: '1.9rem', letterSpacing: '0.04em' }}>
          Reports
        </h1>
        <p style={{ fontFamily: 'Poppins, sans-serif', fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
          <FiPieChart size={12} style={{ display: 'inline', marginRight: '0.25rem' }} />
          Financial performance analytics
        </p>
      </motion.div>

      <div style={{
        display: 'flex',
        gap: 0,
        marginBottom: '1.5rem',
        border: '1.5px solid var(--border-medium)',
        borderRadius: 8,
        overflow: 'hidden',
        width: 'fit-content',
      }}>
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontWeight: 700,
              fontSize: '0.85rem',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              padding: '0.55rem 1.25rem',
              border: 'none',
              borderRight: t !== 'Monthly' ? '1px solid var(--border-medium)' : 'none',
              background: tab === t ? 'var(--primary-blue)' : 'transparent',
              color: tab === t ? '#0F172A' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'background 0.18s, color 0.18s',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Monthly Comparison Component */}
      <MonthlyComparison />

      {loading ? (
        <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.875rem' }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 120, borderRadius: 12 }} />
          ))}
        </div>
      ) : (
        <>
          {tab === 'Daily' && <DailyReport />}
          {tab === 'Weekly' && <WeeklyReport />}
          {tab === 'Monthly' && <MonthlyReport />}
        </>
      )}

      <style>{`
        @media (max-width: 768px) {
          .kpi-grid {
            grid-template-columns: 1fr !important;
          }
        }

        .section-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .section-header::after {
          content: '';
          flex: 1;
          height: 1px;
          background: var(--border-medium);
        }

        .section-header::before {
          content: '';
          flex: 1;
          height: 1px;
          background: var(--border-medium);
        }

        .chart-container {
          background: var(--bg-card);
          border-radius: var(--radius-lg);
          border: 1px solid var(--border-medium);
          transition: all var(--transition);
        }

        .chart-container:hover {
          border-color: var(--primary-blue);
          box-shadow: var(--shadow-md);
        }
      `}</style>
    </div>
  );
}