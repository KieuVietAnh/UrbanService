import { useEffect, useMemo, useState } from 'react';

import { MAP_GEOCODING_REVERSE_URL } from '../config/mapConfig';

const CACHE_PREFIX = 'urbanmind:detail-location:';
let lastReverseRequestAt = 0;

const normalizeText = (value) => String(value || '').trim();

export const isLegacyLocationText = (value) => {
  const text = normalizeText(value).toLowerCase();
  if (!text) return true;

  return (
    text === 'vị trí hiện tại' ||
    text === 'chưa có địa chỉ' ||
    text === 'chưa có địa điểm' ||
    text.startsWith('vị trí đã chọn:') ||
    text.startsWith('vị trí gần đúng:') ||
    /^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/.test(text)
  );
};

const isValidCoordinate = (value, min, max) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max;
};

const getCachedLocation = (key) => {
  if (typeof window === 'undefined') return '';

  try {
    return normalizeText(window.sessionStorage.getItem(`${CACHE_PREFIX}${key}`));
  } catch {
    return '';
  }
};

const setCachedLocation = (key, value) => {
  if (typeof window === 'undefined' || !value) return;

  try {
    window.sessionStorage.setItem(`${CACHE_PREFIX}${key}`, value);
  } catch {
    // Session storage may be unavailable.
  }
};

const waitForReverseRateLimit = async () => {
  if (typeof window === 'undefined') return;

  const elapsed = Date.now() - lastReverseRequestAt;
  if (elapsed < 1000) {
    await new Promise((resolve) => {
      window.setTimeout(resolve, 1000 - elapsed);
    });
  }
  lastReverseRequestAt = Date.now();
};

export const useResolvedLocationText = ({
  locationText,
  areaName,
  latitude,
  longitude,
}) => {
  const normalizedLocation = normalizeText(locationText);
  const normalizedArea = normalizeText(areaName);
  const hasHumanLocation = normalizedLocation && !isLegacyLocationText(normalizedLocation);

  const fallbackText = useMemo(
    () => (
      hasHumanLocation
        ? normalizedLocation
        : normalizedArea || 'Chưa xác định vị trí'
    ),
    [hasHumanLocation, normalizedArea, normalizedLocation]
  );

  const [resolvedText, setResolvedText] = useState(fallbackText);

  useEffect(() => {
    setResolvedText(fallbackText);
  }, [fallbackText]);

  useEffect(() => {
    if (hasHumanLocation) return undefined;
    if (!isValidCoordinate(latitude, -90, 90) || !isValidCoordinate(longitude, -180, 180)) {
      return undefined;
    }

    const lat = Number(latitude);
    const lng = Number(longitude);
    const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    const cached = getCachedLocation(cacheKey);

    if (cached) {
      setResolvedText(cached);
      return undefined;
    }

    let cancelled = false;

    const resolveLocation = async () => {
      try {
        await waitForReverseRateLimit();

        const params = new URLSearchParams({
          lat: String(lat),
          lon: String(lng),
          format: 'jsonv2',
          addressdetails: '1',
          zoom: '18',
          'accept-language': 'vi',
        });

        const response = await fetch(
          `${MAP_GEOCODING_REVERSE_URL}?${params.toString()}`,
          { headers: { Accept: 'application/json' } }
        );

        if (!response.ok) return;

        const payload = await response.json();
        const displayName = normalizeText(payload?.display_name);
        if (!displayName || cancelled) return;

        setCachedLocation(cacheKey, displayName);
        setResolvedText(displayName);
      } catch (error) {
        console.warn('Unable to resolve legacy feedback location', error);
      }
    };

    void resolveLocation();

    return () => {
      cancelled = true;
    };
  }, [hasHumanLocation, latitude, longitude]);

  return resolvedText;
};
