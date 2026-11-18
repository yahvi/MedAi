import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, setToken } from '../services/api';
import { useSettings } from './SettingsContext';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { hydrateFromServer } = useSettings();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('medai_token');
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then((res) => {
        setUser(res.user);
        hydrateFromServer(res.preferences);
      })
      .catch(() => {
        setToken('');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const res = await api.login({ email, password });
    setToken(res.token);
    setUser(res.user);
    hydrateFromServer(res.preferences);
    return res.user;
  };

  const register = async (name, email, password) => {
    const res = await api.register({ name, email, password });
    setToken(res.token);
    setUser(res.user);
    hydrateFromServer(res.preferences);
    return res.user;
  };

  const demoLogin = async () => {
    const res = await api.demoLogin();
    setToken(res.token);
    setUser(res.user);
    hydrateFromServer(res.preferences);
    return res.user;
  };

  const logout = () => {
    setToken('');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, demoLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

