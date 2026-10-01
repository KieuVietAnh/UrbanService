import React from 'react';
import { useWindowDimensions, View } from 'react-native';
import type { RouterLike } from '../types';
import { QUICK_ACTIONS } from '../constants/homeActions';
import { QuickActionCard } from './QuickActionCard';
import { styles } from '../homeStyles';

type Props = { router: RouterLike };

export function QuickActions({ router }: Props) {
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;

  return (
    <View style={styles.sectionTight}>
      <View style={styles.quickActionsPanel}>
        {QUICK_ACTIONS.map((action, index) => (
          <QuickActionCard
            key={action.id}
            action={action}
            delay={index * 45}
            isTablet={isTablet}
            router={router}
          />
        ))}
      </View>
    </View>
  );
}
