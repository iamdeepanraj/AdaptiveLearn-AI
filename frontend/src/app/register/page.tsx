'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Lock, Mail, User, ArrowRight, GraduationCap } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function RegisterPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register({
        full_name: fullName,
        email,
        password,
        role: 'student',
      });
      router.push('/courses');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-md bg-surface rounded-3xl border border-line shadow-card p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary text-white shadow-xs mb-2">
            <GraduationCap className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-fg tracking-tight">
            Create Student Account
          </h2>
          <p className="text-xs text-fg-3">
            Join AdaptiveLearn AI as your personal local study companion.
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-danger-soft border border-danger/30 text-xs text-danger font-medium text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-fg-3 mb-1.5">
              Full Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-fg-3 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Doe"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-line-strong bg-surface-2 text-fg text-sm placeholder:text-fg-3 focus:outline-none focus:ring-2 focus:ring-focus transition"
              />
            </div>
          </div>

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
                placeholder="jane@university.edu"
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
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
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
                <span>Complete Registration</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-xs text-fg-3">
          Already registered?{' '}
          <Link href="/login" className="font-semibold text-primary-fg hover:underline transition">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
