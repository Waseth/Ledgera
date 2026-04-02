import { motion } from 'framer-motion';

export default function StatCard({ value, label, icon: Icon, color, trend, trendValue }) {
  return (
    <motion.div
      className="card stat-card"
      whileHover={{ y: -4, boxShadow: 'var(--shadow-lg)' }}
      transition={{ duration: 0.2 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="stat-label">{label}</div>
          <div className="stat-value">{value}</div>
          {trend && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.25rem',
              marginTop: '0.5rem', fontSize: '0.7rem',
              color: trend === 'up' ? 'var(--accent-green)' : 'var(--accent-red)'
            }}>
              {trend === 'up' ? '↑' : '↓'} {trendValue}%
            </div>
          )}
        </div>
        {Icon && <Icon size={28} color={color} style={{ opacity: 0.7 }} />}
      </div>
    </motion.div>
  );
}