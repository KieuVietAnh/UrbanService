import React from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Icon from '@expo/vector-icons/Feather';
import { Text } from '@/components/ui';
import type { RouterLike } from '../types';
import { styles } from '../homeStyles';

type Props = { router: RouterLike };

export function HeroCard({ router }: Props) {
  return (
    <Animated.View entering={FadeInDown.delay(80).springify().damping(18)} style={styles.heroCard}>
      <View style={styles.heroGlowA} />
      <View style={styles.heroGlowB} />
      <View style={styles.heroContent}>
        <View style={styles.heroCopy}>
          <Text style={styles.heroLabel}>UrbanMind</Text>
          <Text style={styles.heroTitle}>Xây dựng đô thị văn minh, hiện đại và đáng sống</Text>
          <Text style={styles.heroSubtitle}>Gửi phản ánh nhanh để cộng đồng và thành phố cùng xử lý các vấn đề quanh bạn.</Text>
          <Pressable
            style={styles.heroPrimaryButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push('/(resident)/create-feedback');
            }}
          >
            <Text style={styles.heroPrimaryText}>Gửi phản ánh</Text>
            <View style={styles.heroButtonIcon}>
              <Icon name="plus" size={18} color="#2563EB" />
            </View>
          </Pressable>
        </View>

        <View style={styles.heroIllustration}>
          <View style={[styles.heroCityImage, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#DBEAFE' }]}>
            <Icon name="map" size={42} color="#2563EB" />
          </View>
          <View style={styles.heroCloud} />
          <View style={styles.heroPhoneCard}>
            <Icon name="smartphone" size={18} color="#2563EB" />
          </View>
          <View style={styles.heroCitizen}>
            <View style={styles.heroCitizenHead} />
            <View style={styles.heroCitizenBody} />
          </View>
          <View style={styles.heroTreeA} />
          <View style={styles.heroTreeB} />
        </View>
      </View>
    </Animated.View>
  );
}
