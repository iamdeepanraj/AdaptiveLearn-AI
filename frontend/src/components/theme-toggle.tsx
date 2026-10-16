'use client';

import React, { useEffect, useState } from 'react';
import { Sun, Moon, Laptop } from 'lucide-react';

export type ThemeChoice = 'light' | 'dark' | 'system';

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeChoice>('system');
  const [mounted, setMounted] = useState(false);

  const applyTheme = (choice: ThemeChoice) => {
    try {
      localStorage.setItem('adaptivelearn_theme', choice);
    } catch (e) {
      // ignore
    }
    setTheme(choice);

    const isDark =
      choice === 'dark' ||
      (choice === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  useEffect(() => {
    setMounted(true);
    let stored: ThemeChoice = 'system';
    try {
      const val = localStorage.getItem('adaptivelearn_theme');
      if (val === 'light' || val === 'dark' || val === 'system') {
        stored = val;
      }
    } catch (e) {
      // ignore
    }
    setTheme(stored);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      try {
        const current = localStorage.getItem('adaptivelearn_theme') || 'system';
        if (current === 'system') {
          if (mediaQuery.matches) {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        }
      } catch (e) {
        // ignore
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 h-8 w-24" />
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Theme selection"
      className="flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs shadow-2xs"
    >
      <button
        type="button"
        role="radio"
        aria-checked={theme === 'light'}
        onClick={() => applyTheme('light')}
        className={`p-1.5 rounded-lg transition cursor-pointer flex items-center justify-center ${
          theme === 'light'
            ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-2xs font-bold'
            : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
        }`}
        title="Light theme"
      >
        <Sun className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={theme === 'system'}
        onClick={() => applyTheme('system')}
        className={`p-1.5 rounded-lg transition cursor-pointer flex items-center justify-center ${
          theme === 'system'
            ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-2xs font-bold'
            : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
        }`}
        title="System default"
      >
        <Laptop className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={theme === 'dark'}
        onClick={() => applyTheme('dark')}
        className={`p-1.5 rounded-lg transition cursor-pointer flex items-center justify-center ${
          theme === 'dark'
            ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-2xs font-bold'
            : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
        }`}
        title="Dark theme"
      >
        <Moon className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
