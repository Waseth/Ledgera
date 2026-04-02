import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import StatCard from '../components/StatCard';
import Modal from '../components/Modal';
import DayModal from '../components/DayModal';
import ProductModal from '../components/ProductModal';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};
const item = {
  hidden: { opacity: 0, y: 18 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.4,0,0.2,1] } },
};

const fmt = n => Number(n || 0).toLocaleString('en-KE', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});

export default function Dashboard() {
  const { toast } = useToast();
  const [data,    setData]    = useState(null);
  const [weekly,  setWeekly]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [dayModal,setDayModal]= useState(null); // 'open' | 'close'
  const [prodModal,setProdModal] = useState(false);

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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.875rem' }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 140, borderRadius: 12 }} />
        ))}
      </div>
    </div>
  );

  const barData = weekly?.daily_breakdown?.map(d => ({
    date: d.date.slice(5),
    revenue: d.revenue,
    profit: d.profit,
  })) || [];

  return (
    <div className="page-wrapper">
      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}
      >
        <div>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 800, fontSize: '1.9rem',
            letterSpacing: '0.04em', textTransform: 'uppercase',
            color: 'var(--text-primary)',
          }}>
            Admin Dashboard
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            {new Date().toLocaleDateString('en-KE', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
          </div>
        </div>
        <div className="action-row" style={{ marginBottom: 0 }}>
          <button className="btn btn-teal btn-sm" onClick={() => setDayModal('open')}>📅 Open Day</button>
          <button className="btn btn-danger btn-sm" onClick={() => setDayModal('close')}>🔒 Close Day</button>
          <button className="btn btn-primary btn-sm" onClick={() => setProdModal(true)}>➕ Product</button>
          <button className="btn btn-ghost btn-sm" onClick={load}>↻ Refresh</button>
        </div>
      </motion.div>

      {/* TODAY */}
      <div className="section-header">Today's Performance</div>
      <motion.div
        className="kpi-grid"
        variants={container}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={item}>
          <StatCard value={data?.today?.revenue}    label="Today Revenue"    prefix="KSh " decimals={2} accentClass="card-accent-teal" />
        </motion.div>
        <motion.div variants={item}>
          <StatCard value={data?.today?.profit}     label="Today Gross Profit" prefix="KSh " decimals={2} valueColor="var(--accent-green)" />
        </motion.div>
        <motion.div variants={item}>
          <StatCard value={data?.today?.net_profit} label="Today Net Profit" prefix="KSh " decimals={2}
            valueColor={data?.today?.net_profit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}
            sub={`After KSh ${fmt(data?.today?.expenses)} expenses`}
          />
        </motion.div>
      </motion.div>

      {/* WEEK */}
      <div className="section-header section-gap">7-Day Overview</div>
      <motion.div
        className="kpi-grid"
        variants={container}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={item}>
          <StatCard value={data?.week?.revenue}     label="Week Revenue"    prefix="KSh " decimals={2} sub={`${data?.week?.sale_count} total sales`} />
        </motion.div>
        <motion.div variants={item}>
          <StatCard value={data?.week?.net_profit}  label="Week Net Profit" prefix="KSh " decimals={2}
            valueColor={data?.week?.net_profit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}
          />
        </motion.div>
        <motion.div variants={item}>
          <StatCard
            value={data?.outstanding_debt} label="Outstanding Debt" prefix="KSh " decimals={2}
            valueColor={data?.outstanding_debt > 0 ? 'var(--accent-amber)' : 'var(--text-primary)'}
            accentClass={data?.outstanding_debt > 0 ? 'card-accent' : ''}
          />
        </motion.div>
      </motion.div>

      {/* Low stock */}
      <motion.div variants={item} style={{ marginTop: '0.875rem' }}>
        <StatCard
          value={data?.low_stock_count} label="Low Stock Items" decimals={0}
          valueColor={data?.low_stock_count > 0 ? 'var(--accent-red)' : 'var(--accent-green)'}
          accentClass={data?.low_stock_count > 0 ? 'card-accent-red' : 'card-accent-green'}
          sub={data?.low_stock_count > 0 ? 'Restock required' : 'All products stocked'}
        />
      </motion.div>

      {/* Weekly bar chart */}
      {barData.length > 0 && (
        <>
          <div className="section-header section-gap">Revenue — Last 7 Days</div>
          <motion.div
            className="card"
            style={{ padding: '1.25rem' }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border-subtle)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fill: 'var(--text-secondary)' }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  tick={{ fontFamily: "'DM Mono', monospace", fontSize: 10, fill: 'var(--text-muted)' }}
                  axisLine={false} tickLine={false} width={60}
                  tickFormatter={v => `${(v/1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 8,
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '0.82rem',
                    boxShadow: 'var(--shadow-md)',
                  }}
                  formatter={(v, name) => [`KSh ${fmt(v)}`, name === 'revenue' ? 'Revenue' : 'Profit']}
                  labelStyle={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}
                />
                <Bar dataKey="revenue" fill="var(--accent-teal)"  radius={[4,4,0,0]} />
                <Bar dataKey="profit"  fill="var(--accent-rust)"  radius={[4,4,0,0]} opacity={0.7} />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.75rem', justifyContent: 'center' }}>
              {[{ color: 'var(--accent-teal)', label: 'Revenue' }, { color: 'var(--accent-rust)', label: 'Profit' }].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} />
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{l.label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </>
      )}

      {/* Modals */}
      <DayModal mode={dayModal} onClose={() => setDayModal(null)} onSuccess={load} />
      <ProductModal open={prodModal} onClose={() => setProdModal(false)} onSuccess={load} />
    </div>
  );
}