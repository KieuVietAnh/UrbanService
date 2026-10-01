import React, { useCallback } from 'react';
import { View, ScrollView, RefreshControl, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/features/auth';
import {
  HomeHeader,
  HeroCard,
  QuickActions,
  ActiveTickets,
  NearbyIncidents,
  FeaturedIncidents,
  CommunityPreview,
  useHomeData,
} from '@/features/home';
import { colors } from '@/constants/theme';
import { styles } from '@/features/home/homeStyles';

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const firstName = ((user as { fullName?: string } | null | undefined)?.fullName?.split(' ').pop() ?? 'bạn');
  const areaName = (
    (user as { areaName?: string; districtName?: string } | null | undefined)?.areaName ??
    (user as { areaName?: string; districtName?: string } | null | undefined)?.districtName ??
    ''
  );
  const today = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const { tickets, nearby, isLoading, nearbyLoading, refetch, isRefetching } = useHomeData();

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <HomeHeader router={router} today={today} firstName={firstName} areaName={areaName} />
        <HeroCard router={router} />
        <NearbyIncidents nearbyLoading={nearbyLoading} nearby={nearby} router={router} />
        <QuickActions router={router} />
        <FeaturedIncidents nearbyLoading={nearbyLoading} nearby={nearby} router={router} />
        <CommunityPreview router={router} />
        <ActiveTickets isLoading={isLoading} tickets={tickets} router={router} />
        <View style={{ height: 120 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
