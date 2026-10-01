import React from 'react';
import { Pressable, PressableProps, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { cardStyles } from '@/theme/cardStyles';
import { shadows } from '@/theme/shadows';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Shadow = 'none' | 'sm' | 'md' | 'lg';

interface AppCardProps extends Omit<PressableProps, 'style'> {
  children: React.ReactNode;
  shadow?: Shadow;
  className?: string;
  pressable?: boolean;
  style?: PressableProps['style'];
}

export function AppCard({
  children,
  shadow = 'md',
  className = '',
  pressable = false,
  onPress,
  style,
  ...props
}: AppCardProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (!pressable && !onPress) return;
    scale.value = withSpring(0.98, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const isInteractive = pressable || Boolean(onPress);

  return (
    <AnimatedPressable
      style={[animatedStyle, shadows[shadow], styles.cardBase, style]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      disabled={!isInteractive}
      className={[
        'overflow-hidden',
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  cardBase: {
    ...cardStyles.base,
    overflow: 'hidden',
  },
});

export default AppCard;
