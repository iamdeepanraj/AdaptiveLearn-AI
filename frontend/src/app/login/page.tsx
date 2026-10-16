'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Sparkles, Lock, Mail, ArrowRight, UserCheck, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login, switchDemoRole } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = async (role: 'student' | 'teacher') => {
    setError(null);
    setLoading(true);
    try {
      await switchDemoRole(role);
    } catch (err: any) {
      setError(err.message || 'Failed to sign in demo account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-md bg-surface rounded-3xl border border-line shadow-card p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary text-white shadow-xs mb-2">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-fg tracking-tight">
            Welcome to AdaptiveLearn
          </h2>
          <p className="text-xs text-fg-3">
            Sign in to access your course materials and adaptive learning models.
          </p>
        </div>

        {/* Quick Demo Access Bar */}
        <div className="p-3.5 rounded-2xl bg-surface-2 border border-line space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary-fg text-center">
            Instant Demo Sign-In
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickDemo('student')}
              className="px-3 py-2 bg-surface hover:bg-surface-3 text-fg rounded-xl text-xs font-semibold border border-line shadow-2xs transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5 text-primary-fg" />
              <span>Student Demo</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemo('teacher')}
              className="px-3 py-2 bg-surface hover:bg-surface-3 text-fg rounded-xl text-xs font-semibold border border-line shadow-2xs transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-primary-fg" />
              <span>Teacher Demo</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-danger-soft border border-danger/30 text-xs text-danger font-medium text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-fg-3 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-fg-3 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@domain.edu"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-line-strong bg-surface-2 text-fg text-sm placeholder:text-fg-3 focus:outline-none focus:ring-2 focus:ring-focus transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-fg-3 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-fg-3 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-line-strong bg-surface-2 text-fg text-sm placeholder:text-fg-3 focus:outline-none focus:ring-2 focus:ring-focus transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white font-semibold text-sm shadow-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>Sign In to Account</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-xs text-fg-3">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="font-semibold text-primary-fg hover:underline transition">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
