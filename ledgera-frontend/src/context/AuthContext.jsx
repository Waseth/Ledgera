import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('ledgera-user');
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Just check if token exists, don't make unnecessary API calls
    const token = localStorage.getItem('auth_token');
    if (token && user) {
      setLoading(false);
    } else if (!token) {
      setUser(null);
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, [user]);

  const login = useCallback(async (email, password) => {
    const data = await api.login(email, password);
    const userObj = {
      role: data.user.role,
      email: data.user.email,
      name: data.user.name,
      id: data.user.id
    };
    setUser(userObj);
    return data.user.role;
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);