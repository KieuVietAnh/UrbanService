import React, { useState } from 'react';
import {
  View,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Icon from '@expo/vector-icons/Feather';
import { Text } from '@/components/ui';
import { AppHeader } from '@/components/ui';
import { SkeletonCard } from '@/components/shared';
import { AppEmptyState } from '@/components/shared';
import { AppErrorState } from '@/components/shared';
import { useToast } from '@/components/shared';
import { semantics } from '@/theme/semantics';
import type { NotificationItem } from '../types/notification.types';
import { notificationApi, notificationKeys } from '../api';

export type { NotificationItem } from '../types/notification.types';

const TYPE_CONFIG: Record<string, { icon: keyof typeof Icon.glyphMap; color: string; bg: string }> = {
  ASSIGNED: { icon: 'user-check', color: semantics.text.brand, bg: semantics.bg.primarySoft },
  NEED_MORE: { icon: 'alert-circle', color: semantics.text.danger, bg: semantics.feedback.error.bg },
  RESOLVED: { icon: 'check-circle', color: semantics.intent.success.text, bg: semantics.intent.success.bg },
  CLOSED: { icon: 'check-square', color: semantics.text.muted, bg: semantics.bg.surfaceSubtle },
  DEFAULT: { icon: 'bell', color: semantics.text.brand, bg: semantics.bg.primarySoft },
};

function getTypeConfig(type?: string) {
  return TYPE_CONFIG[type?.toUpperCase() ?? ''] ?? TYPE_CONFIG.DEFAULT;
}

function getPriorityLabel(type?: string) {
  const normalized = type?.toUpperCase() ?? '';
  if (normalized === 'NEED_MORE') return 'Ưu tiên cao';
  if (normalized === 'ASSIGNED') return 'Giao việc';
  if (normalized === 'RESOLVED') return 'Hoàn tất';
  if (normalized === 'CLOSED') return 'Đã đóng';
  return 'Thông tin';
}

function getTicketIdFromTargetUrl(targetUrl: unknown): string | undefined {
  if (typeof targetUrl !== 'string') return undefined;

  const path = targetUrl.split(/[?#]/, 1)[0];
  const match = path.match(/(?:^|\/)tickets\/([^/]+)\/?$/i);
  if (!match?.[1]) return undefined;

  try {
    return decodeURIComponent(match[1]).trim() || undefined;
  } catch {
    return undefined;
  }
}

function groupByDay(items: NotificationItem[]) {
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  const groups: { title: string; data: NotificationItem[] }[] = [];

  const map: Record<string, NotificationItem[]> = {};
  items.forEach((n) => {
    const parsed = n.createdAt ? new Date(n.createdAt) : null;
    const d = parsed && !Number.isNaN(parsed.getTime()) ? parsed.toDateString() : 'unknown';
    if (!map[d]) map[d] = [];
    map[d].push(n);
  });

  Object.entries(map).forEach(([dateStr, groupItems]) => {
    let title = dateStr === 'unknown' ? 'Không rõ thời gian' : dateStr;
    if (dateStr === today) title = 'Hôm nay';
    else if (dateStr === yesterday) title = 'Hôm qua';
    else if (dateStr !== 'unknown') title = new Date(dateStr).toLocaleDateString('vi-VN');
    groups.push({ title, data: groupItems });
  });

  return groups;
}

function NotifItem({
  item,
  onPress,
}: {
  item: NotificationItem;
  onPress: () => void;
}) {
  const cfg = getTypeConfig(item.type);
  const priorityLabel = getPriorityLabel(item.type);
  const time = item.createdAt
    ? new Date(item.createdAt).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.notifItem,
        !item.isRead && styles.notifUnread,
        pressed && styles.notifPressed,
      ]}
    >
      <View style={[styles.notifIconWrap, { backgroundColor: cfg.bg }]}>
        <Icon name={cfg.icon} size={17} color={cfg.color} />
      </View>
      <View style={styles.notifContent}>
        <View style={styles.notifHeaderRow}>
          <View style={[styles.priorityBadge, { backgroundColor: cfg.bg }]}> 
            <Text style={[styles.priorityBadgeText, { color: cfg.color }]}>{priorityLabel}</Text>
          </View>
          <Text style={styles.notifTime}>{time}</Text>
        </View>
        <Text
          style={[styles.notifTitle, !item.isRead && styles.notifTitleUnread]}
          numberOfLines={2}
        >
          {item.title}
        </Text>
        <Text style={styles.notifMessage} numberOfLines={2}>
          {item.message}
        </Text>
        <View style={styles.notifFooter}>
          {!item.isRead ? <View style={styles.unreadPill}><Text style={styles.unreadPillText}>Mới</Text></View> : <View style={styles.readState} />}
          <Text style={styles.notifAction}>Xem</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [filterUnread, setFilterUnread] = useState(false);

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: notificationKeys.list(filterUnread),
    queryFn: () => notificationApi.list(1, 50, filterUnread ? false : undefined),
  });

  const markAllMutation = useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      toast.success('Đã đánh dấu tất cả là đã đọc');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Không thể đánh dấu tất cả đã đọc');
    },
  });

  const rawItems = data?.items ?? [];
  const notifications: NotificationItem[] = rawItems.flatMap((n: any): NotificationItem[] => {
    const notificationId = n.notificationId ?? n.id;
    if (!Number.isInteger(notificationId) || notificationId <= 0 || notificationId > 2147483647) return [];
    const targetType = typeof n.targetType === 'string' ? n.targetType : undefined;
    const targetId = typeof n.targetId === 'string' ? n.targetId : undefined;
    const feedbackTarget = ['feedback', 'report'].includes((targetType || '').toLowerCase()) ? targetId : undefined;
    return [{
      notificationId,
      title: n.title ?? 'Thông báo hệ thống',
      message: n.message ?? n.content ?? '',
      type: n.type ?? 'DEFAULT',
      isRead: Boolean(n.isRead),
      createdAt: n.createdAt ?? '',
      incidentId: n.incidentId,
      targetId,
      targetType,
      relatedId: n.relatedId ?? n.feedbackId ?? feedbackTarget ?? getTicketIdFromTargetUrl(n.targetUrl),
      relatedType: n.relatedType ?? (feedbackTarget ? 'FEEDBACK' : undefined),
      targetUrl: n.targetUrl,
    }];
  });

  const groups = groupByDay(notifications);
  const unreadCount = notifications.filter((item) => !item.isRead).length;

  const handleNotifPress = async (item: NotificationItem) => {
    if (!item.isRead) {
      try {
        await notificationApi.markRead(item.notificationId);
        queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      } catch {
        /* silent */
      }
    }

    const targetType = String(item.targetType ?? item.relatedType ?? item.type ?? '')
      .trim()
      .toLowerCase();
    const targetId = item.targetId ?? item.relatedId;

    if (item.incidentId || targetType.includes('incident')) {
      const incidentId = item.incidentId ?? targetId;
      if (incidentId) {
        router.push(`/(resident)/community/${incidentId}` as any);
      } else {
        router.push('/(resident)/community' as any);
      }
      return;
    }

    if (targetType.includes('areaalert') || targetType.includes('area_alert')) {
      router.push('/(resident)/area-alerts' as any);
      return;
    }

    if (targetType.includes('feedback') || targetType.includes('report')) {
      if (targetId) {
        router.push(`/(resident)/tickets/${targetId}` as any);
      } else {
        router.push('/(resident)/tickets' as any);
      }
    }
  };

  const flatData: (string | NotificationItem)[] = [];
  groups.forEach((g) => {
    flatData.push(g.title);
    g.data.forEach((n) => flatData.push(n));
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader
        title="Thông báo"
        showBack
        rightAction={
          <Pressable
            hitSlop={10}
            onPress={() => markAllMutation.mutate()}
            disabled={markAllMutation.isPending}
          >
            <Icon name="check-square" size={20} color={semantics.text.brand} />
          </Pressable>
        }
      />

      <View style={styles.tabFilterRow}>
        <View style={styles.feedHeaderCard}>
          <View>
            <Text style={styles.feedEyebrow}>Activity Feed</Text>
            <Text style={styles.feedTitle}>Cập nhật gần đây</Text>
          </View>
          <View style={styles.feedSummaryChip}>
            <Text style={styles.feedSummaryText}>{unreadCount} chưa đọc</Text>
          </View>
        </View>
        <View style={styles.tabRow}>
          <Pressable
            onPress={() => setFilterUnread(false)}
            style={[styles.filterChip, !filterUnread && styles.filterChipActive]}
          >
            <Text style={[styles.filterChipText, !filterUnread && styles.filterChipTextActive]}>
              Tất cả
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setFilterUnread(true)}
            style={[styles.filterChip, filterUnread && styles.filterChipActive]}
          >
            <Text style={[styles.filterChipText, filterUnread && styles.filterChipTextActive]}>
              Chưa đọc
            </Text>
          </Pressable>
        </View>
      </View>

      {isError && !isLoading ? (
        <AppErrorState onRetry={refetch}>
          {(error as any)?.message || 'Không thể tải danh sách thông báo'}
        </AppErrorState>
      ) : (
        <FlatList
          data={isLoading ? Array(5).fill(null) : flatData}
          keyExtractor={(item, i) =>
            typeof item === 'string'
              ? `header-${i}`
              : item
              ? String(item.notificationId)
              : `skeleton-${i}`
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={semantics.text.brand}
            />
          }
          ListEmptyComponent={
            !isLoading ? (
              <AppEmptyState icon={<Icon name="bell-off" size={44} color={semantics.text.lightMuted} />}>
                {filterUnread
                  ? 'Bạn đã đọc tất cả thông báo.'
                  : 'Các thông báo mới về phản ánh của bạn sẽ xuất hiện tại đây.'}
              </AppEmptyState>
            ) : null
          }
          renderItem={({ item }) => {
            if (item === null) {
              return (
                <View style={styles.skeletonWrap}>
                  <SkeletonCard />
                </View>
              );
            }
            if (typeof item === 'string') {
              return <Text style={styles.groupHeader}>{item.toUpperCase()}</Text>;
            }
            return <NotifItem item={item} onPress={() => handleNotifPress(item)} />;
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: semantics.bg.app,
  },
  tabFilterRow: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: semantics.bg.surface,
    borderBottomWidth: 1,
    borderBottomColor: semantics.border.default,
  },
  feedHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 18,
    backgroundColor: semantics.bg.surfaceSubtle,
    marginBottom: 10,
  },
  feedEyebrow: {
    fontFamily: 'Geist-Medium',
    fontSize: 11,
    color: '#475569',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  feedTitle: {
    fontFamily: 'Geist-SemiBold',
    fontSize: 16,
    color: '#0F172A',
  },
  feedSummaryChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: semantics.bg.primarySoft,
  },
  feedSummaryText: {
    fontFamily: 'Geist-SemiBold',
    fontSize: 12,
    color: '#1D4ED8',
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: semantics.bg.surfaceSubtle,
  },
  filterChipActive: {
    backgroundColor: semantics.bg.primarySoft,
  },
  filterChipText: {
    fontSize: 13,
    fontFamily: 'Geist-Medium',
    color: '#475569',
  },
  filterChipTextActive: {
    color: '#0F172A',
    fontFamily: 'Geist-SemiBold',
  },
  skeletonWrap: {
    paddingVertical: 8,
  },
  groupHeader: {
    fontFamily: 'Geist-SemiBold',
    fontSize: 11,
    color: '#0F172A',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingTop: 20,
    paddingBottom: 10,
    marginTop: 6,
    marginBottom: 4,
    borderBottomWidth: 1.5,
    borderBottomColor: '#94A3B8',
  },
  notifItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 13,
    paddingHorizontal: 12,
    marginBottom: 10,
    backgroundColor: semantics.bg.surface,
    borderRadius: 18,
    borderWidth: 1.2,
    borderColor: '#CBD5E1',
    minHeight: 86,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#2563EB',
  },
  notifUnread: {
    backgroundColor: semantics.bg.primarySoft,
    borderColor: semantics.bg.primary,
    shadowOpacity: 0.09,
  },
  notifPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.96,
  },
  notifIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  notifContent: {
    flex: 1,
    minWidth: 0,
  },
  notifHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
    flexWrap: 'wrap',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  priorityBadgeText: {
    fontFamily: 'Geist-SemiBold',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  unreadPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: semantics.intent.info.bg,
  },
  unreadPillText: {
    fontFamily: 'Geist-SemiBold',
    fontSize: 10,
    color: semantics.intent.info.text,
  },
  readState: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: semantics.border.light,
  },
  notifTitle: {
    fontFamily: 'Geist-Regular',
    fontSize: 14,
    color: '#111827',
    lineHeight: 20,
  },
  notifTitleUnread: {
    fontFamily: 'Geist-SemiBold',
    color: '#0F172A',
  },
  notifMessage: {
    fontFamily: 'Geist-Regular',
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
    marginTop: 4,
    marginRight: 4,
  },
  notifFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  notifTime: {
    fontFamily: 'Geist-Regular',
    fontSize: 11,
    color: '#64748B',
  },
  notifAction: {
    fontFamily: 'Geist-Medium',
    fontSize: 11,
    color: '#1D4ED8',
  },
});
