import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  const login = useCallback(async (payload) => {
    const { data } = await api.post('/auth/login', payload);
    setUser(data.user);
    localStorage.setItem('wm_user', JSON.stringify(data.user));
    localStorage.setItem('wm_token', data.token);
    return data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    setUser(data.user);
    localStorage.setItem('wm_user', JSON.stringify(data.user));
    localStorage.setItem('wm_token', data.token);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('wm_user');
    localStorage.removeItem('wm_token');
  }, []);

  const restore = useCallback(() => {
    const cached = localStorage.getItem('wm_user');
    if (!cached) return;

    try {
      setUser(JSON.parse(cached));
    } catch {
      localStorage.removeItem('wm_user');
      localStorage.removeItem('wm_token');
    }
  }, []);

  const value = useMemo(() => ({ user, login, register, logout, restore }), [user, login, register, logout, restore]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
