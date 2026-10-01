import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Icon from '@expo/vector-icons/Feather';

import { KeyboardAwareComposerLayout } from '@/components/layouts';
import { AppBadge, AppButton, AppCard, AppHeader, Text } from '@/components/ui';
import { AppEmptyState, AppErrorState, SkeletonCard, useToast } from '@/components/shared';
import { communityApi, communityKeys } from '@/features/community/api';
import type { CommunityFeedCache, PublicIncidentDetail } from '@/features/community/types';
import { getResidentStatusLabel, getResidentStage } from '@/features/resident-status';
import TicketLocationMap from '@/features/reporting/components/ticket-location-map';
import { semantics } from '@/theme/semantics';

const formatDate = (value?: string | null) => value
  ? new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
  : '';

const publicEventLabel = (eventType?: string) => {
  const key = String(eventType ?? '').replace(/[_\s-]+/g, '').toLowerCase();
  if (key.includes('close') || key.includes('approved') || key.includes('complete')) return 'Hoàn thành';
  if (key.includes('resolution') || key.includes('approval') || key.includes('review')) return 'Đang kiểm tra kết quả';
  if (key.includes('progress') || key.includes('rework') || key.includes('process')) return 'Đang xử lý';
  if (key.includes('assign') || key.includes('verify') || key.includes('receive')) return 'Đã tiếp nhận';
  return 'Đã ghi nhận';
};

export default function CommunityDetailScreen() {
  const { id, autoFocusComment } = useLocalSearchParams<{ id?: string; autoFocusComment?: string }>();
  const incidentId = typeof id === 'string' ? id : '';
  const toast = useToast();
  const queryClient = useQueryClient();
  const inputRef = useRef<TextInput | null>(null);
  const [comment, setComment] = useState('');

  const detailQuery = useQuery({
    queryKey: communityKeys.detail(incidentId),
    queryFn: () => communityApi.getFeedDetail(incidentId),
    enabled: Boolean(incidentId),
  });
  const resolutionQuery = useQuery({
    queryKey: communityKeys.resolution(incidentId),
    queryFn: () => communityApi.getResolution(incidentId),
    enabled: Boolean(incidentId) && getResidentStage(detailQuery.data?.status) === 'completed',
  });
  const timelineQuery = useQuery({
    queryKey: communityKeys.timeline(incidentId),
    queryFn: () => communityApi.getTimeline(incidentId),
    enabled: Boolean(incidentId),
  });
  const commentsQuery = useQuery({
    queryKey: communityKeys.comments(incidentId),
    queryFn: () => communityApi.getComments(incidentId),
    enabled: Boolean(incidentId),
  });

  const incident = detailQuery.data;
  const resolution = resolutionQuery.data;
  const comments = commentsQuery.data ?? [];
  const timeline = timelineQuery.data ?? [];

  useEffect(() => {
    if (autoFocusComment === '1' || autoFocusComment === 'true') {
      const timer = setTimeout(() => inputRef.current?.focus(), 350);
      return () => clearTimeout(timer);
    }
  }, [autoFocusComment]);

  const syncDetail = (patch: Partial<PublicIncidentDetail>) => {
    queryClient.setQueryData<PublicIncidentDetail>(communityKeys.detail(incidentId), (current) => current ? { ...current, ...patch } : current);
    queryClient.setQueriesData<CommunityFeedCache>({ queryKey: communityKeys.feeds() }, (current) => {
      if (!current?.items) return current;
      return {
        ...current,
        items: current.items.map((item) => item.incidentId === incidentId ? { ...item, ...patch } : item),
      };
    });
  };

  const supportMutation = useMutation({
    mutationFn: async () => {
      if (incident?.isSupportedByCurrentUser) await communityApi.unsupport(incidentId);
      else await communityApi.support(incidentId);
      return !incident?.isSupportedByCurrentUser;
    },
    onSuccess: (supported) => {
      syncDetail({
        isSupportedByCurrentUser: supported,
        supportCount: Math.max(0, Number(incident?.supportCount ?? 0) + (supported ? 1 : -1)),
      });
    },
    onError: () => toast.error('Không thể cập nhật lượt đồng tình.'),
  });

  const subscribeMutation = useMutation({
    mutationFn: async () => {
      if (incident?.isSubscribedByCurrentUser) await communityApi.unsubscribe(incidentId);
      else await communityApi.subscribe(incidentId);
      return !incident?.isSubscribedByCurrentUser;
    },
    onSuccess: (subscribed) => {
      syncDetail({
        isSubscribedByCurrentUser: subscribed,
        subscriberCount: Math.max(0, Number(incident?.subscriberCount ?? 0) + (subscribed ? 1 : -1)),
      });
      toast.success(subscribed ? 'Đã theo dõi sự vụ.' : 'Đã dừng theo dõi sự vụ.');
    },
    onError: () => toast.error('Không thể cập nhật theo dõi.'),
  });

  const commentMutation = useMutation({
    mutationFn: () => communityApi.addComment(incidentId, comment.trim()),
    onSuccess: async () => {
      setComment('');
      await queryClient.invalidateQueries({ queryKey: communityKeys.comments(incidentId) });
      await queryClient.invalidateQueries({ queryKey: communityKeys.detail(incidentId) });
      toast.success('Đã gửi bình luận.');
    },
    onError: () => toast.error('Không thể gửi bình luận.'),
  });

  const gallery = useMemo(() => {
    const incidentMedia = incident?.media?.map((item) => item.fileUrl || item.thumbnailUrl).filter(Boolean) ?? [];
    const completionMedia = resolution?.completionDocuments?.map((item) => item.fileUrl || item.thumbnailUrl).filter(Boolean) ?? [];
    return [...incidentMedia, ...completionMedia] as string[];
  }, [incident?.media, resolution?.completionDocuments]);

  if (detailQuery.isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <AppHeader showBack title="Chi tiết sự vụ" />
        <ScrollView contentContainerStyle={styles.loading}><SkeletonCard /><SkeletonCard /></ScrollView>
      </SafeAreaView>
    );
  }

  if (detailQuery.isError || !incident) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <AppHeader showBack title="Chi tiết sự vụ" />
        <AppErrorState onRetry={detailQuery.refetch}>Không thể tải sự vụ cộng đồng.</AppErrorState>
      </SafeAreaView>
    );
  }

  const latitude = Number(incident.latitude ?? 0);
  const longitude = Number(incident.longitude ?? 0);
  const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude) && latitude !== 0 && longitude !== 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader showBack title="Chi tiết sự vụ" />
      <KeyboardAwareComposerLayout
        composer={
          <View style={styles.composer}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={comment}
              onChangeText={setComment}
              placeholder="Thêm bình luận công khai..."
              placeholderTextColor={semantics.text.lightMuted}
              multiline
            />
            <Pressable
              style={[styles.send, (!comment.trim() || commentMutation.isPending) && styles.sendDisabled]}
              disabled={!comment.trim() || commentMutation.isPending}
              onPress={() => commentMutation.mutate()}
            >
              <Icon name="send" size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        }
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={detailQuery.isRefetching} onRefresh={detailQuery.refetch} />}
        >
          <View style={styles.hero}>
            <View style={styles.statusRow}>
              <AppBadge status={incident.status} label={getResidentStatusLabel(incident.status)} />
              {incident.categoryName ? <Text style={styles.category}>{incident.categoryName}</Text> : null}
            </View>
            <Text style={styles.title}>{incident.title || 'Sự vụ cộng đồng'}</Text>
            <Text style={styles.description}>{incident.description || 'Chưa có mô tả công khai.'}</Text>
            <View style={styles.metaRow}><Icon name="map-pin" size={14} color={semantics.text.muted} /><Text style={styles.meta}>{incident.locationText || incident.areaName || 'Chưa xác định vị trí'}</Text></View>
            <View style={styles.metaRow}><Icon name="clock" size={14} color={semantics.text.muted} /><Text style={styles.meta}>{formatDate(incident.createdAt)}</Text></View>
            {incident.imageUrl ? <Image source={{ uri: incident.imageUrl }} style={styles.cover} /> : null}
            <View style={styles.actions}>
              <AppButton
                size="sm"
                variant={incident.isSupportedByCurrentUser ? 'primary' : 'outline'}
                onPress={() => supportMutation.mutate()}
                loading={supportMutation.isPending}
                leftIcon={<Icon name="thumbs-up" size={14} color={incident.isSupportedByCurrentUser ? '#FFFFFF' : semantics.text.brand} />}
              >
                {incident.supportCount ?? 0} đồng tình
              </AppButton>
              <AppButton
                size="sm"
                variant={incident.isSubscribedByCurrentUser ? 'primary' : 'outline'}
                onPress={() => subscribeMutation.mutate()}
                loading={subscribeMutation.isPending}
                leftIcon={<Icon name="bell" size={14} color={incident.isSubscribedByCurrentUser ? '#FFFFFF' : semantics.text.brand} />}
              >
                {incident.isSubscribedByCurrentUser ? 'Đang theo dõi' : 'Theo dõi'}
              </AppButton>
            </View>
          </View>

          {hasCoordinates ? (
            <AppCard shadow="sm" style={styles.card}>
              <Text style={styles.sectionTitle}>Vị trí công khai</Text>
              <View style={styles.mapWrap}>
                <TicketLocationMap
                  style={styles.map}
                  latitude={latitude}
                  longitude={longitude}
                  initialRegion={{ latitude, longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
                />
              </View>
            </AppCard>
          ) : null}

          <AppCard shadow="sm" style={styles.card}>
            <Text style={styles.sectionTitle}>Tiến độ công khai</Text>
            {timelineQuery.isLoading ? <SkeletonCard /> : timeline.length ? timeline.map((event, index) => (
              <View key={String(event.incidentEventId ?? index)} style={styles.timelineRow}>
                <View style={styles.timelineDot} />
                <View style={styles.timelineBody}>
                  <Text style={styles.timelineTitle}>{publicEventLabel(event.eventType)}</Text>
                  <Text style={styles.timelineTime}>{formatDate(event.createdAt)}</Text>
                </View>
              </View>
            )) : (
              <Text style={styles.muted}>Sự vụ đã được ghi nhận. Tiến độ mới sẽ xuất hiện tại đây.</Text>
            )}
          </AppCard>

          {resolution ? (
            <AppCard shadow="sm" style={styles.card}>
              <View style={styles.resolutionHeader}><Icon name="check-circle" size={20} color="#059669" /><Text style={styles.resolutionTitle}>Kết quả đã được duyệt</Text></View>
              {resolution.resolutionSummary ? <Text style={styles.resolutionText}>{resolution.resolutionSummary}</Text> : null}
              {resolution.actionTaken ? <Text style={styles.resolutionAction}>Biện pháp: {resolution.actionTaken}</Text> : null}
              {resolution.resolvedAt ? <Text style={styles.timelineTime}>Hoàn tất: {formatDate(resolution.resolvedAt)}</Text> : null}
            </AppCard>
          ) : null}

          {gallery.length ? (
            <View style={styles.gallerySection}>
              <Text style={styles.sectionTitle}>Hình ảnh công khai</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gallery}>
                {gallery.map((uri, index) => <Image key={`${uri}-${index}`} source={{ uri }} style={styles.galleryImage} />)}
              </ScrollView>
            </View>
          ) : null}

          <View style={styles.commentsSection}>
            <Text style={styles.sectionTitle}>Bình luận cộng đồng ({comments.length})</Text>
            {commentsQuery.isLoading ? <SkeletonCard /> : comments.length ? comments.map((item) => (
              <View key={item.id} style={styles.commentCard}>
                <View style={styles.commentIcon}><Icon name="user" size={14} color={semantics.text.brand} /></View>
                <View style={styles.commentBody}>
                  <Text style={styles.commentAuthor}>Thành viên cộng đồng</Text>
                  <Text style={styles.commentText}>{item.content}</Text>
                  <Text style={styles.timelineTime}>{formatDate(item.createdAt)}</Text>
                </View>
              </View>
            )) : (
              <AppEmptyState icon={<Icon name="message-circle" size={34} color={semantics.text.lightMuted} />}>Chưa có bình luận công khai.</AppEmptyState>
            )}
          </View>
        </ScrollView>
      </KeyboardAwareComposerLayout>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: semantics.bg.app },
  loading: { padding: 20, gap: 12 },
  scroll: { paddingBottom: 24 },
  hero: { padding: 20, backgroundColor: semantics.bg.surface, borderBottomWidth: 1, borderBottomColor: semantics.border.default },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  category: { fontFamily: 'Geist-SemiBold', fontSize: 12, color: semantics.text.brand, flexShrink: 1 },
  title: { fontFamily: 'Geist-Bold', fontSize: 24, lineHeight: 31, color: semantics.text.primary, marginTop: 14 },
  description: { fontFamily: 'Geist-Regular', fontSize: 14, lineHeight: 22, color: semantics.text.primary, marginTop: 10 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 9 },
  meta: { flex: 1, fontFamily: 'Geist-Regular', fontSize: 12, color: semantics.text.muted },
  cover: { width: '100%', height: 190, borderRadius: 18, marginTop: 16, backgroundColor: semantics.bg.surfaceSubtle },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16, flexWrap: 'wrap' },
  card: { marginHorizontal: 16, marginTop: 14, padding: 16 },
  sectionTitle: { fontFamily: 'Geist-SemiBold', fontSize: 13, color: semantics.text.primary, marginBottom: 12 },
  mapWrap: { height: 170, borderRadius: 16, overflow: 'hidden' },
  map: { width: '100%', height: 170 },
  timelineRow: { flexDirection: 'row', gap: 12, paddingVertical: 9 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: semantics.bg.primary, marginTop: 4 },
  timelineBody: { flex: 1 },
  timelineTitle: { fontFamily: 'Geist-SemiBold', fontSize: 13, color: semantics.text.primary },
  timelineTime: { fontFamily: 'Geist-Regular', fontSize: 11, color: semantics.text.muted, marginTop: 3 },
  muted: { fontFamily: 'Geist-Regular', fontSize: 13, lineHeight: 20, color: semantics.text.muted },
  resolutionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  resolutionTitle: { fontFamily: 'Geist-Bold', fontSize: 15, color: '#047857' },
  resolutionText: { fontFamily: 'Geist-Regular', fontSize: 14, lineHeight: 22, color: semantics.text.primary },
  resolutionAction: { fontFamily: 'Geist-Medium', fontSize: 13, lineHeight: 20, color: semantics.text.primary, marginTop: 8 },
  gallerySection: { marginTop: 16 },
  gallery: { gap: 10, paddingHorizontal: 16 },
  galleryImage: { width: 180, height: 122, borderRadius: 16, backgroundColor: semantics.bg.surfaceSubtle },
  commentsSection: { paddingHorizontal: 16, marginTop: 20 },
  commentCard: { flexDirection: 'row', gap: 11, backgroundColor: semantics.bg.surface, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: semantics.border.default },
  commentIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: semantics.bg.primarySoft },
  commentBody: { flex: 1 },
  commentAuthor: { fontFamily: 'Geist-SemiBold', fontSize: 12, color: semantics.text.primary },
  commentText: { fontFamily: 'Geist-Regular', fontSize: 14, lineHeight: 20, color: semantics.text.primary, marginTop: 4 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: semantics.bg.surface, borderTopWidth: 1, borderTopColor: semantics.border.default },
  input: { flex: 1, minHeight: 44, maxHeight: 100, borderRadius: 22, paddingHorizontal: 15, paddingVertical: 10, backgroundColor: semantics.bg.surfaceSubtle, color: semantics.text.primary, fontFamily: 'Geist-Regular', fontSize: 14 },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: semantics.bg.primary },
  sendDisabled: { opacity: 0.45 },
});
