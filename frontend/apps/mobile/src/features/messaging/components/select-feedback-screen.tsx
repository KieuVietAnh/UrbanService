import React from 'react';
import { View, FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { AppHeader, Text } from '@/components/ui';
import { AppCard } from '@/components/ui';
import { TicketStatusBadge } from '@/components/ui';
import { AppErrorState, SkeletonCard } from '@/components/shared';
import { feedbackApi, reportingKeys } from '@/features/reporting/api';
import { colors } from '@/constants/theme';

export default function SelectFeedbackScreen() {
  const router = useRouter();

  const { data, isLoading, isError, isRefetching, refetch } = useQuery({
    queryKey: reportingKeys.list({ pageSize: 50, sortBy: 'createdAt', sortOrder: 'desc' }),
    queryFn: () =>
      feedbackApi.list({ pageSize: 50, sortBy: 'createdAt', sortOrder: 'desc' }),
    staleTime: 1000 * 30,
  });

  const feedbacks = Array.isArray(data) ? data : data?.items ?? [];

  const renderItem = ({ item }: { item: any }) => {
    const createdAt = item?.createdAt
      ? new Date(item.createdAt).toLocaleDateString('vi-VN')
      : '';
    return (
      <AppCard
        shadow="sm"
        pressable
        onPress={() => router.push(`/(resident)/tickets/${item.feedbackId ?? item.id}/chat` as any)}
        style={styles.cardPressable}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {item.title ?? 'Chưa có tiêu đề'}
          </Text>
          <TicketStatusBadge status={item.status ?? 'PENDING'} size="sm" />
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Ngày tạo</Text>
          <Text style={styles.metaValue}>{createdAt}</Text>
        </View>
      </AppCard>
    );
  };

  const renderEmpty = () => isError ? (
    <AppErrorState onRetry={refetch}>Không thể tải danh sách phản ánh.</AppErrorState>
  ) : (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIconCircle}>
        <Text style={styles.emptyIcon}>📄</Text>
      </View>
      <Text style={styles.emptyTitle}>Bạn chưa có phản ánh nào</Text>
      <Text style={styles.emptySubtitle}>
        Bạn cần tạo phản ánh trước khi trao đổi với nhân viên.
      </Text>
      <Pressable
        onPress={() => router.push('/(resident)/create-feedback' as any)}
        style={styles.emptyButton}
      >
        <Text style={styles.emptyButtonText}>Tạo phản ánh</Text>
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <AppHeader showBack title="Chọn phản ánh" onBack={() => router.back()} />
      <View style={styles.headerSection}>
        <Text style={styles.description}>
          Để nhân viên hỗ trợ chính xác hơn, hãy chọn phản ánh bạn muốn trao đổi.
        </Text>
      </View>

      <FlatList
        data={isLoading ? Array(4).fill(null) : feedbacks}
        keyExtractor={(item, index) => (item ? String(item.feedbackId ?? item.id ?? index) : String(index))}
        renderItem={({ item }) => (item ? renderItem({ item }) : <SkeletonCard />)}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={!isLoading ? renderEmpty : null}
        showsVerticalScrollIndicator={false}
        onRefresh={refetch}
        refreshing={isRefetching}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  headerSection: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  title: { fontFamily: 'Geist-SemiBold', fontSize: 22, color: colors.text, marginBottom: 8 },
  description: { fontFamily: 'Geist-Regular', fontSize: 14, color: colors.muted, lineHeight: 20 },
  listContent: { padding: 20, paddingBottom: 28 },
  cardPressable: { marginBottom: 16, padding: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  cardTitle: { fontFamily: 'Geist-SemiBold', fontSize: 16, color: colors.text, flex: 1 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  metaLabel: { fontFamily: 'Geist-Regular', fontSize: 12, color: colors.muted },
  metaValue: { fontFamily: 'Geist-SemiBold', fontSize: 13, color: colors.text },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyIconCircle: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center', marginBottom: 18 },
  emptyIcon: { fontSize: 32 },
  emptyTitle: { fontFamily: 'Geist-SemiBold', fontSize: 18, color: colors.text, marginBottom: 8, textAlign: 'center' },
  emptySubtitle: { fontFamily: 'Geist-Regular', fontSize: 14, color: colors.muted, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  emptyButton: { backgroundColor: colors.primary, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 999 },
  emptyButtonText: { fontFamily: 'Geist-SemiBold', fontSize: 14, color: '#FFFFFF' },
});
