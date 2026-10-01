import React from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Icon from '@expo/vector-icons/Feather';
import { SkeletonCard } from '@/components/shared';
import { Text } from '@/components/ui';
import { colors } from '@/constants/theme';
import type { RouterLike, TicketLike } from '../types';
import { styles } from '../homeStyles';
import { SectionHeader } from './SectionHeader';

type Props = {
  isLoading: boolean;
  tickets: TicketLike[];
  router: RouterLike;
};

const STATUS_CARDS = [
  {
    key: 'all',
    label: 'Tất cả',
    icon: 'file-text' as const,
    accent: '#2563EB',
    bg: '#EFF6FF',
    match: () => true,
  },
  {
    key: 'processing',
    label: 'Đang xử lý',
    icon: 'refresh-cw' as const,
    accent: '#F59E0B',
    bg: '#FFFBEB',
    match: (status: string) => ['assigned', 'inprogress', 'in progress', 'submitted', 'needrework', 'need rework'].includes(status),
  },
  {
    key: 'resolved',
    label: 'Đã xử lý',
    icon: 'check-circle' as const,
    accent: '#22C55E',
    bg: '#ECFDF5',
    match: (status: string) => status === 'resolved',
  },
  {
    key: 'closed',
    label: 'Đã đóng',
    icon: 'archive' as const,
    accent: '#64748B',
    bg: '#F8FAFC',
    match: (status: string) => ['closed', 'rejected'].includes(status),
  },
];

export function ActiveTickets({ isLoading, tickets, router }: Props) {
  return (
    <View style={styles.section}>
      <SectionHeader title="Phản ánh của tôi" actionLabel="Xem tất cả" onAction={() => router.push('/(resident)/tickets')} />
      {isLoading ? (
        <View style={styles.myReportsGrid}>
          {Array.from({ length: 4 }).map((_, index) => (
            <View key={index} style={styles.myReportSkeleton}>
              <SkeletonCard />
            </View>
          ))}
        </View>
      ) : tickets.length === 0 ? (
        <View style={styles.emptyStateCard}>
          <Icon name="inbox" size={28} color={colors.lightMuted} />
          <Text style={styles.emptyTitle}>Chưa có phản ánh nào</Text>
          <Text style={styles.emptySubtitle}>Tạo phản ánh đầu tiên để theo dõi tiến độ xử lý ngay trên điện thoại.</Text>
        </View>
      ) : (
        <View style={styles.myReportsGrid}>
          {STATUS_CARDS.map((item, index) => {
            const count =
              item.key === 'all'
                ? tickets.length
                : tickets.filter((ticket) => item.match(String(ticket.status ?? '').toLowerCase().replace(/\s+/g, ''))).length;
            return <ReportStatusCard key={item.key} item={item} count={count} delay={index * 60} router={router} />;
          })}
        </View>
      )}
    </View>
  );
}

function ReportStatusCard({
  item,
  count,
  delay,
  router,
}: {
  item: (typeof STATUS_CARDS)[number];
  count: number;
  delay: number;
  router: RouterLike;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View entering={FadeInDown.delay(delay).springify().damping(18)} style={[styles.myReportCard, { backgroundColor: item.bg }, animStyle]}>
      <Pressable
        style={styles.myReportPressable}
        onPressIn={() => {
          scale.value = withSpring(0.96, { damping: 16, stiffness: 360 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 16, stiffness: 360 });
        }}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push('/(resident)/tickets');
        }}
      >
        <Text style={styles.myReportCount}>{count}</Text>
        <Text style={[styles.myReportLabel, { color: item.accent }]} numberOfLines={1}>
          {item.label}
        </Text>
        <View style={[styles.myReportIconWrap, { backgroundColor: item.accent }]}>
          <Icon name={item.icon} size={18} color="#FFFFFF" />
        </View>
      </Pressable>
    </Animated.View>
  );
}
