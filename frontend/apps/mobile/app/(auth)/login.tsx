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
import { getMobileEntry } from '@/features/auth/mobile-access';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import Constants from 'expo-constants';
import Icon from '@expo/vector-icons/Feather';
import { Text } from '@/components/ui';
import { AppButton } from '@/components/ui';
import { AppInput } from '@/components/ui';
import { PasswordInput } from '@/components/shared';
import { useAuthStore } from '@/features/auth';
import { useToast } from '@/components/shared';
import { semantics } from '@/theme/semantics';
import UrbanHeroBackground from '@/components/auth/UrbanHeroBackground';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const toast = useToast();
  const login = useAuthStore((s) => s.login);
  const googleLogin = useAuthStore((s) => s.googleLogin);
  const isLoading = useAuthStore((s) => s.isLoading);
  const authError = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const submitLockRef = useRef(false);

  const expoConfig = Constants.expoConfig as {
    scheme?: string;
    extra?: Record<string, string | undefined>;
    android?: { package?: string };
  } | undefined;
  const manifest = Constants.manifest as {
    scheme?: string;
    android?: { package?: string };
  } | undefined;

  const googleIosClientId =
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
    expoConfig?.extra?.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
    '';
  const googleAndroidClientId =
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ||
    expoConfig?.extra?.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ||
    '';
  const googleWebClientId =
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
    expoConfig?.extra?.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
    '';

  const redirectUri = makeRedirectUri({
    scheme: expoConfig?.scheme || manifest?.scheme || 'urbanmind',
  });

  console.log('[GoogleOAuth] debug', {
    packageName: expoConfig?.android?.package || manifest?.android?.package || 'unknown',
    hasIosClientId: Boolean(googleIosClientId),
    hasAndroidClientId: Boolean(googleAndroidClientId),
    hasWebClientId: Boolean(googleWebClientId),
    iosClientIdPresent: !!googleIosClientId,
    androidClientIdPresent: !!googleAndroidClientId,
    webClientIdPresent: !!googleWebClientId,
    redirectUri,
  });

  const [request, , promptAsync] = Google.useAuthRequest({
    iosClientId: googleIosClientId,
    androidClientId: googleAndroidClientId,
    webClientId: googleWebClientId,
    redirectUri,
    scopes: ['profile', 'email'],
  });

  const validate = () => {
    const e: typeof errors = {};
    if (!email.trim()) {
      e.email = 'Vui lòng nhập email';
    }
    if (!password) {
      e.password = 'Vui lòng nhập mật khẩu';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLogin = async () => {
    if (submitLockRef.current || isLoading) return;
    if (!validate()) return;

    submitLockRef.current = true;
    try {
      const user = await login(email.trim(), password);
      router.replace(getMobileEntry(user));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Email hoặc mật khẩu không chính xác';
      toast.error(message || 'Email hoặc mật khẩu không chính xác');
    } finally {
      submitLockRef.current = false;
    }
  };

  const handleGoogleSignIn = async () => {
    if (submitLockRef.current || isLoading) return;
    if (!request) {
      toast.error('Google login chưa sẵn sàng. Vui lòng thử lại.');
      return;
    }

    submitLockRef.current = true;
    clearError();
    setErrors({});

    try {
      const result = await promptAsync();
      if (result.type === 'success') {
        console.log('[GoogleOAuth] result', {
          type: result.type,
          hasAuthentication: Boolean(result.authentication),
          hasIdToken: Boolean(result.authentication?.idToken),
        });
      } else {
        console.log('[GoogleOAuth] result', {
          type: result.type,
          error: 'error' in result ? result.error : undefined,
          errorCode: 'errorCode' in result ? result.errorCode : undefined,
          errorDescription: 'errorDescription' in result ? result.errorDescription : undefined,
          params: 'params' in result ? Object.keys(result.params || {}) : [],
        });
      }

      if (result.type !== 'success' || !result.authentication?.idToken) {
        const errorMessage = result.type === 'dismiss'
          ? 'Google login đã bị hủy'
          : 'Google login không thành công';
        toast.error(errorMessage);
        return;
      }

      const user = await googleLogin(result.authentication.idToken);
      router.replace(getMobileEntry(user));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Google đăng nhập thất bại';
      toast.error(message || 'Google đăng nhập thất bại');
    } finally {
      submitLockRef.current = false;
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={styles.container}>
            <View style={styles.backgroundLayer}>
              <UrbanHeroBackground />
            </View>

          <View style={styles.contentWrap}>
            <View style={styles.brandHeaderRow}>
              <View style={styles.brandIconSquare}>
                <Icon name="map-pin" size={20} color="#FFFFFF" />
              </View>
              <View style={styles.brandTextWrap}>
                <Text style={styles.brandTitle}>UrbanMind</Text>
                <Text style={styles.brandTagline}>Cổng phản ánh đô thị thông minh</Text>
              </View>
            </View>

            <Text style={styles.heroMessage}>
              Theo dõi phản ánh, nhận thông báo tiến độ và tương tác với chính quyền dễ dàng.
            </Text>

            <View style={styles.benefitsRow}>
              <View style={styles.benefitInlineItem}>
                <View style={styles.benefitIconWrap}>
                  <Icon name="message-square" size={16} color={semantics.text.brand} />
                </View>
                <Text style={styles.benefitTitle}>Ghi nhận</Text>
              </View>
              <View style={styles.benefitSeparator} />
              <View style={styles.benefitInlineItem}>
                <View style={styles.benefitIconWrap}>
                  <Icon name="bell" size={16} color={semantics.text.brand} />
                </View>
                <Text style={styles.benefitTitle}>Theo dõi</Text>
              </View>
              <View style={styles.benefitSeparator} />
              <View style={styles.benefitInlineItem}>
                <View style={styles.benefitIconWrap}>
                  <Icon name="check-circle" size={16} color={semantics.text.brand} />
                </View>
                <Text style={styles.benefitTitle}>Hoàn tất</Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Đăng nhập</Text>
            <Text style={styles.cardSub}>
              Tiếp tục theo dõi phản ánh của bạn
            </Text>

            <AppInput
              label="Email"
              leftIcon="mail"
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                if (authError) clearError();
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              error={errors.email}
            />

            <PasswordInput
              label="Mật khẩu"
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                if (authError) clearError();
              }}
              error={errors.password}
            />

            <Pressable
              onPress={() => router.push('/(auth)/forgot-password')}
              style={styles.forgotPasswordContainer}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.forgotPasswordText}>Quên mật khẩu?</Text>
            </Pressable>

            {authError ? (
              <View style={styles.errorBox}>
                <Icon name="alert-circle" size={16} color={semantics.feedback.error.icon} />
                <Text style={styles.errorText}>{authError}</Text>
              </View>
            ) : null}

            <AppButton
              onPress={handleLogin}
              accessibilityRole="button"
              accessibilityLabel="Đăng nhập"
              loading={isLoading}
              fullWidth
              size="lg"
              rightIcon={<Icon name="arrow-right" size={18} color="#FFFFFF" style={{ marginLeft: 4 }} />}
              style={styles.primaryButtonStyle}
            >
              Đăng nhập
            </AppButton>

            <View style={styles.dividerWrap}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>hoặc</Text>
              <View style={styles.dividerLine} />
            </View>

            <AppButton
              variant="secondary"
              fullWidth
              size="lg"
              leftIcon={
                <View style={styles.googleBadge}>
                  <Text style={styles.googleBadgeText}>G</Text>
                </View>
              }
              onPress={handleGoogleSignIn}
              style={styles.secondaryButtonStyle}
            >
              Đăng nhập với Google
            </AppButton>

            <View style={styles.registerRow}>
              <Text style={styles.registerPrompt}>Chưa có tài khoản?</Text>
              <Text style={styles.registerLink} onPress={() => router.push('/(auth)/register')}>
                Tạo tài khoản
              </Text>
            </View>
          </View>

          <View style={styles.footerWrap}>
            <Text style={styles.footerText}>
              <Text style={styles.footerLink}>Điều khoản</Text>
              {' '}•{' '}
              <Text style={styles.footerLink}>Chính sách</Text>
            </Text>
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
    backgroundColor: '#EAF3FF',
  },
  flex1: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
    backgroundColor: '#EAF3FF',
  },
  backgroundLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 300,
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
    zIndex: 0,
  },
  contentWrap: {
    position: 'relative',
    zIndex: 1,
    paddingHorizontal: 18,
    paddingTop: 28,
    paddingBottom: 8,
  },
  brandHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 1,
  },
  brandIconSquare: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 6,
  },
  brandTextWrap: {
    flex: 1,
  },
  brandTitle: {
    fontSize: 24,
    fontFamily: 'Geist-Bold',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  brandTagline: {
    fontSize: 12,
    fontFamily: 'Geist-Medium',
    color: '#475569',
    marginTop: 2,
  },
  heroMessage: {
    marginTop: 14,
    fontSize: 13,
    fontFamily: 'Geist-Regular',
    color: '#0F172A',
    lineHeight: 19,
    width: '78%',
    zIndex: 1,
  },
  benefitsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    marginTop: 18,
    paddingHorizontal: 0,
    zIndex: 1,
    
  },
  benefitTitle: {
    fontSize: 11,
    fontFamily: 'Geist-Bold',
    color: '#0F172A',
    textAlign: 'center',
  },
  benefitInlineItem: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    marginHorizontal: 18,
  },
  benefitIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#EAF3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitSeparator: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(148,163,184,0.22)',
  },
  card: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 58,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.14)',
    zIndex: 2,
  },
  cardTitle: {
    alignSelf: 'center',
    fontSize: 28,
    fontFamily: 'Geist-Bold',
    color: semantics.text.primary,
    marginBottom: 4,
    letterSpacing: -0.4,
  },
  cardSub: {
        alignSelf: 'center',

    fontSize: 13,
    fontFamily: 'Geist-Regular',
    color: '#64748B',
    marginBottom: 14,
    lineHeight: 18,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: semantics.feedback.error.bg,
    borderWidth: 1,
    borderColor: semantics.feedback.error.border,
    marginBottom: 10,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Geist-Medium',
    color: semantics.feedback.error.text,
    lineHeight: 16,
  },
  primaryButtonStyle: {
    marginTop: 4,
  },
  dividerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(148,163,184,0.24)',
  },
  dividerText: {
    fontSize: 11,
    fontFamily: 'Geist-Medium',
    color: '#64748B',
    paddingHorizontal: 10,
    textTransform: 'lowercase',
  },
  googleBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DDE7F5',
    marginRight: 6,
  },
  googleBadgeText: {
    fontSize: 12,
    fontFamily: 'Geist-Bold',
    color: '#4285F4',
  },
  secondaryButtonStyle: {
    marginTop: 0,
    backgroundColor: '#EFF6FF',
  },
  registerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 6,
  },
  registerPrompt: {
    fontSize: 12.5,
    fontFamily: 'Geist-Regular',
    color: '#64748B',
  },
  registerLink: {
    fontSize: 12.5,
    fontFamily: 'Geist-SemiBold',
    color: semantics.text.brand,
  },
  footerWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 10,
    zIndex: 3,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 11,
    fontFamily: 'Geist-Regular',
    color: '#475569',
    textAlign: 'center',
    lineHeight: 15,
  },
  footerLink: {
    fontFamily: 'Geist-SemiBold',
    color: semantics.text.brand,
  },
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginBottom: 16,
    paddingVertical: 8,
    paddingLeft: 12,
  },
  forgotPasswordText: {
    fontSize: 13,
    fontFamily: 'Geist-SemiBold',
    color: semantics.text.brand,
  },
});
