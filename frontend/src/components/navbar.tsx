'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sparkles,
  AlertTriangle,
  BrainCircuit,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { ThemeToggle } from '@/components/theme-toggle';

interface NavItem {
  href: string;
  label: string;
  icon?: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/courses', label: 'My courses' },
  { href: '/upload', label: 'Upload' },
  { href: '/tutor', label: 'Tutor' },
  { href: '/quiz', label: 'Quiz' },
  {
    href: '/understanding',
    label: 'My understanding',
    icon: <BrainCircuit className="w-4 h-4 shrink-0" />,
  },
  { href: '/dashboard', label: 'Revise' },
  { href: '/analytics', label: 'System evaluation' },
];

function NavbarContent() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [llmHealth, setLlmHealth] = useState<{
    configured: boolean;
    model: string;
    reason: string;
  } | null>(null);

  useEffect(() => {
    setMounted(true);
    api
      .getHealth()
      .then((data) => {
        if (data?.llm) {
          setLlmHealth({
            configured: data.llm.configured,
            model: data.llm.model,
            reason: data.llm.reason,
          });
        }
      })
      .catch(() => {
        setLlmHealth({
          configured: false,
          model: 'gemma4:e4b',
          reason: 'Backend health service unreachable',
        });
      });
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const activeUser = mounted ? user : null;

  return (
    <div className="w-full">
      {/* Offline Model Banner */}
      {llmHealth && !llmHealth.configured && (
        <div className="w-full bg-warning-soft border-b border-warning px-4 py-2 text-xs text-fg flex items-center justify-between">
          <div className="max-w-7xl mx-auto flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
            <span>
              <strong>Local Model Offline:</strong> Ollama is unreachable or model{' '}
              <code className="bg-surface-2 text-fg border border-line px-1 py-0.5 rounded font-mono font-medium">
                {llmHealth.model}
              </code>{' '}
              is not pulled ({llmHealth.reason}). Running in grounded extractive fallback mode.
            </span>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-40 w-full border-b border-line bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
          {/* Brand & Desktop Navigation */}
          <div className="flex items-center gap-4 xl:gap-6 min-w-0">
            <Link
              href={activeUser ? '/dashboard' : '/'}
              className="flex items-center gap-2.5 shrink-0 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-lg"
            >
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-xs group-hover:opacity-95 transition">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-lg text-fg tracking-tight flex items-center gap-1.5 leading-none">
                  AdaptiveLearn{' '}
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-primary-soft text-primary-fg font-semibold uppercase">
                    AI
                  </span>
                </span>
                <p className="hidden 2xl:block text-[10px] text-fg-3 font-medium mt-0.5">
                  Local Gemma Study Companion
                </p>
              </div>
            </Link>

            {/* Desktop Navigation (>= 1280px / xl) */}
            {activeUser && (
              <nav className="hidden xl:flex items-center gap-1 text-sm font-medium">
                {NAV_ITEMS.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-primary-soft text-primary-fg font-semibold'
                          : 'text-fg-2 hover:text-fg hover:bg-surface-2'
                      }`}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            )}
          </div>

          {/* Right controls: Theme Toggle, User/Auth, Mobile Menu Button */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <ThemeToggle />

            {activeUser ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 pl-1 sm:pl-2">
                  <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs shrink-0">
                    {activeUser.full_name?.charAt(0) || 'S'}
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-xs font-semibold text-fg leading-tight">
                      {activeUser.full_name}
                    </p>
                    <p className="text-[10px] text-fg-3">Self-Study Companion</p>
                  </div>
                  <button
                    onClick={logout}
                    title="Sign Out"
                    aria-label="Sign Out"
                    className="p-1.5 rounded-lg text-fg-3 hover:text-danger hover:bg-danger-soft transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>

                {/* Mobile Drawer Toggle Button (< 1280px / xl) */}
                <button
                  type="button"
                  aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                  aria-expanded={mobileMenuOpen}
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="xl:hidden p-2 rounded-lg text-fg-2 hover:text-fg hover:bg-surface-2 border border-line transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                  {mobileMenuOpen ? (
                    <X className="w-5 h-5" />
                  ) : (
                    <Menu className="w-5 h-5" />
                  )}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="px-3 sm:px-4 py-2 text-sm font-medium text-fg-2 hover:text-primary-fg transition rounded-lg"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="px-3 sm:px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg shadow-xs transition"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Collapsed Slide-Out Menu for Viewports < 1280px */}
        {activeUser && mobileMenuOpen && (
          <div className="xl:hidden border-t border-line bg-surface px-4 py-3 shadow-card">
            <nav className="flex flex-col gap-1 text-sm font-medium">
              {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`px-3 py-2 rounded-lg whitespace-nowrap transition-colors flex items-center gap-2 ${
                      isActive
                        ? 'bg-primary-soft text-primary-fg font-semibold'
                        : 'text-fg-2 hover:text-fg hover:bg-surface-2'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </header>
    </div>
  );
}

export function Navbar() {
  return (
    <Suspense
      fallback={<div className="h-16 border-b border-line bg-surface" />}
    >
      <NavbarContent />
    </Suspense>
  );
}
