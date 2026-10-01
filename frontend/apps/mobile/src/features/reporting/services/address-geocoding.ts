export type AddressSuggestion = {
  id: string;
  displayName: string;
  latitude: number;
  longitude: number;
};

type ArcGisCandidate = {
  address?: string;
  location?: { x?: number; y?: number };
  attributes?: { Match_addr?: string };
};

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    osm_id?: string | number;
    name?: string;
    street?: string;
    housenumber?: string;
    district?: string;
    city?: string;
    state?: string;
    country?: string;
  };
};

type AddressSearchOptions = {
  areaName?: string;
  viewbox?: string;
  signal?: AbortSignal;
};

const ARCGIS_GEOCODING_URL = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates';
const PHOTON_GEOCODING_URL = 'https://photon.komoot.io/api/';
const resultCache = new Map<string, AddressSuggestion[]>();

const isValidCoordinate = (value: number, min: number, max: number) => (
  Number.isFinite(value) && value >= min && value <= max
);

const isAbortError = (error: unknown) => (
  error instanceof Error && error.name === 'AbortError'
);

const normalizeResults = (results: Array<{
  id?: string | number;
  displayName?: string;
  latitude?: string | number;
  longitude?: string | number;
}>): AddressSuggestion[] => {
  const seen = new Set<string>();
  const normalized: AddressSuggestion[] = [];

  results.forEach((result, index) => {
    const latitude = Number(result.latitude);
    const longitude = Number(result.longitude);
    const displayName = String(result.displayName || '').trim();
    if (
      !displayName ||
      !isValidCoordinate(latitude, -90, 90) ||
      !isValidCoordinate(longitude, -180, 180)
    ) return;

    const key = `${displayName.toLocaleLowerCase('vi')}|${latitude.toFixed(5)}|${longitude.toFixed(5)}`;
    if (seen.has(key)) return;
    seen.add(key);
    normalized.push({
      id: String(result.id || `address-${index}-${latitude}-${longitude}`),
      displayName,
      latitude,
      longitude,
    });
  });

  return normalized.slice(0, 8);
};

const searchWithArcGis = async (
  query: string,
  { areaName, viewbox, signal }: AddressSearchOptions
) => {
  const contextualQuery = areaName
    ? `${query}, ${areaName}, Hồ Chí Minh, Việt Nam`
    : `${query}, Hồ Chí Minh, Việt Nam`;
  const params = new URLSearchParams({
    f: 'json',
    singleLine: contextualQuery,
    maxLocations: '8',
    outFields: 'Match_addr,Addr_type,PlaceName,Type',
    countryCode: 'VNM',
  });

  if (viewbox) {
    const [west, north, east, south] = viewbox.split(',').map(Number);
    if ([west, north, east, south].every(Number.isFinite)) {
      params.set('location', `${(west + east) / 2},${(north + south) / 2}`);
    }
  }

  const response = await fetch(`${ARCGIS_GEOCODING_URL}?${params.toString()}`, {
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) throw new Error(`ArcGIS search failed with status ${response.status}`);

  const payload = await response.json();
  const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
  return normalizeResults((candidates as ArcGisCandidate[]).map((candidate, index) => ({
    id: `arcgis-${index}-${candidate?.location?.y}-${candidate?.location?.x}`,
    displayName: candidate?.address || candidate?.attributes?.Match_addr,
    latitude: candidate?.location?.y,
    longitude: candidate?.location?.x,
  })));
};

const searchWithPhoton = async (
  query: string,
  { areaName, viewbox, signal }: AddressSearchOptions
) => {
  const contextualQuery = areaName
    ? `${query}, ${areaName}, Hồ Chí Minh, Việt Nam`
    : `${query}, Hồ Chí Minh, Việt Nam`;
  const params = new URLSearchParams({
    q: contextualQuery,
    lang: 'vi',
    limit: '8',
  });

  if (viewbox) {
    const [west, north, east, south] = viewbox.split(',').map(Number);
    if ([west, north, east, south].every(Number.isFinite)) {
      params.set('lon', String((west + east) / 2));
      params.set('lat', String((north + south) / 2));
    }
  }

  const response = await fetch(`${PHOTON_GEOCODING_URL}?${params.toString()}`, {
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) throw new Error(`Photon search failed with status ${response.status}`);

  const payload = await response.json();
  const features = Array.isArray(payload?.features) ? payload.features : [];
  return normalizeResults((features as PhotonFeature[]).map((feature, index) => {
    const properties = feature.properties || {};
    const [longitude, latitude] = feature.geometry?.coordinates || [];
    const street = [properties.housenumber, properties.street].filter(Boolean).join(' ');
    return {
      id: properties.osm_id || `photon-${index}-${latitude}-${longitude}`,
      displayName: [
        properties.name,
        street,
        properties.district,
        properties.city,
        properties.state,
        properties.country,
      ].filter(Boolean).join(', '),
      latitude,
      longitude,
    };
  }));
};

export async function searchVietnameseAddresses(
  rawQuery: string,
  options: AddressSearchOptions = {}
): Promise<AddressSuggestion[]> {
  const query = rawQuery.trim();
  if (query.length < 3) return [];

  const cacheKey = JSON.stringify({
    query: query.toLocaleLowerCase('vi'),
    areaName: options.areaName || '',
    viewbox: options.viewbox || '',
  });
  const cached = resultCache.get(cacheKey);
  if (cached) return cached;

  try {
    const primaryResults = await searchWithArcGis(query, options);
    if (primaryResults.length > 0) {
      resultCache.set(cacheKey, primaryResults);
      return primaryResults;
    }
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (__DEV__) console.warn('ArcGIS address search unavailable, using fallback');
  }

  const fallbackResults = await searchWithPhoton(query, options);
  resultCache.set(cacheKey, fallbackResults);
  return fallbackResults;
}
