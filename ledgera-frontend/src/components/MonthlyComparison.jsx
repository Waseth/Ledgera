import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiBarChart2, FiTrendingUp, FiTrendingDown, FiRefreshCw, FiCalendar } from 'react-icons/fi';
import { api } from '../api/client';

export default function MonthlyComparison() {
  const [history, setHistory] = useState([]);
  const [selectedMonth1, setSelectedMonth1] = useState('');
  const [selectedMonth2, setSelectedMonth2] = useState('');
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const data = await api.get('/reports/monthly/history');
      setHistory(data);
      if (data.length >= 2) {
        setSelectedMonth1(`${data[1].year}-${String(data[1].month).padStart(2, '0')}`);
        setSelectedMonth2(`${data[0].year}-${String(data[0].month).padStart(2, '0')}`);
      } else if (data.length === 1) {
        setSelectedMonth1(`${data[0].year}-${String(data[0].month).padStart(2, '0')}`);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const compareMonths = async () => {
    if (!selectedMonth1 || !selectedMonth2) {
      return;
    }
    setLoading(true);
    try {
      const data = await api.get(`/reports/monthly/compare?month1=${selectedMonth1}&month2=${selectedMonth2}`);
      setComparison(data);
    } catch (err) {
      console.error('Comparison failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatMonth = (yearMonth) => {
    if (!yearMonth) return '';
    const [year, month] = yearMonth.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  return (
    <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
      <h3 style={{
        fontFamily: 'Poppins, sans-serif',
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        fontSize: '1rem',
        fontWeight: 600
      }}>
        <FiBarChart2 size={20} /> Monthly Performance Comparison
      </h3>

      {/* Desktop layout - side by side */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: '1rem',
        marginBottom: '1rem',
        flexWrap: 'wrap'
      }} className="comparison-desktop">
        {/* Month 1 Selector */}
        <div style={{ flex: 1, minWidth: '200px' }}>
          <label style={{
            fontSize: '0.7rem',
            color: 'var(--text-muted)',
            display: 'block',
            marginBottom: '0.35rem',
            fontFamily: 'Poppins, sans-serif',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            <FiCalendar size={12} style={{ display: 'inline', marginRight: '0.25rem' }} />
            First Month
          </label>
          <select
            className="form-select"
            value={selectedMonth1}
            onChange={(e) => setSelectedMonth1(e.target.value)}
            disabled={loadingHistory}
            style={{
              width: '100%',
              padding: '0.6rem 0.85rem',
              fontFamily: 'Poppins, sans-serif',
              fontSize: '0.9rem',
              borderRadius: 'var(--radius-md)',
              border: '1.5px solid var(--border-medium)',
              background: 'var(--bg-input)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              transition: 'all var(--transition)'
            }}
          >
            <option value="">Select first month</option>
            {history.map(h => (
              <option key={`${h.year}-${h.month}`} value={`${h.year}-${String(h.month).padStart(2, '0')}`}>
                {h.month_name}
              </option>
            ))}
          </select>
        </div>

        {/* VS Divider */}
        <div style={{
          textAlign: 'center',
          fontSize: '1rem',
          fontWeight: 600,
          color: 'var(--text-muted)',
          paddingBottom: '0.6rem'
        }}>
          VS
        </div>

        {/* Month 2 Selector */}
        <div style={{ flex: 1, minWidth: '200px' }}>
          <label style={{
            fontSize: '0.7rem',
            color: 'var(--text-muted)',
            display: 'block',
            marginBottom: '0.35rem',
            fontFamily: 'Poppins, sans-serif',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            <FiCalendar size={12} style={{ display: 'inline', marginRight: '0.25rem' }} />
            Second Month
          </label>
          <select
            className="form-select"
            value={selectedMonth2}
            onChange={(e) => setSelectedMonth2(e.target.value)}
            disabled={loadingHistory}
            style={{
              width: '100%',
              padding: '0.6rem 0.85rem',
              fontFamily: 'Poppins, sans-serif',
              fontSize: '0.9rem',
              borderRadius: 'var(--radius-md)',
              border: '1.5px solid var(--border-medium)',
              background: 'var(--bg-input)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              transition: 'all var(--transition)'
            }}
          >
            <option value="">Select second month</option>
            {history.map(h => (
              <option key={`${h.year}-${h.month}`} value={`${h.year}-${String(h.month).padStart(2, '0')}`}>
                {h.month_name}
              </option>
            ))}
          </select>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            className="btn btn-primary"
            onClick={compareMonths}
            disabled={loading || !selectedMonth1 || !selectedMonth2}
            style={{
              fontFamily: 'Poppins, sans-serif',
              color: '#0F172A',
              padding: '0.6rem 1.25rem',
              fontSize: '0.85rem',
              whiteSpace: 'nowrap'
            }}
          >
            {loading ? 'Comparing...' : 'Compare '}
          </button>

          <button
            className="btn btn-outline btn-sm"
            onClick={loadHistory}
            disabled={loadingHistory}
            style={{
              fontFamily: 'Poppins, sans-serif',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.6rem 1rem'
            }}
          >
            <FiRefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Mobile layout - stacked with centered VS */}
      <div style={{
        display: 'none',
        flexDirection: 'column',
        gap: '1rem',
        marginBottom: '1rem'
      }} className="comparison-mobile">
        <div style={{ width: '100%' }}>
          <label style={{
            fontSize: '0.7rem',
            color: 'var(--text-muted)',
            display: 'block',
            marginBottom: '0.35rem',
            fontFamily: 'Poppins, sans-serif',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            textAlign: 'center'
          }}>
            <FiCalendar size={12} style={{ display: 'inline', marginRight: '0.25rem' }} />
            Select Months to Compare
          </label>
        </div>

        <select
          className="form-select"
          value={selectedMonth1}
          onChange={(e) => setSelectedMonth1(e.target.value)}
          disabled={loadingHistory}
          style={{
            width: '100%',
            padding: '0.6rem 0.85rem',
            fontFamily: 'Poppins, sans-serif',
            fontSize: '0.9rem',
            borderRadius: 'var(--radius-md)',
            border: '1.5px solid var(--border-medium)',
            background: 'var(--bg-input)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            textAlign: 'center'
          }}
        >
          <option value="">Select first month</option>
          {history.map(h => (
            <option key={`${h.year}-${h.month}`} value={`${h.year}-${String(h.month).padStart(2, '0')}`}>
              {h.month_name}
            </option>
          ))}
        </select>

        <div style={{
          textAlign: 'center',
          fontSize: '1rem',
          fontWeight: 600,
          color: 'var(--text-muted)'
        }}>
          VS
        </div>

        <select
          className="form-select"
          value={selectedMonth2}
          onChange={(e) => setSelectedMonth2(e.target.value)}
          disabled={loadingHistory}
          style={{
            width: '100%',
            padding: '0.6rem 0.85rem',
            fontFamily: 'Poppins, sans-serif',
            fontSize: '0.9rem',
            borderRadius: 'var(--radius-md)',
            border: '1.5px solid var(--border-medium)',
            background: 'var(--bg-input)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            textAlign: 'center'
          }}
        >
          <option value="">Select second month</option>
          {history.map(h => (
            <option key={`${h.year}-${h.month}`} value={`${h.year}-${String(h.month).padStart(2, '0')}`}>
              {h.month_name}
            </option>
          ))}
        </select>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button
            className="btn btn-primary"
            onClick={compareMonths}
            disabled={loading || !selectedMonth1 || !selectedMonth2}
            style={{
              fontFamily: 'Poppins, sans-serif',
              color: '#0F172A',
              padding: '0.6rem 1.25rem',
              fontSize: '0.85rem'
            }}
          >
            {loading ? 'Comparing...' : 'Compare'}
          </button>

          <button
            className="btn btn-outline btn-sm"
            onClick={loadHistory}
            disabled={loadingHistory}
            style={{
              fontFamily: 'Poppins, sans-serif',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.6rem 1rem'
            }}
          >
            <FiRefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {comparison && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ marginTop: '1.5rem' }}
        >
          {/* KPI Cards - Responsive grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem',
            marginBottom: '1rem'
          }}>
            <div className="card stat-card" style={{ textAlign: 'center', padding: '1rem' }}>
              <div className="stat-label" style={{ fontFamily: 'Poppins, sans-serif', fontSize: '0.7rem' }}>Revenue Change</div>
              <div style={{
                fontSize: '1.3rem',
                fontWeight: 700,
                color: comparison.comparison.revenue_difference >= 0 ? '#10B981' : '#EF4444',
                fontFamily: 'Poppins, sans-serif',
                marginTop: '0.5rem'
              }}>
                {comparison.comparison.revenue_difference >= 0 ? '+' : ''}{comparison.comparison.revenue_difference.toLocaleString()} KSh
              </div>
              <div style={{
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.25rem',
                marginTop: '0.25rem',
                color: comparison.comparison.revenue_percentage_change >= 0 ? '#10B981' : '#EF4444'
              }}>
                {comparison.comparison.revenue_percentage_change >= 0 ? <FiTrendingUp /> : <FiTrendingDown />}
                {Math.abs(comparison.comparison.revenue_percentage_change).toFixed(1)}%
              </div>
            </div>

            <div className="card stat-card" style={{ textAlign: 'center', padding: '1rem' }}>
              <div className="stat-label" style={{ fontFamily: 'Poppins, sans-serif', fontSize: '0.7rem' }}>Profit Change</div>
              <div style={{
                fontSize: '1.3rem',
                fontWeight: 700,
                color: comparison.comparison.profit_difference >= 0 ? '#10B981' : '#EF4444',
                fontFamily: 'Poppins, sans-serif',
                marginTop: '0.5rem'
              }}>
                {comparison.comparison.profit_difference >= 0 ? '+' : ''}{comparison.comparison.profit_difference.toLocaleString()} KSh
              </div>
              <div style={{
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.25rem',
                marginTop: '0.25rem',
                color: comparison.comparison.profit_percentage_change >= 0 ? '#10B981' : '#EF4444'
              }}>
                {comparison.comparison.profit_percentage_change >= 0 ? <FiTrendingUp /> : <FiTrendingDown />}
                {Math.abs(comparison.comparison.profit_percentage_change).toFixed(1)}%
              </div>
            </div>

            <div className="card stat-card" style={{ textAlign: 'center', padding: '1rem' }}>
              <div className="stat-label" style={{ fontFamily: 'Poppins, sans-serif', fontSize: '0.7rem' }}>Net Profit Change</div>
              <div style={{
                fontSize: '1.3rem',
                fontWeight: 700,
                color: comparison.comparison.net_profit_difference >= 0 ? '#10B981' : '#EF4444',
                fontFamily: 'Poppins, sans-serif',
                marginTop: '0.5rem'
              }}>
                {comparison.comparison.net_profit_difference >= 0 ? '+' : ''}{comparison.comparison.net_profit_difference.toLocaleString()} KSh
              </div>
            </div>
          </div>

          {/* Month Details - Responsive grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1rem',
            marginTop: '1rem'
          }}>
            <div className="card" style={{ padding: '1rem', background: 'var(--bg-surface)' }}>
              <h4 style={{
                fontFamily: 'Poppins, sans-serif',
                fontSize: '0.85rem',
                fontWeight: 600,
                marginBottom: '0.75rem',
                color: 'var(--text-primary)',
                borderBottom: '1px solid var(--border-medium)',
                paddingBottom: '0.5rem'
              }}>
                {formatMonth(selectedMonth1)}
              </h4>
              <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Revenue:</span>
                  <span style={{ fontWeight: 600, color: 'var(--accent-teal)' }}>KSh {comparison.month1.total_revenue.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Profit:</span>
                  <span style={{ fontWeight: 600, color: 'var(--accent-green)' }}>KSh {comparison.month1.total_profit.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Net Profit:</span>
                  <span style={{ fontWeight: 600, color: comparison.month1.net_profit >= 0 ? '#10B981' : '#EF4444' }}>
                    KSh {comparison.month1.net_profit.toLocaleString()}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Sales Count:</span>
                  <span style={{ fontWeight: 600 }}>{comparison.month1.sale_count.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: '1rem', background: 'var(--bg-surface)' }}>
              <h4 style={{
                fontFamily: 'Poppins, sans-serif',
                fontSize: '0.85rem',
                fontWeight: 600,
                marginBottom: '0.75rem',
                color: 'var(--text-primary)',
                borderBottom: '1px solid var(--border-medium)',
                paddingBottom: '0.5rem'
              }}>
                {formatMonth(selectedMonth2)}
              </h4>
              <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Revenue:</span>
                  <span style={{ fontWeight: 600, color: 'var(--accent-teal)' }}>KSh {comparison.month2.total_revenue.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Profit:</span>
                  <span style={{ fontWeight: 600, color: 'var(--accent-green)' }}>KSh {comparison.month2.total_profit.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Net Profit:</span>
                  <span style={{ fontWeight: 600, color: comparison.month2.net_profit >= 0 ? '#10B981' : '#EF4444' }}>
                    KSh {comparison.month2.net_profit.toLocaleString()}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Sales Count:</span>
                  <span style={{ fontWeight: 600 }}>{comparison.month2.sale_count.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {history.length === 0 && !loadingHistory && (
        <div style={{
          textAlign: 'center',
          padding: '2rem',
          color: 'var(--text-muted)',
          fontFamily: 'Poppins, sans-serif',
          fontSize: '0.85rem'
        }}>
          <FiBarChart2 size={32} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
          <p>No historical data yet. Monthly reports will be saved automatically as you view them.</p>
        </div>
      )}

      {/* Add responsive CSS */}
      <style>{`
        @media (max-width: 768px) {
          .comparison-desktop {
            display: none !important;
          }
          .comparison-mobile {
            display: flex !important;
          }
        }

        @media (min-width: 769px) {
          .comparison-desktop {
            display: flex !important;
          }
          .comparison-mobile {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}