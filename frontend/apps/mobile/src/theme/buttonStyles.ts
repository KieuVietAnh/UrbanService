import { StyleSheet } from 'react-native';
import { semantics } from './semantics';
import { radius } from './radius';

export const buttonStyles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius['2xl'],
    borderWidth: 1,
    minHeight: 52,
  },
  primary: {
    backgroundColor: semantics.interactive.primaryBg,
    borderColor: semantics.interactive.primaryBg,
  },
  secondary: {
    backgroundColor: semantics.interactive.secondaryBg,
    borderColor: semantics.interactive.secondaryBorder,
  },
  outline: {
    backgroundColor: semantics.bg.surface,
    borderColor: semantics.border.default,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  danger: {
    backgroundColor: semantics.interactive.dangerBg,
    borderColor: semantics.feedback.error.border,
  },
  textPrimary: {
    color: semantics.interactive.primaryText,
  },
  textSecondary: {
    color: semantics.interactive.secondaryText,
  },
  textOutline: {
    color: semantics.text.primary,
  },
  textGhost: {
    color: semantics.interactive.secondaryText,
  },
  textDanger: {
    color: semantics.interactive.dangerText,
  },
});

export type ButtonStyles = typeof buttonStyles;
