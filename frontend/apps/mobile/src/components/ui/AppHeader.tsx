import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Icon from '@expo/vector-icons/Feather';
import { Text } from './Text';
import { semantics } from '@/theme/semantics';
import { shadows } from '@/theme/shadows';

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  transparent?: boolean;
  className?: string;
}

export function AppHeader({
  title,
  subtitle,
  showBack = false,
  onBack,
  rightAction,
  transparent = false,
  className = '',
}: AppHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <View
      style={[
        styles.headerContainer,
        transparent ? styles.transparentBg : [styles.surfaceBg, shadows.sm],
      ]}
      className={className}
    >
      {showBack ? (
        <Pressable
          onPress={handleBack}
          style={styles.backButton}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
        >
          <Icon name="arrow-left" size={20} color={semantics.text.primary} />
        </Pressable>
      ) : (
        <View style={styles.placeholder} />
      )}

      {title ? (
        <View style={styles.titleWrap}>
          <Text style={styles.titleText} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitleText} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      ) : (
        <View style={{ flex: 1 }} />
      )}

      {rightAction ? (
        <View style={styles.rightSlot}>{rightAction}</View>
      ) : (
        <View style={styles.placeholder} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 56,
  },
  surfaceBg: {
    backgroundColor: semantics.bg.surface,
    borderBottomWidth: 1,
    borderBottomColor: semantics.border.light,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  transparentBg: {
    backgroundColor: 'transparent',
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: semantics.bg.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  titleText: {
    fontSize: 17,
    fontFamily: 'Geist-Bold',
    color: semantics.text.primary,
    letterSpacing: -0.3,
  },
  subtitleText: {
    fontSize: 11,
    fontFamily: 'Geist-Regular',
    color: semantics.text.muted,
    marginTop: 1,
  },
  placeholder: {
    width: 38,
  },
  rightSlot: {
    minWidth: 38,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});

export default AppHeader;