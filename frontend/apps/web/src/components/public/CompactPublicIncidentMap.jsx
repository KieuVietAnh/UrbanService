import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MapContainer,
  Marker,
  Popup,
  useMap,
} from 'react-leaflet';
import * as Lucide from 'lucide-react';
import 'leaflet/dist/leaflet.css';

import ConfiguredMapTileLayer from '../maps/ConfiguredMapTileLayer';
import { useTheme } from '../../contexts/ThemeContext';
import { createIncidentMarkerIcon } from '../maps/incidentMarkerIcon';

const DEFAULT_CENTER = [10.77653, 106.700981];
const DEFAULT_ZOOM = 12;

const getIncidentId = (item) => (
  item?.incidentId || item?.id || item?.feedbackId || item?.ticketId || ''
);

const parseCoordinatesFromLocationText = (locationText) => {
  if (!locationText || typeof locationText !== 'string') {
    return { latitude: Number.NaN, longitude: Number.NaN };
  }

  const match = locationText.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return { latitude: Number.NaN, longitude: Number.NaN };

  return {
    latitude: Number(match[1]),
    longitude: Number(match[2]),
  };
};

const normalizeMapItem = (item) => {
  const parsedLocation = parseCoordinatesFromLocationText(item?.locationText);

  return {
    ...item,
    incidentId: getIncidentId(item),
    latitude: Number(
      item?.latitude ??
      item?.lat ??
      item?.location?.latitude ??
      item?.location?.lat ??
      parsedLocation.latitude
    ),
    longitude: Number(
      item?.longitude ??
      item?.lng ??
      item?.lon ??
      item?.location?.longitude ??
      item?.location?.lng ??
      item?.location?.lon ??
      parsedLocation.longitude
    ),
  };
};

function FitCompactBounds({ incidents }) {
  const map = useMap();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      map.invalidateSize();

      if (incidents.length === 0) {
        map.setView(DEFAULT_CENTER, DEFAULT_ZOOM, { animate: false });
        return;
      }

      if (incidents.length === 1) {
        map.setView(
          [incidents[0].latitude, incidents[0].longitude],
          15,
          { animate: false }
        );
        return;
      }

      map.fitBounds(
        incidents.map((incident) => [incident.latitude, incident.longitude]),
        {
          padding: [34, 34],
          maxZoom: 15,
          animate: false,
        }
      );
    }, 90);

    return () => window.clearTimeout(timer);
  }, [incidents, map]);

  return null;
}

const CompactPublicIncidentMapStyles = () => (
  <style>{`
    .compact-public-incident-map .leaflet-container {
      height: 100%;
      width: 100%;
      background: #dbeafe;
    }

    .compact-public-incident-map .leaflet-control-zoom,
    .compact-public-incident-map .leaflet-control-attribution {
      border: 1px solid rgba(148, 163, 184, 0.42) !important;
      border-radius: 10px !important;
      overflow: hidden;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12) !important;
    }

    .compact-public-incident-map .leaflet-control-zoom a,
    .compact-public-incident-map .leaflet-control-attribution {
      background: rgba(255, 255, 255, 0.92) !important;
      color: #475569 !important;
    }

    .compact-public-incident-map .leaflet-popup-content-wrapper,
    .compact-public-incident-map .leaflet-popup-tip {
      border: 1px solid rgba(203, 213, 225, 0.86);
      background: rgba(255, 255, 255, 0.98);
      color: #0f172a;
    }

    .compact-public-incident-map .leaflet-popup-content-wrapper {
      border-radius: 14px;
    }

    html[data-theme="dark"] .compact-public-incident-map .leaflet-container {
      background: #10223a;
    }

    html[data-theme="dark"] .compact-public-incident-map .leaflet-control-zoom a,
    html[data-theme="dark"] .compact-public-incident-map .leaflet-control-attribution {
      border-color: rgba(96, 165, 250, 0.16) !important;
      background: rgba(7, 20, 39, 0.92) !important;
      color: #dbeafe !important;
    }

    html[data-theme="dark"] .compact-public-incident-map .leaflet-popup-content-wrapper,
    html[data-theme="dark"] .compact-public-incident-map .leaflet-popup-tip {
      border-color: rgba(96, 165, 250, 0.18);
      background: #0b1830;
      color: #f8fafc;
    }
  `}</style>
);

const CompactPublicIncidentMap = ({
  items = [],
  loading = false,
  error = '',
  fullMapPath = '/community/map#incident-map',
  detailPathBuilder = (incidentId) => `/community/feed/${incidentId}`,
  detailStateBuilder = () => undefined,
  mapLabel = 'Bản đồ sự cố',
  showOpenMapCard = true,
  minHeight = 320,
  compact = false,
  deferUntilTilesReady = false,
  interactive = true,
  showPopup = true,
}) => {
  const { theme } = useTheme();
  const [tilesReady, setTilesReady] = useState(false);
  const [tilesUnavailable, setTilesUnavailable] = useState(false);

  const incidents = useMemo(
    () => items
      .map(normalizeMapItem)
      .filter((item) => (
        Number.isFinite(item.latitude) &&
        item.latitude >= -90 &&
        item.latitude <= 90 &&
        Number.isFinite(item.longitude) &&
        item.longitude >= -180 &&
        item.longitude <= 180
      )),
    [items]
  );

  useEffect(() => {
    setTilesReady(false);
    setTilesUnavailable(false);
  }, [theme]);

  const statusText = loading
    ? 'Đang tải vị trí'
    : error
      ? 'Mở bản đồ sự cố'
      : incidents.length > 0
        ? `${incidents.length} vị trí đang hiển thị`
        : 'Chưa có vị trí công khai';

  return (
    <>
      <CompactPublicIncidentMapStyles />
      <div
        className={`compact-public-incident-map relative h-full overflow-hidden border border-[var(--public-border)] ${
          compact
            ? 'rounded-[18px] bg-slate-100 dark:bg-slate-900'
            : 'rounded-[22px] bg-[var(--public-surface-soft)]'
        }`}
        style={{ minHeight }}
      >
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          scrollWheelZoom={false}
          dragging={interactive}
          doubleClickZoom={interactive}
          touchZoom={interactive}
          boxZoom={interactive}
          keyboard={interactive}
          zoomControl={interactive}
          className="h-full w-full"
          style={{ minHeight }}
        >
          <ConfiguredMapTileLayer
            key={theme}
            onReady={deferUntilTilesReady ? () => {
              setTilesReady(true);
              setTilesUnavailable(false);
            } : undefined}
            onUnavailable={deferUntilTilesReady ? () => {
              setTilesUnavailable(true);
              setTilesReady(false);
            } : undefined}
          />
          <FitCompactBounds incidents={incidents} />

          {incidents.map((incident) => (
            <Marker
              key={incident.incidentId || `${incident.latitude}:${incident.longitude}`}
              position={[incident.latitude, incident.longitude]}
              icon={createIncidentMarkerIcon(incident.status, { size: 32 })}
              interactive={interactive}
            >
              {showPopup && interactive ? (
                <Popup minWidth={220} maxWidth={270}>
                  <div className="space-y-2 font-sans">
                    <h3 className="text-sm font-semibold leading-5">
                      {incident.title || 'Sự vụ đô thị'}
                    </h3>
                    <p className="text-xs leading-5 opacity-70">
                      {incident.areaName || incident.locationText || 'Chưa xác định khu vực'}
                    </p>
                    {incident.incidentId ? (
                      <Link
                        to={detailPathBuilder(incident.incidentId)}
                        state={detailStateBuilder(incident)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600"
                      >
                        Xem chi tiết
                        <Lucide.ArrowUpRight size={13} aria-hidden="true" />
                      </Link>
                    ) : null}
                  </div>
                </Popup>
              ) : null}
            </Marker>
          ))}
        </MapContainer>

        {deferUntilTilesReady && !tilesReady && !tilesUnavailable ? (
          <div className="pointer-events-none absolute inset-0 z-[450] flex items-center justify-center bg-slate-100/95 backdrop-blur-[1px] dark:bg-slate-900/95">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-300">
              <Lucide.LoaderCircle size={16} className="animate-spin text-blue-600" />
              Đang tải bản đồ...
            </div>
          </div>
        ) : null}

        {deferUntilTilesReady && tilesUnavailable ? (
          <div className="absolute inset-0 z-[460] flex items-center justify-center bg-slate-50 px-5 text-center dark:bg-slate-900">
            <div>
              <Lucide.MapPin size={20} className="mx-auto text-blue-600" />
              <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">Không tải được nền bản đồ</p>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Vị trí sự vụ vẫn được ghi nhận. Bạn có thể mở bản đồ lớn để thử lại.</p>
            </div>
          </div>
        ) : null}

        {showOpenMapCard ? (
          <Link
            to={fullMapPath}
            state={{ focusMap: true }}
            className="absolute bottom-4 left-4 z-[500] flex w-[min(250px,calc(100%-2rem))] items-center gap-3 rounded-2xl border border-white/75 bg-white/94 p-3.5 text-left shadow-[0_14px_34px_rgba(15,23,42,0.18)] backdrop-blur transition hover:-translate-y-0.5 hover:border-blue-300 dark:border-white/10 dark:bg-slate-950/90 dark:hover:border-blue-400/35"
            aria-label="Mở bản đồ sự cố đầy đủ"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white" aria-hidden="true">
              <Lucide.MapPinned size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-600 dark:text-blue-300">
                {mapLabel}
              </span>
              <strong className="mt-1 block truncate text-sm font-semibold text-slate-950 dark:text-white">
                {statusText}
              </strong>
            </span>
            <Lucide.ArrowUpRight size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
          </Link>
        ) : null}
      </div>
    </>
  );
};

export default CompactPublicIncidentMap;
