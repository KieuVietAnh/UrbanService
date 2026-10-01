import React, { useMemo, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Icon from '@expo/vector-icons/Feather';

import { AppButton, AppCard, AppHeader, Text } from '@/components/ui';
import { AppEmptyState, AppErrorState, SkeletonCard, useToast } from '@/components/shared';
import { semantics } from '@/theme/semantics';
import { areaAlertKeys, areaAlertsApi, type AreaAlert } from '../api/area-alerts-api';

const getAreaId = (area: any) => Number(area?.areaId ?? area?.id ?? 0);
const getAreaName = (area: any) => String(area?.areaName ?? area?.name ?? 'Khu vực');

const severityStyle = (severity?: string) => {
  const key = String(severity ?? '').toLowerCase();
  if (key === 'critical' || key === 'high') return { bg: '#FEE2E2', text: '#B91C1C', label: 'Khẩn' };
  if (key === 'medium' || key === 'warning') return { bg: '#FEF3C7', text: '#92400E', label: 'Chú ý' };
  return { bg: '#DBEAFE', text: '#1D4ED8', label: 'Thông tin' };
};

const formatDate = (value?: string | null) => value
  ? new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
  : 'Đang cập nhật';

export default function AreaAlertsScreen() {
  const [onlySubscribed, setOnlySubscribed] = useState(true);
  const [manageVisible, setManageVisible] = useState(false);
  const queryClient = useQueryClient();
  const toast = useToast();

  const alertsQuery = useQuery({
    queryKey: areaAlertKeys.alerts(onlySubscribed),
    queryFn: () => areaAlertsApi.getAlerts(onlySubscribed),
  });
  const subscriptionsQuery = useQuery({
    queryKey: areaAlertKeys.subscriptions(),
    queryFn: areaAlertsApi.getSubscriptions,
  });
  const areasQuery = useQuery({
    queryKey: areaAlertKeys.areas(),
    queryFn: areaAlertsApi.getAreas,
  });

  const subscribedIds = useMemo(
    () => new Set((subscriptionsQuery.data ?? []).map((item) => Number(item.areaId))),
    [subscriptionsQuery.data]
  );

  const toggleMutation = useMutation({
    mutationFn: async ({ areaId, subscribed }: { areaId: number; subscribed: boolean }) => {
      if (subscribed) await areaAlertsApi.unsubscribe(areaId);
      else await areaAlertsApi.subscribe(areaId);
      return !subscribed;
    },
    onSuccess: async (subscribed) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: areaAlertKeys.subscriptions() }),
        queryClient.invalidateQueries({ queryKey: areaAlertKeys.all }),
      ]);
      toast.success(subscribed ? 'Đã theo dõi khu vực.' : 'Đã dừng theo dõi khu vực.');
    },
    onError: () => toast.error('Không thể cập nhật khu vực theo dõi.'),
  });

  const alerts = alertsQuery.data?.items ?? [];
  const refreshing = alertsQuery.isRefetching || subscriptionsQuery.isRefetching;
  const refresh = () => {
    alertsQuery.refetch();
    subscriptionsQuery.refetch();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader showBack title="Cảnh báo khu vực" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}><Icon name="alert-triangle" size={24} color="#B45309" /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Chủ động với khu vực bạn quan tâm</Text>
            <Text style={styles.heroText}>Theo dõi phường hoặc khu vực để nhận các cảnh báo đang hoạt động.</Text>
          </View>
        </View>

        <View style={styles.toolbar}>
          <View style={styles.tabs}>
            <Pressable style={[styles.tab, onlySubscribed && styles.tabActive]} onPress={() => setOnlySubscribed(true)}>
              <Text style={[styles.tabText, onlySubscribed && styles.tabTextActive]}>Đang theo dõi</Text>
            </Pressable>
            <Pressable style={[styles.tab, !onlySubscribed && styles.tabActive]} onPress={() => setOnlySubscribed(false)}>
              <Text style={[styles.tabText, !onlySubscribed && styles.tabTextActive]}>Tất cả</Text>
            </Pressable>
          </View>
          <AppButton size="sm" variant="outline" onPress={() => setManageVisible(true)} leftIcon={<Icon name="settings" size={14} color={semantics.text.brand} />}>
            Khu vực
          </AppButton>
        </View>

        <Text style={styles.followingText}>{subscribedIds.size} khu vực đang được theo dõi</Text>

        {alertsQuery.isLoading ? (
          <View style={styles.list}>{[0, 1, 2].map((item) => <SkeletonCard key={item} />)}</View>
        ) : alertsQuery.isError ? (
          <AppErrorState onRetry={alertsQuery.refetch}>Không thể tải cảnh báo khu vực.</AppErrorState>
        ) : alerts.length === 0 ? (
          <AppEmptyState icon={<Icon name="shield" size={42} color={semantics.text.lightMuted} />}>
            {onlySubscribed ? 'Chưa có cảnh báo tại các khu vực bạn theo dõi.' : 'Hiện chưa có cảnh báo đang hoạt động.'}
          </AppEmptyState>
        ) : (
          <View style={styles.list}>{alerts.map((alert: AreaAlert) => {
            const severity = severityStyle(alert.severity);
            return (
              <AppCard key={String(alert.alertId)} shadow="sm" style={styles.alertCard}>
                <View style={styles.alertHeader}>
                  <View style={[styles.severity, { backgroundColor: severity.bg }]}><Text style={[styles.severityText, { color: severity.text }]}>{severity.label}</Text></View>
                  <Text style={styles.alertTime}>{formatDate(alert.startAt)}</Text>
                </View>
                <Text style={styles.alertTitle}>{alert.title || 'Cảnh báo khu vực'}</Text>
                <Text style={styles.alertMessage}>{alert.message || 'Vui lòng theo dõi thông tin cập nhật từ cơ quan quản lý.'}</Text>
                <View style={styles.areaRow}><Icon name="map-pin" size={14} color={semantics.text.brand} /><Text style={styles.areaText}>{alert.areaName || 'Khu vực đang cập nhật'}</Text></View>
                {alert.categoryName ? <Text style={styles.categoryText}>{alert.categoryName}</Text> : null}
              </AppCard>
            );
          })}</View>
        )}
      </ScrollView>

      <Modal visible={manageVisible} transparent animationType="slide" onRequestClose={() => setManageVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View><Text style={styles.modalTitle}>Khu vực theo dõi</Text><Text style={styles.modalSub}>Chọn nơi bạn muốn nhận cảnh báo</Text></View>
              <Pressable onPress={() => setManageVisible(false)} hitSlop={10}><Icon name="x" size={22} color={semantics.text.primary} /></Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.areaList}>
              {areasQuery.isLoading ? <SkeletonCard /> : (areasQuery.data ?? []).map((area) => {
                const areaId = getAreaId(area);
                const subscribed = subscribedIds.has(areaId);
                const pending = toggleMutation.isPending && toggleMutation.variables?.areaId === areaId;
                return (
                  <Pressable
                    key={String(areaId)}
                    style={styles.areaOption}
                    disabled={pending}
                    onPress={() => toggleMutation.mutate({ areaId, subscribed })}
                  >
                    <View style={[styles.areaIcon, subscribed && styles.areaIconActive]}><Icon name={subscribed ? 'bell' : 'map-pin'} size={16} color={subscribed ? '#FFFFFF' : semantics.text.brand} /></View>
                    <Text style={styles.areaOptionText}>{getAreaName(area)}</Text>
                    <View style={[styles.toggle, subscribed && styles.toggleActive]}><View style={[styles.toggleKnob, subscribed && styles.toggleKnobActive]} /></View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: semantics.bg.app },
  scroll: { padding: 16, paddingBottom: 120 },
  hero: { flexDirection: 'row', gap: 13, borderRadius: 20, padding: 16, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A' },
  heroIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEF3C7' },
  heroTitle: { fontFamily: 'Geist-Bold', fontSize: 16, color: semantics.text.primary },
  heroText: { fontFamily: 'Geist-Regular', fontSize: 12, lineHeight: 18, color: semantics.text.muted, marginTop: 4 },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 18 },
  tabs: { flexDirection: 'row', gap: 6, flex: 1 },
  tab: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: semantics.bg.surfaceSubtle },
  tabActive: { backgroundColor: semantics.bg.primarySoft },
  tabText: { fontFamily: 'Geist-Medium', fontSize: 12, color: semantics.text.muted },
  tabTextActive: { color: semantics.text.brand, fontFamily: 'Geist-SemiBold' },
  followingText: { fontFamily: 'Geist-Regular', fontSize: 11, color: semantics.text.muted, marginTop: 10 },
  list: { gap: 11, marginTop: 14 },
  alertCard: { padding: 16 },
  alertHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  severity: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999 },
  severityText: { fontFamily: 'Geist-SemiBold', fontSize: 10, textTransform: 'uppercase' },
  alertTime: { fontFamily: 'Geist-Regular', fontSize: 10, color: semantics.text.muted },
  alertTitle: { fontFamily: 'Geist-Bold', fontSize: 16, color: semantics.text.primary, marginTop: 11 },
  alertMessage: { fontFamily: 'Geist-Regular', fontSize: 13, lineHeight: 20, color: semantics.text.primary, marginTop: 7 },
  areaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  areaText: { flex: 1, fontFamily: 'Geist-Medium', fontSize: 12, color: semantics.text.brand },
  categoryText: { fontFamily: 'Geist-Regular', fontSize: 11, color: semantics.text.muted, marginTop: 6 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.42)' },
  modalSheet: { maxHeight: '78%', borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: semantics.bg.surface, paddingBottom: 24 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: semantics.border.default },
  modalTitle: { fontFamily: 'Geist-Bold', fontSize: 18, color: semantics.text.primary },
  modalSub: { fontFamily: 'Geist-Regular', fontSize: 12, color: semantics.text.muted, marginTop: 3 },
  areaList: { padding: 16, gap: 9 },
  areaOption: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: 16, backgroundColor: semantics.bg.surfaceSubtle },
  areaIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: semantics.bg.primarySoft },
  areaIconActive: { backgroundColor: semantics.bg.primary },
  areaOptionText: { flex: 1, fontFamily: 'Geist-SemiBold', fontSize: 13, color: semantics.text.primary },
  toggle: { width: 42, height: 24, borderRadius: 12, padding: 3, backgroundColor: '#CBD5E1' },
  toggleActive: { backgroundColor: '#22C55E' },
  toggleKnob: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#FFFFFF' },
  toggleKnobActive: { marginLeft: 18 },
});
