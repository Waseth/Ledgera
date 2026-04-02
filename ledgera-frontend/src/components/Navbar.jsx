import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { api } from '../api/client';
import NotifPanel from './NotifPanel';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { isDark, toggle } = useTheme();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [menuOpen,     setMenuOpen]     = useState(false);
  const [notifOpen,    setNotifOpen]    = useState(false);
  const [unreadCount,  setUnreadCount]  = useState(0);
  const [dayStatus,    setDayStatus]    = useState(null); // 'open' | 'closed' | 'no_day'
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  useEffect(() => {
    api.get('/notifications/count').then(d => setUnreadCount(d.unread)).catch(() => {});
    api.get('/days/status').then(d => setDayStatus(d.status)).catch(() => {});
  }, []);

  const handleLogout = async () => {
    if (!logoutConfirm) { setLogoutConfirm(true); return; }
    await logout();
    toast('Logged out successfully', 'info');
    navigate('/login');
  };

  const navLinks = user?.role === 'admin'
    ? [
        { to: '/dashboard',    label: 'Dashboard' },
        { to: '/products',     label: 'Products'  },
        { to: '/reports',      label: 'Reports'   },
        { to: '/debts',        label: 'Debts'     },
        { to: '/shopkeepers',  label: 'Staff'     },
      ]
    : [
        { to: '/sales',    label: 'Sales'    },
        { to: '/products', label: 'Products' },
        { to: '/debts',    label: 'Debts'    },
        { to: '/reports',  label: 'Reports'  },
      ];

  const DayPill = () => {
    if (!dayStatus) return null;
    const map = {
      open:   { label: 'Day Open',   cls: 'open'   },
      closed: { label: 'Day Closed', cls: 'closed' },
      no_day: { label: 'No Day',     cls: 'noday'  },
    };
    const { label, cls } = map[dayStatus] || {};
    return <span className={`day-pill ${cls}`}>{label}</span>;
  };

  return (
    <>
      <nav style={{
        background: 'var(--nav-bg)',
        color: 'var(--nav-text)',
        position: 'sticky',
        top: 0,
        zIndex: 500,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '0 1.25rem',
          height: 56,
          display: 'flex',
          alignItems: 'center',
          gap: '1.5rem',
        }}>
          {/* Logo */}
          <span style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 800,
            fontSize: '1.35rem',
            letterSpacing: '0.06em',
            color: 'var(--accent-rust)',
            textTransform: 'uppercase',
            flexShrink: 0,
          }}>
            Ledgera
          </span>

          {/* Desktop links */}
          <div className="nav-links-desktop" style={{
            display: 'flex',
            gap: '0.25rem',
            flex: 1,
          }}>
            {navLinks.map(l => (
              <NavLink
                key={l.to}
                to={l.to}
                style={({ isActive }) => ({
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  letterSpacing: '0.09em',
                  textTransform: 'uppercase',
                  padding: '0.35rem 0.75rem',
                  borderRadius: 6,
                  color: isActive ? '#fff' : 'var(--nav-muted)',
                  background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                  transition: 'color 0.18s, background 0.18s',
                  textDecoration: 'none',
                })}
              >
                {l.label}
              </NavLink>
            ))}
          </div>

          {/* Right side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
            <DayPill />

            {/* Theme toggle */}
            <button
              onClick={toggle}
              style={{
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6,
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '1rem',
                color: 'var(--nav-text)',
              }}
              aria-label="Toggle theme"
            >
              <AnimatePresence mode="wait">
                <motion.span
                  key={isDark ? 'moon' : 'sun'}
                  initial={{ rotate: -90, scale: 0.5, opacity: 0 }}
                  animate={{ rotate: 0,   scale: 1,   opacity: 1 }}
                  exit={{    rotate:  90, scale: 0.5, opacity: 0 }}
                  transition={{ duration: 0.22 }}
                >
                  {isDark ? '☀️' : '🌙'}
                </motion.span>
              </AnimatePresence>
            </button>

            {/* Notifications */}
            <button
              onClick={() => setNotifOpen(true)}
              style={{
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6,
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                position: 'relative',
                color: 'var(--nav-text)',
                fontSize: '1rem',
              }}
              className={unreadCount > 0 ? 'bell-has-unread' : ''}
              aria-label="Notifications"
            >
              🔔
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: -3,
                  right: -3,
                  background: 'var(--accent-red)',
                  color: '#fff',
                  borderRadius: 999,
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  padding: '1px 5px',
                  fontFamily: "'DM Mono', monospace",
                  lineHeight: 1.4,
                }}>
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Logout */}
            <AnimatePresence>
              {logoutConfirm ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  style={{ display: 'flex', gap: '0.35rem' }}
                >
                  <button
                    onClick={handleLogout}
                    style={{
                      background: 'var(--accent-red)',
                      border: 'none',
                      borderRadius: 5,
                      color: '#fff',
                      padding: '4px 10px',
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      letterSpacing: '0.07em',
                      cursor: 'pointer',
                    }}
                  >YES</button>
                  <button
                    onClick={() => setLogoutConfirm(false)}
                    style={{
                      background: 'rgba(255,255,255,0.1)',
                      border: 'none',
                      borderRadius: 5,
                      color: 'var(--nav-text)',
                      padding: '4px 10px',
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      letterSpacing: '0.07em',
                      cursor: 'pointer',
                    }}
                  >NO</button>
                </motion.div>
              ) : (
                <button
                  onClick={handleLogout}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 6,
                    color: 'rgba(255,255,255,0.55)',
                    padding: '4px 12px',
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: '0.77rem',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    transition: 'color 0.18s, border-color 0.18s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#fca5a5'; e.currentTarget.style.borderColor = '#fca5a5'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
                >
                  Logout
                </button>
              )}
            </AnimatePresence>

            {/* Hamburger */}
            <button
              className="nav-hamburger"
              onClick={() => setMenuOpen(o => !o)}
              style={{
                display: 'none',
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6,
                width: 32,
                height: 32,
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--nav-text)',
                fontSize: '1.1rem',
              }}
            >
              {menuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22 }}
              style={{ overflow: 'hidden', borderTop: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div style={{ padding: '0.75rem 1.25rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {navLinks.map(l => (
                  <NavLink
                    key={l.to}
                    to={l.to}
                    onClick={() => setMenuOpen(false)}
                    style={({ isActive }) => ({
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontWeight: 700,
                      fontSize: '1rem',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      padding: '0.6rem 0.75rem',
                      borderRadius: 6,
                      color: isActive ? '#fff' : 'var(--nav-muted)',
                      background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                      textDecoration: 'none',
                    })}
                  >
                    {l.label}
                  </NavLink>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Notification panel */}
      <AnimatePresence>
        {notifOpen && (
          <NotifPanel
            onClose={() => { setNotifOpen(false); setUnreadCount(0); }}
          />
        )}
      </AnimatePresence>

      <style>{`
        @media (max-width: 768px) {
          .nav-links-desktop { display: none !important; }
          .nav-hamburger { display: flex !important; }
        }
        @keyframes bellPulse {
          0%,100% { transform: rotate(0); }
          15%  { transform: rotate(12deg); }
          30%  { transform: rotate(-9deg); }
          45%  { transform: rotate(7deg); }
          60%  { transform: rotate(-4deg); }
          75%  { transform: rotate(2deg); }
        }
        .bell-has-unread { animation: bellPulse 2s ease 0.8s; }
      `}</style>
    </>
  );
}