import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { Stack, useFocusEffect, useRouter, type Href } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth';
import { notificationApi } from '@/features/notifications/api/notification-api';
import { staffError } from '../staff-api';
import { formatDate, normalizeStaffNotification, staffNotificationTarget, type StaffNotification, type StaffNotificationId } from '../staff-models';
import { Button, colors, contentStyle, Filters, Label, Notice, PageHeading, Pagination, panelStyle, QueryState } from './staff-ui';
import { useStaffContentInsets } from './staff-scroll-view';

export function StaffNotificationsScreen() {
  const userId = useAuthStore((state) => state.user?.id || '');
  const router = useRouter();
  const cache = useQueryClient();
  const layout = useStaffContentInsets();
  const [params, setParams] = useState({ pageNumber: 1, unread: false });
  const key = ['staff', userId, 'notifications'];
  const query = useQuery({ queryKey: [...key, params], queryFn: () => notificationApi.list(params.pageNumber, 20, params.unread ? false : undefined), retry: 1 });
  useFocusEffect(useCallback(() => { void query.refetch(); }, [query.refetch]));
  const notifications = (query.data?.items || []).map(normalizeStaffNotification).filter((item): item is StaffNotification => item !== null);
  const mark = useMutation({ mutationFn: (id: StaffNotificationId | null) => id !== null ? notificationApi.markRead(id) : notificationApi.markAllRead(), onSuccess: () => cache.invalidateQueries({ queryKey: key }) });
  const open = (item: StaffNotification) => {
    if (!item.isRead) mark.mutate(item.notificationId);
    const href = staffNotificationTarget(item);
    if (href) router.push(href as Href);
  };
  return <><Stack.Screen options={{ title: 'Thông báo' }} /><FlatList style={{ backgroundColor: colors.background }} {...layout} contentContainerStyle={[contentStyle, layout.contentContainerStyle, { gap: 0 }]}
    data={notifications} keyExtractor={(item) => String(item.notificationId)} refreshing={query.isRefetching} onRefresh={() => { void query.refetch(); }}
    ListHeaderComponent={<View style={{ gap: 16, paddingBottom: 20 }}><PageHeading title="Thông báo" description="Cập nhật sự vụ và trao đổi dành cho bạn." /><Filters value={params.unread ? 'unread' : 'all'} options={[{ value: 'all', label: 'Tất cả' }, { value: 'unread', label: 'Chưa đọc' }]} onChange={(value) => setParams({ pageNumber: 1, unread: value === 'unread' })} />
      <Button secondary label="Đánh dấu tất cả đã đọc" busy={mark.isPending} disabled={query.isPending || query.isError || !notifications.length} onPress={() => mark.mutate(null)} />
      {mark.error && <Notice error>{staffError(mark.error)}</Notice>}
      <QueryState pending={query.isPending} error={query.error} empty={!query.isPending && !query.error && !notifications.length && 'Bạn không có thông báo nào ở đây.'} retry={() => { void query.refetch(); }} />
    </View>}
    ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
    renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`${item.isRead ? '' : 'Chưa đọc. '}${item.title}`} disabled={mark.isPending} onPress={() => open(item)} style={{ ...panelStyle, backgroundColor: item.isRead ? colors.surface : colors.primarySoft }}><Label bold>{item.title}</Label><Label>{item.message}</Label><Label size={12} muted>{formatDate(item.createdAt)}{!item.isRead ? ' · Chưa đọc' : ''}</Label>{staffNotificationTarget(item) && <Label size={13} style={{ color: colors.primary }}>Mở hồ sơ →</Label>}</Pressable>}
    ListFooterComponent={<View style={{ paddingTop: 20 }}><Pagination page={query.data} busy={query.isFetching} onChange={(pageNumber) => setParams((current) => ({ ...current, pageNumber }))} /></View>}
  /></>;
}
