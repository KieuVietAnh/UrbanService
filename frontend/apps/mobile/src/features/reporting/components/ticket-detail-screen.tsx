
import React, { useMemo, useState } from 'react';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';
import { fontSizes, fonts } from '@/theme/typography';
import {
  View,
  ScrollView,
  Pressable,
  Image,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Modal,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Icon from '@expo/vector-icons/Feather';
import { Text } from '@/components/ui';
import { AppCard } from '@/components/ui';
import { AppHeader } from '@/components/ui';
import { AppBadge } from '@/components/ui';
import { TimelineStep } from '@/components/ui';
import { BottomSheet } from '@/components/shared';
import { AppButton } from '@/components/ui';
import { SkeletonCard, Skeleton } from '@/components/shared';
import { AppErrorState } from '@/components/shared';
import { AppEmptyState } from '@/components/shared';
import { useToast } from '@/components/shared';
import { feedbackApi, reportingKeys } from '@/features/reporting/api';
import {
  getResidentStage,
  getResidentStageIndex,
  getResidentStatusLabel,
  isApprovedPublicResult,
} from '@/features/resident-status';
// Feedback chat moved to its own screen: /tickets/[id]/chat
import { semantics } from '@/theme/semantics';
import { axiosClient } from '@urbanmind/shared-api';
import TicketLocationMap from './ticket-location-map';

const resolveMediaUrl = (value: any) => {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }
  const baseUrl = String(axiosClient.defaults.baseURL || 'https://api.urbanservice.me').replace(/\/$/, '');
  if (trimmed.startsWith('/')) {
    return `${baseUrl}${trimmed}`;
  }
  return `${baseUrl}/${trimmed}`;
};

const getAttachmentUrl = (attachment: any): string | null => {
  if (!attachment) return null;
  if (typeof attachment === 'string') return resolveMediaUrl(attachment);
  if (Array.isArray(attachment)) return getAttachmentUrl(attachment[0]);

  const raw = [
    attachment.fileUrl,
    attachment.url,
    attachment.path,
    attachment.attachmentUrl,
    attachment.displayUrl,
    attachment.mediaUrl,
    attachment.publicUrl,
    attachment.downloadUrl,
    attachment.imageUrl,
    attachment.thumbnailUrl,
    attachment.coverImageUrl,
    attachment.src,
    attachment.link,
    attachment.href,
  ].find((value) => typeof value === 'string' && value.trim());

  return resolveMediaUrl(raw);
};

const getTicketAttachmentCandidates = (ticket: any) => {
  if (!ticket) return [];
  const attachments = Array.isArray(ticket.attachments) ? ticket.attachments : [];
  const attachmentList = Array.isArray(ticket.attachmentList) ? ticket.attachmentList : [];
  const images = Array.isArray(ticket.images) ? ticket.images : [];
  const imageUrls = Array.isArray(ticket.imageUrls) ? ticket.imageUrls : [];
  const mediaUrls = Array.isArray(ticket.mediaUrls) ? ticket.mediaUrls : [];
  const media = Array.isArray(ticket.media) ? ticket.media : [];
  
  return [
    ...attachments,
    ...attachmentList,
    ...images,
    ...imageUrls,
    ...mediaUrls,
    ...media,
  ].filter(Boolean);
};

const getStepStatus = (
  stepKey: string,
  currentStatus: string
): 'done' | 'active' | 'pending' => {
  const ORDER = ['submitted', 'received', 'processing', 'reviewing', 'completed'];
  const currentIdx = getResidentStageIndex(currentStatus);
  const stepIdx = ORDER.indexOf(stepKey);
  if (stepIdx < currentIdx) return 'done';
  if (stepIdx === currentIdx) return 'active';
  return 'pending';
};

const TIMELINE_STEPS = [
  { key: 'submitted', label: 'Đã gửi', desc: 'Phản ánh đã được gửi lên hệ thống.' },
  { key: 'received', label: 'Đã tiếp nhận', desc: 'Phản ánh đã được tiếp nhận để kiểm tra.' },
  { key: 'processing', label: 'Đang xử lý', desc: 'Đơn vị phụ trách đang xử lý sự vụ.' },
  { key: 'reviewing', label: 'Đang kiểm tra kết quả', desc: 'Kết quả đang được kiểm tra trước khi công bố.' },
  { key: 'completed', label: 'Hoàn thành', desc: 'Kết quả xử lý đã được phê duyệt.' },
];

interface CommentItem {
  id: string;
  senderName: string;
  senderRole?: string;
  content: string;
  createdAt: string;
}

function CommentBubble({ msg, isOwn }: { msg: CommentItem; isOwn: boolean }) {
  const time = msg.createdAt
    ? new Date(msg.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
      {!isOwn && (
        <Text style={styles.bubbleSender}>{msg.senderName || 'Cán bộ xử lý'}</Text>
      )}
      <Text style={[styles.bubbleText, isOwn && styles.bubbleTextOwn]}>
        {msg.content}
      </Text>
      <Text style={[styles.bubbleTime, isOwn && styles.bubbleTimeOwn]}>
        {time}
      </Text>
    </View>
  );
}

export default function TicketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const [showComments, setShowComments] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const feedbackId = id || '';

  // Fetch Ticket Details
  const {
    data: ticket,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: reportingKeys.detail(feedbackId),
    queryFn: () => feedbackApi.getById(feedbackId),
    enabled: Boolean(feedbackId),
    refetchInterval: 6000,
  });

  const { data: resolutions = [], isLoading: resolutionsLoading } = useQuery({
    queryKey: reportingKeys.resolutions(feedbackId),
    queryFn: () => feedbackApi.getResolutions(feedbackId),
    enabled: Boolean(feedbackId) && isApprovedPublicResult(ticket?.status),
  });

  // The detail contract already includes comments. Reuse the polled detail response
  // instead of issuing a second GET to the same endpoint on every interval.
  const comments = useMemo<CommentItem[]>(() => {
    const items = Array.isArray(ticket?.comments) ? ticket.comments : [];
    return items.map((c: any, index: number) => {
      const createdAt = c.createdAt ?? '';
      return {
        id: String(c.commentId ?? c.id ?? `comment-${index}`),
        senderName: c.authorName ?? c.userName ?? c.userFullName ?? 'Hệ thống',
        senderRole: c.authorRole ?? c.userRole ?? 'SERVICE_USER',
        content: c.content ?? c.text ?? '',
        createdAt,
      };
    });
  }, [ticket?.comments]);

  // Post Comment Mutation
  const addCommentMutation = useMutation({
    mutationFn: (content: string) => feedbackApi.addComment(feedbackId, content),
    onSuccess: async () => {
      setCommentInput('');
      await queryClient.invalidateQueries({ queryKey: reportingKeys.detail(feedbackId) });
      toast.success('Đã gửi trao đổi');
    },
    onError: (err: any) => toast.error(err.message || 'Không thể gửi bình luận'),
  });

  const commentCount = Array.isArray(comments) ? comments.length : 0;
  const latestComment = Array.isArray(comments) && comments.length > 0
    ? comments[comments.length - 1]
    : null;
  const latestCommentPreview = latestComment?.content
    ? String(latestComment.content).slice(0, 96)
    : 'Chưa có bình luận';

  const status = ticket?.status ?? 'SUBMITTED';
  const createdAt = ticket?.createdAt
    ? new Date(ticket.createdAt).toLocaleString('vi-VN')
    : '';

  const latitude = Number(ticket?.latitude ?? ticket?.location?.latitude ?? ticket?.locationLatitude ?? ticket?.coordinates?.latitude ?? ticket?.geo?.latitude ?? 0);
  const longitude = Number(ticket?.longitude ?? ticket?.location?.longitude ?? ticket?.locationLongitude ?? ticket?.coordinates?.longitude ?? ticket?.geo?.longitude ?? 0);
  const hasLocationCoords = Number.isFinite(latitude) && Number.isFinite(longitude) && latitude !== 0 && longitude !== 0;
  const miniMapRegion = hasLocationCoords
    ? {
        latitude,
        longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }
    : {
        latitude: 21.0278,
        longitude: 105.8342,
        latitudeDelta: 0.15,
        longitudeDelta: 0.15,
      };

  const attachmentUrls = getTicketAttachmentCandidates(ticket)
    .map(getAttachmentUrl)
    .filter((uri): uri is string => Boolean(uri));
  const histories: any[] = ticket?.statusHistories ?? [];
  const latestResolution = Array.isArray(resolutions) && resolutions.length
    ? [...resolutions].sort((a: any, b: any) => new Date(b?.resolvedAt ?? b?.createdAt ?? 0).getTime() - new Date(a?.resolvedAt ?? a?.createdAt ?? 0).getTime())[0]
    : null;
  const resolutionDocuments = Array.isArray(latestResolution?.completionDocuments)
    ? latestResolution.completionDocuments.map(getAttachmentUrl).filter((value: string | null): value is string => Boolean(value))
    : [];
  const canReview = isApprovedPublicResult(status) && Boolean(latestResolution);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <AppHeader showBack title="Chi tiết phản ánh" />
        <ScrollView contentContainerStyle={{ padding: spacing['5'], gap: spacing['3.5'] }}>
          <Skeleton height={28} width="70%" />
          <Skeleton height={18} width="40%" />
          <SkeletonCard />
          <SkeletonCard />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (isError && !isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <AppHeader showBack title="Chi tiết phản ánh" />
        <AppErrorState onRetry={refetch}>
          {(error as any)?.message || 'Không thể tải thông tin phản ánh'}
        </AppErrorState>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader
        showBack
        title="Chi tiết phản ánh"
        rightAction={
          <Pressable hitSlop={10} onPress={() => router.push('/(resident)/notifications' as any)}>
            <Icon name="bell" size={20} color={semantics.text.primary} />
          </Pressable>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={semantics.text.brand}
          />
        }
      >
        <View style={styles.heroSection}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroTitleBlock}>
              {ticket?.categoryName && (
                <View style={styles.categoryBadge}>
                  <Icon name="tag" size={12} color={semantics.text.brand} />
                  <Text style={styles.categoryBadgeText}>{ticket.categoryName}</Text>
                </View>
              )}
              <Text style={styles.titleText}>{ticket?.title ?? '—'}</Text>
            </View>
            <View style={styles.heroBadgeStack}>
              <AppBadge status={status} label={getResidentStatusLabel(status)} size="md" />
            </View>
          </View>

          <View style={styles.metaRows}>
            {ticket?.priority && (
              <View style={styles.metaRow}>
                <Icon name="zap" size={13} color={semantics.text.muted} />
                <Text style={styles.metaText}>Mức độ: {ticket.priority === 'Urgent' ? 'Khẩn cấp' : ticket.priority === 'High' ? 'Cao' : ticket.priority === 'Low' ? 'Thấp' : 'Trung bình'}</Text>
              </View>
            )}
            <View style={styles.metaRow}>
              <Icon name="map-pin" size={13} color={semantics.text.muted} />
              <Text style={styles.metaText}>{ticket?.locationText ?? 'Không rõ vị trí'}</Text>
            </View>
            <View style={styles.metaRow}>
              <Icon name="calendar" size={13} color={semantics.text.muted} />
              <Text style={styles.metaText}>{createdAt}</Text>
            </View>
          </View>

          <View style={styles.heroActionRow}>
            <AppButton
              variant="primary"
              size="md"
              onPress={() => router.push(`/(resident)/tickets/${feedbackId}/chat` as any)}
              fullWidth
              leftIcon={<Icon name="message-circle" size={15} color="#FFFFFF" style={{ marginRight: 5 }} />}
            >
              Mở hỗ trợ
            </AppButton>
          </View>
        </View>

        <View style={styles.sectionStack}>
          <AppCard shadow="sm">
            <View style={styles.cardContent}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardHeaderTitle}>Tiến độ xử lý</Text>
                <Text style={styles.sectionCounter}>{TIMELINE_STEPS.length} bước</Text>
              </View>
              <View style={styles.timelineCard}>
                {TIMELINE_STEPS.map((step, i) => {
                  const stepStatus = getStepStatus(step.key, status);
                  const histEntry = histories.find(
                    (h: any) => getResidentStage(h.status ?? h.newStatus) === step.key
                  );
                  const historyTime = histEntry?.createdAt ?? histEntry?.changedAt;
                  const ts = historyTime
                    ? new Date(historyTime).toLocaleString('vi-VN')
                    : undefined;

                  return (
                    <TimelineStep
                      key={step.key}
                      title={step.label}
                      description={step.desc}
                      timestamp={ts}
                      status={stepStatus}
                      isLast={i === TIMELINE_STEPS.length - 1}
                    />
                  );
                })}
              </View>
            </View>
          </AppCard>

          {ticket?.assignment?.operatorName && (
            <AppCard shadow="sm">
              <View style={styles.cardContent}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardHeaderTitle}>Đơn vị tiếp nhận</Text>
                  <View style={styles.trustBadge}>
                    <Icon name="check-circle" size={12} color="#10B981" />
                    <Text style={styles.trustBadgeText}>Đang xử lý</Text>
                  </View>
                </View>
                <View style={styles.assignedUnitRow}>
                  <View style={styles.assignedUnitAvatar}>
                    <Text style={styles.assignedUnitAvatarText}>
                      {(ticket.assignment.operatorName || 'OP').slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.assignedUnitName}>{ticket.assignment.operatorName}</Text>
                    <Text style={styles.assignedUnitStatus}>
                      {getResidentStatusLabel(status)}
                    </Text>
                  </View>
                </View>
              </View>
            </AppCard>
          )}

          <AppCard shadow="sm">
            <View style={styles.cardContent}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardHeaderTitle}>Vị trí phản ánh</Text>
                <View style={styles.locationBadge}>
                  <Icon name="map-pin" size={12} color={semantics.text.brand} />
                  <Text style={styles.locationBadgeText}>Bản đồ</Text>
                </View>
              </View>

              {hasLocationCoords ? (
                <View style={styles.locationMapWrapper}>
                  <TicketLocationMap
                    style={styles.locationMapCompact}
                    initialRegion={miniMapRegion}
                    latitude={latitude}
                    longitude={longitude}
                    camera={
                      hasLocationCoords
                        ? {
                            center: { latitude, longitude },
                            pitch: 0,
                            heading: 0,
                            altitude: 800,
                            zoom: 15,
                          }
                        : undefined
                    }
                  />
                  <View style={styles.locationMapTextWrap}>
                    <Text style={styles.locationTitle}>{ticket?.locationText ?? 'Không rõ vị trí'}</Text>
                    <Text style={styles.locationSubtitle}>Vị trí phản ánh đang được theo dõi</Text>
                    <Text style={styles.locationCoordsText}>{latitude.toFixed(5)}, {longitude.toFixed(5)}</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.locationMapCard}>
                  <View style={styles.locationMapCompactPlaceholder}>
                    <Icon name="map" size={28} color={semantics.text.brand} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.locationTitle}>{ticket?.locationText ?? 'Không rõ vị trí'}</Text>
                    <Text style={styles.locationSubtitle}>Vị trí phản ánh đang được theo dõi</Text>
                  </View>
                </View>
              )}
            </View>
          </AppCard>

          <AppCard shadow="sm">
            <View style={styles.cardContent}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardHeaderTitle}>Nội dung phản ánh</Text>
              </View>
              <Text style={styles.descriptionText}>{ticket?.description ?? 'Không có mô tả chi tiết.'}</Text>
            </View>
          </AppCard>

          {attachmentUrls.length > 0 && (
            <AppCard shadow="sm">
              <View style={styles.cardContent}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardHeaderTitle}>Bằng chứng & đính kèm</Text>
                  <Text style={styles.sectionCounter}>({attachmentUrls.length})</Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.gallery}
                >
                  {attachmentUrls.map((imgUri, i) => (
                    <Pressable key={i} onPress={() => setSelectedImage(imgUri)}>
                      <Image source={{ uri: imgUri }} style={styles.galleryImage} />
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </AppCard>
          )}

          {isApprovedPublicResult(status) && (
            <AppCard shadow="sm">
              <View style={styles.cardContent}>
                <View style={styles.resolutionHeader}>
                  <View style={styles.resolutionIcon}><Icon name="check-circle" size={20} color="#047857" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resolutionTitle}>Kết quả xử lý đã được duyệt</Text>
                    <Text style={styles.resolutionSubtitle}>Thông tin công khai dành cho người gửi phản ánh</Text>
                  </View>
                </View>
                {resolutionsLoading ? <SkeletonCard /> : latestResolution ? (
                  <>
                    {latestResolution.resolutionSummary ? <Text style={styles.resolutionSummary}>{latestResolution.resolutionSummary}</Text> : null}
                    {latestResolution.actionTaken ? <Text style={styles.resolutionAction}>Biện pháp thực hiện: {latestResolution.actionTaken}</Text> : null}
                    {latestResolution.resultNote ? <Text style={styles.resolutionAction}>{latestResolution.resultNote}</Text> : null}
                    {latestResolution.resolvedAt ? <Text style={styles.resolutionTime}>Hoàn tất lúc {new Date(latestResolution.resolvedAt).toLocaleString('vi-VN')}</Text> : null}
                    {resolutionDocuments.length > 0 ? (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.resolutionGallery}>
                        {resolutionDocuments.map((uri: string, index: number) => (
                          <Pressable key={`${uri}-${index}`} onPress={() => setSelectedImage(uri)}>
                            <Image source={{ uri }} style={styles.resolutionImage} />
                          </Pressable>
                        ))}
                      </ScrollView>
                    ) : null}
                  </>
                ) : (
                  <Text style={styles.descriptionText}>Kết quả đang được đồng bộ. Vui lòng kéo xuống để làm mới.</Text>
                )}
              </View>
            </AppCard>
          )}

          <AppCard shadow="sm">
            <View style={styles.cardContent}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardHeaderTitle}>Lịch sử cập nhật</Text>
                <Text style={styles.sectionCounter}>{histories.length}</Text>
              </View>
              <View style={styles.activityList}>
                {histories.length > 0 ? histories.slice(0, 4).map((history: any, index: number) => (
                  <View key={`${history?.id ?? index}-${history?.createdAt ?? index}`} style={styles.activityRow}>
                    <View style={styles.activityDot} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.activityTitle}>{getResidentStatusLabel(history?.status ?? history?.newStatus)}</Text>
                      <Text style={styles.activityNote}>Trạng thái xử lý phản ánh đã được cập nhật.</Text>
                      <Text style={styles.activityTime}>{history?.createdAt || history?.changedAt ? new Date(history.createdAt ?? history.changedAt).toLocaleString('vi-VN') : '—'}</Text>
                    </View>
                  </View>
                )) : (
                  <Text style={styles.descriptionText}>Chưa có lịch sử hoạt động.</Text>
                )}
              </View>
            </View>
          </AppCard>

          {ticket?.incidentId ? <AppCard shadow="sm">
            <View style={styles.cardContent}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardHeaderTitle}>Thảo luận cộng đồng</Text>
                <View style={styles.supportMeta}>
                  <Icon name="message-circle" size={12} color={semantics.text.brand} />
                  <Text style={styles.supportCount}>{commentCount} bình luận</Text>
                </View>
              </View>
              <View style={styles.communityPreview}>
                <Text style={styles.communityTitle}>Trò chuyện với cộng đồng</Text>
                <Text style={styles.descriptionText} numberOfLines={2}>{latestCommentPreview}</Text>
                <View style={styles.supportRow}>
                  <AppButton
                    variant="outline"
                    size="sm"
                    fullWidth
                    onPress={() => router.push(`/(resident)/community/${ticket.incidentId}` as any)}
                    leftIcon={<Icon name="message-circle" size={16} color={semantics.text.brand} style={{ marginRight: spacing['1.5'] }} />}
                  >
                    Mở thảo luận
                  </AppButton>
                </View>
              </View>
            </View>
          </AppCard> : null}


        </View>
      </ScrollView>

      {/* Resolution Review Card / Bottom Action Bar */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(spacing['7'] as number, insets.bottom + 8) }]}>
        <View style={{ flex: 1 }}>
          <AppButton
            variant="outline"
            size="md"
            fullWidth
            leftIcon={<Icon name="message-circle" size={16} color={semantics.text.brand} style={{ marginRight: spacing['1.5'] }} />}
            onPress={() => setShowComments(true)}
          >
            Trao đổi
          </AppButton>
        </View>

        {canReview && (
          <View style={{ flex: 1 }}>
            <AppButton
              variant="primary"
              size="md"
              fullWidth
              onPress={() => router.push(`/(resident)/tickets/${feedbackId}/review` as any)}
              leftIcon={<Icon name="star" size={16} color="#FFFFFF" style={{ marginRight: spacing['1.5'] }} />}
            >
              Đánh giá kết quả
            </AppButton>
          </View>
        )}
      </View>

      {/* Discussion Bottom Sheet */}
      <BottomSheet
        visible={showComments}
        onClose={() => setShowComments(false)}
        snapPoint={560}
      >
        <View style={styles.msgHeader}>
          <Text style={styles.msgHeaderTitle}>Trao đổi với cán bộ xử lý</Text>
          <Pressable onPress={() => setShowComments(false)} hitSlop={10}>
            <Icon name="x" size={20} color={semantics.text.primary} />
          </Pressable>
        </View>

        <FlatList
          data={comments}
          keyExtractor={(m) => m.id}
          style={{ flex: 1, paddingHorizontal: spacing['4'] }}
          contentContainerStyle={{ paddingVertical: spacing['3'], gap: spacing['2.5'] }}
          ListEmptyComponent={
            <AppEmptyState
              icon={<Icon name="message-circle" size={40} color={semantics.text.lightMuted} />}
            >
              Chưa có bình luận trao đổi nào.{'\n'}Gửi câu hỏi hoặc phản hồi cho cán bộ phụ trách.
            </AppEmptyState>
          }
          renderItem={({ item }) => (
            <CommentBubble
              msg={item}
              isOwn={item.senderRole === 'SERVICE_USER' || item.senderRole === 'service-user'}
            />
          )}
        />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.msgInputRow}>
            <TextInput
              style={styles.msgInput}
              placeholder="Nhập nội dung trao đổi..."
              placeholderTextColor={semantics.text.lightMuted}
              value={commentInput}
              onChangeText={setCommentInput}
              multiline
            />
            <Pressable
              onPress={() => commentInput.trim() && addCommentMutation.mutate(commentInput.trim())}
              disabled={!commentInput.trim() || addCommentMutation.isPending}
              style={[
                styles.sendBtn,
                !commentInput.trim() && styles.sendBtnDisabled,
              ]}
            >
              <Icon name="send" size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </BottomSheet>

      {/* Image Zoom Modal */}
      <Modal visible={Boolean(selectedImage)} transparent animationType="fade">
        <View style={styles.imageModalBackdrop}>
          <Pressable onPress={() => setSelectedImage(null)} style={styles.imageModalClose} hitSlop={12}>
            <Icon name="x" size={24} color="#FFFFFF" />
          </Pressable>
          {selectedImage && (
            <Image
              source={{ uri: selectedImage }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: semantics.bg.app },
  scrollContent: {
    paddingBottom: 140,
  },
  heroSection: {
    paddingHorizontal: spacing['5'],
    paddingTop: spacing['4'],
    paddingBottom: 18,
    backgroundColor: semantics.bg.surface,
    borderBottomWidth: 1,
    borderBottomColor: semantics.border.default,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing['3.5'],
  },
  heroTitleBlock: {
    flex: 1,
  },
  heroBadgeStack: {
    alignItems: 'flex-end',
    gap: spacing['2'],
  },
  priorityBadgeWrap: {
    marginTop: spacing['1'],
  },
  codeText: {
    fontSize: fontSizes['xs'],
    fontFamily: fonts.medium,
    color: semantics.text.muted,
    marginBottom: spacing['2'],
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['1.5'],
    paddingVertical: spacing['1.5'],
    paddingHorizontal: spacing['2.5'],
    borderRadius: radius['sm'],
    backgroundColor: semantics.bg.surfaceSubtle,
    marginBottom: spacing['2'],
  },
  categoryBadgeText: {
    fontSize: fontSizes['xs'],
    fontFamily: fonts.semibold,
    color: semantics.text.brand,
  },
  titleText: {
    fontSize: 26,
    fontFamily: fonts.bold,
    color: semantics.text.primary,
    marginBottom: spacing['2.5'],
    letterSpacing: -0.4,
  },
  metaRows: {
    gap: spacing['1.5'],
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['1.5'],
  },
  metaText: {
    fontSize: fontSizes['sm'],
    fontFamily: fonts.regular,
    color: semantics.text.muted,
    flex: 1,
  },
  heroActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['2.5'],
    marginTop: spacing['4'],
    minHeight: 44,
  },
  sectionStack: {
    paddingHorizontal: spacing['5'],
    gap: spacing['3'],
    marginTop: spacing['3.5'],
  },
  cardWrap: {
    paddingHorizontal: spacing['5'],
    marginTop: spacing['4'],
  },
  cardContent: {
    padding: spacing['4'],
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing['2.5'],
  },
  cardHeaderTitle: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: semantics.text.lightMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  liveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['1.5'],
    borderRadius: radius['pill'],
    paddingHorizontal: spacing['2.5'],
    paddingVertical: spacing['1.5'],
    backgroundColor: '#DCFCE7',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: radius['pill'],
    backgroundColor: '#10B981',
  },
  liveChipText: {
    fontSize: fontSizes['2xs'],
    fontFamily: fonts.semibold,
    color: '#047857',
  },
  currentStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['3'],
  },
  statusCurrentIcon: {
    width: 48,
    height: 48,
    borderRadius: radius['md'],
    backgroundColor: semantics.bg.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentStatusLabel: {
    fontSize: fontSizes['lg'],
    fontFamily: fonts.bold,
    color: semantics.text.primary,
    marginBottom: spacing['1'],
  },
  currentStatusBody: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: semantics.text.brand,
    marginBottom: spacing['1.5'],
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  descriptionText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: semantics.text.primary,
    lineHeight: 22,
  },
  statusDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing['3'],
    borderTopWidth: 1,
    borderTopColor: semantics.border.default,
    marginTop: spacing['3'],
  },
  statusDetailKey: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: semantics.text.muted,
  },
  statusDetailValue: {
    fontSize: fontSizes['xs'],
    fontFamily: fonts.semibold,
    color: semantics.text.primary,
  },
  supportMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  supportCount: {
    fontSize: fontSizes['2xs'],
    fontFamily: fonts.semibold,
    color: semantics.text.muted,
  },
  chatCardMain: {
    borderRadius: radius['lg'],
    backgroundColor: '#EFF6FF',
    padding: spacing['3.5'],
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  chatHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['3'],
  },
  chatIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius['md'],
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatTitle: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: semantics.text.primary,
  },
  chatSubtitle: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: semantics.text.muted,
    marginTop: 3,
  },
  chatPreviewWrap: {
    marginTop: spacing['3'],
    padding: spacing['2.5'],
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  chatPreviewText: {
    fontSize: fontSizes['xs'],
    fontFamily: fonts.regular,
    color: semantics.text.primary,
    lineHeight: 18,
  },
  supportRow: {
    marginTop: spacing['3'],
  },
  timelineCard: {
    paddingTop: spacing['0.5'],
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['1'],
    borderRadius: 99,
    backgroundColor: '#EAF7EE',
    paddingHorizontal: spacing['2'],
    paddingVertical: spacing['1'],
  },
  locationBadgeText: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes['2xs'],
    color: '#047857',
  },
  locationMapCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['3'],
  },
  locationMapWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['3'],
  },
  locationMapCompact: {
    width: 110,
    height: 110,
    borderRadius: radius['lg'],
    overflow: 'hidden',
    backgroundColor: '#EAF7EE',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  locationMapCompactPlaceholder: {
    width: 80,
    height: 56,
    borderRadius: radius['md'],
    backgroundColor: '#EAF7EE',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationMapTextWrap: {
    flex: 1,
  },
  locationTitle: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes['sm'],
    color: semantics.text.primary,
  },
  locationSubtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSizes['2xs'],
    color: semantics.text.muted,
    marginTop: spacing['1'],
  },
  locationCoordsText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes['2xs'],
    color: semantics.text.brand,
    marginTop: spacing['1.5'],
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['1'],
    borderRadius: 99,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: spacing['2'],
    paddingVertical: spacing['1'],
  },
  trustBadgeText: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes['2xs'],
    color: '#047857',
  },
  assignedUnitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['3'],
  },
  assignedUnitAvatar: {
    width: 44,
    height: 44,
    borderRadius: radius['md'],
    backgroundColor: semantics.text.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assignedUnitAvatarText: {
    fontFamily: fonts.bold,
    fontSize: fontSizes['sm'],
    color: '#FFFFFF',
  },
  assignedUnitName: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes['sm'],
    color: semantics.text.primary,
  },
  assignedUnitStaff: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: semantics.text.muted,
    marginTop: spacing['0.5'],
  },
  assignedUnitStatus: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: semantics.text.primary,
    marginTop: spacing['1'],
  },
  communityPreview: {
    paddingVertical: spacing['1'],
  },
  communityTitle: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes['sm'],
    color: semantics.text.primary,
    marginBottom: spacing['1.5'],
  },
  metadataLabel: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: semantics.text.muted,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing['5'],
    marginBottom: spacing['2.5'],
  },
  sectionTitle: {
    fontSize: fontSizes['xs'],
    fontFamily: fonts.semibold,
    color: semantics.text.lightMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sectionCounter: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: semantics.text.muted,
  },
  gallery: {
    paddingHorizontal: spacing['5'],
    gap: spacing['2.5'],
  },
  galleryImage: {
    width: 160,
    height: 120,
    borderRadius: radius['control'],
    backgroundColor: semantics.bg.surfaceSubtle,
  },
  timelineSection: {
    paddingHorizontal: spacing['5'],
    marginTop: spacing['6'],
  },
  discussionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['1.5'],
    paddingHorizontal: spacing['2.5'],
    paddingVertical: spacing['1.5'],
    borderRadius: radius['pill'],
    backgroundColor: '#EFF6FF',
  },
  discussionPillText: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: semantics.text.brand,
  },
  unitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['1.5'],
    borderRadius: radius['pill'],
    backgroundColor: '#E0F2FE',
    paddingHorizontal: spacing['2.5'],
    paddingVertical: 5,
  },
  unitBadgeText: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes['2xs'],
    color: semantics.text.brand,
  },
  unitBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['3'],
  },
  unitAvatarWrap: {
    width: 48,
    height: 48,
    borderRadius: radius['control'],
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#93C5FD',
  },
  unitTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: semantics.text.primary,
  },
  unitSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: semantics.text.muted,
    marginTop: 3,
  },
  slaOwnerText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes['2xs'],
    color: semantics.text.lightMuted,
    marginTop: spacing['1'],
  },
  unitStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['1'],
    paddingHorizontal: spacing['2'],
    paddingVertical: spacing['1'],
    borderRadius: radius['pill'],
    backgroundColor: '#DCFCE7',
  },
  unitOnlineDot: {
    width: 8,
    height: 8,
    borderRadius: 10,
    backgroundColor: '#22C55E',
  },
  unitStatusText: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes['2xs'],
    color: '#047857',
  },
  metaDetailGrid: {
    gap: spacing['2.5'],
  },
  metaDetailItem: {
    paddingVertical: spacing['2.5'],
    borderBottomWidth: 1,
    borderBottomColor: semantics.border.default,
  },
  metaDetailLabel: {
    fontSize: fontSizes['2xs'],
    fontFamily: fonts.regular,
    color: semantics.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  metaDetailValue: {
    marginTop: spacing['1'],
    fontSize: fontSizes['sm'],
    fontFamily: fonts.semibold,
    color: semantics.text.primary,
  },
  activityList: {
    gap: spacing['2.5'],
  },
  resolutionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['3'],
    marginBottom: spacing['3'],
  },
  resolutionIcon: {
    width: 42,
    height: 42,
    borderRadius: radius['md'],
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resolutionTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes['sm'],
    color: '#047857',
  },
  resolutionSubtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSizes['2xs'],
    color: semantics.text.muted,
    marginTop: spacing['0.5'],
  },
  resolutionSummary: {
    fontFamily: fonts.regular,
    fontSize: fontSizes['sm'],
    lineHeight: 22,
    color: semantics.text.primary,
  },
  resolutionAction: {
    fontFamily: fonts.medium,
    fontSize: fontSizes['xs'],
    lineHeight: 19,
    color: semantics.text.primary,
    marginTop: spacing['2'],
  },
  resolutionTime: {
    fontFamily: fonts.regular,
    fontSize: fontSizes['2xs'],
    color: semantics.text.muted,
    marginTop: spacing['2.5'],
  },
  resolutionGallery: {
    gap: spacing['2.5'],
    paddingTop: spacing['3'],
  },
  resolutionImage: {
    width: 150,
    height: 108,
    borderRadius: radius['control'],
    backgroundColor: semantics.bg.surfaceSubtle,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing['2.5'],
  },
  activityDot: {
    width: 8,
    height: 8,
    marginTop: spacing['1'],
    borderRadius: radius['pill'],
    backgroundColor: semantics.bg.primary,
  },
  activityTitle: {
    fontSize: fontSizes['xs'],
    fontFamily: fonts.semibold,
    color: semantics.text.primary,
  },
  activityNote: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: semantics.text.muted,
    marginTop: spacing['1'],
    lineHeight: 17,
  },
  activityTime: {
    fontSize: fontSizes['2xs'],
    fontFamily: fonts.regular,
    color: semantics.text.lightMuted,
    marginTop: spacing['1'],
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: spacing['3'],
    paddingHorizontal: spacing['5'],
    paddingTop: spacing['3'],
    paddingBottom: spacing['7'],
    backgroundColor: semantics.bg.surface,
    borderTopWidth: 1,
    borderTopColor: semantics.border.default,
  },
  msgHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing['5'],
    paddingBottom: spacing['3.5'],
    borderBottomWidth: 1,
    borderBottomColor: semantics.border.default,
  },
  msgHeaderTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: semantics.text.primary,
  },
  msgInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing['2.5'],
    paddingHorizontal: spacing['4'],
    paddingTop: spacing['2.5'],
    paddingBottom: spacing['4'],
    borderTopWidth: 1,
    borderTopColor: semantics.border.default,
  },
  msgInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    backgroundColor: semantics.bg.surfaceSubtle,
    borderRadius: radius['cardLarge'],
    paddingHorizontal: spacing['4'],
    paddingVertical: spacing['2.5'],
    fontFamily: fonts.regular,
    fontSize: 14,
    color: semantics.text.primary,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: radius['cardLarge'],
    backgroundColor: semantics.bg.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: semantics.text.lightMuted,
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: radius['card'],
    paddingHorizontal: spacing['3.5'],
    paddingVertical: spacing['2.5'],
  },
  bubbleOwn: {
    backgroundColor: semantics.bg.primary,
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: semantics.bg.surfaceSubtle,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  bubbleSender: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: semantics.text.muted,
    marginBottom: 3,
  },
  bubbleText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: semantics.text.primary,
    lineHeight: 20,
  },
  bubbleTextOwn: {
    color: semantics.text.inverse,
  },
  bubbleTime: {
    fontFamily: fonts.regular,
    fontSize: fontSizes['2xs'],
    color: semantics.text.lightMuted,
    marginTop: spacing['1'],
    alignSelf: 'flex-end',
  },
  bubbleTimeOwn: {
    color: 'rgba(255,255,255,0.7)',
  },
  imageModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: radius['xl'],
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullImage: {
    width: '100%',
    height: '80%',
  },
});
