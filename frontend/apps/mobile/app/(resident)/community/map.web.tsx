import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Icon from '@expo/vector-icons/Feather';
import { Text } from '@/components/ui';
import { AppHeader } from '@/components/ui';
import { AppCard } from '@/components/ui';
import { SkeletonCard } from '@/components/shared';
import { communityApi, communityKeys } from '@/features/community/api';
import { colors } from '@/constants/theme';

export default function CommunityMapScreen() {
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: communityKeys.webMapFeed(),
    queryFn: () => communityApi.getFeed({ pageNumber: 1, pageSize: 50 }),
  });

  const items = data?.items ?? [];
  const markers = items.filter((item: any) => Number.isFinite(item?.latitude) && Number.isFinite(item?.longitude));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader showBack title="Bản đồ cộng đồng" />
      <View style={styles.container}>
        {isLoading ? (
          <View style={styles.loadingWrap}>
            <SkeletonCard />
          </View>
        ) : (
          <View style={styles.webFallback}>
            <Icon name="map" size={40} color={colors.primary} />
            <Text className="text-base font-sans-semibold text-text mt-4">Bản đồ đang được chuẩn bị cho web</Text>
            <Text className="text-sm text-text-muted mt-2 text-center">
              Trên web, bạn có thể xem danh sách phản ánh và mở chi tiết từ từng mục.
            </Text>
          </View>
        )}

        <View style={styles.bottomCard}>
          <AppCard shadow="sm">
            <View style={styles.bottomCardContent}>
              <Text className="text-sm font-sans-semibold text-text">Xem phản ánh quanh đây</Text>
              <Text className="text-xs text-text-muted mt-1">Bấm vào điểm đánh dấu để mở chi tiết phản ánh.</Text>
            </View>
          </AppCard>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { flex: 1 },
  loadingWrap: { flex: 1, padding: 20 },
  webFallback: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  bottomCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
  },
  bottomCardContent: {
    padding: 14,
  },
});
