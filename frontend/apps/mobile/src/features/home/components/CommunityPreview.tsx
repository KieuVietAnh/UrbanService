import React from 'react';
import { Image, Pressable, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Icon from '@expo/vector-icons/Feather';
import * as Haptics from 'expo-haptics';
import { SkeletonCard } from '@/components/shared';
import { Text } from '@/components/ui';
import { colors } from '@/constants/theme';
import type { RouterLike } from '../types';
import { useQuery } from '@tanstack/react-query';
import { communityApi, communityKeys } from '@/features/community/api';
import { styles } from '../homeStyles';

type Props = {
  router: RouterLike;
};

export function CommunityPreview({ router }: Props) {
  const feedParams = { pageNumber: 1, pageSize: 8 };
  const { data, isLoading } = useQuery({
    queryKey: communityKeys.feed(feedParams),
    queryFn: () => communityApi.getFeed(feedParams),
    staleTime: 1000 * 60,
    refetchOnWindowFocus: false,
  });

  const items = Array.isArray(data?.items) ? data.items : [];

  return (
    <View style={styles.section}>
      {isLoading ? (
        <View style={styles.communityBlock}>
          {Array.from({ length: 2 }).map((_, index) => (
            <View key={`preview-skeleton-${index}`} style={styles.communitySkeleton}>
              <SkeletonCard />
            </View>
          ))}
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyStateCard}>
          <Icon name="message-circle" size={28} color={colors.lightMuted} />
          <Text style={styles.emptyTitle}>Chưa có hoạt động cộng đồng</Text>
          <Text style={styles.emptySubtitle}>Các tin tức và phản ánh gần đây sẽ xuất hiện ở đây.</Text>
        </View>
      ) : (
        <View style={styles.communityHeroCard}>
          <View style={styles.communityGlow} />
          <View style={styles.communityHeaderRow}>
            <View>
              <Text style={styles.communitySectionTitle}>Cộng đồng cùng chung tay</Text>
              <Text style={styles.communitySectionSub}>Các chia sẻ mới nhất quanh khu vực</Text>
            </View>
            <Pressable style={styles.communityCta} onPress={() => router.push('/(resident)/community')}>
              <Text style={styles.communityCtaText}>Xem tất cả</Text>
              <Icon name="chevron-right" size={15} color="#6D28D9" />
            </Pressable>
          </View>

          <View style={styles.communityBodyRow}>
            <View style={styles.communityMiniList}>
              {items.slice(0, 2).map((item, index) => {
                const id = item.incidentId ?? item.id;
                const media = item.media?.find((value) => value?.fileUrl || value?.thumbnailUrl);
                const imageUrl = item.imageUrl || media?.thumbnailUrl || media?.fileUrl;
                return (
                  <Animated.View key={id ?? index} entering={FadeInDown.delay(index * 70).springify().damping(18)}>
                    <Pressable
                      style={styles.communityMiniCard}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        if (id) router.push(`/(resident)/community/${id}`);
                      }}
                    >
                      {imageUrl ? (
                        <Image source={{ uri: imageUrl }} style={styles.communityMiniImage} />
                      ) : (
                        <View style={[styles.communityMiniImage, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' }]}>
                          <Icon name="image" size={20} color={colors.lightMuted} />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <View style={styles.communityNewPill}>
                          <Text style={styles.communityNewText}>Mới</Text>
                        </View>
                        <Text style={styles.communityMiniTitle} numberOfLines={2}>
                          {item.title || 'Bài viết cộng đồng'}
                        </Text>
                        <Text style={styles.communityMiniAddress} numberOfLines={1}>
                          {item.locationText || 'Khu vực đang cập nhật'}
                        </Text>
                        <View style={styles.communityStatsRow}>
                          <Icon name="thumbs-up" size={12} color="#6B7280" />
                          <Text style={styles.communityStatText}>{item.supportCount ?? 0}</Text>
                          <Icon name="message-square" size={12} color="#6B7280" />
                          <Text style={styles.communityStatText}>{item.commentCount ?? 0}</Text>
                        </View>
                      </View>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>

            <View style={styles.communityIllustration}>
              <View style={styles.communityPersonA} />
              <View style={styles.communityPersonB} />
              <View style={styles.communityHeartBubble}>
                <Icon name="heart" size={16} color="#EC4899" />
              </View>
              <View style={styles.communityChatBubble}>
                <Icon name="message-circle" size={16} color="#8B5CF6" />
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
