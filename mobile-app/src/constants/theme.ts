 import { Platform } from 'react-native';

export const Colors = {
  // Dark mode is the primary/default ERP operational aesthetic matching web dashboard
  dark: {
    background: '#09090B', // Jet black backdrop
    card: '#121215', // Deep charcoal card surface
    cardElevated: '#18181B', // Elevated surfaces, modals, bottom sheets
    cardHover: '#202024',
    border: 'rgba(255, 255, 255, 0.09)', // Subtle 9% hairline border
    borderMedium: 'rgba(255, 255, 255, 0.16)',
    borderFocus: '#FFFFFF',
    primary: '#FFFFFF', // High-contrast solid white action buttons
    primaryForeground: '#09090B', // Solid black text inside primary buttons
    secondary: '#27272A', // Zinc-800 secondary surfaces
    secondaryForeground: '#F4F4F5',
    muted: '#18181B',
    mutedForeground: '#A1A1AA', // Zinc-400 for secondary text
    text: '#F4F4F5', // Crisp bright white text
    textSecondary: '#A1A1AA',
    textTertiary: '#71717A', // Zinc-500 for subdued labels
    inputBackground: '#121215',
    inputBorder: 'rgba(255, 255, 255, 0.12)',

    // Functional semantic accents (Restrained minimal status indicators)
    statusPaid: '#10B981',
    statusPaidBg: 'rgba(16, 185, 129, 0.12)',
    statusPending: '#F59E0B',
    statusPendingBg: 'rgba(245, 158, 11, 0.12)',
    statusCancelled: '#EF4444',
    statusCancelledBg: 'rgba(239, 68, 68, 0.12)',
    statusAssigned: '#A855F7',
    statusAssignedBg: 'rgba(168, 85, 247, 0.12)',
    statusDelivery: '#38BDF8',
    statusDeliveryBg: 'rgba(56, 189, 248, 0.12)',

    // Template backwards-compat
    backgroundElement: '#18181B',
    backgroundSelected: '#27272A',
  },
  light: {
    background: '#FFFFFF',
    card: '#F4F4F5',
    cardElevated: '#FFFFFF',
    cardHover: '#E4E4E7',
    border: 'rgba(0, 0, 0, 0.09)',
    borderMedium: 'rgba(0, 0, 0, 0.16)',
    borderFocus: '#09090B',
    primary: '#09090B',
    primaryForeground: '#FFFFFF',
    secondary: '#E4E4E7',
    secondaryForeground: '#09090B',
    muted: '#F4F4F5',
    mutedForeground: '#71717A',
    text: '#09090B',
    textSecondary: '#71717A',
    textTertiary: '#A1A1AA',
    inputBackground: '#FFFFFF',
    inputBorder: 'rgba(0, 0, 0, 0.12)',

    statusPaid: '#059669',
    statusPaidBg: '#ECFDF5',
    statusPending: '#D97706',
    statusPendingBg: '#FFFBEB',
    statusCancelled: '#DC2626',
    statusCancelledBg: '#FEF2F2',
    statusAssigned: '#7C3AED',
    statusAssignedBg: '#F5F3FF',
    statusDelivery: '#0284C7',
    statusDeliveryBg: '#F0F9FF',

    // Template backwards-compat
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
  },
} as const;

export type ThemeColor = keyof typeof Colors.dark;

export const Theme = Colors.dark;
export const MaxContentWidth = 800;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-sans)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  // Template backwards-compat
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

export const Typography = {
  family: Platform.select({
    ios: 'System',
    android: 'Roboto',
    default: 'normal',
  }),
} as const;
