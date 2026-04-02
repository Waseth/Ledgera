import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);   // { role, email }
  const [loading, setLoading] = useState(true);

  // Check session on mount by pinging a protected endpoint
  useEffect(() => {
    api.get('/days/status')
      .then(() => {
        // Session alive — read role from localStorage (set on login)
        const stored = localStorage.getItem('ledgera-user');
        if (stored) setUser(JSON.parse(stored));
        else setUser({ role: 'unknown' });
      })
      .catch(() => {
        setUser(null);
        localStorage.removeItem('ledgera-user');
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api.post('/auth/login', { email, password });
    const role = data.redirect.includes('dashboard') ? 'admin' : 'shopkeeper';
    const userObj = { role, email };
    setUser(userObj);
    localStorage.setItem('ledgera-user', JSON.stringify(userObj));
    return role;
  }, []);

  const logout = useCallback(async () => {
    await api.post('/auth/logout', {}).catch(() => {});
    setUser(null);
    localStorage.removeItem('ledgera-user');
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);