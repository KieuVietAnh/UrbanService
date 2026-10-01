import React, { useState } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  Alert,
  RefreshControl,
  StyleSheet,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Icon from '@expo/vector-icons/Feather';
import { getRoleLabel } from '@urbanmind/shared-types';
import { AppButton, AppInput, Text } from '@/components/ui';
import { SkeletonCard } from '@/components/shared';
import { AppErrorState } from '@/components/shared';
import { useAuthStore } from '@/features/auth';
import { feedbackApi, reportingKeys, type FeedbackFilters } from '@/features/reporting/api';
import { useToast } from '@/components/shared';
import { semantics } from '@/theme/semantics';
import { profileApi, profileKeys } from '../api';
import { getResidentStage } from '@/features/resident-status';

const PROFILE_FEEDBACK_FILTERS: FeedbackFilters = {
  pageSize: 100,
  sortBy: 'createdAt',
  sortOrder: 'desc',
};

interface SettingRow {
  icon: keyof typeof Icon.glyphMap;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

function SectionHeader({ label }: { label: string }) {
  return <Text style={styles.sectionHeader}>{label}</Text>;
}

function SettingItem({ item }: { item: SettingRow }) {
  return (
    <Pressable
      onPress={item.onPress}
      style={({ pressed }) => [styles.settingItem, pressed && styles.settingItemPressed]}
    >
      <View style={styles.settingMainContent}>
        <View style={[styles.settingIcon, item.destructive && styles.settingIconDestructive]}>
          <Icon
            name={item.icon}
            size={18}
            color={item.destructive ? semantics.text.danger : semantics.text.brand}
          />
        </View>
        <Text
          style={[styles.settingLabel, item.destructive && styles.settingLabelDestructive]}
          numberOfLines={1}
        >
          {item.label}
        </Text>
      </View>

    </Pressable>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const setUser = useAuthStore((s) => s.setUser);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');

  const userId = user?.id || '';

  // Fetch Profile via userApi
  const {
    data: profileData,
    isLoading: isProfileLoading,
    isError: isProfileError,
    refetch: refetchProfile,
    isRefetching,
  } = useQuery({
    queryKey: profileKeys.detail(),
    queryFn: profileApi.getProfile,
    enabled: Boolean(userId),
    retry: false,
  });

  // Fetch Feedback Stats
  const { data: myFeedbacksData, isLoading: isFeedbackLoading } = useQuery({
    queryKey: reportingKeys.list(PROFILE_FEEDBACK_FILTERS),
    queryFn: () => feedbackApi.list(PROFILE_FEEDBACK_FILTERS),
    enabled: Boolean(userId),
  });

  // Update Profile Mutation via userApi
  const updateProfileMutation = useMutation({
    mutationFn: profileApi.updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.detail() });
      if (user) {
        setUser({
          ...user,
          fullName: editName,
          phone: editPhone,
        });
      }
      setEditModalVisible(false);
      toast.success('Cập nhật thông tin thành công!');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Không thể cập nhật thông tin');
    },
  });

  const activeProfile = profileData || user;
  const fullName = activeProfile?.fullName || 'Cư dân';
  const email = activeProfile?.email || '';
  const phone = activeProfile?.phone || '';
  const addressValue = (activeProfile as Record<string, unknown> | null | undefined)?.address;
  const address = typeof addressValue === 'string' ? addressValue : '';
  const roleLabel = getRoleLabel(activeProfile?.role) || 'Cư dân';

  const initials = fullName
    .split(' ')
    .slice(-2)
    .map((w: string) => w[0])
    .join('')
    .toUpperCase() || 'U';

  const feedbackItems = Array.isArray(myFeedbacksData)
    ? myFeedbacksData
    : myFeedbacksData?.items || [];
  const totalCount = Array.isArray(myFeedbacksData)
    ? myFeedbacksData.length
    : myFeedbacksData?.totalItems || feedbackItems.length;

  const isSubmittedStatus = (status?: string) => getResidentStage(status) === 'submitted';
  const isProcessingStatus = (status?: string) => [
    'received',
    'processing',
    'reviewing',
  ].includes(getResidentStage(status));
  const isResolvedStatus = (status?: string) => getResidentStage(status) === 'completed';

  const submittedCount = feedbackItems.filter((item: any) => isSubmittedStatus(item?.status)).length;
  const processingCount = feedbackItems.filter((item: any) => isProcessingStatus(item?.status)).length;
  const resolvedCount = feedbackItems.filter((item: any) => isResolvedStatus(item?.status)).length;

  const handleOpenEdit = () => {
    setEditName(fullName);
    setEditPhone(phone);
    setEditAddress(address);
    setEditModalVisible(true);
  };

  const handleOpenMyFeedbacks = () => {
    router.push('/(resident)/tickets' as any);
  };

  const handleSaveEdit = () => {
    if (!editName.trim()) {
      toast.error('Họ và tên không được để trống');
      return;
    }
    updateProfileMutation.mutate({
      fullName: editName.trim(),
      phone: editPhone.trim(),
      address: editAddress.trim(),
    });
  };

  const handleLogout = () => {
    Alert.alert(
      'Đăng xuất',
      'Bạn có chắc chắn muốn đăng xuất khỏi ứng dụng?',
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Đăng xuất',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  const ACCOUNT_ROWS: SettingRow[] = [
    { icon: 'user', label: 'Chỉnh sửa thông tin cá nhân', onPress: handleOpenEdit },
    { icon: 'lock', label: 'Đổi mật khẩu', onPress: () => toast.info('Tính năng đang hoàn thiện') },
    {
      icon: 'bell',
      label: 'Cài đặt thông báo',
      onPress: () => router.push('/(resident)/notifications' as any),
    },
  ];

  const SUPPORT_ROWS: SettingRow[] = [
    { icon: 'help-circle', label: 'Trung tâm trợ giúp', onPress: () => toast.info('Tổng đài CSKH: 1900 8888') },
    { icon: 'shield', label: 'Điều khoản & Chính sách bảo mật', onPress: () => toast.info('UrbanMind v1.0.0 Policy') },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Top Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tài khoản</Text>
        <Pressable
          onPress={() => router.push('/(resident)/notifications' as any)}
          style={styles.bellBtn}
          hitSlop={10}
        >
          <Icon name="bell" size={20} color={semantics.text.primary} />
        </Pressable>
      </View>

      {isProfileError && !isProfileLoading ? (
        <AppErrorState onRetry={refetchProfile}>
          Không thể tải thông tin hồ sơ
        </AppErrorState>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetchProfile}
              tintColor={semantics.text.brand}
            />
          }
        >
          {isProfileLoading ? (
            <View style={{ padding: 20 }}>
              <SkeletonCard />
            </View>
          ) : (
            <>
              <View style={styles.profileHero}>
                <View style={styles.avatarWrap}>
                  <Text style={styles.avatarInitials}>{initials}</Text>
                  <Pressable onPress={handleOpenEdit} style={styles.avatarEditBtn} hitSlop={6}>
                    <Icon name="edit-2" size={12} color="#FFFFFF" />
                  </Pressable>
                </View>

                <View style={styles.heroContent}>
                  <Text style={styles.nameText}>{fullName}</Text>
                  <View style={styles.roleChip}>
                    <Icon name="award" size={12} color="#2563EB" />
                    <Text style={styles.roleChipText}>{roleLabel}</Text>
                  </View>
                  <View style={styles.contactStack}>
                    {phone ? (
                      <View style={styles.infoRow}>
                        <Icon name="phone" size={13} color="#64748B" />
                        <Text style={styles.infoText}>{phone}</Text>
                      </View>
                    ) : null}
                    {email ? (
                      <View style={styles.infoRow}>
                        <Icon name="mail" size={13} color="#64748B" />
                        <Text style={styles.infoText}>{email}</Text>
                      </View>
                    ) : null}
                    {address ? (
                      <View style={styles.infoRow}>
                        <Icon name="map-pin" size={13} color="#64748B" />
                        <Text style={styles.infoText} numberOfLines={2}>{address}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>

              <View style={styles.statsRow}>
                {[
                  { label: 'Đã gửi', value: String(submittedCount), accent: '#2563EB' },
                  { label: 'Đang xử lý', value: String(processingCount), accent: '#F59E0B' },
                  { label: 'Hoàn thành', value: String(resolvedCount), accent: '#16A34A' },
                ].map((stat) => (
                  <View key={stat.label} style={styles.statCell}>
                    <View style={[styles.statDot, { backgroundColor: stat.accent }]} />
                    <Text style={styles.statValue}>{stat.value}</Text>
                    <Text style={styles.statLabel}>{stat.label}</Text>
                  </View>
                ))}
              </View>

              <Pressable
                onPress={handleOpenMyFeedbacks}
                style={({ pressed }) => [styles.feedbackPanel, pressed && styles.feedbackPanelPressed]}
              >
                <View style={styles.feedbackPanelContent}>
                  <View style={styles.feedbackPanelTitleWrap}>
                    <View style={styles.feedbackPanelIconWrap}>
                      <Icon name="clipboard" size={16} color="#2563EB" />
                    </View>
                    <View style={styles.feedbackPanelTextWrap}>
                      <Text style={styles.feedbackPanelEyebrow}>Phản ánh của tôi</Text>
                      <Text style={styles.feedbackPanelTitle}>Tổng quan hoạt động</Text>
                    </View>
                  </View>
                  <View style={styles.feedbackPanelBadge}>
                    <Text style={styles.feedbackPanelBadgeText}>
                      {isFeedbackLoading ? 'Đang tải...' : `${totalCount} mục`}
                    </Text>
                  </View>
                </View>
              </Pressable>

              <SectionHeader label="CÀI ĐẶT TÀI KHOẢN" />
              <View style={styles.settingsGroup}>
                {ACCOUNT_ROWS.map((row) => (
                  <SettingItem key={row.label} item={row} />
                ))}
              </View>

              <SectionHeader label="HỖ TRỢ & PHÁP LÝ" />
              <View style={styles.settingsGroup}>
                {SUPPORT_ROWS.map((row) => (
                  <SettingItem key={row.label} item={row} />
                ))}
              </View>

              <View style={styles.logoutWrap}>
                <AppButton
                  variant="danger"
                  size="lg"
                  fullWidth
                  leftIcon={<Icon name="log-out" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />}
                  onPress={handleLogout}
                >
                  Đăng xuất
                </AppButton>
              </View>

              <View style={styles.footer}>
                <Text style={styles.footerTitle}>UrbanMind Mobile v1.0.0</Text>
                <Text style={styles.footerSub}>Cổng Dịch vụ Công Đô thị Thông minh</Text>
              </View>
            </>
          )}
        </ScrollView>
      )}

      {/* Edit Profile Modal */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chỉnh sửa thông tin</Text>
              <Pressable onPress={() => setEditModalVisible(false)} hitSlop={10}>
                <Icon name="x" size={20} color={semantics.text.primary} />
              </Pressable>
            </View>

            <AppInput
              label="Họ và tên"
              value={editName}
              onChangeText={setEditName}
              leftIcon="user"
            />

            <AppInput
              label="Số điện thoại"
              value={editPhone}
              onChangeText={setEditPhone}
              leftIcon="phone"
              keyboardType="phone-pad"
            />

            <AppInput
              label="Địa chỉ"
              value={editAddress}
              onChangeText={setEditAddress}
              leftIcon="map-pin"
              placeholder="Nhập địa chỉ liên hệ"
            />

            <View style={styles.modalActions}>
              <View style={{ flex: 1 }}>
                <AppButton
                  variant="outline"
                  size="md"
                  fullWidth
                  onPress={() => setEditModalVisible(false)}
                >
                  Hủy
                </AppButton>
              </View>
              <View style={{ flex: 1 }}>
                <AppButton
                  variant="primary"
                  size="md"
                  fullWidth
                  onPress={handleSaveEdit}
                  loading={updateProfileMutation.isPending}
                >
                  Lưu thay đổi
                </AppButton>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: semantics.bg.app,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: semantics.bg.surface,
    borderBottomWidth: 1,
    borderBottomColor: semantics.border.default,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Geist-Bold',
    color: semantics.text.primary,
  },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: semantics.bg.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 22,
    paddingHorizontal: 20,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 12,
    backgroundColor: semantics.bg.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  avatarWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#DBEAFE',
    borderWidth: 3,
    borderColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarInitials: {
    fontFamily: 'Geist-Bold',
    fontSize: 26,
    color: '#1D4ED8',
  },
  avatarEditBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: semantics.bg.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: semantics.bg.surface,
  },
  heroContent: {
    flex: 1,
  },
  nameText: {
    fontSize: 18,
    fontFamily: 'Geist-Bold',
    color: '#0F172A',
  },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  roleChipText: {
    fontSize: 12,
    fontFamily: 'Geist-SemiBold',
    color: '#1D4ED8',
  },
  contactStack: {
    marginTop: 8,
    gap: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    fontSize: 13,
    fontFamily: 'Geist-Regular',
    color: '#475569',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: semantics.bg.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 6,
  },
  statValue: {
    fontSize: 18,
    fontFamily: 'Geist-Bold',
    color: '#0F172A',
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Geist-Medium',
    color: '#64748B',
    marginTop: 2,
  },
  feedbackPanel: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    backgroundColor: semantics.bg.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  feedbackPanelPressed: {
    opacity: 0.96,
    transform: [{ scale: 0.995 }],
  },
  feedbackPanelContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    margin: 2,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    backgroundColor: semantics.bg.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  feedbackPanelTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  feedbackPanelTextWrap: {
    flex: 1,
  },
  feedbackPanelIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackPanelEyebrow: {
    fontFamily: 'Geist-Medium',
    fontSize: 11,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  feedbackPanelTitle: {
    fontFamily: 'Geist-SemiBold',
    fontSize: 15,
    color: '#0F172A',
    marginTop: 2,
  },
  feedbackPanelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#DBEAFE',
    alignSelf: 'center',
  },
  feedbackPanelBadgeText: {
    fontFamily: 'Geist-SemiBold',
    fontSize: 11,
    color: '#1D4ED8',
  },
  sectionHeader: {
    fontFamily: 'Geist-SemiBold',
    fontSize: 11,
    color: semantics.text.lightMuted,
    letterSpacing: 0.6,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 6,
  },
  settingsGroup: {
    marginHorizontal: 16,
    backgroundColor: semantics.bg.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    paddingVertical: 4,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
    minHeight: 76,
    marginHorizontal: 8,
    marginTop: 10,
    marginBottom: 4,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  settingItemPressed: {
    backgroundColor: semantics.bg.surfaceSubtle,
  },
  settingMainContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minWidth: 0,
    marginRight: 12,
    paddingLeft: 6,
    paddingVertical: 2,
  },
  settingIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: semantics.bg.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingIconDestructive: {
    backgroundColor: semantics.feedback.error.bg,
  },
  settingLabel: {
    flex: 1,
    fontFamily: 'Geist-Medium',
    fontSize: 14.5,
    color: semantics.text.primary,
    lineHeight: 17,
    includeFontPadding: false,
    paddingTop: 0,
    paddingBottom: 0,
  },
  settingLabelDestructive: {
    color: semantics.text.danger,
  },

  logoutWrap: {
    paddingHorizontal: 16,
    marginTop: 20,
  },
  footer: {
    alignItems: 'center',
    marginTop: 28,
  },
  footerTitle: {
    fontSize: 12,
    fontFamily: 'Geist-SemiBold',
    color: semantics.text.lightMuted,
  },
  footerSub: {
    fontSize: 11,
    fontFamily: 'Geist-Regular',
    color: semantics.text.lightMuted,
    marginTop: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: semantics.bg.surface,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Geist-Bold',
    color: semantics.text.primary,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
});
