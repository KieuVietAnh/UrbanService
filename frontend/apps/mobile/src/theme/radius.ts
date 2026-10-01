// Border radius design tokens
export const radius = {
  none: 0,
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 28,
  control: 14,
  card: 18,
  cardLarge: 22,
  pill: 999,
  full: 9999,
} as const;

export type Radius = typeof radius;
