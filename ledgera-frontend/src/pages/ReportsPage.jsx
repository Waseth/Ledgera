import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LineChart, Line,
} from 'recharts';

const fmt = n => Number(n || 0).toLocaleString('en-KE', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});

const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const item = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.38 } },
};

const TABS = ['Daily', 'Weekly', 'Monthly'];

/* Reusable KPI row */
function KpiRow({ rows }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.875rem', marginBottom: '1.5rem' }}>
      {rows.map((r, i) => (
        <motion.div
          key={r.label}
          className={`card stat-card ${r.accent || ''}`}
          variants={item}
          whileHover={{ y: -2, boxShadow: 'var(--shadow-lg)' }}
        >
          <div style={{
            fontFamily: r.mono ? "'DM Mono', monospace" : "'Barlow Condensed', sans-serif",
            fontWeight: r.mono ? 500 : 800,
            fontSize: r.mono ? '1.35rem' : '1.9rem',
            color: r.color || 'var(--text-primary)',
            lineHeight: 1.1,
            wordBreak: 'break-all',
          }}>
            {r.value}
          </div>
          <div className="stat-label" style={{ marginTop: '0.4rem' }}>{r.label}</div>
          {r.sub && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{r.sub}</div>}
        </motion.div>
      ))}
    </div>
  );
}

/* Recharts shared style */
const chartTooltipStyle = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border-medium)',
  borderRadius: 8,
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '0.82rem',
  boxShadow: 'var(--shadow-md)',
};

export default function ReportsPage() {
  const { toast } = useToast();
  const [tab,     setTab]     = useState('Daily');
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [date,    setDate]    = useState(new Date().toISOString().slice(0, 10));
  const [month,   setMonth]   = useState(new Date().toISOString().slice(0, 7));

  const load = useCallback(async () => {
    setLoading(true);
    setData(null);
    try {
      let res;
      if (tab === 'Daily')   res = await api.get(`/reports/daily?start=${date}`);
      if (tab === 'Weekly')  res = await api.get('/reports/weekly');
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
          <input
            className="form-input"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            style={{ maxWidth: 200 }}
          />
        </div>
        <motion.div variants={container} initial="hidden" animate="show">
          <KpiRow rows={[
            { label: 'Revenue',      value: `KSh ${fmt(d.revenue)}`,    mono: true,  color: 'var(--accent-teal)',  accent: 'card-accent-teal' },
            { label: 'Gross Profit', value: `KSh ${fmt(d.profit)}`,     mono: true,  color: 'var(--accent-green)', accent: 'card-accent-green' },
            { label: 'Expenses',     value: `KSh ${fmt(d.expenses)}`,   mono: true,  color: 'var(--accent-amber)' },
            { label: 'Net Profit',   value: `KSh ${fmt(d.net_profit)}`, mono: true,
              color: d.net_profit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)',
              accent: d.net_profit < 0 ? 'card-accent-red' : 'card-accent-green',
            },
            { label: 'Cash Sales',   value: `KSh ${fmt(d.cash_revenue)}`, mono: true },
            { label: 'Debt Sales',   value: `KSh ${fmt(d.debt_revenue)}`, mono: true, color: 'var(--accent-amber)' },
            { label: 'Total Sales',  value: d.sale_count, color: 'var(--text-primary)' },
          ]} />

          {/* Day close info */}
          {d.day && (
            <motion.div variants={item}>
              <div className="section-header">Day Close Summary</div>
              <div className={`card ${d.day.mismatch && d.day.mismatch !== 0 ? 'card-accent-red' : 'card-accent-green'}`} style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
                  {[
                    { label: 'Status',        value: d.day.is_closed ? 'Closed' : 'Open' },
                    { label: 'Opening Cash',  value: `KSh ${fmt(d.day.opening_cash)}` },
                    { label: 'Actual Cash',   value: d.day.actual_cash != null ? `KSh ${fmt(d.day.actual_cash)}` : '—' },
                    { label: 'Mismatch',      value: d.day.mismatch != null ? `KSh ${fmt(d.day.mismatch)}` : '—',
                      color: d.day.mismatch < 0 ? 'var(--accent-red)' : d.day.mismatch > 0 ? 'var(--accent-amber)' : 'var(--accent-green)' },
                  ].map(r => (
                    <div key={r.label}>
                      <div style={{ fontFamily: "'Barlow Condensed'", fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{r.label}</div>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontWeight: 500, color: r.color || 'var(--text-primary)', fontSize: '0.98rem' }}>{r.value}</div>
                    </div>
                  ))}
                </div>
                {d.day.mismatch && d.day.mismatch !== 0 && (
                  <div className="mismatch-banner" style={{ marginTop: '1rem', marginBottom: 0 }}>
                    ⚠ Cash mismatch of KSh {fmt(Math.abs(d.day.mismatch))} {d.day.mismatch < 0 ? 'short' : 'over'}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </motion.div>
      </>
    );
  };

  /* ---------- WEEKLY ---------- */
  const WeeklyReport = () => {
    if (!data) return null;
    const d = data;
    const barData = (d.daily_breakdown || []).map(r => ({
      date: r.date.slice(5),
      revenue: r.revenue,
      profit: r.profit,
      sales: r.sale_count,
    }));
    return (
      <motion.div variants={container} initial="hidden" animate="show">
        <KpiRow rows={[
          { label: 'Week Revenue',   value: `KSh ${fmt(d.total_revenue)}`, mono: true, color: 'var(--accent-teal)',  accent: 'card-accent-teal'  },
          { label: 'Week Profit',    value: `KSh ${fmt(d.total_profit)}`,  mono: true, color: 'var(--accent-green)', accent: 'card-accent-green' },
          { label: 'Week Expenses',  value: `KSh ${fmt(d.total_expenses)}`,mono: true, color: 'var(--accent-amber)' },
          { label: 'Net Profit',     value: `KSh ${fmt(d.net_profit)}`,    mono: true,
            color: d.net_profit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)',
            accent: d.net_profit < 0 ? 'card-accent-red' : '',
          },
          { label: 'Total Sales',    value: d.sale_count, sub: `${d.start} → ${d.end}` },
        ]} />

        <motion.div variants={item}>
          <div className="section-header">Daily Breakdown</div>
          <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={barData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border-subtle)" />
                <XAxis dataKey="date" tick={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontFamily: "'DM Mono', monospace", fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={60} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip contentStyle={chartTooltipStyle} formatter={(v, n) => [`KSh ${fmt(v)}`, n === 'revenue' ? 'Revenue' : 'Profit']} labelStyle={{ fontFamily: "'Barlow Condensed'", fontWeight: 700 }} />
                <Bar dataKey="revenue" fill="var(--accent-teal)" radius={[4,4,0,0]} />
                <Bar dataKey="profit"  fill="var(--accent-rust)" radius={[4,4,0,0]} opacity={0.75} />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.75rem', justifyContent: 'center' }}>
              {[{ color: 'var(--accent-teal)', label: 'Revenue' }, { color: 'var(--accent-rust)', label: 'Profit' }].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} />
                  <span style={{ fontFamily: "'Barlow Condensed'", fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{l.label}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Daily table */}
        <motion.div variants={item}>
          <div className="section-header">Day-by-Day</div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Revenue (KSh)</th><th>Profit (KSh)</th><th>Sales</th></tr></thead>
              <tbody>
                {(d.daily_breakdown || []).map(r => (
                  <tr key={r.date}>
                    <td className="td-mono" style={{ fontWeight: 600 }}>{r.date}</td>
                    <td className="td-mono" style={{ color: 'var(--accent-teal)' }}>{fmt(r.revenue)}</td>
                    <td className="td-mono" style={{ color: 'var(--accent-green)' }}>{fmt(r.profit)}</td>
                    <td className="td-mono">{r.sale_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </motion.div>
    );
  };

  /* ---------- MONTHLY ---------- */
  const MonthlyReport = () => {
    if (!data) return null;
    const d = data;
    return (
      <motion.div variants={container} initial="hidden" animate="show">
        <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            className="form-input"
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            style={{ maxWidth: 200 }}
          />
        </div>

        <KpiRow rows={[
          { label: 'Month Revenue',    value: `KSh ${fmt(d.total_revenue)}`,  mono: true, color: 'var(--accent-teal)',  accent: 'card-accent-teal'  },
          { label: 'Cash Revenue',     value: `KSh ${fmt(d.cash_revenue)}`,   mono: true, color: 'var(--accent-green)' },
          { label: 'Debt Revenue',     value: `KSh ${fmt(d.debt_revenue)}`,   mono: true, color: 'var(--accent-amber)' },
          { label: 'Gross Profit',     value: `KSh ${fmt(d.total_profit)}`,   mono: true, color: 'var(--accent-green)', accent: 'card-accent-green' },
          { label: 'Total Expenses',   value: `KSh ${fmt(d.total_expenses)}`, mono: true, color: 'var(--accent-amber)' },
          { label: 'Net Profit',       value: `KSh ${fmt(d.net_profit)}`,     mono: true,
            color: d.net_profit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)',
            accent: d.net_profit < 0 ? 'card-accent-red' : 'card-accent-green',
          },
          { label: 'Total Sales',      value: d.sale_count, sub: `${d.start} → ${d.end}` },
        ]} />

        {/* Top 5 Products */}
        {d.top_products?.length > 0 && (
          <motion.div variants={item}>
            <div className="section-header">Top 5 Products — {d.month}</div>
            <div className="table-wrap" style={{ marginBottom: '1.5rem' }}>
              <table>
                <thead>
                  <tr><th>Rank</th><th>Product</th><th>Units Sold</th><th>Revenue (KSh)</th><th>Profit (KSh)</th><th>Margin</th></tr>
                </thead>
                <tbody>
                  {d.top_products.map((p, i) => {
                    const margin = p.revenue > 0
                      ? ((p.profit / p.revenue) * 100).toFixed(1)
                      : '0.0';
                    return (
                      <tr key={p.name}>
                        <td>
                          <span style={{
                            fontFamily: "'Barlow Condensed'",
                            fontWeight: 800,
                            fontSize: '1.1rem',
                            color: i === 0 ? 'var(--accent-rust)' : i === 1 ? 'var(--text-secondary)' : 'var(--text-muted)',
                          }}>
                            #{i + 1}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{p.name}</td>
                        <td className="td-mono">{p.units_sold}</td>
                        <td className="td-mono" style={{ color: 'var(--accent-teal)' }}>{fmt(p.revenue)}</td>
                        <td className="td-mono" style={{ color: 'var(--accent-green)' }}>{fmt(p.profit)}</td>
                        <td>
                          <span style={{
                            fontFamily: "'DM Mono', monospace",
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

            {/* Top products bar chart */}
            <div className="section-header">Top Products by Revenue</div>
            <div className="card" style={{ padding: '1.25rem' }}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={d.top_products.map(p => ({ name: p.name.length > 12 ? p.name.slice(0,12)+'…' : p.name, revenue: p.revenue, profit: p.profit }))}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid horizontal={false} stroke="var(--border-subtle)" />
                  <XAxis type="number" tick={{ fontFamily: "'DM Mono', monospace", fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" tick={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} width={90} />
                  <Tooltip contentStyle={chartTooltipStyle} formatter={(v, n) => [`KSh ${fmt(v)}`, n === 'revenue' ? 'Revenue' : 'Profit']} />
                  <Bar dataKey="revenue" fill="var(--accent-teal)" radius={[0,4,4,0]} />
                  <Bar dataKey="profit"  fill="var(--accent-green)" radius={[0,4,4,0]} opacity={0.75} />
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
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: '1.5rem' }}
      >
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: '1.9rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Reports
        </div>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
          Financial performance analytics
        </div>
      </motion.div>

      {/* Tab bar */}
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
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 700,
              fontSize: '0.85rem',
              letterSpacing: '0.09em',
              textTransform: 'uppercase',
              padding: '0.55rem 1.25rem',
              border: 'none',
              borderRight: t !== 'Monthly' ? '1px solid var(--border-medium)' : 'none',
              background: tab === t ? 'var(--accent-rust)' : 'transparent',
              color: tab === t ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'background 0.18s, color 0.18s',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.875rem' }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 120, borderRadius: 12 }} />
          ))}
        </div>
      ) : (
        <>
          {tab === 'Daily'   && <DailyReport />}
          {tab === 'Weekly'  && <WeeklyReport />}
          {tab === 'Monthly' && <MonthlyReport />}
        </>
      )}
    </div>
  );
}