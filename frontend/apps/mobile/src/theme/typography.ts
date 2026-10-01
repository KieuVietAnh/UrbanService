// Font family mappings (Geist)
export const fonts = {
  regular: 'Geist-Regular',
  thin: 'Geist-Thin',
  light: 'Geist-Light',
  medium: 'Geist-Medium',
  semibold: 'Geist-SemiBold',
  bold: 'Geist-Bold',
  extrabold: 'Geist-ExtraBold',
  black: 'Geist-Black',
} as const;

// Typography scale (Font sizes)
export const fontSizes = {
  '2xs': 10,
  xs: 12,
  sm: 13,
  base: 15,
  md: 15,
  lg: 17,
  xl: 20,
  '2xl': 24,
  '3xl': 28,
  '4xl': 32,
  '5xl': 36,
} as const;

// Font weights
export const fontWeights = {
  thin: '100' as const,
  extralight: '200' as const,
  light: '300' as const,
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
  black: '900' as const,
} as const;

// Line heights
export const lineHeights = {
  lineHeightNone: 1,
  lineHeightTight: 1.25,
  lineHeightSnug: 1.375,
  lineHeightNormal: 1.5,
  lineHeightRelaxed: 1.625,
  lineHeightLoose: 2,
} as const;

export const typography = {
  ...fontSizes,
  ...fontWeights,
  ...lineHeights,
} as const;

export type Typography = typeof typography;
export type Fonts = typeof fonts;
