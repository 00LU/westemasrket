import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const queryClient = useQueryClient();

  const logout = useCallback(() => {
    localStorage.removeItem('wm_user');
    localStorage.removeItem('wm_token');
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  const saveSession = useCallback(async (data) => {
    await queryClient.cancelQueries();
    queryClient.clear();
    localStorage.setItem('wm_token', data.token);
    localStorage.setItem('wm_user', JSON.stringify(data.user));
    setSessionError('');
    setUser(data.user);
  }, [queryClient]);

  useEffect(() => {
    const controller = new AbortController();
    const token = localStorage.getItem('wm_token');
    if (!token) {
      logout();
      setLoading(false);
      return undefined;
    }

    api.get('/auth/me', { signal: controller.signal })
      .then(({ data }) => {
        if (controller.signal.aborted || localStorage.getItem('wm_token') !== token) return;
        localStorage.setItem('wm_user', JSON.stringify(data));
        setUser(data);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        if (error.response?.status === 401) logout();
        else setSessionError('Impossibile verificare la sessione. Controlla la connessione e ricarica la pagina.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [logout]);

  useEffect(() => {
    window.addEventListener('wm-session-expired', logout);
    return () => window.removeEventListener('wm-session-expired', logout);
  }, [logout]);

  const login = useCallback(async (payload) => {
    const { data } = await api.post('/auth/login', payload);
    await saveSession(data);
    return data.user;
  }, [saveSession]);

  const register = useCallback(async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    await saveSession(data);
    return data.user;
  }, [saveSession]);

  const value = useMemo(() => ({ user, login, register, logout, loading, sessionError }), [user, login, register, logout, loading, sessionError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
