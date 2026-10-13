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
import { AppButton, Text } from '@/components/ui';
import { OTPInput, useToast } from '@/components/shared';
import { getMobileEntry } from '@/features/auth/mobile-access';
import { useAuthStore } from '@/features/auth';
import { semantics } from '@/theme/semantics';

const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyEmailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ autoSend?: string }>();
  const toast = useToast();
  const user = useAuthStore((state) => state.user);
  const requestEmailVerificationOtp = useAuthStore((state) => state.requestEmailVerificationOtp);
  const verifyEmailOtp = useAuthStore((state) => state.verifyEmailOtp);
  const logout = useAuthStore((state) => state.logout);
  const [otp, setOtp] = useState('');
  const [hasOtpError, setHasOtpError] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [otpSent, setOtpSent] = useState(false);
  const [action, setAction] = useState<'send' | 'verify' | null>(null);
  const autoSendStarted = useRef(false);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const sendOtp = async () => {
    setAction('send');
    try {
      await requestEmailVerificationOtp();
      setOtp('');
      setHasOtpError(false);
      setOtpSent(true);
      setCountdown(RESEND_COOLDOWN_SECONDS);
      toast.success('Đã gửi mã OTP tới ' + (user?.email || 'email của bạn') + '.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể gửi mã OTP qua email.');
    } finally {
      setAction(null);
    }
  };

  useEffect(() => {
    if (params.autoSend !== '1' || autoSendStarted.current || !user?.email) return;
    autoSendStarted.current = true;
    void sendOtp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.autoSend, user?.email]);

  const handleVerify = async () => {
    if (!/^\d{6}$/.test(otp)) {
      setHasOtpError(true);
      toast.error('Vui lòng nhập đủ 6 chữ số mã OTP.');
      return;
    }

    setAction('verify');
    setHasOtpError(false);
    try {
      const verifiedUser = await verifyEmailOtp(otp);
      toast.success('Xác thực email thành công.');
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
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}>
            <Pressable onPress={handleSwitchAccount} style={styles.backButton} hitSlop={10}>
              <Icon name="arrow-left" size={20} color={semantics.text.brand} />
            </Pressable>
            <Text style={styles.headerTitle}>Xác thực tài khoản</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Icon name="mail" size={30} color="#FFFFFF" />
            </View>
            <Text style={styles.title}>Xác thực email</Text>
            <Text style={styles.subtitle}>Mã OTP gồm 6 chữ số sẽ được gửi tới {user?.email || 'email của bạn'}.</Text>
          </View>

          <View style={styles.card}>
            {otpSent ? (
              <>
                <View style={styles.emailPill}>
                  <Icon name="mail" size={15} color={semantics.text.brand} />
                  <Text style={styles.emailPillText}>{user?.email}</Text>
                </View>
                <View style={styles.otpWrap}>
                  <OTPInput length={6} value={otp} onChange={setOtp} error={hasOtpError} />
                </View>
                <Pressable disabled={countdown > 0 || action !== null} onPress={() => void sendOtp()} hitSlop={8}>
                  <Text style={[styles.link, (countdown > 0 || action !== null) && styles.linkDisabled]}>
                    {action === 'send' ? 'Đang gửi mã...' : countdown > 0 ? 'Gửi lại sau ' + countdown + 's' : 'Gửi lại mã'}
                  </Text>
                </Pressable>
                <AppButton onPress={handleVerify} loading={action === 'verify'} disabled={action !== null || otp.length !== 6} fullWidth size="lg" className="mt-5">
                  Xác thực email
                </AppButton>
              </>
            ) : (
              <AppButton onPress={() => void sendOtp()} loading={action === 'send'} disabled={action !== null} fullWidth size="lg" rightIcon={<Icon name="send" size={17} color="#FFFFFF" />}>
                Gửi mã xác thực
              </AppButton>
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
  emailPill: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: semantics.bg.primarySoft, marginBottom: 22 },
  emailPillText: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: semantics.text.brand },
  otpWrap: { marginBottom: 18 },
  link: { textAlign: 'center', fontSize: 13, fontFamily: 'Geist-SemiBold', color: semantics.text.brand },
  linkDisabled: { color: semantics.text.lightMuted },
  switchButton: { alignSelf: 'center', paddingVertical: 14, paddingHorizontal: 8 },
  switchText: { fontSize: 13, fontFamily: 'Geist-Medium', color: semantics.text.muted },
});
