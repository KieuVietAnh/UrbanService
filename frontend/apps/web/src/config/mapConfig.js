const configuredTileUrl = String(import.meta.env?.VITE_MAP_TILE_URL ?? '').trim();
const configuredFallbackTileUrl = String(import.meta.env?.VITE_MAP_TILE_FALLBACK_URL ?? '').trim();
const configuredGeocodingBaseUrl = String(import.meta.env?.VITE_MAP_GEOCODING_BASE_URL ?? '')
  .trim()
  .replace(/\/+$/, '');

export const MAP_TILE_URL = configuredTileUrl
  || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export const MAP_TILE_FALLBACK_URL = configuredFallbackTileUrl
  || 'https://tile.openstreetmap.de/{z}/{x}/{y}.png';

export const MAP_TILE_PROVIDERS = [...new Set([
  MAP_TILE_URL,
  MAP_TILE_FALLBACK_URL,
].filter(Boolean))];

export const MAP_TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export const MAP_GEOCODING_BASE_URL = configuredGeocodingBaseUrl
  || 'https://nominatim.openstreetmap.org';

export const MAP_GEOCODING_SEARCH_URL = `${MAP_GEOCODING_BASE_URL}/search`;
export const MAP_GEOCODING_REVERSE_URL = `${MAP_GEOCODING_BASE_URL}/reverse`;

const parseCoordinate = (value, min, max) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
};

export const buildExternalMapUrl = (latitude, longitude) => {
  const lat = parseCoordinate(latitude, -90, 90);
  const lng = parseCoordinate(longitude, -180, 180);
  if (lat === null || lng === null) return '';

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
};
