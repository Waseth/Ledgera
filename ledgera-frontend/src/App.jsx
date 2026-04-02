import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

import { ThemeProvider }  from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider }  from './context/ToastContext';

import Navbar       from './components/Navbar';
import LoginPage    from './pages/LoginPage';
import Dashboard    from './pages/Dashboard';
import SalesPage    from './pages/SalesPage';
import ProductsPage from './pages/ProductsPage';
import DebtsPage    from './pages/DebtsPage';
import ReportsPage  from './pages/ReportsPage';
import ShopkeepersPage from './pages/ShopkeepersPage';
import LoadingScreen from './components/LoadingScreen';

/* Page transition wrapper */
const PageMotion = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 14 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{    opacity: 0, y: -8 }}
    transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
  >
    {children}
  </motion.div>
);

/* Route guard */
function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user)   return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/sales" replace />;
  return children;
}

function AnimatedRoutes() {
  const location = useLocation();
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={
          user ? <Navigate to={user.role === 'admin' ? '/dashboard' : '/sales'} replace /> :
          <PageMotion><LoginPage /></PageMotion>
        } />

        <Route path="/dashboard" element={
          <ProtectedRoute adminOnly>
            <PageMotion><Dashboard /></PageMotion>
          </ProtectedRoute>
        } />

        <Route path="/sales" element={
          <ProtectedRoute>
            <PageMotion><SalesPage /></PageMotion>
          </ProtectedRoute>
        } />

        <Route path="/products" element={
          <ProtectedRoute>
            <PageMotion><ProductsPage /></PageMotion>
          </ProtectedRoute>
        } />

        <Route path="/debts" element={
          <ProtectedRoute>
            <PageMotion><DebtsPage /></PageMotion>
          </ProtectedRoute>
        } />

        <Route path="/reports" element={
          <ProtectedRoute>
            <PageMotion><ReportsPage /></PageMotion>
          </ProtectedRoute>
        } />

        <Route path="/shopkeepers" element={
          <ProtectedRoute adminOnly>
            <PageMotion><ShopkeepersPage /></PageMotion>
          </ProtectedRoute>
        } />

        <Route path="*" element={
          <Navigate to={user ? (user.role === 'admin' ? '/dashboard' : '/sales') : '/login'} replace />
        } />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <AppShell />
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

function AppShell() {
  const { user } = useAuth();
  const location = useLocation();
  const isLogin = location.pathname === '/login';

  return (
    <>
      {user && !isLogin && <Navbar />}
      <AnimatedRoutes />
    </>
  );
}