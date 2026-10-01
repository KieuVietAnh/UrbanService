import React from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Icon from '@expo/vector-icons/Feather';
import { Text } from '@/components/ui';
import type { QuickAction, RouterLike } from '../types';
import { styles } from '../homeStyles';

type Props = {
  action: QuickAction;
  delay?: number;
  isTablet?: boolean;
  router: RouterLike;
};

export function QuickActionCard({ action, delay = 0, isTablet = false, router }: Props) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View
      entering={FadeInDown.delay(delay).springify().damping(16)}
      style={[
        styles.actionItem,
        isTablet ? styles.actionItemTablet : styles.actionItemPhone,
        animStyle,
      ]}
    >
      <Pressable
        onPressIn={() => {
          scale.value = withSpring(0.94, { damping: 16, stiffness: 360 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 16, stiffness: 360 });
        }}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push(action.href);
        }}
        style={styles.actionPressable}
      >
        <View style={[styles.actionIconWrap, { backgroundColor: action.iconBg }]}>
          <Icon name={action.icon} size={22} color={action.accent} />
        </View>
        <Text style={styles.actionLabel} numberOfLines={2}>
          {action.label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
