'use client';

import React from 'react';
import { useTheme } from './theme-provider';
import { Sun, Moon, Monitor } from 'lucide-react';

interface ThemeToggleProps {
  className?: string;
  variant?: 'pill' | 'compact';
}

export function ThemeToggle({ className = '', variant = 'pill' }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();

  if (variant === 'compact') {
    const nextTheme = theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark';
    return (
      <button
        type="button"
        onClick={() => setTheme(nextTheme)}
        className={`p-2 rounded-xl border border-border/80 bg-muted/60 hover:bg-muted text-foreground transition-all duration-150 active:scale-95 ${className}`}
        title={`Current: ${theme}. Click to switch.`}
        aria-label="Toggle visual theme"
      >
        {theme === 'light' ? (
          <Sun className="h-4 w-4 text-amber-500" />
        ) : theme === 'dark' ? (
          <Moon className="h-4 w-4 text-indigo-400" />
        ) : (
          <Monitor className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
    );
  }

  return (
    <div
      className={`inline-flex items-center p-0.5 rounded-xl border border-border/80 bg-muted/60 backdrop-blur-md text-muted-foreground ${className}`}
      role="group"
      aria-label="Theme selection"
    >
      <button
        type="button"
        onClick={() => setTheme('light')}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-150 ${
          theme === 'light'
            ? 'bg-card text-foreground shadow-xs font-semibold'
            : 'hover:text-foreground hover:bg-muted/50'
        }`}
        title="Light theme"
      >
        <Sun className="h-3.5 w-3.5 text-amber-500" />
        <span className="hidden sm:inline">Light</span>
      </button>
      <button
        type="button"
        onClick={() => setTheme('dark')}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-150 ${
          theme === 'dark'
            ? 'bg-card text-foreground shadow-xs font-semibold'
            : 'hover:text-foreground hover:bg-muted/50'
        }`}
        title="Dark theme"
      >
        <Moon className="h-3.5 w-3.5 text-indigo-400" />
        <span className="hidden sm:inline">Dark</span>
      </button>
      <button
        type="button"
        onClick={() => setTheme('system')}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-150 ${
          theme === 'system'
            ? 'bg-card text-foreground shadow-xs font-semibold'
            : 'hover:text-foreground hover:bg-muted/50'
        }`}
        title="Follow system theme"
      >
        <Monitor className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Auto</span>
      </button>
    </div>
  );
}
