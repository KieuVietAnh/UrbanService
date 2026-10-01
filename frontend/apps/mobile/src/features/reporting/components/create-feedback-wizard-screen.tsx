
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  Image,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Modal,
  Text as NativeText,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import Icon from '@expo/vector-icons/Feather';
import { Text } from '@/components/ui';
import { AppButton } from '@/components/ui';
import { AppInput } from '@/components/ui';
import { AppTextArea } from '@/components/shared';
import { AppHeader } from '@/components/ui';
import { AppStepBar } from '@/components/shared';
import { useToast } from '@/components/shared';
import { feedbackApi, reportingKeys, type CreateFeedbackPayload } from '@/features/reporting/api';
import { communityKeys } from '@/features/community/api';
import { colors } from '@/constants/theme';
import {
  searchVietnameseAddresses,
  type AddressSuggestion,
} from '@/features/reporting/services/address-geocoding';
import FeedbackLocationPicker from './feedback-location-picker';

const { width: W } = Dimensions.get('window');
const STEPS = ['Mô tả', 'Vị trí', 'Minh chứng', 'Xem lại'];
const MAX_ATTACHMENT_COUNT = 5;
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_SIZE_BYTES = 20 * 1024 * 1024;
const DRAFT_STORAGE_PREFIX = 'urbanmind:create-ticket-draft';
const GPS_TIMEOUT_MS = 12_000;

const formatFileSize = (bytes = 0) => {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const digits = value >= 10 || Number.isInteger(value) ? 0 : 1;
  return `${value.toFixed(digits)} ${units[unitIndex]}`;
};

const normalizePriority = (value?: string) => {
  if (value === 'Critical') return 'Urgent';
  if (['Low', 'Medium', 'High', 'Urgent'].includes(value || '')) {
    return value as 'Low' | 'Medium' | 'High' | 'Urgent';
  }
  return 'Medium';
};

// Helper accessors for inconsistent API shapes
const getCategoryId = (category: any) => String(category?.categoryId ?? category?.id ?? '');
const getAreaId = (area: any) => String(area?.areaId ?? area?.id ?? '');
const getAreaName = (area: any) => area?.areaName ?? area?.name ?? area?.displayName ?? 'Khu vực';
const isVideoFile = (file: any) => {
  if (!file) return false;
  if (typeof file === 'string') {
    const u = file.toLowerCase();
    return /\.(mp4|mov|avi|mkv)(\?|$)/.test(u);
  }
  return Boolean((file.type && String(file.type).startsWith('video/')) || (file.mimeType && String(file.mimeType).startsWith('video/')));
};


function StepDescription({
  title,
  description,
  onTitleChange,
  onDescChange,
  titleError,
  descriptionError,
}: {
  title: string;
  description: string;
  onTitleChange: (v: string) => void;
  onDescChange: (v: string) => void;
  titleError?: string;
  descriptionError?: string;
}) {
  return (
    <View style={styles.stepBody}>
      <Text style={styles.wizardTitle}>Mô tả phản ánh</Text>

      <Text style={styles.wizardSubtitle}>Mô tả càng chi tiết, xử lý càng chính xác.</Text>



      <View style={styles.formCard}>
        <AppInput
          label="Tiêu đề ngắn gọn"
          leftIcon="edit-3"
          value={title}
          onChangeText={onTitleChange}
          placeholder="VD: Đèn đường số 12 bị hỏng"
          maxLength={120}
          autoCapitalize="sentences"
          error={titleError}
        />
        <AppTextArea
          label="Mô tả chi tiết"
          value={description}
          onChangeText={onDescChange}
          placeholder="Mô tả thêm về vấn đề, thời gian xảy ra, mức độ ảnh hưởng..."
          rows={6}
          maxLength={1000}
          error={descriptionError}
        />
        <View className="flex-row justify-end">
          <Text className="text-xs text-text-muted">{description.length}/1000</Text>
        </View>
      </View>

      <View style={styles.aiTipRow}>
        <View style={styles.aiTip}>
          <Icon name="zap" size={14} color={colors.primary} />
          <Text className="text-xs text-primary flex-1">
            Bạn cũng có thể dùng Trợ lý AI để chuẩn bị nội dung, ảnh và vị trí trước khi mở biểu mẫu này.
          </Text>
        </View>
      </View>
    </View>
  );
}

function StepLocation({
  areaId,
  areas,
  locationText,
  latitude,
  longitude,
  onAreaChange,
  onLocationChange,
  onLatitudeChange,
  onLongitudeChange,
  onAddressSelect,
  onUseCurrentLocation,
  locating,
  loading,
  error,
  locationError,
  latitudeError,
  longitudeError,
}: {
  areaId: string;
  areas: any[];
  locationText: string;
  latitude: number | null;
  longitude: number | null;
  onAreaChange: (v: string) => void;
  onLocationChange: (v: string) => void;
  onLatitudeChange: (v: string) => void;
  onLongitudeChange: (v: string) => void;
  onAddressSelect: (address: string, latitude: number, longitude: number) => void;
  onUseCurrentLocation: () => void | Promise<void>;
  locating?: boolean;
  loading?: boolean;
  error?: string;
  locationError?: string;
  latitudeError?: string;
  longitudeError?: string;
}) {
  const mapRef = React.useRef<any>(null);
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [addressInputFocused, setAddressInputFocused] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [searchingAddress, setSearchingAddress] = useState(false);
  const [addressSearchMessage, setAddressSearchMessage] = useState('');
  const selectedAddressRef = useRef('');
  const toast = useToast();

  const normalizeBoundary = (boundaryGeoJson: any) => {
    if (!boundaryGeoJson) return null;
    if (typeof boundaryGeoJson === 'object') return boundaryGeoJson;
    if (typeof boundaryGeoJson !== 'string') return null;
    const trimmed = boundaryGeoJson.trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null;
    // try several common serializations
    const candidates = [trimmed, trimmed.replace(/""/g, '"'), trimmed.replace(/\\"/g, '"')];
    for (const c of candidates) {
      try {
        const parsed = JSON.parse(c);
        if (parsed) return parsed;
      } catch (e) {
        // continue

      }
    }
    return null;
  };

  const extractCoordsFromGeoJson = (geo: any) => {
    if (!geo) return [];
    const coords: Array<{ latitude: number; longitude: number }> = [];
    const pushFromArray = (arr: any) => {
      if (!Array.isArray(arr)) return;
      // arr could be [lng, lat] or nested
      if (typeof arr[0] === 'number' && typeof arr[1] === 'number') {
        const lng = Number(arr[0]);
        const lat = Number(arr[1]);
        if (Number.isFinite(lat) && Number.isFinite(lng)) coords.push({ latitude: lat, longitude: lng });
        return;
      }
      for (const item of arr) pushFromArray(item);
    };

    if (geo.type === 'FeatureCollection' && Array.isArray(geo.features)) {
      geo.features.forEach((f: any) => extractCoordsFromGeoJson(f).forEach((c) => coords.push(c)));
      return coords;
    }
    if (geo.type === 'Feature' && geo.geometry) return extractCoordsFromGeoJson(geo.geometry);
    if (geo.type === 'Polygon' || geo.type === 'MultiPolygon') {
      pushFromArray(geo.coordinates);
      return coords;
    }
    if (geo.coordinates) {
      pushFromArray(geo.coordinates);
      return coords;
    }
    return coords;
  };

  const selectedArea = useMemo(
    () => areas.find((area) => getAreaId(area) === areaId),
    [areaId, areas]
  );

  const selectedAreaViewbox = useMemo(() => {
    const rawBoundary = selectedArea?.BoundaryGeoJson
      ?? selectedArea?.boundaryGeoJson
      ?? selectedArea?.boundaryGeoJSON
      ?? selectedArea?.boundary
      ?? selectedArea?.geoJson
      ?? selectedArea?.geoJSON
      ?? null;
    const normalized = normalizeBoundary(rawBoundary);
    const coordinates = extractCoordsFromGeoJson(normalized);
    if (coordinates.length === 0) return '';

    const latitudes = coordinates.map((coordinate) => coordinate.latitude);
    const longitudes = coordinates.map((coordinate) => coordinate.longitude);
    return `${Math.min(...longitudes)},${Math.max(...latitudes)},${Math.max(...longitudes)},${Math.min(...latitudes)}`;
  }, [selectedArea]);

  React.useEffect(() => {
    if (!addressInputFocused) return undefined;

    const query = locationText.trim();
    if (query.length < 3) {
      setAddressSuggestions([]);
      setSearchingAddress(false);
      setAddressSearchMessage(query.length > 0 ? 'Nhập ít nhất 3 ký tự để tìm địa chỉ.' : '');
      return undefined;
    }

    if (selectedAddressRef.current === query) {
      setAddressSuggestions([]);
      setSearchingAddress(false);
      setAddressSearchMessage('');
      return undefined;
    }

    const controller = new AbortController();
    const debounceTimer = setTimeout(async () => {
      setSearchingAddress(true);
      setAddressSearchMessage('');
      try {
        const results = await searchVietnameseAddresses(query, {
          areaName: selectedArea ? getAreaName(selectedArea) : '',
          viewbox: selectedAreaViewbox,
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setAddressSuggestions(results);
        setAddressSearchMessage(
          results.length === 0
            ? 'Không tìm thấy địa chỉ phù hợp. Bạn có thể nhập rõ số nhà, tên đường hoặc chọn trên bản đồ.'
            : ''
        );
      } catch (searchError) {
        if (controller.signal.aborted) return;
        setAddressSuggestions([]);
        setAddressSearchMessage('Không thể tìm địa chỉ lúc này. Bạn vẫn có thể chọn trực tiếp trên bản đồ.');
      } finally {
        if (!controller.signal.aborted) setSearchingAddress(false);
      }
    }, 550);

    return () => {
      clearTimeout(debounceTimer);
      controller.abort();
    };
  }, [addressInputFocused, locationText, selectedArea, selectedAreaViewbox]);

  React.useEffect(() => {
    // focus map when areaId changes: prefer polygon fit, then center coords
    const area = selectedArea;
    if (!area || !mapRef.current) return;

    // attempt polygon/geojson first
    const rawBoundary = area?.BoundaryGeoJson ?? area?.boundaryGeoJson ?? area?.boundaryGeoJSON ?? area?.boundary ?? area?.geoJson ?? area?.geoJSON ?? null;
    const normalized = normalizeBoundary(rawBoundary);
    if (normalized) {
      try {
        const coords = extractCoordsFromGeoJson(normalized);
        if (coords.length > 0) {
          // fit to polygon bounds
          try {
            mapRef.current.fitToCoordinates(coords, { edgePadding: { top: 36, left: 36, right: 36, bottom: 36 }, animated: true });
          } catch (e) {
            // some platforms may not support fitToCoordinates; fallback to center
            const first = coords[0];
            mapRef.current.animateToRegion({ latitude: first.latitude, longitude: first.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 600);
          }
          return;
        }
      } catch (err) {
        if (__DEV__) console.warn('Failed to parse area boundary');
        toast.error('Không thể tải hình dạng khu vực. Vui lòng thử lại.');
        return;
      }
    }

    // fallback to center coordinates
    const lat = area?.centerLatitude ?? area?.centerLat ?? area?.latitude ?? area?.lat ?? area?.center?.lat;
    const lng = area?.centerLongitude ?? area?.centerLng ?? area?.longitude ?? area?.lng ?? area?.center?.lng;
    if (lat != null && lng != null) {
      try {
        mapRef.current.animateToRegion({ latitude: Number(lat), longitude: Number(lng), latitudeDelta: 0.02, longitudeDelta: 0.02 }, 600);
      } catch (e) {
        // ignore
      }
    }
  }, [selectedArea, mapRef]);

  React.useEffect(() => {
    if (latitude == null || longitude == null || !mapRef.current) return;

    try {
      mapRef.current.animateToRegion({
        latitude: Number(latitude),
        longitude: Number(longitude),
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      }, 600);
    } catch (e) {
      if (__DEV__) console.warn('Failed to focus current location on map');
    }
  }, [latitude, longitude, mapRef]);

  return (
    <View style={styles.stepBody}>
      <Text style={styles.wizardTitle}>Vị trí xảy ra</Text>
      <Text style={styles.wizardSubtitle}>Chọn khu vực và xác định vị trí cụ thể để xử lý đúng phạm vi.</Text>



      <View style={styles.locationPanel}>

        <View style={styles.areaFieldBlock}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>Khu vực</Text>
            <View style={styles.miniChip}><Text style={styles.miniChipText}>{areas.length} khu vực</Text></View>
          </View>

          {loading && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 12, backgroundColor: '#F0F9FF', borderRadius: 12, marginBottom: 12 }}>
              <ActivityIndicator size="small" color="#0369A1" />
              <Text style={{ fontSize: 13, color: '#0369A1', fontFamily: 'Geist-Medium' }}>Đang tải khu vực...</Text>
            </View>
          )}
          {!loading && areas.length === 0 && (
            <View style={{ paddingVertical: 12, paddingHorizontal: 12, backgroundColor: '#FEF2F2', borderRadius: 12, marginBottom: 12 }}>
              <Text style={{ fontSize: 13, color: '#DC2626', fontFamily: 'Geist-SemiBold' }}>Không thể tải danh sách khu vực</Text>
              <Text style={{ fontSize: 12, color: '#991B1B', marginTop: 4 }}>Vui lòng kiểm tra kết nối mạng hoặc thử lại.</Text>
            </View>
          )}
          {!loading && areas.length > 0 && (
            <Pressable style={styles.selectAreaInput} onPress={() => setShowAreaModal(true)}>
              <Text style={styles.selectAreaText}>{selectedArea ? getAreaName(selectedArea) : 'Chọn khu vực'}</Text>
              <Icon name="chevron-down" size={16} color={colors.muted} />
            </Pressable>
          )}
          <Modal visible={showAreaModal} transparent animationType="slide">
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text className="text-sm font-sans-semibold mb-3">Chọn khu vực</Text>
                <ScrollView>
                  {areas.map((area) => (
                    <Pressable
                      key={getAreaId(area) || getAreaName(area)}
                      onPress={() => { onAreaChange(getAreaId(area)); setShowAreaModal(false); }}
                      style={styles.modalItem}
                    >
                      <Text>{getAreaName(area)}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <View style={styles.modalActions}>
                  <Pressable onPress={() => setShowAreaModal(false)} style={styles.modalCloseBtn}>
                    <Text className="text-sm">Đóng</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>
        </View>

        {error ? <Text style={styles.fieldError}>{error}</Text> : null}

        <View style={styles.locationMapCard}>
          <View style={styles.mapHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.mapTitle}>Bản đồ khu vực</Text>
              <Text style={styles.mapSubtitle}>Đánh dấu vị trí sự cố</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={locating ? 'Đang lấy vị trí hiện tại' : 'Dùng vị trí hiện tại'}
              disabled={locating}
              style={({ pressed }) => [styles.mapButton, locating && styles.mapButtonDisabled, pressed && !locating && { opacity: 0.8 }]}
              onPress={() => {
                setAddressInputFocused(false);
                setAddressSuggestions([]);
                setAddressSearchMessage('');
                Keyboard.dismiss();
                onUseCurrentLocation();
              }}
            >
              {locating ? <ActivityIndicator size="small" color={colors.primary} /> : <Icon name="navigation" size={14} color={colors.primary} />}
              <Text style={styles.mapButtonText}>{locating ? 'Đang lấy...' : 'Hiện tại'}</Text>
            </Pressable>
          </View>

          <View style={styles.mapInner}>
            <FeedbackLocationPicker
              ref={mapRef}
              latitude={latitude}
              longitude={longitude}
              onCoordinateSelect={(nextLatitude, nextLongitude) => {
                setAddressInputFocused(false);
                setAddressSuggestions([]);
                setAddressSearchMessage('');
                Keyboard.dismiss();
                onLatitudeChange(String(nextLatitude));
                onLongitudeChange(String(nextLongitude));
              }}
            />

            <View style={styles.mapSearchOverlay}>
              <AppInput
                label="Tìm địa chỉ trên bản đồ"
                leftIcon="search"
                rightIcon={searchingAddress ? undefined : 'map-pin'}
                value={locationText}
                onFocus={() => setAddressInputFocused(true)}
                onChangeText={(value) => {
                  selectedAddressRef.current = '';
                  onLocationChange(value);
                }}
                placeholder="Nhập số nhà, tên đường hoặc địa điểm..."
                autoCorrect={false}
                returnKeyType="search"
                containerClassName="mb-0"
                error={locationError}
              />

              {searchingAddress ? (
                <View style={styles.addressSearchStatus}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.addressSearchStatusText}>Đang tìm địa chỉ...</Text>
                </View>
              ) : null}

              {addressSuggestions.length > 0 ? (
                <View
                  style={styles.addressSuggestionList}
                  accessibilityRole="menu"
                >
                  {addressSuggestions.slice(0, 4).map((suggestion, index) => (
                    <Pressable
                      key={suggestion.id}
                      accessibilityRole="menuitem"
                      accessibilityLabel={`Chọn địa chỉ ${suggestion.displayName}`}
                      onPress={() => {
                        selectedAddressRef.current = suggestion.displayName;
                        setAddressInputFocused(false);
                        setAddressSuggestions([]);
                        setAddressSearchMessage('');
                        Keyboard.dismiss();
                        onAddressSelect(suggestion.displayName, suggestion.latitude, suggestion.longitude);
                        mapRef.current?.animateToRegion({
                          latitude: suggestion.latitude,
                          longitude: suggestion.longitude,
                          latitudeDelta: 0.008,
                          longitudeDelta: 0.008,
                        }, 600);
                      }}
                      style={({ pressed }) => [
                        styles.addressSuggestionItem,
                        index === Math.min(addressSuggestions.length, 4) - 1 && styles.addressSuggestionItemLast,
                        pressed && styles.addressSuggestionItemPressed,
                      ]}
                    >
                      <View style={styles.addressSuggestionIcon}>
                        <Icon name="map-pin" size={15} color={colors.primary} />
                      </View>
                      <View style={styles.addressSuggestionCopy}>
                        <NativeText
                          style={styles.addressSuggestionText}
                          numberOfLines={2}
                          maxFontSizeMultiplier={1.25}
                        >
                          {suggestion.displayName}
                        </NativeText>
                        <NativeText
                          style={styles.addressSuggestionHint}
                          numberOfLines={1}
                          maxFontSizeMultiplier={1.25}
                        >
                          Chạm để chọn và định vị trên bản đồ
                        </NativeText>
                      </View>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              {addressSearchMessage ? (
                <Text style={styles.addressSearchMessage}>{addressSearchMessage}</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.mapMetaRow}>
            <Icon name="map-pin" size={14} color={latitude != null && longitude != null ? colors.primary : '#94A3B8'} />
            <View style={styles.mapMetaContent}>
              <Text style={styles.mapText} numberOfLines={2}>{locationText || 'Chưa chọn địa chỉ cụ thể'}</Text>
              <Text style={styles.mapHelperText}>{latitude != null && longitude != null ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}` : 'Tìm địa chỉ hoặc chạm trực tiếp lên bản đồ'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.coordRow}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <AppInput
              label="Vĩ độ"
              value={latitude == null ? '' : String(latitude)}
              onChangeText={onLatitudeChange}

              keyboardType="decimal-pad"
              placeholder="10.7769"
              error={latitudeError}
            />
          </View>
          <View style={{ flex: 1 }}>
            <AppInput
              label="Kinh độ"
              value={longitude == null ? '' : String(longitude)}
              onChangeText={onLongitudeChange}
              keyboardType="decimal-pad"
              placeholder="106.7009"
              error={longitudeError}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

function StepAttachments({
  attachments,
  onAdd,
  onRemove,
  error,
}: {
  attachments: Array<{ uri: string; name: string; type: string; size?: number }>;
  onAdd: (uri: string, fileName: string, type: string, size?: number) => void;
  onRemove: (index: number) => void;
  error?: string;
}) {
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      selectionLimit: MAX_ATTACHMENT_COUNT - attachments.length,
      quality: 0.85,
    });
    if (!result.canceled) {
      result.assets.forEach((asset) => {
        onAdd(asset.uri, asset.fileName || `attachment_${Date.now()}.jpg`, asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg'), asset.fileSize);
      });
    }
  };

  const takePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      onAdd(asset.uri, asset.fileName || `attachment_${Date.now()}.jpg`, asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg'), asset.fileSize);
    }
  };

  return (
    <View style={styles.stepBody}>
      <Text style={styles.wizardTitle}>Minh chứng</Text>
      <Text style={styles.wizardSubtitle}>Thêm ảnh hoặc video giúp nhân viên hiểu rõ vấn đề hơn. Tối đa 5 tệp, tổng không quá 20 MB.</Text>



      <View style={styles.uploadPanel}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>Tệp minh chứng</Text>
          <View style={styles.miniChip}><Text style={styles.miniChipText}>{attachments.length}/{MAX_ATTACHMENT_COUNT}</Text></View>
        </View>

        {error ? <Text style={styles.fieldError}>{error}</Text> : null}

        <View style={styles.imgToolbar}>
          <Pressable onPress={pickImage} style={styles.addPrimaryBtn}>
            <Icon name="plus" size={18} color="#FFFFFF" />
            <Text style={styles.addPrimaryBtnText}>Thêm ảnh</Text>
          </Pressable>
          {attachments.length > 0 && attachments.length < MAX_ATTACHMENT_COUNT ? (
            <Pressable onPress={takePhoto} style={styles.secondaryActionBtn}>
              <Icon name="camera" size={16} color={colors.primary} />
            </Pressable>
          ) : null}
        </View>


        {attachments.length > 0 ? (
          <View style={styles.imgGrid}>
            {attachments.map((item, i) => (
              <View key={`${item.name}-${i}`} style={styles.imgItem}>
                {isVideoFile(item) ? (
                  <View style={styles.videoPreview}>
                    <Icon name="video" size={24} color={colors.primary} />
                  </View>
                ) : (
                  <Image source={{ uri: item.uri }} style={styles.imgPreview} />
                )}
                <Pressable onPress={() => onRemove(i)} style={styles.imgRemoveBtn} hitSlop={6}>
                  <Icon name="x" size={12} color="#FFFFFF" />
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.noImgBox}>
            <Icon name="image" size={40} color="#CBD5E1" />
            <Text className="text-sm text-text-muted mt-2 text-center">
              Chưa có ảnh hoặc video nào.{'\n'}Bạn có thể bỏ qua bước này.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function StepReview({
  title,
  description,
  categoryName,
  areaName,
  locationText,
  priority,
  attachments,
}: {
  title: string;
  description: string;
  categoryName: string;
  areaName: string;
  locationText: string;
  priority: string;
  attachments: Array<{ uri: string; name: string; type: string }>;
}) {
  return (
    <View style={styles.stepBody}>
      <Text className="text-xl font-sans-bold text-text mb-1" style={{ letterSpacing: -0.3 }}>
        Xem lại trước khi gửi
      </Text>
      <Text className="text-sm text-text-muted mb-6">
        Kiểm tra thông tin trước khi gửi phản ánh.
      </Text>
      {[
        { label: 'Tiêu đề', value: title || '—', icon: 'edit-3' },
        { label: 'Danh mục', value: categoryName || '—', icon: 'tag' },
        { label: 'Khu vực', value: areaName || '—', icon: 'map-pin' },
        { label: 'Mức ưu tiên', value: priority || '—', icon: 'alert-circle' },
      ].map((row) => (
        <View key={row.label} style={styles.reviewRow}>
          <Icon name={row.icon as any} size={15} color={colors.muted} style={styles.reviewIcon} />
          <View style={{ flex: 1 }}>
            <Text className="text-2xs font-sans-semibold text-text-muted uppercase tracking-wide">{row.label}</Text>
            <Text className="text-sm font-sans-medium text-text mt-0.5">{row.value}</Text>
          </View>
        </View>
      ))}
      <View style={styles.reviewRow}>
        <Icon name="file-text" size={15} color={colors.muted} style={styles.reviewIcon} />
        <View style={{ flex: 1 }}>
          <Text className="text-2xs font-sans-semibold text-text-muted uppercase tracking-wide">Mô tả</Text>
          <Text className="text-sm text-text mt-0.5 leading-snug" numberOfLines={5}>
            {description || '—'}
          </Text>
        </View>
      </View>
      <View style={styles.reviewRow}>
        <Icon name="map-pin" size={15} color={colors.muted} style={styles.reviewIcon} />
        <View style={{ flex: 1 }}>
          <Text className="text-2xs font-sans-semibold text-text-muted uppercase tracking-wide">Địa chỉ</Text>
          <Text className="text-sm text-text mt-0.5 leading-snug">{locationText || '—'}</Text>
        </View>
      </View>
      {attachments.length > 0 ? (
        <View style={styles.reviewRow}>
          <Icon name="image" size={15} color={colors.muted} style={styles.reviewIcon} />
          <View style={{ flex: 1 }}>
            <Text className="text-2xs font-sans-semibold text-text-muted uppercase tracking-wide mb-2">
              Hình ảnh ({attachments.length})
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {attachments.map((item, i) => (
                <View key={`${item.name}-${i}`} style={styles.reviewPreview}>
                  {isVideoFile(item) ? <Icon name="video" size={18} color={colors.primary} /> : <Image source={{ uri: item.uri }} style={styles.reviewImage} />}

                </View>
              ))}
            </View>
          </View>
        </View>
      ) : null}

      <View style={styles.trustBox}>
        {[
          'Thông tin sẽ được gửi đúng theo nội dung bạn đã kiểm tra',
          'Bạn có thể theo dõi tiến độ',
          'Thông báo sẽ được gửi khi có cập nhật',
        ].map((line) => (
          <View key={line} style={styles.trustItem}>
            <View style={styles.trustIconWrap}>
              <Icon name="check" size={12} color="#FFFFFF" />
            </View>
            <Text style={styles.trustText}>{line}</Text>
          </View>
        ))}
      </View>


    </View>
  );
}

export default function CreateFeedbackWizardScreen() {
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const [step, setStep] = useState(1);
  const [categoryId, setCategoryId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [areaId, setAreaId] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [locationText, setLocationText] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationAccuracyMeters, setLocationAccuracyMeters] = useState<number | null>(null);
  const [geoSource, setGeoSource] = useState<'GPS' | 'MANUAL'>('MANUAL');
  const [locating, setLocating] = useState(false);
  const [attachments, setAttachments] = useState<Array<{ uri: string; name: string; type: string; size?: number }>>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [areasLoading, setAreasLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [draftNotice, setDraftNotice] = useState('');
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [suggestedCategoryName, setSuggestedCategoryName] = useState('');

  const selectedCategory = useMemo(() => categories.find((cat) => getCategoryId(cat) === categoryId), [categories, categoryId]);
  const selectedArea = useMemo(() => areas.find((area) => getAreaId(area) === areaId), [areas, areaId]);

  const totalAttachmentSize = useMemo(() => attachments.reduce((sum, item) => sum + (item.size || 0), 0), [attachments]);

  useEffect(() => {
    let active = true;
    const loadOptions = async () => {
      setAreasLoading(true);
      const [areasResult, categoriesResult] = await Promise.allSettled([
        feedbackApi.getAreas(),
        feedbackApi.getCategories(),
      ]);
      if (!active) return;

      const loadedAreas = areasResult.status === 'fulfilled' && Array.isArray(areasResult.value) ? areasResult.value : [];
      const loadedCategories = categoriesResult.status === 'fulfilled' && Array.isArray(categoriesResult.value) ? categoriesResult.value : [];

      setAreas(loadedAreas);
      setCategories(loadedCategories);

      if (__DEV__ && loadedAreas.length === 0) {
        console.warn('No areas loaded from API');
      }

      setAreasLoading(false);
    };
    loadOptions();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const loadDraft = async () => {
      try {

        const draftKey = `${DRAFT_STORAGE_PREFIX}:mobile`;
        const raw = await AsyncStorage.getItem(draftKey);
        if (!raw) return;
        const draft = JSON.parse(raw);
        if (draft.title) setTitle(draft.title);
        if (draft.description) setDescription(draft.description);
        if (draft.categoryId) setCategoryId(String(draft.categoryId));
        if (draft.areaId) setAreaId(String(draft.areaId));
        if (draft.priority) setPriority(normalizePriority(draft.priority));
        if (draft.suggestedCategory) setSuggestedCategoryName(String(draft.suggestedCategory));
        if (draft.locationText) setLocationText(draft.locationText);
        if (draft.latitude != null) setLatitude(Number(draft.latitude));
        if (draft.longitude != null) setLongitude(Number(draft.longitude));
        if (draft.locationAccuracyMeters != null) setLocationAccuracyMeters(Number(draft.locationAccuracyMeters));
        if (draft.geoSource === 'GPS') setGeoSource('GPS');
        if (Array.isArray(draft.attachments)) {
          setAttachments(draft.attachments.filter((item: unknown) => {
            if (!item || typeof item !== 'object') return false;
            const candidate = item as { uri?: unknown; name?: unknown; type?: unknown };
            return typeof candidate.uri === 'string' && typeof candidate.name === 'string' && typeof candidate.type === 'string';
          }));
        }
        setDraftNotice('Đã khôi phục phản ánh đang làm dở. Vui lòng kiểm tra lại trước khi gửi.');
      } catch {
        // ignore
      } finally {
        setDraftLoaded(true);
      }
    };
    loadDraft();
  }, []);

  useEffect(() => {
    if (!suggestedCategoryName || categoryId || categories.length === 0) return;
    const normalizedSuggestion = suggestedCategoryName.trim().toLocaleLowerCase('vi-VN');
    const matched = categories.find((category) => {
      const name = String(category?.categoryName ?? category?.name ?? '').trim().toLocaleLowerCase('vi-VN');
      return name === normalizedSuggestion || name.includes(normalizedSuggestion) || normalizedSuggestion.includes(name);
    });
    if (matched) setCategoryId(getCategoryId(matched));
  }, [categories, categoryId, suggestedCategoryName]);

  useEffect(() => {
    const persistDraft = async () => {
      if (!draftLoaded) return;
      const draftKey = `${DRAFT_STORAGE_PREFIX}:mobile`;
      const hasDraftContent = Boolean(title.trim() || description.trim() || areaId || locationText || latitude != null || longitude != null || attachments.length > 0 || step > 1);
      if (!hasDraftContent) {
        await AsyncStorage.removeItem(draftKey);
        setDraftNotice('');
        return;
      }
      await AsyncStorage.setItem(draftKey, JSON.stringify({
        title,
        description,
        categoryId,
        areaId,
        priority,
        locationText,
        latitude,
        longitude,
        locationAccuracyMeters,
        geoSource,
        attachments,
        suggestedCategory: suggestedCategoryName,
        savedAt: new Date().toISOString(),
      }));
    };
    persistDraft();
  }, [areaId, attachments, categoryId, description, draftLoaded, geoSource, latitude, locationAccuracyMeters, longitude, locationText, priority, step, suggestedCategoryName, title]);

  const validateStep = (stepId: number) => {
    const errors: Record<string, string> = {};

    if (stepId === 1) {
      if (!title.trim()) {
        errors.title = 'Vui lòng nhập tiêu đề phản ánh.';
      }
      if (!description.trim()) {
        errors.description = 'Vui lòng mô tả chi tiết vấn đề.';
      }
    }

    if (stepId === 2) {
      if (!areaId) {
        errors.areaId = 'Vui lòng chọn khu vực xảy ra vấn đề.';
      }
      if (latitude == null || longitude == null) {
        errors.location = 'Vui lòng đánh dấu vị trí cụ thể trên bản đồ.';
      }
    }

    if (stepId === 3) {
      if (attachments.length > MAX_ATTACHMENT_COUNT || totalAttachmentSize > MAX_TOTAL_ATTACHMENT_SIZE_BYTES) {
        errors.attachments = `Tối đa ${MAX_ATTACHMENT_COUNT} tệp và tổng dung lượng không quá ${formatFileSize(MAX_TOTAL_ATTACHMENT_SIZE_BYTES)}.`;
      }
    }

    return errors;
  };

  const isStepValid = useMemo(() => {
    if (step === 1) return Object.keys(validateStep(1)).length === 0;
    if (step === 2) return Object.keys(validateStep(2)).length === 0;
    if (step === 3) return Object.keys(validateStep(3)).length === 0;
    // step 4 (review) requires all previous steps valid
    return Object.keys({ ...validateStep(1), ...validateStep(2), ...validateStep(3) }).length === 0;
  }, [step, title, description, areaId, latitude, longitude, attachments.length, categoryId]);

  const replaceErrors = (errors: Record<string, string>) => {
    setFieldErrors((current) => ({ ...current, ...errors }));
  };

  const clearFieldError = (field: string) => {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const goToNext = () => {
    const errors = validateStep(step);

    if (Object.keys(errors).length > 0) {
      replaceErrors(errors);
      toast.error(Object.values(errors)[0]);
      return;
    }

    if (step === 1) {
      handleDescriptionNext();
      return;
    }

    if (step === 2) {
      handleLocationNext();
      return;
    }

    if (step < STEPS.length) {
      setStep((s) => s + 1);
    }
  };

  const goBack = () => {
    if (step > 1) {
      setStep((s) => s - 1);
      return;
    }

    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/(resident)');
  };

  const handleDescriptionNext = () => {
    setSubmitError('');
    if (!categoryId && categories.length > 0) {
      setCategoryId(getCategoryId(categories[0]));
    }

    setStep(2);
  };

  const handleLocationNext = () => {
    if (latitude == null || longitude == null) {
      const errors = validateStep(2);
      replaceErrors(errors);
      toast.error(errors.location || 'Vui lòng đánh dấu vị trí cụ thể trên bản đồ.');
      return;
    }

    setStep(3);
  };

  const handleUseCurrentLocation = async () => {
    if (locating) return;
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        toast.error('Quyền truy cập vị trí bị từ chối.');
        return;
      }

      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        toast.error('Dịch vụ vị trí đang tắt. Hãy bật GPS hoặc chọn vị trí trên bản đồ.');
        return;
      }

      let result: Location.LocationObject | null = null;
      try {
        result = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('GPS_TIMEOUT')), GPS_TIMEOUT_MS);
          }),
        ]);
      } catch {
        result = await Location.getLastKnownPositionAsync({
          maxAge: 120_000,
          requiredAccuracy: 250,
        });
      }

      if (!result) {
        toast.error('Chưa nhận được vị trí. Hãy thử lại ngoài trời hoặc chọn trực tiếp trên bản đồ.');
        return;
      }

      setLatitude(result.coords.latitude);
      setLongitude(result.coords.longitude);
      setLocationAccuracyMeters(result.coords.accuracy == null ? null : Math.max(0, Math.round(result.coords.accuracy)));
      setGeoSource('GPS');
      setLocationText((current) => current || 'Vị trí hiện tại');
      clearFieldError('location');
    } catch {
      toast.error('Không thể lấy vị trí hiện tại. Hãy chọn vị trí trực tiếp trên bản đồ.');
    } finally {
      setLocating(false);
    }
  };

  const handleAddAttachment = (uri: string, fileName: string, type: string, size?: number) => {
    if (attachments.length >= MAX_ATTACHMENT_COUNT) {
      toast.error(`Chỉ được chọn tối đa ${MAX_ATTACHMENT_COUNT} tệp minh chứng.`);
      return;
    }
    const normalizedType = type || (uri.toLowerCase().endsWith('.mp4') ? 'video/mp4' : 'image/jpeg');

    const normalizedSize = size ?? 0;
    const isVideo = normalizedType.startsWith('video/');
    const sizeLimit = isVideo ? MAX_VIDEO_SIZE_BYTES : MAX_IMAGE_SIZE_BYTES;
    if (normalizedSize > sizeLimit && normalizedSize > 0) {
      toast.error(`${isVideo ? 'Video' : 'Ảnh'} không được vượt quá ${formatFileSize(sizeLimit)}.`);
      return;
    }
    if (attachments.reduce((sum, item) => sum + (item.size || 0), 0) + normalizedSize > MAX_TOTAL_ATTACHMENT_SIZE_BYTES && normalizedSize > 0) {
      toast.error(`Tổng dung lượng minh chứng không được vượt quá ${formatFileSize(MAX_TOTAL_ATTACHMENT_SIZE_BYTES)}.`);
      return;
    }
    setAttachments((current) => [...current, { uri, name: fileName, type: normalizedType, size: normalizedSize }]);
    clearFieldError('attachments');
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((current) => current.filter((_, idx) => idx !== index));
    clearFieldError('attachments');
  };

  const extractCreatedFeedback = (result: any) => result?.data ?? result ?? null;
  const extractFeedbackId = (result: any) => {
    const payload = extractCreatedFeedback(result);
    return payload?.feedbackId ?? payload?.id ?? result?.feedbackId ?? result?.id ?? null;
  };

  const handleSubmit = async () => {
    setSubmitError('');
    const errors = {
      ...validateStep(1),
      ...validateStep(2),
      ...validateStep(3),
    };
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const firstStep = [1, 2, 3].find((stepId) => Object.keys(validateStep(stepId)).length > 0);
      if (firstStep) setStep(firstStep);
      toast.error(Object.values(errors)[0]);
      return;
    }

    const payload: CreateFeedbackPayload = {
      categoryId: String(categoryId),
      title: title.trim(),
      description: description.trim(),
      areaId: String(areaId),
      priority,
      locationText: locationText.trim(),
      latitude: latitude ?? undefined,
      longitude: longitude ?? undefined,
      locationAccuracyMeters: locationAccuracyMeters ?? undefined,
      geoSource,
      attachments: attachments.map((item) => ({
        uri: item.uri,
        name: item.name,
        type: item.type,
      })),
    };

    setSubmitting(true);
    try {
      const response = await feedbackApi.create(payload);
      const createdFeedback = extractCreatedFeedback(response);
      const newFeedbackId = extractFeedbackId(response);

      await AsyncStorage.removeItem(`${DRAFT_STORAGE_PREFIX}:mobile`);
      // Invalidate all feedback-related queries so lists refresh (tickets, stats, feeds)
      qc.invalidateQueries({ queryKey: reportingKeys.lists() });
      qc.invalidateQueries({ queryKey: communityKeys.feeds() });

      // Pre-populate query cache with newly created feedback so detail screen loads instantly
      if (newFeedbackId && createdFeedback) {
        qc.setQueryData(reportingKeys.detail(String(newFeedbackId)), createdFeedback);
      }

      toast.success('Phản ánh đã được gửi thành công!');

      // Navigate to newly created ticket detail instead of list
      if (newFeedbackId) {
        router.replace(`/(resident)/tickets/${newFeedbackId}`);
      } else {
        router.replace('/(resident)/tickets');
      }
    } catch (error) {
      if (__DEV__) console.warn('Create feedback failed');
      const resp = (error as any)?.response;
      const serverMessage = resp?.data?.message || (error as any)?.message || '';
      if (resp?.status === 413) {
        toast.error(`Tệp gửi lên quá lớn (HTTP 413). Vui lòng giảm kích thước ảnh/video hoặc gửi ít tệp hơn. Tối đa ${formatFileSize(MAX_TOTAL_ATTACHMENT_SIZE_BYTES)}.`);
      } else if (typeof serverMessage === 'string' && serverMessage.includes('BoundaryGeoJson')) {
        // Graceful fallback: retry once without areaId so user can still submit
        try {
          const fallback: any = { ...payload };

          delete fallback.areaId;
          const fallbackResponse = await feedbackApi.create(fallback);
          const fallbackCreatedFeedback = extractCreatedFeedback(fallbackResponse);
          const fallbackFeedbackId = extractFeedbackId(fallbackResponse);

          await AsyncStorage.removeItem(`${DRAFT_STORAGE_PREFIX}:mobile`);
          qc.invalidateQueries({ queryKey: reportingKeys.lists() });
          qc.invalidateQueries({ queryKey: communityKeys.feeds() });

          // Pre-populate query cache with newly created feedback
          if (fallbackFeedbackId && fallbackCreatedFeedback) {
            qc.setQueryData(reportingKeys.detail(String(fallbackFeedbackId)), fallbackCreatedFeedback);
          }

          toast.success('Phản ánh đã được gửi (không kèm khu vực do lỗi hình dạng).');

          // Navigate to newly created ticket detail
          if (fallbackFeedbackId) {
            router.replace(`/(resident)/tickets/${fallbackFeedbackId}`);
          } else {
            router.replace('/(resident)/tickets');
          }
        } catch (err2) {
          if (__DEV__) console.warn('Fallback submit without area failed');
          toast.error('Khu vực được chọn chứa dữ liệu hình dạng không hợp lệ. Vui lòng chọn khu vực khác hoặc liên hệ quản trị viên.');
        }
      } else {
        toast.error('Gửi phản ánh thất bại. Vui lòng thử lại.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader
        showBack
        onBack={goBack}
        title={STEPS[step - 1]}
      />
      <AppStepBar currentStep={step} totalSteps={STEPS.length} labels={STEPS} />
      {draftNotice ? (
        <View style={styles.noticeBar}>
          <Icon name="info" size={14} color={colors.primary} />
          <Text className="text-xs text-primary flex-1 ml-2">{draftNotice}</Text>
        </View>
      ) : null}
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={styles.flex1}>
          <ScrollView
            ref={scrollRef}
            style={styles.flex1}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 120, flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            contentInsetAdjustmentBehavior="never"
          >
            {step === 1 && (
              <StepDescription
                title={title}
                description={description}
                onTitleChange={(value) => {
                  setTitle(value);
                  clearFieldError('title');
                }}
                onDescChange={(value) => {
                  setDescription(value);
                  clearFieldError('description');
                }}
                titleError={fieldErrors.title}
                descriptionError={fieldErrors.description}
              />
            )}
            {step === 2 && (
              <StepLocation
                areaId={areaId}
                areas={areas}
                locationText={locationText}
                latitude={latitude}
                longitude={longitude}
                onAreaChange={(value) => {
                  setAreaId(value);
                  clearFieldError('areaId');
                }}
                onLocationChange={(value) => {

                  setLocationText(value);
                  clearFieldError('location');
                }}
                onLatitudeChange={(value) => {
                  const next = value === '' ? null : Number(value);
                  setLatitude(Number.isFinite(next) ? next : null);
                  setLocationAccuracyMeters(null);
                  setGeoSource('MANUAL');
                  clearFieldError('location');
                }}
                onLongitudeChange={(value) => {
                  const next = value === '' ? null : Number(value);
                  setLongitude(Number.isFinite(next) ? next : null);
                  setLocationAccuracyMeters(null);
                  setGeoSource('MANUAL');
                  clearFieldError('location');
                }}
                onAddressSelect={(address, nextLatitude, nextLongitude) => {
                  setLocationText(address);
                  setLatitude(nextLatitude);
                  setLongitude(nextLongitude);
                  setLocationAccuracyMeters(null);
                  setGeoSource('MANUAL');
                  clearFieldError('location');
                }}
                onUseCurrentLocation={handleUseCurrentLocation}
                locating={locating}
                loading={areasLoading}
                error={fieldErrors.areaId}
                locationError={fieldErrors.location}
                latitudeError={fieldErrors.location}
                longitudeError={fieldErrors.location}
              />
            )}
            {step === 3 && (
              <StepAttachments
                attachments={attachments}
                onAdd={handleAddAttachment}
                onRemove={handleRemoveAttachment}
                error={fieldErrors.attachments}
              />
            )}
            {step === 4 && (
              <StepReview
                title={title}
                description={description}
                categoryName={selectedCategory?.categoryName ?? selectedCategory?.name}
                areaName={selectedArea?.areaName ?? selectedArea?.name}
                locationText={locationText}
                priority={priority}
                attachments={attachments}
              />
            )}
            {submitError ? <Text style={styles.submitError}>{submitError}</Text> : null}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
      <View style={[styles.bottomBar, { paddingBottom: Math.max(16, insets.bottom + 8) }]}>
        {step > 1 && (
          <AppButton variant="outline" size="lg" onPress={goBack} className="flex-1">
            Quay lại
          </AppButton>
        )}
        {(() => {
          const isLastStep = step === STEPS.length;
          if (!isLastStep) {
            return (
              <AppButton size="lg" onPress={goToNext} disabled={!isStepValid} className="flex-1" rightIcon={<Icon name="arrow-right" size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />}>
                Tiếp theo
              </AppButton>
            );
          }
          return (
            <AppButton size="lg" onPress={handleSubmit} disabled={!isStepValid} loading={submitting} className="flex-1" rightIcon={<Icon name="send" size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />}>
              Gửi
            </AppButton>
          );
        })()}
      </View>
    </SafeAreaView>
  );
}

const CARD_W = (W - 52) / 2;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  flex1: { flex: 1 },
  stepBody: { paddingHorizontal: 20, paddingTop: 20 },
  noticeBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#DBEAFE' },
  fieldError: { color: '#EF4444', fontSize: 12, marginTop: 8, fontFamily: 'Geist-Regular' },
  submitError: { color: '#EF4444', fontSize: 13, marginHorizontal: 20, marginBottom: 12, fontFamily: 'Geist-Medium' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  categoryCard: { width: CARD_W, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 18, borderWidth: 1.5, borderColor: '#E2E8F0', position: 'relative' },
  categoryCardActive: { borderColor: colors.primary, backgroundColor: '#F0F7FF' },
  categoryIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  categoryIconActive: { backgroundColor: colors.primary },
  categoryLabel: { fontFamily: 'Geist-SemiBold', fontSize: 13, color: '#0F172A', lineHeight: 18, marginBottom: 4 },
  categoryLabelActive: { color: colors.primary },
  categorySubtitle: { fontFamily: 'Geist-Regular', fontSize: 11, color: '#64748B', lineHeight: 15 },
  categoryCheck: { position: 'absolute', top: 10, right: 10, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  aiTipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 16 },
  aiTip: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#EFF6FF', borderRadius: 14, padding: 14 },
  nextInlineButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 2 },
  wizardTitle: { fontFamily: 'Geist-Bold', fontSize: 24, lineHeight: 31, color: '#0F172A', marginBottom: 4 },
  wizardSubtitle: { fontFamily: 'Geist-Regular', fontSize: 13, color: '#64748B', lineHeight: 19, marginBottom: 16 },
  stepProgress: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },

  progressLabel: { backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: '#BFDBFE' },
  progressLabelText: { fontFamily: 'Geist-SemiBold', fontSize: 10, color: colors.primary, textTransform: 'uppercase' },
  sectionLabel: { fontFamily: 'Geist-Medium', fontSize: 13, color: '#334155', marginBottom: 10 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  miniChip: { backgroundColor: '#EFF6FF', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#BFDBFE' },
  miniChipText: { fontFamily: 'Geist-Medium', fontSize: 11, color: colors.primary },
  categorySectionCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 14 },
  formCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 18, borderWidth: 1, borderColor: '#E2E8F0' },
  locationPanel: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 18, borderWidth: 1, borderColor: '#E2E8F0' },
  mapSearchOverlay: { position: 'absolute', top: 12, left: 12, right: 12, zIndex: 20, elevation: 12, padding: 10, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.97)', borderWidth: 1, borderColor: '#DBEAFE', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.14, shadowRadius: 14 },
  addressSearchStatus: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, paddingHorizontal: 4 },
  addressSearchStatusText: { fontFamily: 'Geist-Medium', fontSize: 12, color: '#475569' },
  addressSuggestionList: { width: '100%', marginTop: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#DBEAFE', borderRadius: 14, backgroundColor: '#FFFFFF' },
  addressSuggestionItem: { width: '100%', minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  addressSuggestionItemLast: { borderBottomWidth: 0 },
  addressSuggestionItemPressed: { backgroundColor: '#EFF6FF' },
  addressSuggestionIcon: { width: 30, height: 30, flexShrink: 0, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFF6FF' },
  addressSuggestionCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 0, alignSelf: 'stretch', justifyContent: 'center' },
  addressSuggestionText: { fontFamily: 'Geist-SemiBold', fontSize: 13, lineHeight: 18, color: '#0F172A', includeFontPadding: false },
  addressSuggestionHint: { marginTop: 2, fontFamily: 'Geist-Regular', fontSize: 10, lineHeight: 14, color: '#64748B', includeFontPadding: false },
  addressSearchMessage: { marginTop: 8, paddingHorizontal: 4, fontFamily: 'Geist-Regular', fontSize: 12, lineHeight: 18, color: '#64748B' },
  locationMapCard: { backgroundColor: '#F8FAFC', borderRadius: 24, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 12 },
  mapHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mapTitle: { fontFamily: 'Geist-SemiBold', fontSize: 14, color: '#0F172A' },
  mapSubtitle: { fontFamily: 'Geist-Regular', fontSize: 11, color: '#64748B', marginTop: 2 },
  mapButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EFF6FF', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: '#BFDBFE' },
  mapButtonDisabled: { opacity: 0.65 },
  mapButtonText: { fontFamily: 'Geist-Medium', fontSize: 11, color: colors.primary },
  mapInner: { marginTop: 12, minHeight: 300, height: 300, borderRadius: 16, backgroundColor: '#EAF2F8', overflow: 'hidden', borderWidth: 1, borderColor: '#CBD5E1', position: 'relative' },
  mapMetaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 10, paddingHorizontal: 2 },
  mapMetaContent: { flex: 1 },
  mapText: { fontFamily: 'Geist-Medium', fontSize: 12, color: '#334155' },
  mapHelperText: { fontFamily: 'Geist-Regular', fontSize: 10, color: '#64748B', marginTop: 4 },
  areaFieldBlock: { marginTop: 0 },
  uploadPanel: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 18, borderWidth: 1, borderColor: '#E2E8F0' },
  uploadActions: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  areaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  areaChip: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  areaChipActive: { borderColor: colors.primary, backgroundColor: '#EFF6FF' },
  areaChipText: { fontSize: 13, color: '#334155', fontFamily: 'Geist-Medium' },
  areaChipTextActive: { color: colors.primary },
  coordRow: { flexDirection: 'row', marginBottom: 10 },
  warningBox: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#EFF6FF', borderRadius: 14, padding: 12, marginTop: 10 },
  duplicateList: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12, marginTop: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  addImgBtn: { backgroundColor: '#EFF6FF', borderRadius: 16, paddingVertical: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#BFDBFE', borderStyle: 'dashed' },
  imgToolbar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  addPrimaryBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 },
  addPrimaryBtnText: { fontFamily: 'Geist-SemiBold', fontSize: 13, color: '#FFFFFF' },
  secondaryActionBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' },
  imgGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  imgItem: { position: 'relative', width: '48%' },
  imgPreview: { width: '100%', height: 120, borderRadius: 14, backgroundColor: '#E2E8F0' },
  videoPreview: { width: '100%', height: 120, borderRadius: 14, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  imgRemoveBtn: { position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
  noImgBox: { height: 150, backgroundColor: '#F8FAFC', borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E2E8F0', borderStyle: 'dashed' },
  reviewRow: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#F1F5F9' },
  reviewIcon: { marginTop: 2, marginRight: 12 },
  reviewPreview: { width: 60, height: 60, borderRadius: 10, overflow: 'hidden', backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  reviewImage: { width: 60, height: 60 },
  trustBox: { backgroundColor: '#F0FDF4', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#BBF7D0', marginTop: 16 },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  trustIconWrap: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#22C55E', alignItems: 'center', justifyContent: 'center' },
  trustText: { flex: 1, fontFamily: 'Geist-Medium', fontSize: 12, color: '#166534', lineHeight: 18 },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 12, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#F1F5F9', zIndex: 50 },
  floatingNext: { position: 'absolute', right: 20, bottom: 92, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 6, zIndex: 60 },
  headerNext: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  selectAreaInput: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, marginBottom: 12 },
  selectAreaText: { fontFamily: 'Geist-Medium', fontSize: 14, color: '#0F172A' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: '60%' },
  modalItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  modalActions: { marginTop: 12, alignItems: 'flex-end' },
  modalCloseBtn: { paddingHorizontal: 12, paddingVertical: 8 },
});
