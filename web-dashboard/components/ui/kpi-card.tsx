import React from 'react';
import { LucideIcon } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  colorScheme?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'sky';
  loading?: boolean;
}

const colorStyles = {
  indigo: {
    bg: 'bg-indigo-500/10 dark:bg-indigo-500/15',
    border: 'border-indigo-500/20 dark:border-indigo-500/30',
    text: 'text-indigo-600 dark:text-indigo-400',
    hover: 'hover:border-indigo-500/40',
  },
  emerald: {
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    border: 'border-emerald-500/20 dark:border-emerald-500/30',
    text: 'text-emerald-600 dark:text-emerald-400',
    hover: 'hover:border-emerald-500/40',
  },
  amber: {
    bg: 'bg-amber-500/10 dark:bg-amber-500/15',
    border: 'border-amber-500/20 dark:border-amber-500/30',
    text: 'text-amber-600 dark:text-amber-400',
    hover: 'hover:border-amber-500/40',
  },
  rose: {
    bg: 'bg-rose-500/10 dark:bg-rose-500/15',
    border: 'border-rose-500/20 dark:border-rose-500/30',
    text: 'text-rose-600 dark:text-rose-400',
    hover: 'hover:border-rose-500/40',
  },
  sky: {
    bg: 'bg-sky-500/10 dark:bg-sky-500/15',
    border: 'border-sky-500/20 dark:border-sky-500/30',
    text: 'text-sky-600 dark:text-sky-400',
    hover: 'hover:border-sky-500/40',
  },
};

export function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  colorScheme = 'indigo',
  loading = false,
}: KPICardProps) {
  const scheme = colorStyles[colorScheme] || colorStyles.indigo;

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/80 bg-card/60 p-4 sm:p-5 animate-pulse backdrop-blur-md">
        <div className="h-3.5 w-24 bg-muted rounded-md mb-3" />
        <div className="h-7 w-32 bg-muted rounded-lg mb-2" />
        <div className="h-3 w-16 bg-muted rounded-md" />
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border border-border/80 bg-card/75 p-4 sm:p-5 backdrop-blur-xl transition-all duration-200 ${scheme.hover} shadow-xs hover:shadow-md`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</span>
        {Icon && (
          <div className={`p-2 rounded-xl ${scheme.bg} ${scheme.text} border ${scheme.border}`}>
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
        )}
      </div>
      <div className="mt-2.5 flex items-baseline gap-2">
        <span className="text-xl sm:text-2xl font-extrabold text-foreground font-mono tracking-tight">{value}</span>
        {trend && (
          <span
            className={`text-xs font-semibold ${
              trend.isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {trend.value}
          </span>
        )}
      </div>
      {subtitle && <p className="mt-1 text-xs text-muted-foreground truncate">{subtitle}</p>}
    </div>
  );
}
