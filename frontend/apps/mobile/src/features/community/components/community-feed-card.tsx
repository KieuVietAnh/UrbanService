import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Image, GestureResponderEvent } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Icon from '@expo/vector-icons/Feather';
import { AppCard } from '@/components/ui';
import { AppButton } from '@/components/ui';
import { TicketStatusBadge } from '@/components/ui';
import { Text } from '@/components/ui';
import { getResidentStatusLabel } from '@/features/resident-status';
import { colors } from '@/constants/theme';
import type { CommunityIncidentCardProps } from '../types/community.types';
import { communityApi, communityKeys } from '../api';
import { useToast } from '@/components/shared/toast';
import {
  applyOptimisticCommunitySupport,
  restoreCommunityCache,
  type CommunityCacheSnapshot,
} from '../utils/support-cache';

export function CommunityFeedCard({ item, onPress, onCommentPress }: CommunityIncidentCardProps) {
  const createdAt = item?.createdAt ? new Date(item.createdAt).toLocaleDateString('vi-VN') : '—';
  const [isSupported, setIsSupported] = useState(Boolean(item?.isSupportedByCurrentUser));
  const [supportCount, setSupportCount] = useState(Number(item?.supportCount ?? 0));

  useEffect(() => {
    setIsSupported(Boolean(item?.isSupportedByCurrentUser));
    setSupportCount(Number(item?.supportCount ?? 0));
  }, [item?.isSupportedByCurrentUser, item?.supportCount]);

  const queryClient = useQueryClient();
  const toast = useToast();
  const incidentId = String(item?.incidentId ?? item?.id ?? '');

  const supportMutation = useMutation({
    mutationFn: async (nextSupported: boolean) => {
      if (!incidentId) throw new Error('Missing incident id');
      if (!nextSupported) {
        await communityApi.unsupport(incidentId);
        return false;
      }
      await communityApi.support(incidentId);
      return true;
    },
    onMutate: async (nextSupported: boolean): Promise<{
      previousSupported: boolean;
      previousCount: number;
      snapshot: CommunityCacheSnapshot;
    }> => {
      const previousSupported = isSupported;
      const previousCount = supportCount;

      setIsSupported(nextSupported);
      setSupportCount(Math.max(0, previousCount + (nextSupported ? 1 : -1)));
      const snapshot = applyOptimisticCommunitySupport(queryClient, incidentId, nextSupported);
      await queryClient.cancelQueries({ queryKey: communityKeys.all });
      return { previousSupported, previousCount, snapshot };
    },
    onError: (_error, _nextSupported, context) => {
      setIsSupported(context?.previousSupported ?? Boolean(item?.isSupportedByCurrentUser));
      setSupportCount(context?.previousCount ?? Number(item?.supportCount ?? 0));
      restoreCommunityCache(queryClient, context?.snapshot);
      toast.error('Không thể cập nhật lượt ủng hộ. Vui lòng thử lại.');
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: communityKeys.feeds() });
      void queryClient.invalidateQueries({ queryKey: communityKeys.detail(incidentId) });
    },
  });

  const handleSupportPress = () => {
    if (!incidentId || supportMutation.isPending) return;
    supportMutation.mutate(!isSupported);
  };

  return (
    <AppCard shadow="sm" pressable onPress={onPress} style={styles.wrapper}>
      <View style={styles.cardContent}>
        <View style={styles.topRow}>
            <View style={styles.avatarWrap}>
              <Icon name="users" size={14} color={colors.primary} />
            </View>
            <View style={styles.metaGroup}>
              <Text className="text-sm font-sans-semibold text-text">Sự vụ cộng đồng</Text>
              <Text className="text-xs text-text-muted">{createdAt}</Text>
            </View>
            <TicketStatusBadge status={item?.status ?? 'SUBMITTED'} label={getResidentStatusLabel(item?.status)} size="sm" />
          </View>

          {item?.imageUrl || item?.media?.[0]?.fileUrl ? (
            <Image source={{ uri: item?.imageUrl || item?.media?.[0]?.fileUrl }} style={styles.heroImage} />
          ) : (
            <View style={styles.heroImagePlaceholder}>
              <Icon name="image" size={28} color={colors.lightMuted} />
            </View>
          )}

          <View style={styles.bodyWrap}>
            <View style={styles.badgeRow}>
              <View style={styles.metaPill}>
                <Icon name="map-pin" size={12} color={colors.muted} />
                <Text className="text-2xs text-text-muted" numberOfLines={1}>
                  {item?.locationText ?? 'Địa điểm chưa xác định'}
                </Text>
              </View>
            </View>

            <Text className="text-base font-sans-semibold text-text mt-2" numberOfLines={2}>
              {item?.title ?? 'Không có tiêu đề'}
            </Text>

            <Text className="text-sm text-text-muted mt-2" numberOfLines={3}>
              {item?.description ?? 'Không có mô tả chi tiết.'}
            </Text>
          </View>

          <View style={styles.footerRow}>
            <View style={styles.actionButtons}>
              <AppButton
                variant={isSupported ? 'primary' : 'outline'}
                size="sm"
                onPress={(event: GestureResponderEvent) => {
                  event.stopPropagation?.();
                  handleSupportPress();
                }}
                accessibilityState={{ selected: isSupported, busy: supportMutation.isPending }}
                style={styles.actionButton}
                leftIcon={<Icon name="thumbs-up" size={14} color={isSupported ? '#FFFFFF' : colors.primary} />}
              >
                {supportCount}
              </AppButton>

              <AppButton
                variant="outline"
                size="sm"
                onPress={(event: GestureResponderEvent) => {
                  event.stopPropagation?.();
                  onCommentPress();
                }}
                style={styles.actionButton}
                leftIcon={<Icon name="message-circle" size={14} color={colors.primary} />}
              >
                {item?.commentCount ?? 0}
              </AppButton>
            </View>

            <View style={styles.inlineMeta}>
              <Icon name="clock" size={13} color={colors.lightMuted} />
              <Text className="text-2xs text-text-light">{createdAt}</Text>
            </View>
          </View>
        </View>
      </AppCard>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 12,
  },
  cardContent: {
    padding: 0,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
  },
  avatarWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  metaGroup: {
    flex: 1,
  },
  heroImage: {
    width: '100%',
    height: 180,
    backgroundColor: '#E2E8F0',
  },
  heroImagePlaceholder: {
    width: '100%',
    height: 180,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  bodyWrap: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 6,
  },
  badgeRow: {
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
    maxWidth: '70%',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginTop: 4,
  },
  inlineMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  actionButton: {
    minWidth: 96,
  },
});
