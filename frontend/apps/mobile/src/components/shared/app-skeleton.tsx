import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  radius?: number;
  className?: string;
}

export function Skeleton({ width = '100%', height = 16, radius = 8, className = '' }: SkeletonProps) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [shimmer]);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.52, 1] });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width: width as any, height, borderRadius: radius, opacity },
      ]}
    />
  );
}

// Preset skeleton layouts
export function SkeletonCard() {
  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <Skeleton width={80} height={12} radius={6} />
        <Skeleton width={60} height={20} radius={10} />
      </View>
      <Skeleton width="85%" height={18} radius={6} />
      <View style={{ height: 8 }} />
      <Skeleton width="60%" height={13} radius={6} />
      <View style={{ height: 6 }} />
      <Skeleton width="45%" height={13} radius={6} />
      <View style={{ height: 14 }} />
      <Skeleton width="100%" height={40} radius={10} />
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#E2E8F0',
    borderWidth: 1,
    borderColor: '#EAF0F6',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.34)',
    padding: 18,
    marginBottom: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
});

export default Skeleton;
