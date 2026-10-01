import React, { useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '@expo/vector-icons/Feather';
import { Text } from '@/components/ui';
import { AppButton } from '@/components/ui';
import { AppInput } from '@/components/ui';
import { useForgotPassword } from '@/features/auth';
import { semantics } from '@/theme/semantics';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { isLoading, sendOtp } = useForgotPassword();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const submitLockRef = useRef(false);

  const validate = () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Vui lòng nhập email');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Địa chỉ email không hợp lệ');
      return false;
    }
    setError(undefined);
    return true;
  };

  const handleSendOtp = async () => {
    if (submitLockRef.current || isLoading) return;
    if (!validate()) return;

    submitLockRef.current = true;
    try {
      const success = await sendOtp(email.trim());
      if (success) {
        router.push({
          pathname: '/(auth)/forgot-password/reset',
          params: { email: email.trim() },
        });
      }
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
          <View style={styles.container}>
            <View style={styles.headerRow}>
              <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
                <Icon name="arrow-left" size={20} color={semantics.text.primary} />
              </Pressable>
              <Text style={styles.headerTitle}>Quên mật khẩu</Text>
              <View style={{ width: 38 }} />
            </View>

            <View style={styles.card}>
              <Text style={styles.instruction}>
                Nhập email đã đăng ký. Chúng tôi sẽ gửi mã OTP để bạn đặt lại mật khẩu.
              </Text>

              <AppInput
                label="Email"
                leftIcon="mail"
                value={email}
                onChangeText={(val) => {
                  setEmail(val);
                  if (error) setError(undefined);
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                error={error}
                onSubmitEditing={handleSendOtp}
                returnKeyType="done"
              />

              <AppButton
                onPress={handleSendOtp}
                loading={isLoading}
                fullWidth
                size="lg"
                style={styles.btn}
              >
                Gửi mã OTP
              </AppButton>

              <Pressable onPress={() => router.replace('/(auth)/login')} style={styles.backLinkWrap}>
                <Text style={styles.backLinkText}>Quay lại đăng nhập</Text>
              </Pressable>
            </View>
          </View>
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
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
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
    marginBottom: 24,
  },
  btn: {
    marginTop: 8,
  },
  backLinkWrap: {
    alignSelf: 'center',
    marginTop: 20,
    paddingVertical: 8,
  },
  backLinkText: {
    fontSize: 14,
    fontFamily: 'Geist-SemiBold',
    color: semantics.text.brand,
  },
});
