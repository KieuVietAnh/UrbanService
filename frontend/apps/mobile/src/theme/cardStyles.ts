import { StyleSheet } from 'react-native';
import { semantics } from './semantics';
import { radius } from './radius';

export const cardStyles = StyleSheet.create({
  base: {
    backgroundColor: semantics.bg.surface,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: semantics.border.strong,
    overflow: 'hidden',
  },
  elevated: {
    backgroundColor: semantics.bg.surface,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: semantics.border.default,
  },
  outline: {
    backgroundColor: semantics.bg.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: semantics.border.default,
  },
});

export type CardStyles = typeof cardStyles;
