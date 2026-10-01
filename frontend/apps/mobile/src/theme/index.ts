import { palette, rawColors } from './colors';
import { spacing } from './spacing';
import { radius } from './radius';
import { fonts, fontSizes, fontWeights, lineHeights, typography } from './typography';
import { semantics } from './semantics';
import { shadows } from './shadows';
import { cardStyles } from './cardStyles';
import { buttonStyles } from './buttonStyles';
import { inputStyles } from './inputStyles';
import { badgeStyles } from './badgeStyles';

export * from './colors';
export * from './spacing';
export * from './radius';
export * from './typography';
export * from './semantics';
export * from './shadows';
export * from './cardStyles';
export * from './buttonStyles';
export * from './inputStyles';
export * from './badgeStyles';

// Unified Theme Architecture Object
export const theme = {
  palette,
  colors: rawColors,
  spacing,
  radius,
  fonts,
  fontSizes,
  fontWeights,
  lineHeights,
  typography,
  semantics,
  shadows,
  cardStyles,
  buttonStyles,
  inputStyles,
  badgeStyles,
} as const;

export type Theme = typeof theme;
export default theme;
