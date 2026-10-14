'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, User } from './api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; full_name: string; role: string }) => Promise<void>;
  logout: () => void;
  switchDemoRole: (role: 'student' | 'teacher') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();

  useEffect(() => {
    const savedToken = localStorage.getItem('adaptivelearn_token');
    if (savedToken) {
      setToken(savedToken);
      api.getMe()
        .then((userData) => setUser(userData))
        .catch(() => {
          localStorage.removeItem('adaptivelearn_token');
          setToken(null);
          setUser(null);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await api.login(email, password);
      localStorage.setItem('adaptivelearn_token', res.access_token);
      setToken(res.access_token);
      const userData = await api.getMe();
      setUser(userData);
      router.push('/dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: { email: string; password: string; full_name: string; role: string }) => {
    setIsLoading(true);
    try {
      const res = await api.register(data);
      localStorage.setItem('adaptivelearn_token', res.access_token);
      setToken(res.access_token);
      const userData = await api.getMe();
      setUser(userData);
      router.push('/dashboard');
    } finally {
      setIsLoading(false);
    }
  };


  const logout = () => {
    localStorage.removeItem('adaptivelearn_token');
    setToken(null);
    setUser(null);
    router.push('/login');
  };

  const switchDemoRole = async (role: 'student' | 'teacher') => {
    if (role === 'student') {
      await login('student@adaptivelearn.ai', 'StudentPass123!');
    } else {
      await login('teacher@adaptivelearn.ai', 'TeacherPass123!');
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout, switchDemoRole }}>
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
