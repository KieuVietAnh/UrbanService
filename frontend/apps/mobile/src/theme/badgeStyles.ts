import { StyleSheet } from 'react-native';
import { semantics } from './semantics';

export const badgeStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 9999,
    overflow: 'hidden',
  },
  badgeSm: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    gap: 4,
  },
  badgeMd: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 6,
  },
  dot: {
    borderRadius: 9999,
  },
  dotSm: {
    width: 6,
    height: 6,
  },
  dotMd: {
    width: 7,
    height: 7,
  },
  badgeText: {
    fontFamily: 'Geist-SemiBold',
  },
  textSm: {
    fontSize: 10,
    lineHeight: 14,
  },
  textMd: {
    fontSize: 12,
    lineHeight: 16,
  },
});

export const badgeVariants = {
  subtle: {
    container: { backgroundColor: semantics.intent.neutral.bg, borderColor: semantics.intent.neutral.border },
    text: { color: semantics.intent.neutral.text },
    dot: { backgroundColor: semantics.intent.neutral.dot },
  },
  outline: {
    container: { backgroundColor: semantics.bg.surface, borderColor: semantics.intent.neutral.border },
    text: { color: semantics.intent.neutral.text },
    dot: { backgroundColor: semantics.intent.neutral.dot },
  },
  solid: {
    container: { backgroundColor: semantics.intent.neutral.dot, borderColor: 'transparent' },
    text: { color: semantics.text.inverse },
    dot: { backgroundColor: semantics.text.inverse },
  },
} as const;

export type BadgeStyles = typeof badgeStyles;
export type BadgeVariants = typeof badgeVariants;
