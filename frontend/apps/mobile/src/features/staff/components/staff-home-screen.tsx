import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, useWindowDimensions, View } from 'react-native';
import { Link, Stack, useFocusEffect, type Href } from 'expo-router';
import { useQueries } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth';
import { staffApi, staffKeys } from '../staff-api';
import { recordCode } from '../staff-models';
import {
  colors, contentStyle, Label, panelStyle, QueryState, RecordCard, Section, StaffIcon,
  Status, type StaffIconName,
} from './staff-ui';
import { StaffScrollView } from './staff-scroll-view';

const shortcuts: { title: string; description: string; href: Href; icon: StaffIconName }[] = [
  { title: 'Tra cứu Report', description: 'Tìm phản ánh và sự vụ liên quan', href: '/(staff)/staff/(tabs)/feedbacks', icon: 'feedbacks' },
  { title: 'Trao đổi', description: 'Phản hồi người dân và ghi chú nội bộ', href: '/(staff)/staff/(tabs)/conversations', icon: 'chat' },
  { title: 'Thông báo', description: 'Theo dõi cập nhật công việc', href: '/(staff)/staff/notifications', icon: 'bell' },
];

const metrics = [
  { status: 'Assigned', label: 'Mới được giao', color: colors.primary },
  { status: 'InProgress', label: 'Đang xử lý', color: colors.primaryDark },
  { status: 'NeedRework', label: 'Cần xử lý lại', color: colors.redDark },
  { status: 'SubmittedForApproval', label: 'Chờ duyệt', color: colors.amberDark },
] as const;

function MetricLink({ status, label, value, color, columns, index }: {
  status: string; label: string; value: string; color: string; columns: 1 | 2 | 4; index: number;
}) {
  const [pressed, setPressed] = useState(false);
  const borderRight = columns > 1 && (index + 1) % columns !== 0;
  const borderTop = index >= columns;
  return <Link href={{ pathname: '/(staff)/staff/(tabs)/incidents', params: { status, source: 'dashboard' } }} asChild>
    <Pressable accessibilityRole="button" accessibilityLabel={`Xem sự vụ ${label.toLowerCase()}`} onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)} style={{ width: columns === 1 ? '100%' : columns === 2 ? '50%' : '25%', minHeight: columns === 1 ? 76 : 104, paddingHorizontal: 16, paddingVertical: 15, justifyContent: 'space-between', gap: 8, borderTopWidth: borderTop ? 1 : 0, borderRightWidth: borderRight ? 1 : 0, borderColor: colors.border, backgroundColor: pressed ? colors.primarySoft : colors.surface }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}><Label size={30} bold numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} maxFontSizeMultiplier={1.4} style={{ color, fontVariant: ['tabular-nums'], letterSpacing: -1 }}>{value}</Label><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} /></View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><View style={{ flex: 1 }}><Label size={12} bold style={{ color: colors.textSecondary }}>{label}</Label></View><StaffIcon name="arrow" size={14} color={colors.muted} /></View>
    </Pressable>
  </Link>;
}

function Shortcut({ item, last }: { item: typeof shortcuts[number]; last: boolean }) {
  const [pressed, setPressed] = useState(false);
  return <Link href={item.href} asChild><Pressable accessibilityRole="button" accessibilityLabel={item.title} onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)} style={{ minHeight: 76, flexDirection: 'row', gap: 14, padding: 15, alignItems: 'center', borderBottomWidth: last ? 0 : 1, borderColor: colors.border, backgroundColor: pressed ? colors.primarySoft : colors.surface }}>
    <View style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft }}><StaffIcon name={item.icon} size={21} /></View>
    <View style={{ flex: 1, gap: 3 }}><Label bold size={14}>{item.title}</Label><Label muted size={12}>{item.description}</Label></View>
    <StaffIcon name="arrow" size={16} color={colors.muted} />
  </Pressable></Link>;
}

export function StaffHomeScreen() {
  const user = useAuthStore((state) => state.user);
  const { width, fontScale } = useWindowDimensions();
  const metricColumns = fontScale > 1.5 || (width < 340 && fontScale > 1.15) ? 1 : width >= 780 && fontScale <= 1.15 ? 4 : 2;
  const queries = useQueries({ queries: metrics.map((item) => {
    const params = { pageNumber: 1, status: item.status };
    return { queryKey: staffKeys.incidents(user?.id || '', params), queryFn: ({ signal }: { signal: AbortSignal }) => staffApi.incidents(user?.id || '', params, signal), enabled: Boolean(user?.id), retry: 1 };
  }) });
  const [assigned, inProgress, needRework, waitingApproval] = queries;
  const refresh = useCallback(() => { void assigned.refetch(); void inProgress.refetch(); void needRework.refetch(); void waitingApproval.refetch(); }, [assigned.refetch, inProgress.refetch, needRework.refetch, waitingApproval.refetch]);
  useFocusEffect(refresh);
  const metricError = queries.find((query) => query.error)?.error;
  const focusItem = needRework.data?.items[0] || inProgress.data?.items[0] || assigned.data?.items[0];
  const focusLabel = needRework.data?.items[0] ? 'Cần xử lý lại ngay' : inProgress.data?.items[0] ? 'Tiếp tục công việc' : 'Bắt đầu công việc mới';
  const firstName = user?.fullName?.trim().split(/\s+/).at(-1) || 'bạn';

  return <>
    <Stack.Screen options={{ title: 'Tổng quan', headerRight: () => <Link href="/(staff)/staff/notifications" asChild><Pressable accessibilityRole="button" accessibilityLabel="Thông báo" style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}><StaffIcon name="bell" /></Pressable></Link> }} />
    <StaffScrollView contentContainerStyle={contentStyle} refreshControl={<RefreshControl tintColor={colors.primary} colors={[colors.primary]} refreshing={queries.some((query) => query.isRefetching)} onRefresh={refresh} />}>
      <View style={{ ...panelStyle, padding: 20, gap: 18, overflow: 'hidden', backgroundColor: '#F0F5FF', borderColor: '#D8E5FB' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}><StaffIcon name="account" size={23} color="#FFFFFF" /></View><View style={{ flex: 1, gap: 2 }}><Label muted size={12} bold>KHÔNG GIAN TÁC NGHIỆP</Label><Label size={24} bold style={{ color: colors.inkSoft, letterSpacing: -0.6 }}>Chào {firstName}</Label></View></View>
        <Label size={14} style={{ color: colors.textSecondary }}>Theo dõi công việc quan trọng, xử lý đúng bước và không bỏ sót cập nhật.</Label>
        <Link href="/(staff)/staff/(tabs)/incidents" asChild><Pressable accessibilityRole="button" accessibilityLabel="Mở danh sách sự vụ" style={({ pressed }) => ({ minHeight: 50, borderRadius: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, backgroundColor: pressed ? colors.primaryDark : colors.primary })}><Label selectable={false} bold size={14} style={{ color: '#FFFFFF' }}>Mở sự vụ của tôi</Label><StaffIcon name="arrow" color="#FFFFFF" size={18} /></Pressable></Link>
      </View>

      <Section title="Nhịp công việc"><View style={{ ...panelStyle, padding: 0, gap: 0, overflow: 'hidden', flexDirection: 'row', flexWrap: 'wrap' }}>{metrics.map((item, index) => <MetricLink key={item.status} {...item} value={queries[index].isError ? '-' : queries[index].data?.totalItems.toLocaleString('vi-VN') ?? '…'} columns={metricColumns} index={index} />)}</View></Section>
      {metricError ? <QueryState error={metricError} retry={refresh} /> : null}

      <Section title="Ưu tiên tiếp theo">
        {queries.some((query) => query.isPending) ? <QueryState pending retry={refresh} /> : focusItem ? <Link href={(`/(staff)/staff/incidents/${encodeURIComponent(focusItem.id)}`) as Href} asChild><Pressable accessibilityRole="button" accessibilityLabel={`${focusLabel}: ${focusItem.title}`} style={({ pressed }) => ({ ...panelStyle, padding: 17, borderColor: needRework.data?.items[0] ? '#F5C7C7' : '#C9DDFB', backgroundColor: pressed ? colors.primarySoft : colors.surface })}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}><Label bold size={12} style={{ color: needRework.data?.items[0] ? colors.redDark : colors.primary }}>{focusLabel}</Label><Status value={focusItem.status} /></View>
          <Label bold size={17}>{focusItem.title}</Label>
          <Label muted size={12}>{recordCode(focusItem.id, true)}{focusItem.areaName ? ` · ${focusItem.areaName}` : ''}</Label>
          <View style={{ minHeight: 46, borderRadius: 13, paddingHorizontal: 14, backgroundColor: colors.primarySoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Label bold size={13} style={{ color: colors.primaryDark }}>Mở và tiếp tục đúng bước</Label><StaffIcon name="arrow" size={17} /></View>
        </Pressable></Link> : <QueryState empty="Hiện không có sự vụ cần bạn xử lý." retry={refresh} />}
      </Section>

      <Section title="Sự vụ mới được giao"><QueryState pending={assigned.isPending} error={assigned.error} empty={!assigned.isPending && !assigned.error && !assigned.data?.items.length && 'Bạn chưa có sự vụ mới được giao.'} retry={() => { void assigned.refetch(); }} />{assigned.data?.items.slice(0, 3).map((item) => <RecordCard key={item.id} item={item} incident />)}</Section>
      <Section title="Công cụ nhanh"><View style={{ ...panelStyle, padding: 0, gap: 0, overflow: 'hidden' }}>{shortcuts.map((item, index) => <Shortcut key={item.title} item={item} last={index === shortcuts.length - 1} />)}</View></Section>
    </StaffScrollView>
  </>;
}
