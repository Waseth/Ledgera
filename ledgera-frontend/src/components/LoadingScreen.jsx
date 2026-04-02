import { motion } from 'framer-motion';

export default function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-base)',
      flexDirection: 'column',
      gap: '1rem',
    }}>
      <motion.div
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 800,
          fontSize: '2rem',
          letterSpacing: '0.08em',
          color: 'var(--accent-rust)',
          textTransform: 'uppercase',
        }}
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
      >
        Ledgera
      </motion.div>
      <motion.div
        style={{
          width: 120,
          height: 3,
          background: 'var(--progress-track)',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <motion.div
          style={{
            height: '100%',
            background: 'linear-gradient(90deg, var(--accent-teal), var(--accent-teal-light))',
            borderRadius: 2,
          }}
          animate={{ x: ['-100%', '100%'] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>
    </div>
  );
}