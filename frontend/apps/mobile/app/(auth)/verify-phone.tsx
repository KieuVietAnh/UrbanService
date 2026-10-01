import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Icon from '@expo/vector-icons/Feather';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatPhone, normalizePhone } from '@urbanmind/shared-api';
import { AppButton, AppInput, Text } from '@/components/ui';
import { OTPInput, useToast } from '@/components/shared';
import { getMobileEntry } from '@/features/auth/mobile-access';
import { useAuthStore } from '@/features/auth';
import { semantics } from '@/theme/semantics';

const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyPhoneScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ autoSend?: string }>();
  const toast = useToast();
  const user = useAuthStore((state) => state.user);
  const requestPhoneOtp = useAuthStore((state) => state.requestPhoneOtp);
  const verifyPhoneOtp = useAuthStore((state) => state.verifyPhoneOtp);
  const logout = useAuthStore((state) => state.logout);

  const knownPhone = normalizePhone(user?.phone || '') || user?.phone || '';
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phoneInput, setPhoneInput] = useState(() => formatPhone(knownPhone));
  const [confirmedPhone, setConfirmedPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [hasOtpError, setHasOtpError] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [remainingToday, setRemainingToday] = useState<number | null>(null);
  const [isTestNumber, setIsTestNumber] = useState(false);
  const [action, setAction] = useState<'send' | 'verify' | null>(null);
  const autoSendStarted = useRef(false);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const sendOtpTo = async (rawPhone: string) => {
    const normalized = normalizePhone(rawPhone);
    if (!normalized) {
      toast.error('Nhập số điện thoại Việt Nam gồm 10 chữ số, ví dụ 0901 234 567.');
      return;
    }

    setAction('send');
    try {
      const permission = await requestPhoneOtp(normalized);
      setConfirmedPhone(permission.phoneNumber);
      setPhoneInput(formatPhone(permission.phoneNumber));
      setRemainingToday(permission.remainingToday);
      setIsTestNumber(permission.isTestNumber);
      setOtp('');
      setHasOtpError(false);
      setCountdown(RESEND_COOLDOWN_SECONDS);
      setStep('otp');
      toast.success(`Đã gửi mã OTP tới ${formatPhone(permission.phoneNumber)}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể gửi mã OTP qua SMS.');
    } finally {
      setAction(null);
    }
  };

  // Chỉ tự gửi đúng một lần khi vừa đăng ký. Mở trực tiếp màn này hoặc đăng nhập
  // lại sẽ không tự tiêu thụ thêm một lượt SMS.
  useEffect(() => {
    if (params.autoSend !== '1' || autoSendStarted.current || !knownPhone) return;
    autoSendStarted.current = true;
    void sendOtpTo(knownPhone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.autoSend, knownPhone]);

  const handleVerify = async () => {
    if (!/^\d{6}$/.test(otp)) {
      setHasOtpError(true);
      toast.error('Vui lòng nhập đủ 6 chữ số mã OTP.');
      return;
    }

    setAction('verify');
    setHasOtpError(false);
    try {
      const verifiedUser = await verifyPhoneOtp(otp);
      toast.success('Xác thực số điện thoại thành công.');
      router.replace(getMobileEntry(verifiedUser));
    } catch (error) {
      setHasOtpError(true);
      toast.error(error instanceof Error ? error.message : 'Mã OTP không chính xác hoặc đã hết hạn.');
    } finally {
      setAction(null);
    }
  };

  const handleSwitchAccount = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <Pressable onPress={handleSwitchAccount} style={styles.backButton} hitSlop={10}>
              <Icon name="arrow-left" size={20} color={semantics.text.brand} />
            </Pressable>
            <Text style={styles.headerTitle}>Xác thực tài khoản</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Icon name="smartphone" size={30} color="#FFFFFF" />
            </View>
            <Text style={styles.title}>Xác thực số điện thoại</Text>
            <Text style={styles.subtitle}>
              {step === 'phone'
                ? 'Chúng tôi sẽ gửi mã OTP qua tin nhắn SMS để bảo vệ tài khoản của bạn.'
                : `Nhập mã gồm 6 chữ số vừa gửi tới ${formatPhone(confirmedPhone)}.`}
            </Text>
          </View>

          <View style={styles.card}>
            {step === 'phone' ? (
              <>
                <AppInput
                  label="Số điện thoại nhận mã"
                  leftIcon="phone"
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  value={phoneInput}
                  onChangeText={setPhoneInput}
                  editable={action === null}
                  returnKeyType="send"
                  onSubmitEditing={() => void sendOtpTo(phoneInput)}
                />
                <Text style={styles.hint}>
                  Nếu nhập nhầm lúc đăng ký, bạn có thể sửa số ngay tại đây.
                </Text>
                <AppButton
                  onPress={() => void sendOtpTo(phoneInput)}
                  loading={action === 'send'}
                  disabled={action !== null}
                  fullWidth
                  size="lg"
                  rightIcon={<Icon name="send" size={17} color="#FFFFFF" />}
                >
                  Gửi mã OTP
                </AppButton>
              </>
            ) : (
              <>
                <View style={styles.phonePill}>
                  <Icon name="message-square" size={15} color={semantics.text.brand} />
                  <Text style={styles.phonePillText}>{formatPhone(confirmedPhone)}</Text>
                </View>

                <View style={styles.otpWrap}>
                  <OTPInput length={6} value={otp} onChange={setOtp} error={hasOtpError} />
                </View>

                {isTestNumber ? (
                  <Text style={styles.testNote}>Đây là số thử nghiệm; tin nhắn không tính vào hạn mức.</Text>
                ) : typeof remainingToday === 'number' ? (
                  <Text style={styles.hint}>Hôm nay còn {remainingToday} lượt gửi mã.</Text>
                ) : null}

                <View style={styles.secondaryActions}>
                  <Pressable
                    disabled={countdown > 0 || action !== null}
                    onPress={() => void sendOtpTo(confirmedPhone)}
                    hitSlop={8}
                  >
                    <Text style={[styles.link, (countdown > 0 || action !== null) && styles.linkDisabled]}>
                      {action === 'send'
                        ? 'Đang gửi mã…'
                        : countdown > 0
                          ? `Gửi lại sau ${countdown}s`
                          : 'Gửi lại mã'}
                    </Text>
                  </Pressable>
                  <Pressable
                    disabled={action !== null}
                    onPress={() => {
                      setStep('phone');
                      setOtp('');
                      setHasOtpError(false);
                    }}
                    hitSlop={8}
                  >
                    <Text style={styles.changePhone}>Đổi số điện thoại</Text>
                  </Pressable>
                </View>

                <AppButton
                  onPress={handleVerify}
                  loading={action === 'verify'}
                  disabled={action !== null || otp.length !== 6}
                  fullWidth
                  size="lg"
                >
                  Xác thực
                </AppButton>
              </>
            )}
          </View>

          <Pressable onPress={handleSwitchAccount} style={styles.switchButton} hitSlop={10}>
            <Text style={styles.switchText}>Đăng nhập bằng tài khoản khác</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: semantics.bg.app },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 32 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  backButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: semantics.bg.surface },
  headerTitle: { fontSize: 17, fontFamily: 'Geist-Bold', color: semantics.text.primary },
  headerSpacer: { width: 38 },
  hero: { alignItems: 'center', paddingHorizontal: 12, marginBottom: 20 },
  heroIcon: { width: 64, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: semantics.bg.primary, marginBottom: 16 },
  title: { fontSize: 24, fontFamily: 'Geist-Bold', color: semantics.text.primary, textAlign: 'center', letterSpacing: -0.5 },
  subtitle: { marginTop: 8, maxWidth: 340, fontSize: 14, lineHeight: 21, fontFamily: 'Geist-Regular', color: semantics.text.muted, textAlign: 'center' },
  card: { width: '100%', backgroundColor: semantics.bg.surface, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: semantics.border.default, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 18, elevation: 3 },
  hint: { marginTop: -4, marginBottom: 18, fontSize: 12, lineHeight: 18, fontFamily: 'Geist-Regular', color: semantics.text.muted },
  phonePill: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: semantics.bg.primarySoft, marginBottom: 22 },
  phonePillText: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: semantics.text.brand },
  otpWrap: { marginBottom: 18 },
  testNote: { marginTop: -4, marginBottom: 16, fontSize: 12, lineHeight: 18, fontFamily: 'Geist-Medium', color: semantics.intent.success.text },
  secondaryActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20 },
  link: { fontSize: 13, fontFamily: 'Geist-SemiBold', color: semantics.text.brand },
  linkDisabled: { color: semantics.text.lightMuted },
  changePhone: { fontSize: 13, fontFamily: 'Geist-SemiBold', color: semantics.text.secondary },
  switchButton: { alignSelf: 'center', paddingVertical: 14, paddingHorizontal: 8 },
  switchText: { fontSize: 13, fontFamily: 'Geist-Medium', color: semantics.text.muted },
});
