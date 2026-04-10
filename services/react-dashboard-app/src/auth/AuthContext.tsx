import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface AuthState {
  isAuthenticated: boolean;
  email: string | null;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const VALID_EMAIL = "thomas.atwood@geodecapital.com";
const VALID_PASSWORD = "demo12345";
const AUTH_KEY = "geode_dashboard_auth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const stored = localStorage.getItem(AUTH_KEY);
    return stored ? { isAuthenticated: true, email: JSON.parse(stored).email } : { isAuthenticated: false, email: null };
  });

  const login = useCallback((email: string, password: string) => {
    if (email === VALID_EMAIL && password === VALID_PASSWORD) {
      localStorage.setItem(AUTH_KEY, JSON.stringify({ email }));
      setState({ isAuthenticated: true, email });
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_KEY);
    setState({ isAuthenticated: false, email: null });
  }, []);

  return <AuthContext.Provider value={{ ...state, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
