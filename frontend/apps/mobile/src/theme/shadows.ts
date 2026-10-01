import { Platform, StyleSheet } from 'react-native';

// A shared shadow token set for mobile surfaces and interactive elements.
export const shadows = StyleSheet.create({
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: Platform.select({
    ios: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
    },
    android: { elevation: 2 },
  }) as any,
  md: Platform.select({
    ios: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.09,
      shadowRadius: 8,
    },
    android: { elevation: 4 },
  }) as any,
  lg: Platform.select({
    ios: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.14,
      shadowRadius: 18,
    },
    android: { elevation: 8 },
  }) as any,
  primary: Platform.select({
    ios: {
      shadowColor: '#0B56D9',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.22,
      shadowRadius: 16,
    },
    android: { elevation: 6 },
  }) as any,
});

export type Shadows = typeof shadows;
