// Primitive color palette for Urban Service mobile design system
// Aligned with web index.css CSS variables (source of truth)
export const palette = {
  // Primary Brand Scale (Blue)
  // Aligned with web: --brand-primary: #0b56d9
  blue: {
    50: '#EFF6FF',
    100: '#DBEAFE',
    200: '#BFDBFE',
    300: '#93C5FD',
    400: '#60A5FA',
    500: '#3B82F6',
    550: '#0B56D9', // web --brand-primary (trust blue)
    600: '#0052CC', // existing primary brand color (kept for compat)
    700: '#0043A4', // web --brand-primary-dark: #0846a8 ≈ this
    800: '#1E40AF',
    900: '#0B1E4E',
  },

  // Slate Neutral Scale
  slate: {
    50: '#F8FAFC', // web --bg
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A', // web --ink
    950: '#020617',
  },

  // Deep Navy Scale — for hero backgrounds (web dark hero gradient)
  // web: --surface dark: #0f1724, --bg dark: #071024
  navy: {
    900: '#060F24', // deepest hero background
    850: '#071024', // web --bg dark
    800: '#0D1D36', // web dark card gradient start
    750: '#0F1724', // web --surface dark
    700: '#081426', // web dark gradient end
  },

  // Semantic Status Scales
  emerald: {
    50: '#ECFDF5', // web --color-success-bg
    100: '#D1FAE5',
    200: '#A7F3D0',
    500: '#10B981',
    700: '#047857', // web --color-success
    800: '#065F46',
  },
  amber: {
    50: '#FFFBEB', // web --color-warning-bg
    100: '#FEF3C7',
    200: '#FDE68A',
    500: '#F59E0B',
    700: '#B45309', // web --color-warning
    800: '#92400E',
  },
  red: {
    50: '#FFF1F2', // web --color-danger-bg
    100: '#FEE2E2',
    200: '#FECACA',
    500: '#EF4444',
    700: '#B91C1C', // web --color-danger
    800: '#991B1B',
  },
  purple: {
    50: '#FAF5FF',
    100: '#EDE9FE',
    200: '#DDD6FE',
    500: '#7C3AED',
    700: '#6D28D9',
    800: '#5B21B6',
  },

  // Utility
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
} as const;

// Base raw color map for direct backwards compatibility
// Aligned with web --brand-primary values where possible
export const rawColors = {
  primary: palette.blue[550],         // now uses web --brand-primary
  primaryDark: palette.blue[700],     // web --brand-primary-dark
  primarySoft: palette.blue[50],
  primaryMuted: palette.blue[100],

  background: palette.slate[50],      // web --bg: #f8fafc
  backgroundBlue: '#F4F7FF',
  surface: palette.white,            // web --surface: #ffffff

  text: palette.slate[900],          // web --ink: #0f172a
  textSecondary: palette.slate[700],
  muted: palette.slate[500],         // web --muted: #6b7280 ≈ slate-500
  lightMuted: palette.slate[400],
  border: palette.slate[200],
  borderLight: palette.slate[100],
  borderStrong: palette.slate[300],

  statusPending: palette.amber[500],
  statusPendingBg: palette.amber[100],
  statusPendingText: palette.amber[800],

  statusProcessing: palette.blue[500],
  statusProcessingBg: palette.blue[50],
  statusProcessingText: '#1D4ED8',

  statusWaiting: palette.purple[500],
  statusWaitingBg: palette.purple[100],
  statusWaitingText: palette.purple[800],

  statusResolved: palette.emerald[500],
  statusResolvedBg: palette.emerald[100],
  statusResolvedText: palette.emerald[700],

  statusClosed: palette.slate[500],
  statusClosedBg: palette.slate[100],
  statusClosedText: palette.slate[700],

  statusRejected: palette.red[500],
  statusRejectedBg: palette.red[100],
  statusRejectedText: palette.red[800],

  emerald: palette.emerald[500],
  emeraldLight: palette.emerald[100],
  emeraldDark: palette.emerald[700],
  red: palette.red[500],
  redLight: palette.red[100],
  redDark: palette.red[800],
  amber: palette.amber[500],
  amberLight: palette.amber[100],
  amberDark: palette.amber[800],
  purple: palette.purple[500],
  purpleLight: palette.purple[100],
  purpleDark: palette.purple[800],
} as const;

export type Palette = typeof palette;
export type RawColors = typeof rawColors;
