'use client';

import { UserStats } from './types';

interface UserStatsGridProps {
  stats: UserStats;
}

export function UserStatsGrid({ stats }: UserStatsGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <div className="p-4 rounded-2xl border border-border/80 bg-card/75 backdrop-blur-xl shadow-sm space-y-1">
        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Total Staff</span>
        <div className="text-xl font-bold text-foreground font-mono">{stats.total}</div>
        <p className="text-[11px] text-muted-foreground">Registered users</p>
      </div>

      <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 backdrop-blur-xl shadow-sm space-y-1">
        <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">Active Staff</span>
        <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">{stats.active}</div>
        <p className="text-[11px] text-emerald-600/70 dark:text-emerald-400/70">Full system access</p>
      </div>

      <div className="p-4 rounded-2xl border border-primary/30 bg-primary/5 backdrop-blur-xl shadow-sm space-y-1">
        <span className="text-[11px] font-bold text-primary uppercase tracking-wider block">Active Drivers</span>
        <div className="text-xl font-bold text-primary font-mono">{stats.drivers}</div>
        <p className="text-[11px] text-primary/70">Available for delivery dispatch</p>
      </div>

      <div className="p-4 rounded-2xl border border-rose-500/30 bg-rose-500/5 backdrop-blur-xl shadow-sm space-y-1">
        <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider block">Inactive / Blocked</span>
        <div className="text-xl font-bold text-rose-600 dark:text-rose-400 font-mono">{stats.inactive}</div>
        <p className="text-[11px] text-rose-600/70 dark:text-rose-400/70">Access revoked & hidden</p>
      </div>
    </div>
  );
}
