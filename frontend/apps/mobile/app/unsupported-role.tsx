import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Icon from '@expo/vector-icons/Feather';
import { Text } from '@/components/ui';
import { AppButton } from '@/components/ui';
import { useAuthStore } from '@/features/auth';
import { getRoleLabel } from '@urbanmind/shared-types';
import { semantics } from '@/theme/semantics';

/**
 * Unsupported Role Screen
 * Admin, Manager and Provider workspaces remain web-only.
 */
export default function UnsupportedRoleScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const roleLabel = getRoleLabel(user?.role) || 'Cán bộ / Quản trị';

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <View style={styles.iconWrap}>
          <Icon name="shield-off" size={44} color={semantics.text.danger} />
        </View>

        <Text style={styles.title}>
          Tài khoản không hỗ trợ trên Mobile
        </Text>

        <Text style={styles.description}>
          Tài khoản của bạn có vai trò <Text style={styles.roleHighlight}>{roleLabel}</Text>. 
          Ứng dụng di động UrbanMind hiện hỗ trợ cư dân và nhân viên hệ thống (System Staff).
        </Text>

        <View style={styles.noticeBox}>
          <Icon name="info" size={16} color={semantics.text.brand} style={{ marginTop: 2 }} />
          <Text style={styles.noticeText}>
            Vui lòng đăng nhập trên cổng thông tin Web để sử dụng các tính năng quản lý, phân công và xử lý công việc.
          </Text>
        </View>

        <View style={styles.actionWrap}>
          <AppButton
            variant="primary"
            size="lg"
            fullWidth
            onPress={handleLogout}
            leftIcon={<Icon name="log-out" size={18} color={semantics.text.inverse} style={{ marginRight: 6 }} />}
          >
            Đăng xuất & Đổi tài khoản
          </AppButton>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: semantics.bg.app,
  },
  container: {
    flex: 1,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: semantics.feedback.error.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: semantics.feedback.error.border,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Geist-Bold',
    color: semantics.text.primary,
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.4,
  },
  description: {
    fontSize: 15,
    fontFamily: 'Geist-Regular',
    color: semantics.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  roleHighlight: {
    fontFamily: 'Geist-SemiBold',
    color: semantics.text.primary,
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: semantics.bg.primarySoft,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: semantics.border.primary,
    marginBottom: 32,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Geist-Medium',
    color: semantics.text.primary,
    lineHeight: 19,
  },
  actionWrap: {
    width: '100%',
  },
});
