
import React, { useState } from 'react';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';
import { fontSizes, fonts } from '@/theme/typography';
import { View, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Icon from '@expo/vector-icons/Feather';
import { Text } from '@/components/ui';
import { AppHeader } from '@/components/ui';
import { AppButton } from '@/components/ui';
import { AppTextArea } from '@/components/shared';
import { useToast } from '@/components/shared';
import { feedbackApi, reportingKeys } from '@/features/reporting/api';
import { isApprovedPublicResult } from '@/features/resident-status';
import { colors } from '@/constants/theme';

const STARS = [1, 2, 3, 4, 5];

const SATISFACTION_OPTIONS = [
  { value: true, icon: 'thumbs-up', label: 'Hài lòng', bg: '#D1FAE5', color: '#047857' },
  { value: false, icon: 'thumbs-down', label: 'Chưa hài lòng', bg: '#FEE2E2', color: '#991B1B' },
];

export default function ReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();

  const [rating, setRating] = useState(0);
  const [isSatisfied, setIsSatisfied] = useState<boolean | null>(null);
  const [comment, setComment] = useState('');

  const { data: feedback } = useQuery({
    queryKey: reportingKeys.detail(id ?? ''),
    queryFn: () => feedbackApi.getById(id ?? ''),
    enabled: Boolean(id),
  });
  const { data: resolutions = [] } = useQuery({
    queryKey: reportingKeys.resolutions(id ?? ''),
    queryFn: () => feedbackApi.getResolutions(id ?? ''),
    enabled: Boolean(id) && isApprovedPublicResult(feedback?.status),
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      feedbackApi.submitReview(id!, rating, isSatisfied ?? true, comment.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reportingKeys.detail(id ?? '') });
      toast.success('Cảm ơn bạn đã đánh giá!');
      router.back();
    },
    onError: () => toast.error('Gửi đánh giá thất bại'),
  });

  const resultAvailable = isApprovedPublicResult(feedback?.status) && Array.isArray(resolutions) && resolutions.length > 0;
  const canSubmit = resultAvailable && rating > 0 && isSatisfied !== null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader showBack title="Đánh giá kết quả xử lý" />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.successCard}>
          <View style={styles.illustrationWrap}>
            <Icon name="check-circle" size={60} color="#10B981" />
          </View>
          <Text style={styles.successTitle}>Vấn đề đã được xử lý!</Text>
          <Text style={styles.successSubtitle}>Đánh giá của bạn giúp chúng tôi nâng cao chất lượng dịch vụ.</Text>
          <View style={styles.successMetaRow}>
            <View style={styles.successMetaPill}>
              <Icon name="activity" size={12} color={colors.primary} />
              <Text style={styles.successMetaText}>Xử lý hoàn tất</Text>
            </View>
            <View style={styles.successMetaPill}>
              <Icon name="clock" size={12} color={colors.primary} />
              <Text style={styles.successMetaText}>Cập nhật mới</Text>
            </View>
          </View>
        </View>

        <View style={styles.ratingCard}>
          {!resultAvailable ? (
            <View style={styles.pendingNotice}>
              <Icon name="clock" size={16} color="#92400E" />
              <Text style={styles.pendingNoticeText}>Bạn có thể đánh giá sau khi kết quả xử lý được phê duyệt và công bố.</Text>
            </View>
          ) : null}
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Đánh giá chất lượng xử lý</Text>
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>Feedback</Text>
            </View>
          </View>

          <Text style={styles.subtleQuestion}>Bạn đánh giá chất lượng xử lý như thế nào?</Text>
          <View style={styles.starsRow}>
            {STARS.map((s) => (
              <Pressable key={s} onPress={() => setRating(s)} hitSlop={8} style={s <= rating ? styles.starButtonActive : styles.starButton}>
                <Icon
                  name="star"
                  size={34}
                  color={s <= rating ? colors.amber : '#CBD5E1'}
                  fill={s <= rating ? colors.amber : 'transparent'}
                />
              </Pressable>
            ))}
          </View>
          <Text style={styles.ratingHint}>{rating ? `${rating}/5 sao` : 'Chưa có đánh giá'}</Text>
        </View>

        <View style={styles.satisfactionCard}>
          <Text style={styles.sectionTitle}>Kết quả xử lý</Text>
          <Text style={styles.subtleQuestion}>Bạn có hài lòng với kết quả không?</Text>
          <View style={styles.satisfactionRow}>
            {SATISFACTION_OPTIONS.map((opt) => {
              const active = isSatisfied === opt.value;
              return (
                <Pressable
                  key={String(opt.value)}
                  onPress={() => setIsSatisfied(opt.value)}
                  style={[
                    styles.satisfactionBtn,
                    { backgroundColor: active ? opt.bg : colors.background },
                    active && { borderColor: opt.color },
                  ]}
                >
                  <Icon
                    name={opt.icon as any}
                    size={22}
                    color={active ? opt.color : '#94A3B8'}
                  />
                  <Text
                    style={[
                      styles.satisfactionLabel,
                      active && { color: opt.color, fontFamily: fonts.semibold },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.feedbackCard}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Phản hồi của bạn</Text>
            <View style={styles.emptyChip}>
              <Text style={styles.emptyChipText}>{comment.trim() ? 'Đã nhập' : 'Trống'}</Text>
            </View>
          </View>
          <View style={styles.commentWrap}>
            <AppTextArea
              label="Góp ý thêm (tùy chọn)"
              value={comment}
              onChangeText={setComment}
              placeholder="Chia sẻ thêm về trải nghiệm của bạn..."
              rows={4}
              maxLength={500}
            />
          </View>
          <Text style={styles.helperText}>Bạn có thể để trống nếu không muốn bổ sung thêm.</Text>
        </View>

        <View style={styles.ctaArea}>
          <AppButton
            onPress={() => submitMutation.mutate()}
            loading={submitMutation.isPending}
            disabled={!canSubmit}
            fullWidth
            size="lg"
            rightIcon={<Icon name="send" size={16} color="#FFFFFF" style={{ marginLeft: spacing['1'] }} />}
          >
            Gửi đánh giá
          </AppButton>

          <Pressable onPress={() => router.back()} style={styles.skipButton} hitSlop={12}>
            <Text style={styles.skipText}>Bỏ qua</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  body: {
    flexGrow: 1,
    paddingHorizontal: spacing['6'],
    paddingTop: spacing['5'],
    paddingBottom: 30,
  },
  pendingNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing['2'],
    borderRadius: radius['control'],
    padding: spacing['3'],
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: spacing['3'],
  },
  pendingNoticeText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: fontSizes['xs'],
    lineHeight: 18,
    color: '#92400E',
  },
  successCard: {
    backgroundColor: colors.surface,
    borderRadius: radius['2xl'],
    padding: spacing['5'],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1FAE5',
    shadowColor: colors.emerald,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 3,
  },
  illustrationWrap: {
    width: 116,
    height: 116,
    borderRadius: 58,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing['3'],
    borderWidth: 1,
    borderColor: '#6EE7B7',
  },
  successTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes['2xl'],
    color: colors.text,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  successSubtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSizes['sm'],
    color: colors.muted,
    lineHeight: 20,
    marginTop: spacing['2'],
    textAlign: 'center',
  },
  successMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['2'],
    marginTop: spacing['4'],
  },
  successMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['1.5'],
    paddingHorizontal: spacing['3'],
    paddingVertical: 7,
    borderRadius: radius['pill'],
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  successMetaText: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes['2xs'],
    color: '#047857',
  },
  ratingCard: {
    marginTop: spacing['4'],
    backgroundColor: colors.surface,
    borderRadius: radius['xl'],
    padding: spacing['4'],
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes['sm'],
    color: '#334155',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['1.5'],
    backgroundColor: colors.primarySoft,
    borderRadius: radius['pill'],
    paddingHorizontal: spacing['2.5'],
    paddingVertical: spacing['1.5'],
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: radius['pill'],
    backgroundColor: '#3B82F6',
  },
  liveText: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes['2xs'],
    color: '#1D4ED8',
  },
  subtleQuestion: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.text,
    marginTop: spacing['3'],
    marginBottom: spacing['3'],
    textAlign: 'center',
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing['2.5'],
  },
  starButton: {
    padding: spacing['2'],
    borderRadius: radius['pill'],
  },
  starButtonActive: {
    padding: spacing['2'],
    borderRadius: radius['pill'],
    backgroundColor: '#FEF3C7',
  },
  ratingHint: {
    marginTop: spacing['3'],
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.muted,
    textAlign: 'center',
  },
  satisfactionCard: {
    marginTop: spacing['4'],
    backgroundColor: colors.surface,
    borderRadius: radius['xl'],
    padding: spacing['4'],
    borderWidth: 1,
    borderColor: colors.border,
  },
  satisfactionRow: {
    flexDirection: 'row',
    gap: spacing['3'],
    marginTop: spacing['3'],
  },
  satisfactionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['2.5'],
    paddingVertical: spacing['4'],
    borderRadius: radius['control'],
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  satisfactionLabel: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.muted,
  },
  feedbackCard: {
    marginTop: spacing['4'],
    backgroundColor: colors.surface,
    borderRadius: radius['xl'],
    padding: spacing['4'],
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyChip: {
    backgroundColor: colors.background,
    borderRadius: radius['pill'],
    paddingHorizontal: spacing['2.5'],
    paddingVertical: spacing['1.5'],
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  emptyChipText: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes['2xs'],
    color: colors.muted,
  },
  commentWrap: {
    marginTop: spacing['2.5'],
    marginBottom: spacing['2'],
  },
  helperText: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.muted,
  },
  ctaArea: {
    marginTop: spacing['5'],
    paddingBottom: spacing['3.5'],
  },
  skipButton: {
    alignSelf: 'center',
    marginTop: spacing['3.5'],
  },
  skipText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes['sm'],
    color: colors.muted,
  },
});
