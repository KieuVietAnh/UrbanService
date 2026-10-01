import { StyleSheet, Text, View } from 'react-native';
import { rawColors as colors } from '@/theme/colors';

export default function BrandLogo({
  size = 'md',
  subtitle = 'CITIZEN PORTAL',
  center = false,
}) {
  const isSmall = size === 'sm';

  return (
    <View style={[styles.wrapper, center && styles.center]}>
      <View style={[styles.iconBox, isSmall && styles.iconBoxSmall]}>
        <Text style={[styles.iconText, isSmall && styles.iconTextSmall]}>✦</Text>
      </View>

      <View style={center && styles.textCenter}>
        <Text style={[styles.brandName, isSmall && styles.brandNameSmall]}>
          UrbanMind
        </Text>
        <Text style={[styles.subtitle, isSmall && styles.subtitleSmall]}>
          {subtitle}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  center: {
    flexDirection: 'column',
    gap: 12,
  },

  textCenter: {
    alignItems: 'center',
  },

  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 8,
  },

  iconBoxSmall: {
    width: 38,
    height: 38,
    borderRadius: 12,
  },

  iconText: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 34,
  },

  iconTextSmall: {
    fontSize: 22,
    lineHeight: 25,
  },

  brandName: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: -0.8,
  },

  brandNameSmall: {
    fontSize: 18,
  },

  subtitle: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '800',
    color: colors.muted,
    letterSpacing: 1.4,
  },

  subtitleSmall: {
    fontSize: 8,
    letterSpacing: 1,
  },
});
