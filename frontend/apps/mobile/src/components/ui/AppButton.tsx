import React from 'react';
import {
  Pressable,
  PressableProps,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
} from 'react-native';

import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Text } from './Text';
import { semantics } from '@/theme/semantics';
import { shadows } from '@/theme/shadows';
import { buttonStyles } from '@/theme/buttonStyles';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface AppButtonProps extends Omit<PressableProps, 'style'> {
  children: React.ReactNode;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  className?: string;
  style?: ViewStyle;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-primary active:bg-primary-dark',
  secondary: 'bg-primary-soft border border-primary',
  outline: 'bg-surface border border-border-strong',
  ghost: 'bg-transparent',
  danger: 'bg-red active:bg-red-dark',
};

const TEXT_CLASSES: Record<Variant, string> = {
  primary: 'text-text-inverse',
  secondary: 'text-primary',
  outline: 'text-text',
  ghost: 'text-primary',
  danger: 'text-text-inverse',
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'h-10 px-4 rounded-xl gap-1.5',
  md: 'h-12 px-5 rounded-2xl gap-2',
  lg: 'h-14 px-6 rounded-2xl gap-2.5',
};

const TEXT_SIZE_CLASSES: Record<Size, string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
};

export function AppButton({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  disabled,
  onPress,
  className = '',
  style,
  ...props
}: AppButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const handlePress = (event: any) => {
    if (loading || disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.(event);
  };

  const isDisabled = disabled || loading;

  const shadowStyle: ViewStyle = variant === 'primary' ? {
    ...shadows.primary,
  } : variant === 'danger' ? {
    ...shadows.md,
  } : {};

  const resolvedStyle = [
    animatedStyle,
    shadowStyle,
    style,
    buttonStyles.base,
    variant === 'primary' && buttonStyles.primary,
    variant === 'secondary' && buttonStyles.secondary,
    variant === 'outline' && buttonStyles.outline,
    variant === 'ghost' && buttonStyles.ghost,
    variant === 'danger' && buttonStyles.danger,
    variant === 'primary' && styles.primaryButton,
    variant === 'secondary' && styles.secondaryButton,
    variant === 'outline' && styles.outlineButton,
    variant === 'ghost' && styles.ghostButton,
    variant === 'danger' && styles.dangerButton,
  ].filter(Boolean);

  return (
    <AnimatedPressable
      style={resolvedStyle}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={isDisabled}
      className={[
        'flex-row items-center justify-center',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        fullWidth ? 'w-full' : 'self-start',
        isDisabled ? 'opacity-50' : '',
        className,
      ].join(' ')}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' || variant === 'danger' ? '#FFFFFF' : semantics.bg.primary}
        />
      ) : (
        <>
          {leftIcon}
          <Text
            className={[
              'font-sans-semibold text-center',
              TEXT_CLASSES[variant],
              TEXT_SIZE_CLASSES[size],
            ].join(' ')}
          >
            {children}
          </Text>
          {rightIcon}
        </>
      )}
    </AnimatedPressable>
  );
}

export default AppButton;

const styles = StyleSheet.create({
  primaryButton: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.34)',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: semantics.border.primary,
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: semantics.border.default,
  },
  ghostButton: {
    borderWidth: 0,
  },
  dangerButton: {
    borderWidth: 1,
    borderColor: 'rgba(185,28,28,0.16)',
  },
});