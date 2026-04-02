import { useEffect, useRef } from 'react';
import { motion, useMotionValue, animate } from 'framer-motion';

/* Animated number count-up */
function AnimatedNumber({ value, decimals = 2, prefix = '' }) {
  const ref = useRef(null);
  const count = useMotionValue(0);

  useEffect(() => {
    const controls = animate(count, value, {
      duration: 1.4,
      ease: 'easeOut',
      onUpdate(v) {
        if (ref.current) {
          ref.current.textContent = prefix + v.toFixed(decimals);
        }
      },
    });
    return controls.stop;
  }, [value]); // eslint-disable-line

  return <span ref={ref}>{prefix}{(0).toFixed(decimals)}</span>;
}

export default function StatCard({
  value,
  label,
  sub,
  prefix = '',
  suffix = '',
  decimals = 2,
  percentile,       // 0-100, shows progress bar
  accentClass = '', // card-accent, card-accent-teal, etc.
  valueColor,       // CSS color override
  delay = 0,
}) {
  const pct = percentile != null ? Math.min(100, Math.max(0, percentile)) : null;

  return (
    <motion.div
      className={`card stat-card ${accentClass}`}
      whileHover={{ y: -3, boxShadow: 'var(--shadow-lg)' }}
      transition={{ duration: 0.2 }}
    >
      {/* Value */}
      <div
        className="stat-value"
        style={valueColor ? { color: valueColor } : {}}
      >
        {prefix}
        <AnimatedNumber value={Number(value) || 0} decimals={decimals} />
        {suffix}
      </div>

      {/* Label */}
      <div className="stat-label">{label}</div>

      {/* Sub-text */}
      {sub && (
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
          {sub}
        </div>
      )}

      {/* Percentile bar (like reference) */}
      {pct != null && (
        <div className="progress-wrap">
          <div className="progress-badge">{pct}th pct</div>
          <div className="progress-track">
            <motion.div
              className="progress-fill"
              initial={{ width: '0%' }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1], delay: delay + 0.3 }}
            >
              <div className="progress-dot" />
            </motion.div>
          </div>
        </div>
      )}
    </motion.div>
  );
}