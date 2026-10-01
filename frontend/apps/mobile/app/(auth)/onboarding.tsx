import React, { useRef, useState } from 'react';
import {
  View,
  ScrollView,
  Dimensions,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '@expo/vector-icons/Feather';
import { Text } from '@/components/ui';
import { AppButton } from '@/components/ui';
import { colors } from '@/constants/theme';
import { semantics } from '@/theme/semantics';

const { width: W } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    emoji: '📍',
    title: 'Phản ánh đô thị\ndễ dàng hơn',
    subtitle: 'Gửi phản ánh, theo dõi tiến độ và nhận kết quả xử lý ngay trên điện thoại.',
    accent: '#EFF6FF',
    hint: 'Theo dõi tiến độ',
  },
  {
    id: '2',
    emoji: '⚡',
    title: 'Theo dõi tiến độ\ntheo thời gian thực',
    subtitle: 'Biết chính xác phản ánh của bạn đang ở bước nào trong quy trình xử lý.',
    accent: '#F0FDF4',
    hint: 'Nhận thông báo',
  },
  {
    id: '3',
    emoji: '🏙️',
    title: 'Cùng nhau xây dựng\nthành phố tốt hơn',
    subtitle: 'Hơn 5.000 phản ánh đã được xử lý nhờ sự đóng góp của cư dân như bạn.',
    accent: '#FFF7ED',
    hint: 'Cộng đồng kết nối',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const goNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      const nextIndex = currentIndex + 1;
      scrollRef.current?.scrollTo({ x: nextIndex * W, animated: true });
      setCurrentIndex(nextIndex);
    } else {
      router.replace('/(auth)/login');
    }
  };

  const handleScroll = (e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / W);
    setCurrentIndex(idx);
  };

  const isLast = currentIndex === SLIDES.length - 1;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.skipRow}>
        <Pressable onPress={() => router.replace('/(auth)/login')} hitSlop={12}>
          <Text style={styles.skipText}>Bỏ qua</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
      >
        {SLIDES.map((slide) => (
          <View key={slide.id} style={{ width: W }}>
            <View style={styles.slideInner}>
              <View style={[styles.illustrationWrap, { backgroundColor: slide.accent }]}> 
                <View style={styles.illustrationBadge}>
                  <Icon name="sparkles" size={14} color={semantics.text.brand} />
                  <Text style={styles.illustrationBadgeText}>{slide.hint}</Text>
                </View>
                <Text style={styles.emoji}>{slide.emoji}</Text>
                <View style={styles.previewCard}>
                  <View style={styles.previewDot} />
                  <Text style={styles.previewCardText}>Đã xử lý • Chiếu sáng công cộng</Text>
                </View>
              </View>

              <View style={styles.copyWrap}>
                <Text style={styles.title}>{slide.title}</Text>
                <Text style={styles.subtitle}>{slide.subtitle}</Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dotRow}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === currentIndex ? styles.dotActive : styles.dotInactive,
            ]}
          />
        ))}
      </View>

      <View style={styles.actionsRow}>
        <AppButton onPress={goNext} fullWidth size="lg">
          {isLast ? 'Bắt đầu' : 'Tiếp theo'}
        </AppButton>

        {!isLast && (
          <AppButton
            variant="ghost"
            fullWidth
            size="md"
            onPress={() => router.replace('/(auth)/login')}
          >
            Tôi đã có tài khoản
          </AppButton>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  skipRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  skipText: {
    fontSize: 14,
    fontFamily: 'Geist-Medium',
    color: semantics.text.muted,
  },
  slideInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  illustrationWrap: {
    width: '100%',
    maxWidth: 360,
    height: 280,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.06)',
  },
  illustrationBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  illustrationBadgeText: {
    fontSize: 11,
    fontFamily: 'Geist-SemiBold',
    color: semantics.text.primary,
  },
  emoji: {
    fontSize: 72,
  },
  previewCard: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  previewDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  previewCardText: {
    fontFamily: 'Geist-SemiBold',
    fontSize: 12,
    color: '#0F172A',
  },
  copyWrap: {
    alignItems: 'center',
    marginTop: 24,
    maxWidth: 340,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Geist-Bold',
    color: semantics.text.primary,
    textAlign: 'center',
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Geist-Regular',
    color: semantics.text.muted,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 22,
  },
  dotRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 18,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 24,
    backgroundColor: colors.primary,
  },
  dotInactive: {
    width: 6,
    backgroundColor: '#CBD5E1',
  },
  actionsRow: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 10,
  },
});
