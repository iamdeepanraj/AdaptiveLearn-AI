'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  GraduationCap,
  BookOpen,
  Bot,
  BrainCircuit,
  Award,
  BarChart3,
  UploadCloud,
  LogOut,
  Sparkles,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

function NavbarContent() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [mounted, setMounted] = React.useState(false);
  const [llmHealth, setLlmHealth] = React.useState<{ configured: boolean; model: string; reason: string } | null>(null);

  React.useEffect(() => {
    setMounted(true);
    // Check local LLM status
    api.getHealth()
      .then((data) => {
        if (data && data.llm) {
          setLlmHealth({
            configured: data.llm.configured,
            model: data.llm.model,
            reason: data.llm.reason
          });
        }
      })
      .catch(() => {
        setLlmHealth({
          configured: false,
          model: 'gemma4:e4b',
          reason: 'Backend health service unreachable'
        });
      });
  }, []);

  const activeUser = mounted ? user : null;

  return (
    <div className="w-full">
      {/* Offline Model Banner */}
      {llmHealth && !llmHealth.configured && (
        <div className="w-full bg-amber-50 dark:bg-amber-950/80 border-b border-amber-200 dark:border-amber-800/60 px-4 py-2 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between shadow-xs">
          <div className="max-w-7xl mx-auto flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              <strong>Local Model Offline:</strong> Ollama is unreachable or model{' '}
              <code className="bg-amber-100 dark:bg-amber-900 px-1 py-0.5 rounded font-mono font-medium">
                {llmHealth.model}
              </code>{' '}
              is not pulled ({llmHealth.reason}). Running in grounded extractive fallback mode.
            </span>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-6">
            <Link href={activeUser ? '/dashboard' : '/'} className="flex items-center gap-2.5 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-lg text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-1.5">
                  AdaptiveLearn <span className="text-xs px-1.5 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-semibold uppercase">AI</span>
                </span>
                <p className="text-[10px] text-slate-500 font-medium">Local Gemma Study Companion</p>
              </div>
            </Link>

            {/* Nav Links: My courses, Upload, Tutor, Quiz, My understanding, Revise, System evaluation */}
            {activeUser && (
              <nav className="hidden lg:flex items-center gap-1 ml-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                <Link
                  href="/courses"
                  className={`px-3 py-1.5 rounded-lg transition ${
                    pathname === '/courses' ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-semibold' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  My courses
                </Link>
                <Link
                  href="/upload"
                  className={`px-3 py-1.5 rounded-lg transition ${
                    pathname === '/upload' ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-semibold' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  Upload
                </Link>
                <Link
                  href="/tutor"
                  className={`px-3 py-1.5 rounded-lg transition ${
                    pathname === '/tutor' ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-semibold' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  Tutor
                </Link>
                <Link
                  href="/quiz"
                  className={`px-3 py-1.5 rounded-lg transition ${
                    pathname === '/quiz' ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-semibold' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  Quiz
                </Link>
                <Link
                  href="/understanding"
                  className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                    pathname === '/understanding' ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-semibold' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <BrainCircuit className="w-4 h-4 text-indigo-500" />
                  My understanding
                </Link>
                <Link
                  href="/dashboard"
                  className={`px-3 py-1.5 rounded-lg transition ${
                    pathname === '/dashboard' ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-semibold' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  Revise
                </Link>
                <Link
                  href="/analytics"
                  className={`px-3 py-1.5 rounded-lg transition ${
                    pathname === '/analytics' ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-semibold' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  System evaluation
                </Link>
              </nav>
            )}
          </div>

          {/* User Profile */}
          <div className="flex items-center gap-3">
            {activeUser ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 pl-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-blue-500 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                    {activeUser.full_name?.charAt(0) || 'S'}
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-tight">
                      {activeUser.full_name}
                    </p>
                    <p className="text-[10px] text-slate-500">Self-Study Companion</p>
                  </div>
                  <button
                    onClick={logout}
                    title="Sign Out"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition ml-2"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:text-indigo-600 transition"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>
    </div>
  );
}

export function Navbar() {
  return (
    <React.Suspense fallback={<div className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95" />}>
      <NavbarContent />
    </React.Suspense>
  );
}
