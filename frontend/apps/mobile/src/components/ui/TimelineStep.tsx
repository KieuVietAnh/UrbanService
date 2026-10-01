import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from './Text';
import { colors } from '@/constants/theme';

interface TimelineStepProps {
  title: string;
  description?: string;
  timestamp?: string;
  status: 'done' | 'active' | 'pending';
  isLast?: boolean;
  badge?: string;
  children?: React.ReactNode;
}

export function TimelineStep({
  title,
  description,
  timestamp,
  status,
  isLast = false,
  badge,
  children,
}: TimelineStepProps) {
  const dotBg =
    status === 'done'
      ? colors.primary
      : status === 'active'
      ? colors.primary
      : '#CBD5E1';

  const lineColor = status === 'done' ? colors.primary : '#E2E8F0';

  return (
    <View style={styles.row}>
      {/* Left: dot + line */}
      <View style={styles.lineCol}>
        <View style={[styles.dot, { backgroundColor: dotBg }, status === 'active' && styles.dotActive]}>
          {status === 'done' && (
            <View style={styles.checkInner} />
          )}
          {status === 'active' && (
            <View style={styles.activePulse} />
          )}
        </View>
        {!isLast && <View style={[styles.line, { backgroundColor: lineColor }]} />}
      </View>

      {/* Right: content */}
      <View style={[styles.content, !isLast && styles.contentPadded]}>
        <View style={styles.titleRow}>
          <Text
            style={[
              styles.title,
              status === 'pending' && { color: colors.lightMuted },
              status === 'active' && { color: colors.primary },
            ]}
          >
            {title}
          </Text>
          {badge && (
            <View style={[styles.badge, status === 'active' && styles.badgeActive]}>
              <Text style={[styles.badgeText, status === 'active' && styles.badgeTextActive]}>
                {badge}
              </Text>
            </View>
          )}
        </View>

        {timestamp && (
          <Text style={[styles.timestamp, status === 'pending' && { color: '#CBD5E1' }]}>
            {timestamp}
          </Text>
        )}

        {description && (
          <Text style={[styles.description, status === 'pending' && { color: '#CBD5E1' }]}>
            {description}
          </Text>
        )}

        {children && <View style={styles.childrenWrap}>{children}</View>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  lineCol: {
    alignItems: 'center',
    width: 24,
    marginRight: 14,
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  dotActive: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  checkInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  activePulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  line: {
    width: 2,
    flex: 1,
    marginTop: 4,
    marginBottom: 0,
  },
  content: {
    flex: 1,
    paddingBottom: 4,
  },
  contentPadded: {
    paddingBottom: 24,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  title: {
    fontFamily: 'Geist-SemiBold',
    fontSize: 14,
    color: '#0F172A',
    lineHeight: 20,
  },
  timestamp: {
    fontFamily: 'Geist-Regular',
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 4,
  },
  description: {
    fontFamily: 'Geist-Regular',
    fontSize: 13,
    color: '#334155',
    lineHeight: 19,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
  },
  badgeActive: {
    backgroundColor: '#EFF6FF',
  },
  badgeText: {
    fontFamily: 'Geist-SemiBold',
    fontSize: 11,
    color: '#64748B',
  },
  badgeTextActive: {
    color: colors.primary,
  },
  childrenWrap: {
    marginTop: 10,
  },
});

export default TimelineStep;
