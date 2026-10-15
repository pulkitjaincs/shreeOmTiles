import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  AuthUser,
  getMobileToken,
  getMobileUser,
  setMobileAuth,
  clearMobileAuth,
  setOnUnauthorizedHandler,
} from './api';
import { setupPushNotifications, unregisterPushTokenWithBackend } from './notifications';

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: AuthUser) => Promise<void>;
  updateUser: (user: AuthUser) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    setOnUnauthorizedHandler(() => {
      setToken(null);
      setUser(null);
    });

    return () => {
      setOnUnauthorizedHandler(null);
    };
  }, []);

  useEffect(() => {
    async function loadStoredSession() {
      try {
        const storedToken = await getMobileToken();
        const storedUser = await getMobileUser();
        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(storedUser);
          // Register device push token with backend for active session
          setupPushNotifications().catch((err) => {
            console.warn('[Push] Auto-setup push notification error:', err);
          });
        }
      } catch (err) {
        console.warn('Failed to load stored auth session', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadStoredSession();
  }, []);

  const login = async (newToken: string, newUser: AuthUser) => {
    await setMobileAuth(newToken, newUser);
    setToken(newToken);
    setUser(newUser);
    // Request permissions and register push token on fresh login
    setupPushNotifications().catch((err) => {
      console.warn('[Push] Setup push notification on login error:', err);
    });
  };

  const updateUser = async (newUser: AuthUser) => {
    await setMobileAuth(token, newUser);
    setUser(newUser);
  };

  const logout = async () => {
    await unregisterPushTokenWithBackend().catch((err) => {
      console.warn('[Push] Unregister push token on logout error:', err);
    });
    await clearMobileAuth();
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: Boolean(token),
        isLoading,
        login,
        updateUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
