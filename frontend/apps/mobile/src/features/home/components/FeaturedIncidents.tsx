import React from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Icon from '@expo/vector-icons/Feather';
import { axiosClient } from '@urbanmind/shared-api';
import { useQueries } from '@tanstack/react-query';
import { SkeletonCard } from '@/components/shared';
import { TicketStatusBadge } from '@/components/ui';
import { Text } from '@/components/ui';
import { colors } from '@/constants/theme';
import { communityApi, communityKeys } from '@/features/community/api';
import type { RouterLike, TicketLike } from '../types';
import { styles } from '../homeStyles';
import { SectionHeader } from './SectionHeader';

type Props = {
  nearbyLoading: boolean;
  nearby: TicketLike[];
  router: RouterLike;
};

const resolveMediaUrl = (value: unknown) => {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:') || trimmed.startsWith('blob:') || trimmed.startsWith('file:')) {
    return trimmed;
  }
  const baseUrl = String(axiosClient.defaults.baseURL || '').replace(/\/$/, '');
  if (!baseUrl) return trimmed;
  return trimmed.startsWith('/') ? `${baseUrl}${trimmed}` : `${baseUrl}/${trimmed}`;
};

const isImageLike = (attachment: any, url: string) => {
  const mime = String(attachment?.mime ?? attachment?.mimeType ?? attachment?.type ?? attachment?.contentType ?? attachment?.fileType ?? '').toLowerCase();
  if (mime) return mime.startsWith('image/');
  const name = String(attachment?.fileName ?? attachment?.name ?? attachment?.originalFileName ?? attachment?.originalName ?? '').toLowerCase();
  if (name) return /\.(png|jpe?g|webp|gif|heic|heif)$/i.test(name);
  return /\.(png|jpe?g|webp|gif|heic|heif)(\?|#|$)/i.test(url) || /^https?:\/\//i.test(url) || url.startsWith('file:') || url.startsWith('data:image/');
};

const getAttachmentUrl = (attachment: any): string | null => {
  if (!attachment) return null;
  if (typeof attachment === 'string') return resolveMediaUrl(attachment);
  if (Array.isArray(attachment)) return getAttachmentUrl(attachment[0]);

  const raw = [
    attachment.fileUrl,
    attachment.FileUrl,
    attachment.url,
    attachment.Url,
    attachment.uri,
    attachment.Uri,
    attachment.path,
    attachment.filePath,
    attachment.FilePath,
    attachment.attachmentUrl,
    attachment.AttachmentUrl,
    attachment.displayUrl,
    attachment.DisplayUrl,
    attachment.mediaUrl,
    attachment.MediaUrl,
    attachment.publicUrl,
    attachment.PublicUrl,
    attachment.downloadUrl,
    attachment.DownloadUrl,
    attachment.imageUrl,
    attachment.ImageUrl,
    attachment.thumbnailUrl,
    attachment.ThumbnailUrl,
    attachment.coverImageUrl,
    attachment.CoverImageUrl,
    attachment.src,
    attachment.link,
    attachment.href,
    attachment.location,
    attachment.Location,
  ].find((value) => typeof value === 'string' && value.trim());

  return resolveMediaUrl(raw);
};

const getIncidentImages = (ticket: TicketLike) => {
  const item = ticket as any;
  const candidates = [
    item.imageUrl,
    item.ImageUrl,
    item.thumbnailUrl,
    item.ThumbnailUrl,
    item.coverImageUrl,
    item.CoverImageUrl,
    item.mediaUrl,
    item.MediaUrl,
    ...(Array.isArray(item.attachments) ? item.attachments : []),
    ...(Array.isArray(item.Attachments) ? item.Attachments : []),
    ...(Array.isArray(item.attachmentList) ? item.attachmentList : []),
    ...(Array.isArray(item.feedbackAttachments) ? item.feedbackAttachments : []),
    ...(Array.isArray(item.evidence) ? item.evidence : []),
    ...(Array.isArray(item.evidences) ? item.evidences : []),
    ...(Array.isArray(item.evidenceImages) ? item.evidenceImages : []),
    ...(Array.isArray(item.attachmentUrls) ? item.attachmentUrls : []),
    ...(Array.isArray(item.images) ? item.images : []),
    ...(Array.isArray(item.imageUrls) ? item.imageUrls : []),
    ...(Array.isArray(item.mediaUrls) ? item.mediaUrls : []),
    ...(Array.isArray(item.media) ? item.media : []),
  ].filter(Boolean);

  const urls = candidates
    .map((candidate) => {
      const url = getAttachmentUrl(candidate);
      if (!url || !isImageLike(candidate, url)) return null;
      return url;
    })
    .filter(Boolean) as string[];

  return Array.from(new Set(urls));
};

export function FeaturedIncidents({ nearbyLoading, nearby, router }: Props) {
  const items = nearby;
  const detailQueries = useQueries({
    queries: items.slice(0, 5).map((item) => {
      const id = item.incidentId ?? item.id;
      return {
        queryKey: communityKeys.detail(String(id ?? '')),
        queryFn: () => communityApi.getFeedDetail(String(id)),
        enabled: Boolean(id) && getIncidentImages(item).length === 0,
        staleTime: 1000 * 60 * 5,
        retry: 1,
      };
    }),
  });

  return (
    <View style={styles.section}>
      <SectionHeader
        title="Phản ánh cộng đồng mới"
        actionLabel="Xem tất cả"
        onAction={() => router.push('/(resident)/community')}
      />
      {nearbyLoading ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featuredRow}>
          {Array.from({ length: 3 }).map((_, index) => (
            <View key={`featured-skeleton-${index}`} style={styles.featuredSkeleton}>
              <SkeletonCard />
            </View>
          ))}
        </ScrollView>
      ) : items.length === 0 ? (
        <View style={styles.emptyStateCard}>
          <Icon name="inbox" size={28} color={colors.lightMuted} />
          <Text style={styles.emptyTitle}>Chưa có phản ánh cộng đồng</Text>
          <Text style={styles.emptySubtitle}>Phản ánh mới từ API sẽ xuất hiện tại đây.</Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featuredRow}>
          {items.slice(0, 5).map((item, index) => {
            const detail = detailQueries[index]?.data as TicketLike | undefined;
            const mergedItem = detail ? ({ ...item, ...detail } as TicketLike) : item;
            return (
              <FeaturedIncidentCard
                key={item.incidentId ?? item.id ?? `community-${index}`}
                item={mergedItem}
                index={index}
                router={router}
              />
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

function FeaturedIncidentCard({ item, index, router }: { item: TicketLike; index: number; router: RouterLike }) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const id = item.incidentId ?? item.id;
  const images = getIncidentImages(item);

  return (
    <Animated.View entering={FadeInDown.delay(index * 70).springify().damping(18)} style={[styles.featuredCard, animatedStyle]}>
      <Pressable
        disabled={!id}
        onPressIn={() => {
          scale.value = withSpring(0.98, { damping: 16, stiffness: 360 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 16, stiffness: 360 });
        }}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          if (id) router.push(`/(resident)/community/${id}`);
        }}
        style={styles.featuredPressable}
      >
        <View style={styles.featuredImageWrap}>
          <IncidentImageCollage images={images} />
        </View>
        <Text style={styles.featuredTitle} numberOfLines={2}>
          {item.title ?? 'Sự cố gần bạn'}
        </Text>
        <View style={styles.featuredMetaRow}>
          <Icon name="map-pin" size={13} color={colors.text} />
          <Text style={styles.featuredAddress} numberOfLines={1}>
            {item.locationText ?? 'Vị trí đang cập nhật'}
          </Text>
        </View>
        <View style={styles.featuredStatusRow}>
          <TicketStatusBadge status={item.status ?? 'Submitted'} size="sm" />
        </View>
      </Pressable>
    </Animated.View>
  );
}

function IncidentImageCollage({ images }: { images: string[] }) {
  if (images.length === 0) {
    return (
      <View style={styles.featuredImageFallback}>
        <Icon name="image" size={24} color="#94A3B8" />
      </View>
    );
  }

  if (images.length === 1) {
    return <Image source={{ uri: images[0] }} style={styles.featuredImage} resizeMode="cover" />;
  }

  if (images.length === 2) {
    return (
      <View style={styles.featuredCollageRow}>
        {images.slice(0, 2).map((uri) => (
          <Image key={uri} source={{ uri }} style={styles.featuredCollageHalf} resizeMode="cover" />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.featuredCollageRow}>
      <Image source={{ uri: images[0] }} style={styles.featuredCollageMain} resizeMode="cover" />
      <View style={styles.featuredCollageStack}>
        <Image source={{ uri: images[1] }} style={styles.featuredCollageSmall} resizeMode="cover" />
        <View style={styles.featuredCollageSmallWrap}>
          <Image source={{ uri: images[2] }} style={styles.featuredImage} resizeMode="cover" />
          {images.length > 3 ? (
            <View style={styles.featuredMoreOverlay}>
              <Text style={styles.featuredMoreText}>+{images.length - 3}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}
