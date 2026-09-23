import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { authService, type AuthUser } from './auth-service';

const TOKEN_KEY = 'docquiz-ai.auth.token';
const USER_KEY = 'docquiz-ai.auth.user';

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (name: string, email: string, phone: string, password: string) => Promise<AuthUser>;
  sendPhoneOtp: (countryCode: string, phoneNumber: string) => Promise<{ message: string; phone: string; expiresInSeconds: number }>;
  verifyPhoneOtp: (countryCode: string, phoneNumber: string, otp: string) => Promise<AuthUser>;
  sendGoogleEmailOtp: (email: string, name?: string) => Promise<{ message: string; email: string; expiresInSeconds: number }>;
  verifyGoogleEmailOtp: (email: string, otp: string, name?: string) => Promise<AuthUser>;
  loginWithGoogle: (params: { email: string; name?: string; avatarUrl?: string }) => Promise<AuthUser>;
  demoLogin: () => Promise<AuthUser>;
  forgotPassword: (email: string) => Promise<{ message: string; email: string }>;
  logout: () => Promise<void>;
}


const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore existing session on mount
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      const storedUser = localStorage.getItem(USER_KEY);

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch (e) {
      console.error('Failed to parse cached auth state:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveSession = (newToken: string, newUser: AuthUser) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
  };

  const clearSession = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  };

  const login = async (email: string, password: string) => {
    const { token: newToken, user: newUser } = await authService.login(email, password);
    saveSession(newToken, newUser);
    return newUser;
  };

  const register = async (name: string, email: string, phone: string, password: string) => {
    const { token: newToken, user: newUser } = await authService.register(name, email, phone, password);
    saveSession(newToken, newUser);
    return newUser;
  };

  const sendPhoneOtp = async (countryCode: string, phoneNumber: string) => {
    return await authService.sendPhoneOtp(countryCode, phoneNumber);
  };

  const verifyPhoneOtp = async (countryCode: string, phoneNumber: string, otp: string) => {
    const { token: newToken, user: newUser } = await authService.verifyPhoneOtp(countryCode, phoneNumber, otp);
    saveSession(newToken, newUser);
    return newUser;
  };

  const sendGoogleEmailOtp = async (email: string, name?: string) => {
    return await authService.sendGoogleEmailOtp(email, name);
  };

  const verifyGoogleEmailOtp = async (email: string, otp: string, name?: string) => {
    const { token: newToken, user: newUser } = await authService.verifyGoogleEmailOtp(email, otp, name);
    saveSession(newToken, newUser);
    return newUser;
  };

  const loginWithGoogle = async (params: { email: string; name?: string; avatarUrl?: string }) => {
    const { token: newToken, user: newUser } = await authService.googleAuth(params);
    saveSession(newToken, newUser);
    return newUser;
  };



  const demoLogin = async () => {
    return login('alex.morgan@docquiz.ai', 'DocQuiz2026!');
  };

  const forgotPassword = async (email: string) => {
    return await authService.forgotPassword(email);
  };

  const logout = async () => {
    await authService.logout(token);
    clearSession();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: Boolean(user && token),
        isLoading,
        login,
        register,
        sendPhoneOtp,
        verifyPhoneOtp,
        sendGoogleEmailOtp,
        verifyGoogleEmailOtp,
        loginWithGoogle,
        demoLogin,
        forgotPassword,
        logout,
      }}
    >

      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
