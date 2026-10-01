import React from 'react';
import { View, StyleSheet } from 'react-native';
import {
  getStatusIntent,
  getStatusLabel,
  getPriorityIntent,
} from '@urbanmind/shared-types';
import { Text } from './Text';
import { semantics } from '@/theme/semantics';

export type BadgeVariant = 'subtle' | 'solid' | 'outline';
export type BadgeSize = 'sm' | 'md';

export interface AppBadgeProps {
  status?: string | null;
  priority?: string | null;
  severity?: string | null;
  label?: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  showDot?: boolean;
  className?: string;
}

// Severity intent mapping helper
const resolveSeverityIntent = (value?: string | null): string => {
  const key = `${value ?? ''}`.trim().toLowerCase();
  switch (key) {
    case 'critical':
    case 'urgent':
      return 'danger';
    case 'high':
    case 'major':
      return 'warning';
    case 'medium':
    case 'normal':
      return 'info';
    case 'low':
    case 'minor':
      return 'neutral';
    default:
      return 'neutral';
  }
};

export function AppBadge({
  status,
  priority,
  severity,
  label: customLabel,
  variant = 'subtle',
  size = 'md',
  showDot = true,
  className = '',
}: AppBadgeProps) {
  let intent: 'info' | 'warning' | 'success' | 'danger' | 'neutral' = 'neutral';
  let displayText = customLabel ?? '';

  if (status) {
    intent = getStatusIntent(status) as any;
    if (!displayText) {
      displayText = getStatusLabel(status, status);
    }
  } else if (priority) {
    intent = getPriorityIntent(priority) as any;
    if (!displayText) {
      displayText = priority;
    }
  } else if (severity) {
    intent = resolveSeverityIntent(severity) as any;
    if (!displayText) {
      displayText = severity;
    }
  }

  const token = semantics.intent[intent] ?? semantics.intent.neutral;

  // Variant styling
  const getVariantStyles = () => {
    switch (variant) {
      case 'solid':
        return {
          container: { backgroundColor: token.dot, borderColor: 'transparent', borderWidth: 1 },
          text: { color: semantics.text.inverse },
          dot: { backgroundColor: semantics.text.inverse },
        };
      case 'outline':
        return {
          container: { backgroundColor: semantics.bg.surface, borderColor: token.border, borderWidth: 1 },
          text: { color: token.text },
          dot: { backgroundColor: token.dot },
        };
      case 'subtle':
      default:
        return {
          container: { backgroundColor: token.bg, borderColor: token.border, borderWidth: 1 },
          text: { color: token.text },
          dot: { backgroundColor: token.dot },
        };
    }
  };

  const variantStyle = getVariantStyles();
  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.badgeContainer,
        variantStyle.container,
        isSmall ? styles.badgeSm : styles.badgeMd,
      ]}
      className={className}
    >
      {showDot && (
        <View
          style={[
            styles.dot,
            variantStyle.dot,
            isSmall ? styles.dotSm : styles.dotMd,
          ]}
        />
      )}
      <Text
        style={[
          styles.badgeText,
          variantStyle.text,
          isSmall ? styles.textSm : styles.textMd,
        ]}
      >
        {displayText}
      </Text>
    </View>
  );
}

// Re-export TicketStatusBadge helper for seamless compatibility
export function TicketStatusBadge(props: Omit<AppBadgeProps, 'priority' | 'severity'>) {
  return <AppBadge {...props} />;
}

const styles = StyleSheet.create({
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 9999,
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

export default AppBadge;