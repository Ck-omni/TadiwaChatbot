import React, { createContext, useContext, useEffect, useState } from 'react';
import { authApi, ApiError, type BackendUser } from '../lib/api';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: BackendUser['role'];
}

interface LoginResult {
  success: boolean;
  error?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => void;
  // Re-fetches /auth/me and updates both context state and the stored
  // session — call after a self-service profile edit so the header
  // (name/initials) reflects the change without a full re-login.
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const STORAGE_KEY = 'omni_hd_session';

interface StoredSession {
  accessToken: string;
  refreshToken: string;
  user: BackendUser;
}

function toAuthUser(u: BackendUser): AuthUser {
  return { id: u.id, name: u.fullName, email: u.email, role: u.role };
}

function readStoredSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.accessToken || !parsed?.refreshToken || !parsed?.user) return null; // stale shape from the old demo auth
    return parsed as StoredSession;
  } catch {
    return null;
  }
}

function writeStoredSession(session: StoredSession | null) {
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable — the session just won't survive a refresh.
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount, actively validate whatever session is stored — never just
  // trust stale localStorage data. An expired access token gets one refresh
  // attempt; if that also fails (or the backend is unreachable), the
  // session is cleared and the user lands back on /login. This is stricter
  // than optimistically trusting local data, which is the right tradeoff
  // for an internal tool talking to a real auth backend.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const stored = readStoredSession();
      if (!stored) {
        setIsLoading(false);
        return;
      }

      try {
        const me = await authApi.me(stored.accessToken);
        if (cancelled) return;
        setUser(toAuthUser(me));
        setAccessToken(stored.accessToken);
      } catch {
        try {
          const { accessToken: refreshedToken } = await authApi.refresh(stored.refreshToken);
          const me = await authApi.me(refreshedToken);
          if (cancelled) return;
          const nextSession = { ...stored, accessToken: refreshedToken, user: me };
          writeStoredSession(nextSession);
          setUser(toAuthUser(me));
          setAccessToken(refreshedToken);
        } catch {
          if (cancelled) return;
          writeStoredSession(null);
          setUser(null);
          setAccessToken(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (email: string, password: string): Promise<LoginResult> => {
    try {
      const result = await authApi.login(email, password);
      writeStoredSession({ accessToken: result.accessToken, refreshToken: result.refreshToken, user: result.user });
      setUser(toAuthUser(result.user));
      setAccessToken(result.accessToken);
      return { success: true };
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Unable to reach the server. Try again.';
      return { success: false, error: message };
    }
  };

  const logout = () => {
    const stored = readStoredSession();
    // Clear local state immediately — logout should feel instant. The
    // server-side revoke is fire-and-forget: if it fails (network blip,
    // already-expired token), the end state the user wants — signed out
    // locally — is already true either way.
    writeStoredSession(null);
    setUser(null);
    setAccessToken(null);
    if (stored?.refreshToken) {
      authApi.logout(stored.refreshToken).catch(() => {});
    }
  };

  const refreshUser = async () => {
    if (!accessToken) return;
    try {
      const me = await authApi.me(accessToken);
      const stored = readStoredSession();
      if (stored) writeStoredSession({ ...stored, user: me });
      setUser(toAuthUser(me));
    } catch {
      // Best-effort — the header just keeps showing whatever it had.
    }
  };

  return (
    <AuthContext.Provider value={{ user, accessToken, isAuthenticated: !!user, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
