import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import BoqService from '../services/BoqService';

// ── Context ───────────────────────────────────────────────────────────────────
const AuthContext = createContext(null);

const TOKEN_KEY = 'flyyai_token';
const USER_KEY  = 'flyyai_user';

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user,         setUser]         = useState(null);   // { id, email, full_name, company, role }
  const [token,        setToken]        = useState(null);
  const [authLoading,  setAuthLoading]  = useState(true);   // checking saved session
  const [authError,    setAuthError]    = useState('');

  // ── Restore session on mount ─────────────────────────────────────────────
  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const savedUser  = localStorage.getItem(USER_KEY);

    if (savedToken && savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setToken(savedToken);
      setUser(parsedUser);

      // Verify token is still valid with backend
      BoqService.getMe(savedToken)
        .then((freshUser) => {
          setUser(freshUser);
          localStorage.setItem(USER_KEY, JSON.stringify(freshUser));
        })
        .catch(() => {
          // Token expired or invalid — clear session
          _clearSession();
        })
        .finally(() => setAuthLoading(false));
    } else {
      setAuthLoading(false);
    }
  }, []);

  // ── Internal helpers ─────────────────────────────────────────────────────
  const _saveSession = (newToken, newUser) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    BoqService.setAuthToken(newToken);
  };

  const _clearSession = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
    BoqService.setAuthToken(null);
  };

  // ── Public actions ────────────────────────────────────────────────────────
  const register = useCallback(async ({ email, password, fullName, company }) => {
    setAuthError('');
    const data = await BoqService.register({ email, password, fullName, company });
    _saveSession(data.token, data.user);
    return data.user;
  }, []);

  const login = useCallback(async ({ email, password }) => {
    setAuthError('');
    const data = await BoqService.login({ email, password });
    _saveSession(data.token, data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    _clearSession();
  }, []);

  // Set token on axios whenever it changes
  useEffect(() => {
    if (token) BoqService.setAuthToken(token);
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, authLoading, authError, setAuthError, register, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
