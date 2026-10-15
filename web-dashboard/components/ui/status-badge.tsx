import React from 'react';

type BadgeVariant =
  | 'success' // green/emerald
  | 'warning' // amber/yellow
  | 'danger'  // rose/red
  | 'info'    // sky/indigo
  | 'neutral'; // neutral/muted

interface StatusBadgeProps {
  status: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
}

const statusVariantMap: Record<string, BadgeVariant> = {
  // Invoice & Payment statuses
  PAID: 'success',
  CONFIRMED: 'success',
  PARTIAL: 'warning',
  CREATED: 'info',
  PENDING: 'warning',
  FAILED: 'danger',

  // Delivery statuses
  DELIVERED: 'success',
  IN_TRANSIT: 'info',
  ASSIGNED: 'warning',
  RETURNED: 'danger',

  // Credit statuses
  CLEARED: 'success',
  UNPAID: 'danger',

  // Generic
  ACTIVE: 'success',
  INACTIVE: 'neutral',
  YES: 'success',
  NO: 'neutral',
};

const variantStyles: Record<BadgeVariant, string> = {
  success: 'bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 dark:border-emerald-500/30',
  warning: 'bg-amber-500/10 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20 dark:border-amber-500/30',
  danger: 'bg-rose-500/10 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/20 dark:border-rose-500/30',
  info: 'bg-sky-500/10 dark:bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/20 dark:border-sky-500/30',
  neutral: 'bg-muted text-muted-foreground border-border',
};

export function StatusBadge({ status, variant, size = 'sm' }: StatusBadgeProps) {
  const resolvedVariant = variant || statusVariantMap[status.toUpperCase()] || 'neutral';
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-lg border ${variantStyles[resolvedVariant]} ${sizeClasses}`}
    >
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-80" />
      {status.replace(/_/g, ' ')}
    </span>
  );
}
