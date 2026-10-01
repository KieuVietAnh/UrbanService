import React, { useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  Pressable,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '@expo/vector-icons/Feather';
import { Text } from '@/components/ui';
import { AppButton } from '@/components/ui';
import { PasswordInput, OTPInput } from '@/components/shared';
import { useForgotPassword } from '@/features/auth';
import { semantics } from '@/theme/semantics';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const email = (params.email as string) || '';

  const { isLoading, reset, resendOtp } = useForgotPassword();
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [errors, setErrors] = useState<{
    otp?: boolean;
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  const submitLockRef = useRef(false);

  const validate = () => {
    const e: typeof errors = {};
    if (otp.length < 6) {
      e.otp = true;
    }
    if (!newPassword) {
      e.newPassword = 'Vui lòng nhập mật khẩu mới';
    } else if (newPassword.length < 6) {
      e.newPassword = 'Mật khẩu mới phải có ít nhất 6 ký tự';
    }
    if (!confirmPassword) {
      e.confirmPassword = 'Vui lòng xác nhận mật khẩu mới';
    } else if (newPassword !== confirmPassword) {
      e.confirmPassword = 'Mật khẩu xác nhận không khớp';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleReset = async () => {
    if (submitLockRef.current || isLoading) return;
    if (!validate()) return;

    submitLockRef.current = true;
    try {
      const success = await reset({
        email,
        otp,
        newPassword,
      });
      if (success) {
        router.replace('/(auth)/login');
      }
    } finally {
      submitLockRef.current = false;
    }
  };

  const handleResend = async () => {
    if (submitLockRef.current || isLoading) return;
    submitLockRef.current = true;
    try {
      await resendOtp(email);
      setOtp('');
      setErrors((prev) => ({ ...prev, otp: undefined }));
    } finally {
      submitLockRef.current = false;
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.headerRow}>
              <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
                <Icon name="arrow-left" size={20} color={semantics.text.primary} />
              </Pressable>
              <Text style={styles.headerTitle}>Đặt lại mật khẩu</Text>
              <View style={{ width: 38 }} />
            </View>

            <View style={styles.card}>
              <Text style={styles.instruction}>
                Mã OTP đã được gửi tới:{'\n'}
                <Text style={styles.emailText}>{email}</Text>
              </Text>

              <Text style={styles.label}>Mã OTP</Text>
              <View style={styles.otpWrap}>
                <OTPInput
                  length={6}
                  value={otp}
                  onChange={(val) => {
                    setOtp(val);
                    if (errors.otp) setErrors((prev) => ({ ...prev, otp: undefined }));
                  }}
                  error={errors.otp}
                />
              </View>

              <PasswordInput
                label="Mật khẩu mới (Tối thiểu 6 ký tự)"
                value={newPassword}
                onChangeText={(val) => {
                  setNewPassword(val);
                  if (errors.newPassword) setErrors((prev) => ({ ...prev, newPassword: undefined }));
                }}
                error={errors.newPassword}
              />

              <PasswordInput
                label="Xác nhận mật khẩu mới"
                value={confirmPassword}
                onChangeText={(val) => {
                  setConfirmPassword(val);
                  if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                }}
                error={errors.confirmPassword}
                onSubmitEditing={handleReset}
                returnKeyType="done"
              />

              <Pressable onPress={handleResend} style={styles.resendBtn} hitSlop={8}>
                <Text style={styles.resendText}>Gửi lại mã</Text>
              </Pressable>

              <AppButton
                onPress={handleReset}
                loading={isLoading}
                fullWidth
                size="lg"
                style={styles.btn}
              >
                Đặt lại mật khẩu
              </AppButton>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
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
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
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
  instruction: {
    fontSize: 14,
    fontFamily: 'Geist-Regular',
    color: semantics.text.secondary,
    lineHeight: 20,
    marginBottom: 20,
  },
  emailText: {
    fontFamily: 'Geist-SemiBold',
    color: semantics.text.primary,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Geist-Medium',
    color: semantics.text.secondary,
    marginBottom: 10,
  },
  otpWrap: {
    width: '100%',
    marginBottom: 20,
  },
  resendBtn: {
    alignSelf: 'flex-start',
    marginBottom: 20,
    paddingVertical: 4,
  },
  resendText: {
    fontFamily: 'Geist-SemiBold',
    fontSize: 14,
    color: semantics.text.brand,
  },
  btn: {
    marginTop: 8,
  },
});
