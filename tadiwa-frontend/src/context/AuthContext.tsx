import React, { createContext, useContext, useEffect, useState } from 'react';
import { authApi, ApiError, registerSessionHandlers, type BackendUser } from '../lib/api';

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
  // True when the session was torn down automatically because the access
  // token expired and the refresh token couldn't renew it — as opposed to
  // the user clicking Logout. ProtectedRoute surfaces this on the redirect
  // to /login so the reason isn't a silent mystery; login() clears it.
  sessionExpired: boolean;
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
  const [sessionExpired, setSessionExpired] = useState(false);

  // Wire the API layer's 401 handling back into this context: it has no
  // React state of its own, so it calls back here to pull the current
  // refresh token, persist a renewed access token, or tear the session
  // down when the refresh token itself is dead. Registered once — these
  // callbacks close over the stable setState functions, not stale state.
  useEffect(() => {
    registerSessionHandlers({
      getRefreshToken: () => readStoredSession()?.refreshToken ?? null,
      onTokenRefreshed: (newAccessToken) => {
        const stored = readStoredSession();
        if (stored) writeStoredSession({ ...stored, accessToken: newAccessToken });
        setAccessToken(newAccessToken);
      },
      onSessionExpired: () => {
        writeStoredSession(null);
        setUser(null);
        setAccessToken(null);
        setSessionExpired(true);
      },
    });
  }, []);

  // On mount, actively validate whatever session is stored — never just
  // trust stale localStorage data. An expired access token gets refreshed
  // transparently by apiFetch's own 401 handling (registered above); if
  // that also fails (dead refresh token, or the backend unreachable), the
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
        // If the token had expired, apiFetch already refreshed it silently
        // and persisted the new one via onTokenRefreshed — re-read storage
        // so we pick that up instead of re-applying the stale one below.
        const current = readStoredSession() ?? stored;
        const nextSession = { ...current, user: me };
        writeStoredSession(nextSession);
        setUser(toAuthUser(me));
        setAccessToken(nextSession.accessToken);
      } catch {
        // A genuine 401 already went through onSessionExpired above (which
        // cleared storage/state); this also covers plain network errors,
        // where it hasn't — clear here too so a stale session can't linger.
        if (cancelled) return;
        writeStoredSession(null);
        setUser(null);
        setAccessToken(null);
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
      setSessionExpired(false);
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
    setSessionExpired(false); // an explicit logout is not an "expired" one
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
    <AuthContext.Provider value={{ user, accessToken, isAuthenticated: !!user, isLoading, sessionExpired, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
