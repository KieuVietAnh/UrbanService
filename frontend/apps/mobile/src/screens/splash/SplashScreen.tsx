import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { rawColors as colors } from '@/theme/colors';

export default function SplashScreen() {
  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <View style={[styles.orbit, styles.orbitTop]} />
      <View style={[styles.orbit, styles.orbitBottom]} />

      <View style={styles.center}>
        <View style={styles.logoFrame}>
          <Image
            source={require('../../../assets/icon.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="Biểu tượng UrbanMind"
          />
        </View>
        <Text style={styles.brand}>UrbanMind</Text>
        <Text style={styles.title}>Kết nối cộng đồng</Text>
        <Text style={styles.desc}>Kiến tạo đô thị thông minh và bền vững.</Text>
      </View>

      <View style={styles.loadingArea}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.loadingText}>ĐANG KHỞI ĐỘNG</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  orbit: {
    position: 'absolute',
    width: 330,
    height: 330,
    borderRadius: 165,
    borderWidth: 30,
    borderColor: 'rgba(37, 99, 235, 0.08)',
  },
  orbitTop: {
    top: -150,
    left: -145,
  },
  orbitBottom: {
    bottom: -155,
    right: -155,
  },
  center: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  logoFrame: {
    width: 150,
    height: 150,
    borderRadius: 42,
    padding: 5,
    backgroundColor: '#FFFFFF',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 8,
  },
  logo: {
    width: '100%',
    height: '100%',
    borderRadius: 37,
  },
  brand: {
    marginTop: 24,
    fontFamily: 'Geist-Bold',
    fontSize: 28,
    letterSpacing: -0.7,
    color: colors.text,
  },
  title: {
    marginTop: 8,
    fontFamily: 'Geist-SemiBold',
    fontSize: 17,
    color: colors.text,
  },
  desc: {
    marginTop: 6,
    fontFamily: 'Geist-Regular',
    fontSize: 13,
    lineHeight: 20,
    color: colors.muted,
    textAlign: 'center',
  },
  loadingArea: {
    position: 'absolute',
    bottom: 64,
    alignItems: 'center',
    gap: 14,
  },
  loadingText: {
    fontFamily: 'Geist-SemiBold',
    fontSize: 11,
    letterSpacing: 2.2,
    color: colors.lightMuted,
  },
});
