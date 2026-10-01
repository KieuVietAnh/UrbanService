import React, { useEffect, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Location from 'expo-location';
import Icon from '@expo/vector-icons/Feather';
import { Text } from '@/components/ui';
import { useAuthStore } from '@/features/auth';
import { colors } from '@/constants/theme';
import type { RouterLike } from '../types';
import { styles } from '../homeStyles';

type Props = {
  router: RouterLike;
  today: string;
  firstName: string;
  areaName: string;
};

const formatRole = (role?: string) => {
  if (!role) return 'Resident';
  const normalized = role.replace(/[_-]+/g, ' ').trim().toLowerCase();
  if (normalized === 'resident' || normalized === 'service user') return 'Resident';
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
};

const getInitials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

const formatCurrentArea = (address?: Location.LocationGeocodedAddress | null) => {
  if (!address) return '';
  const raw = address as Location.LocationGeocodedAddress & {
    formattedAddress?: string;
    cityDistrict?: string;
  };
  const ward = raw.district || raw.subregion || raw.name || raw.street || '';
  const district = raw.cityDistrict || raw.city || raw.region || '';
  return [ward, district].filter(Boolean).join(', ');
};

export function HomeHeader({ router, areaName }: Props) {
  const user = useAuthStore((state) => state.user);
  const [currentArea, setCurrentArea] = useState('');
  const userAny = user as
    | (typeof user & {
        areaName?: string;
        wardName?: string;
        districtName?: string;
        locationName?: string;
        profileImageUrl?: string | null;
      })
    | null;

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        const lastKnown = await Location.getLastKnownPositionAsync();
        const position =
          lastKnown ??
          (await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          }));

        const [address] = await Location.reverseGeocodeAsync({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });

        if (!mounted) return;
        const nextArea = formatCurrentArea(address);
        if (nextArea) setCurrentArea(nextArea);
      } catch {
        // Fall back to the profile/location data already available on Home.
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const fullName = user?.fullName?.trim() || user?.email || 'Resident';
  const avatarUrl = user?.avatarUrl || userAny?.profileImageUrl || null;
  const roleLabel = formatRole(user?.role);
  const locationLabel =
    currentArea ||
    areaName ||
    userAny?.areaName ||
    userAny?.wardName ||
    userAny?.locationName ||
    userAny?.districtName ||
    'Đang xác định khu vực';

  return (
    <Animated.View entering={FadeIn.duration(240)} style={styles.headerRow}>
      <View style={styles.profileHeaderLeft}>
        <View style={styles.profileAvatar}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.profileAvatarImage} />
          ) : (
            <Text style={styles.profileAvatarText}>{getInitials(fullName) || 'R'}</Text>
          )}
        </View>

        <View style={styles.profileMeta}>
          <Text style={styles.profileName} numberOfLines={1}>
            {fullName}
          </Text>
          <View style={styles.profileRoleRow}>
            <View style={styles.profileRoleBadge}>
              <Text style={styles.profileRoleText}>{roleLabel}</Text>
            </View>
          </View>
          <View style={styles.profileAreaRow}>
            <Icon name="map-pin" size={13} color={colors.muted} />
            <Text style={styles.profileArea} numberOfLines={1}>
              {locationLabel}
            </Text>
          </View>
        </View>
      </View>

      <Pressable onPress={() => router.push('/(resident)/notifications')} style={styles.headerNotificationButton}>
        <Icon name="bell" size={20} color={colors.text} />
      </Pressable>
    </Animated.View>
  );
}
