import React, { useState } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '@expo/vector-icons/Feather';
import { Text } from '@/components/ui';
import { AppButton } from '@/components/ui';
import { AppInput } from '@/components/ui';
import { PasswordInput } from '@/components/shared';
import { useAuthStore } from '@/features/auth';
import { useToast } from '@/components/shared';
import { semantics } from '@/theme/semantics';

interface Errors {
  fullName?: string;
  phone?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

export default function RegisterScreen() {
  const router = useRouter();
  const toast = useToast();
  const register = useAuthStore((s) => s.register);
  const isLoading = useAuthStore((s) => s.isLoading);

  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  const setField = (field: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const validate = (): boolean => {
    const e: Errors = {};
    const name = form.fullName.trim();
    const phone = form.phone.trim();
    const email = form.email.trim();

    if (!name) {
      e.fullName = 'Vui lòng nhập họ và tên';
    } else if (name.length < 2) {
      e.fullName = 'Họ và tên phải có ít nhất 2 ký tự';
    }

    if (!phone) {
      e.phone = 'Vui lòng nhập số điện thoại';
    } else if (!/^0\d{9}$/.test(phone)) {
      e.phone = 'Số điện thoại phải có 10 chữ số (bắt đầu bằng số 0)';
    }

    if (!email) {
      e.email = 'Vui lòng nhập email';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      e.email = 'Địa chỉ email không hợp lệ';
    }

    if (!form.password) {
      e.password = 'Vui lòng nhập mật khẩu';
    } else if (form.password.length < 8) {
      e.password = 'Mật khẩu phải có ít nhất 8 ký tự';
    }

    if (!form.confirmPassword) {
      e.confirmPassword = 'Vui lòng nhập lại mật khẩu';
    } else if (form.password !== form.confirmPassword) {
      e.confirmPassword = 'Mật khẩu xác nhận không khớp';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;

    if (!agreed) {
      toast.error('Vui lòng đồng ý với điều khoản sử dụng');
      return;
    }

    try {
      await register({
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        password: form.password,
      });

      router.replace({ pathname: '/(auth)/verify-phone', params: { autoSend: '1' } });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Đăng ký thất bại. Vui lòng thử lại.');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
      >
        <View style={styles.flex1}>
          <ScrollView
            style={styles.flex1}
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
            contentInsetAdjustmentBehavior="never"
          >
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
              <Icon name="arrow-left" size={20} color={semantics.text.primary} />
            </Pressable>
            <Text style={styles.headerTitle}>Tạo tài khoản mới</Text>
            <View style={{ width: 38 }} />
          </View>

          {/* Hero Panel — Deep Navy Theme */}
          <View style={styles.heroCard}>
            <View style={styles.heroIconWrap}>
              <Icon name="user-plus" size={20} color="#FFFFFF" />
            </View>
            <View style={styles.heroTextWrap}>
              <Text style={styles.heroTitle}>Đăng ký Cư dân UrbanMind</Text>
              <Text style={styles.heroSub}>Tạo tài khoản để gửi phản ánh đô thị, nhận thông báo tiến độ và kết nối nhanh với chính quyền.</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardSub}>
              Nhập đầy đủ thông tin bên dưới để khởi tạo hồ sơ cư dân
            </Text>

            <AppInput
              label="Họ và tên"
              leftIcon="user"
              value={form.fullName}
              onChangeText={setField('fullName')}
              autoCapitalize="words"
              error={errors.fullName}
            />

            <AppInput
              label="Số điện thoại"
              leftIcon="phone"
              value={form.phone}
              onChangeText={setField('phone')}
              keyboardType="phone-pad"
              maxLength={10}
              error={errors.phone}
            />

            <AppInput
              label="Email"
              leftIcon="mail"
              value={form.email}
              onChangeText={setField('email')}
              keyboardType="email-address"
              autoCapitalize="none"
              error={errors.email}
            />

            <PasswordInput
              label="Mật khẩu (Tối thiểu 8 ký tự)"
              value={form.password}
              onChangeText={setField('password')}
              error={errors.password}
            />

            <PasswordInput
              label="Nhập lại mật khẩu"
              value={form.confirmPassword}
              onChangeText={setField('confirmPassword')}
              error={errors.confirmPassword}
            />

            <Pressable
              onPress={() => setAgreed((v) => !v)}
              style={styles.termsRow}
            >
              <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
                {agreed && <Icon name="check" size={12} color="#FFFFFF" />}
              </View>
              <Text style={styles.termsText}>
                Tôi đồng ý với{' '}
                <Text style={styles.termsLink}>Điều khoản sử dụng</Text>
                {' '}và{' '}
                <Text style={styles.termsLink}>Chính sách bảo mật</Text>
                {' '}của UrbanMind
              </Text>
            </Pressable>

            <AppButton
              onPress={handleRegister}
              loading={isLoading}
              fullWidth
              size="lg"
              className="mt-4"
              rightIcon={<Icon name="arrow-right" size={18} color="#FFFFFF" style={{ marginLeft: 4 }} />}
            >
              Tiếp tục xác thực số điện thoại
            </AppButton>

            <Pressable onPress={() => router.replace('/(auth)/login')} className="mt-5 self-center">
              <Text style={styles.loginLink}>
                Đã có tài khoản?{' '}
                <Text style={styles.loginLinkBold}>Đăng nhập ngay</Text>
              </Text>
            </Pressable>
          </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: semantics.bg.app,
  },
  flex1: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: semantics.bg.surfaceSubtle,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Geist-Bold',
    color: semantics.text.primary,
    letterSpacing: -0.3,
  },
  heroCard: {
    backgroundColor: '#071024',
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.18)',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 5,
  },
  heroIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: semantics.bg.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextWrap: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 16,
    fontFamily: 'Geist-Bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  heroSub: {
    fontSize: 12,
    fontFamily: 'Geist-Regular',
    color: 'rgba(255, 255, 255, 0.78)',
    lineHeight: 18,
  },
  card: {
    backgroundColor: semantics.bg.surface,
    borderRadius: 26,
    padding: 24,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 4,
    borderWidth: 1,
    borderColor: semantics.border.default,
  },
  cardSub: {
    fontSize: 13,
    fontFamily: 'Geist-Regular',
    color: semantics.text.muted,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 6,
    marginBottom: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: semantics.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: semantics.bg.primary,
    borderColor: semantics.bg.primary,
  },
  termsText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Geist-Regular',
    color: semantics.text.secondary,
    lineHeight: 18,
  },
  termsLink: {
    fontFamily: 'Geist-SemiBold',
    color: semantics.text.brand,
  },
  loginLink: {
    fontSize: 14,
    fontFamily: 'Geist-Regular',
    color: semantics.text.muted,
  },
  loginLinkBold: {
    fontFamily: 'Geist-SemiBold',
    color: semantics.text.brand,
  },
});
