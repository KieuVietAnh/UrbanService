// Spacing scale tokens for layout, padding, margin, and gaps
export const spacing = {
  '0': 0,
  '0.5': 2,
  '1': 4,
  '1.5': 6,
  '2': 8,
  '2.5': 10,
  '3': 12,
  '3.5': 14,
  '4': 16,
  '5': 20,
  '6': 24,
  '7': 28,
  '8': 32,
  '10': 40,
  '12': 48,
  '14': 56,
  '16': 64,
  '18': 72,
  '20': 80,

  // Named semantic spacing aliases
  none: 0,
  '3xs': 2,
  '2xs': 4,
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 40,
  '3xl': 48,

  // Inset & Component safe dimensions
  safeBottom: 34,
  tabBar: 80,
  headerHeight: 56,
} as const;

export type Spacing = typeof spacing;
