import React from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/ui';
import Animated, { FadeIn } from 'react-native-reanimated';
import Icon from '@expo/vector-icons/Feather';
import { colors } from '@/constants/theme';
import { styles } from '../homeStyles';

type Props = {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function SectionHeader({ title, subtitle, actionLabel, onAction }: Props) {
  return (
    <Animated.View entering={FadeIn.duration(220)} style={styles.sectionHeader}>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSub}>{subtitle}</Text> : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} style={styles.sectionAction}>
          <Text style={styles.sectionActionText}>{actionLabel}</Text>
          <Icon name="chevron-right" size={16} color={colors.primary} />
        </Pressable>
      ) : null}
    </Animated.View>
  );
}
