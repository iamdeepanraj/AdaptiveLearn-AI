'use client';

import React, { useEffect, useState } from 'react';
import { Sun, Moon, Laptop } from 'lucide-react';
import { useTheme } from 'next-themes';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className="flex items-center p-0.5 rounded-lg bg-surface-2 border border-line h-8 w-24"
        aria-hidden="true"
      />
    );
  }

  const handleSelect = (mode: 'light' | 'system' | 'dark') => {
    try {
      setTheme(mode);
    } catch {
      // safe fallback
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label="Theme selection"
      className="flex items-center p-0.5 rounded-lg bg-surface-2 border border-line text-xs"
    >
      <button
        type="button"
        role="radio"
        aria-checked={theme === 'light'}
        aria-pressed={theme === 'light'}
        aria-label="Light theme"
        onClick={() => handleSelect('light')}
        className={`px-2 py-1 rounded-md transition-colors cursor-pointer flex items-center justify-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 ${
          theme === 'light'
            ? 'bg-surface text-primary-fg shadow-sm font-medium'
            : 'text-fg-2 hover:text-fg'
        }`}
        title="Light theme"
      >
        <Sun className="w-3.5 h-3.5" />
        <span className="sr-only sm:not-sr-only sm:inline text-[11px]">Light</span>
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={theme === 'system'}
        aria-pressed={theme === 'system'}
        aria-label="System default"
        onClick={() => handleSelect('system')}
        className={`px-2 py-1 rounded-md transition-colors cursor-pointer flex items-center justify-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 ${
          theme === 'system'
            ? 'bg-surface text-primary-fg shadow-sm font-medium'
            : 'text-fg-2 hover:text-fg'
        }`}
        title="System default"
      >
        <Laptop className="w-3.5 h-3.5" />
        <span className="sr-only sm:not-sr-only sm:inline text-[11px]">Auto</span>
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={theme === 'dark'}
        aria-pressed={theme === 'dark'}
        aria-label="Dark theme"
        onClick={() => handleSelect('dark')}
        className={`px-2 py-1 rounded-md transition-colors cursor-pointer flex items-center justify-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 ${
          theme === 'dark'
            ? 'bg-surface text-primary-fg shadow-sm font-medium'
            : 'text-fg-2 hover:text-fg'
        }`}
        title="Dark theme"
      >
        <Moon className="w-3.5 h-3.5" />
        <span className="sr-only sm:not-sr-only sm:inline text-[11px]">Dark</span>
      </button>
    </div>
  );
}
