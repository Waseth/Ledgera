import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiHome, FiBox, FiCreditCard, FiPieChart, FiUsers,
  FiShoppingCart, FiSun, FiMoon, FiBell, FiLogOut, FiAlertCircle
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { api } from '../api/client';
import NotifPanel from './NotifPanel';
import Modal from './Modal';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { isDark, toggle } = useTheme();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);

  // Only fetch notifications if user is authenticated
  useEffect(() => {
    if (user) {
      api.get('/reports/notifications', true)
        .then(data => {
          const unread = Array.isArray(data) ? data.filter(n => !n.is_read).length : 0;
          setUnreadCount(unread);
        })
        .catch((err) => {
          console.error('Failed to fetch notifications:', err.message);
        });
    }
  }, [user]);

  const handleLogout = async () => {
    await logout();
    toast('Logged out successfully', 'info');
    navigate('/login');
  };

  const navLinks = user?.role === 'admin'
    ? [
      { to: '/dashboard', label: 'Dashboard', icon: FiHome },
      { to: '/products', label: 'Products', icon: FiBox },
      { to: '/reports', label: 'Reports', icon: FiPieChart },
      { to: '/debts', label: 'Debts', icon: FiCreditCard },
      { to: '/shopkeepers', label: 'Staff', icon: FiUsers },
    ]
    : [
      { to: '/sales', label: 'Sales', icon: FiShoppingCart },
      { to: '/products', label: 'Products', icon: FiBox },
      { to: '/debts', label: 'Debts', icon: FiCreditCard },
      { to: '/reports', label: 'Reports', icon: FiPieChart },
    ];

  const DesktopNav = () => (
    <div className="desktop-nav" style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.25rem',
      flex: 1,
    }}>
      {navLinks.map(link => (
        <NavLink
          key={link.to}
          to={link.to}
          style={({ isActive }) => ({
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            borderRadius: 'var(--radius-md)',
            color: isActive ? 'var(--nav-accent)' : 'var(--nav-muted)',
            background: isActive ? 'var(--primary-blue-dim)' : 'transparent',
            textDecoration: 'none',
            fontFamily: 'Poppins, sans-serif',
            fontWeight: 500,
            fontSize: '0.85rem',
            transition: 'all var(--transition)',
          })}
        >
          <link.icon size={18} />
          <span>{link.label}</span>
        </NavLink>
      ))}
    </div>
  );

  const BottomNav = () => (
    <div className="bottom-nav">
      {navLinks.map(link => (
        <NavLink
          key={link.to}
          to={link.to}
          className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
          onClick={() => setMenuOpen(false)}
        >
          <link.icon size={20} />
          <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: '0.7rem' }}>{link.label}</span>
        </NavLink>
      ))}
    </div>
  );

  return (
    <>
      <nav style={{
        background: 'var(--nav-bg)',
        color: 'var(--nav-text)',
        position: 'sticky',
        top: 0,
        zIndex: 500,
        borderBottom: '1px solid var(--border-medium)',
        backdropFilter: 'blur(10px)',
      }}>
        <div style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '0.75rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1.5rem',
        }}>
          <span style={{
            fontFamily: 'Poppins, sans-serif',
            fontWeight: 800,
            fontSize: '1.35rem',
            color: 'var(--nav-accent)',
            flexShrink: 0,
          }}>
            Ledgera
          </span>

          <DesktopNav />

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            <button
              onClick={toggle}
              style={{
                background: 'var(--primary-blue-dim)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)',
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--nav-text)',
              }}
            >
              {isDark ? <FiSun size={18} /> : <FiMoon size={18} />}
            </button>

            <button
              onClick={() => setNotifOpen(true)}
              style={{
                background: 'var(--primary-blue-dim)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)',
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                position: 'relative',
                color: 'var(--nav-text)',
              }}
            >
              <FiBell size={18} />
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  background: 'var(--accent-red)',
                  color: 'white',
                  borderRadius: 999,
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  fontFamily: 'Poppins, sans-serif',
                  padding: '1px 5px',
                }}>
                  {unreadCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setLogoutModalOpen(true)}
              style={{
                background: 'transparent',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)',
                padding: '0.5rem 1rem',
                color: 'var(--nav-text)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontFamily: 'Poppins, sans-serif',
              }}
            >
              <FiLogOut size={16} />
              <span style={{ fontSize: '0.85rem' }}>Logout</span>
            </button>
          </div>
        </div>
      </nav>

      <BottomNav />
      <NotifPanel open={notifOpen} onClose={() => setNotifOpen(false)} onRead={() => setUnreadCount(0)} />

      {/* Custom Logout Confirmation Modal */}
      <Modal
        open={logoutModalOpen}
        onClose={() => setLogoutModalOpen(false)}
        title="Confirm Logout"
        maxWidth={400}
      >
        <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'var(--accent-red-dim)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem auto',
          }}>
            <FiAlertCircle size={24} color="var(--accent-red)" />
          </div>
          <h3 style={{
            fontFamily: 'Poppins, sans-serif',
            fontWeight: 600,
            fontSize: '1.1rem',
            marginBottom: '0.5rem',
            color: 'var(--text-primary)',
          }}>
            Are you sure?
          </h3>
          <p style={{
            fontFamily: 'Poppins, sans-serif',
            fontSize: '0.85rem',
            color: 'var(--text-muted)',
            marginBottom: '1.5rem',
          }}>
            You will be logged out of your account and will need to sign in again to access your data.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button
              className="btn btn-outline"
              onClick={() => setLogoutModalOpen(false)}
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              Cancel
            </button>
            <button
              className="btn btn-danger"
              onClick={handleLogout}
              style={{ fontFamily: 'Poppins, sans-serif', background: 'var(--accent-red)', color: '#FFFFFF' }}
            >
              Yes, Logout
            </button>
          </div>
        </div>
      </Modal>

      <style>{`
        @media (max-width: 768px) {
          .desktop-nav {
            display: none !important;
          }
          .bottom-nav {
            display: flex !important;
          }
        }
        @media (min-width: 769px) {
          .bottom-nav {
            display: none !important;
          }
        }
        .bottom-nav {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: var(--nav-bg);
          border-top: 1px solid var(--border-medium);
          box-shadow: var(--nav-shadow);
          display: none;
          justify-content: space-around;
          z-index: 100;
          padding: 0.5rem 1rem;
        }
        .bottom-nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.25rem;
          padding: 0.5rem;
          border-radius: var(--radius-md);
          transition: all var(--transition);
          cursor: pointer;
          text-decoration: none;
          color: var(--nav-muted);
          font-size: 0.7rem;
          font-weight: 500;
          flex: 1;
          text-align: center;
        }
        .bottom-nav-item.active {
          color: var(--nav-accent);
          background: var(--primary-blue-dim);
        }
        .bottom-nav-item svg {
          font-size: 1.25rem;
        }
        @media (max-width: 768px) {
          .page-wrapper {
            padding-bottom: 80px;
          }
        }
      `}</style>
    </>
  );
}