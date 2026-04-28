'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from './api/auth';
import { User, LoginCredentials } from '@/types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  microsoftLogin: (accessToken: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function resolvePostLoginRedirect(user: User): string {
  if (user.force_password_change) return '/force-password-change';
  return '/overview';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const token = localStorage.getItem('access_token');
      if (token) {
        const currentUser = await authApi.getCurrentUser();
        setUser(currentUser);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshUser() {
    const currentUser = await authApi.getCurrentUser();
    setUser(currentUser);
  }

  async function login(credentials: LoginCredentials) {
    try {
      const tokens = await authApi.login(credentials);
      localStorage.setItem('access_token', tokens.access);
      localStorage.setItem('refresh_token', tokens.refresh);

      const currentUser = await authApi.getCurrentUser();
      setUser(currentUser);
      router.push(resolvePostLoginRedirect(currentUser));
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }

  async function microsoftLogin(accessToken: string) {
    try {
      const tokens = await authApi.microsoftOAuth(accessToken);
      localStorage.setItem('access_token', tokens.access);
      localStorage.setItem('refresh_token', tokens.refresh);

      const currentUser = await authApi.getCurrentUser();
      setUser(currentUser);
      router.push(resolvePostLoginRedirect(currentUser));
    } catch (error) {
      console.error('Microsoft login failed:', error);
      throw error;
    }
  }

  async function logout() {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        await authApi.logout(refreshToken);
      }
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      setUser(null);
      router.push('/login');
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        microsoftLogin,
        logout,
        refreshUser,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
