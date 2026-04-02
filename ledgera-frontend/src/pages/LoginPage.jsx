import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function LoginPage() {
  const { login } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { setError('Both fields are required.'); return; }
    setError('');
    setLoading(true);
    try {
      const role = await login(email.trim().toLowerCase(), password);
      toast('Welcome back!', 'success');
      navigate(role === 'admin' ? '/dashboard' : '/sales', { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-base)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background decorative lines */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.05, pointerEvents: 'none' }} xmlns="http://www.w3.org/2000/svg">
        <line x1="0" y1="30%" x2="100%" y2="35%" stroke="currentColor" strokeWidth="1" />
        <line x1="0" y1="60%" x2="100%" y2="55%" stroke="currentColor" strokeWidth="1" />
        <line x1="0" y1="80%" x2="100%" y2="85%" stroke="currentColor" strokeWidth="0.5" />
      </svg>

      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{ textAlign: 'center', marginBottom: '2rem' }}
        >
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 800,
            fontSize: '3rem',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--accent-rust)',
            lineHeight: 1,
          }}>
            Ledgera
          </div>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 600,
            fontSize: '0.78rem',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            marginTop: '0.4rem',
          }}>
            Shop Management System
          </div>
        </motion.div>

        {/* Card */}
        <motion.div
          className="card"
          style={{ padding: '2rem' }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          {/* Header line */}
          <div style={{
            height: 3,
            background: 'linear-gradient(90deg, var(--accent-rust), var(--accent-teal))',
            borderRadius: '2px 2px 0 0',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
          }} />

          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 800,
              fontSize: '1.3rem',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'var(--text-primary)',
            }}>
              Sign In
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Enter your credentials to continue
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                className="form-input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoFocus
                autoComplete="email"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                className="form-input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  background: 'var(--accent-red-dim)',
                  border: '1px solid var(--accent-red)',
                  borderRadius: 6,
                  padding: '0.6rem 0.875rem',
                  fontSize: '0.85rem',
                  color: 'var(--accent-red)',
                  marginBottom: '1rem',
                }}
              >
                {error}
              </motion.div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '0.25rem', padding: '0.75rem' }}
              disabled={loading}
            >
              {loading ? (
                <motion.span
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  Signing in…
                </motion.span>
              ) : 'Sign In'}
            </button>
          </form>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          style={{
            textAlign: 'center',
            marginTop: '1.5rem',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            fontFamily: "'Barlow Condensed', sans-serif",
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          Ledgera · Shop Management System
        </motion.div>
      </div>
    </div>
  );
}