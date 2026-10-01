import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import * as Lucide from 'lucide-react';
import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet/dist/leaflet.css';

import { buildExternalMapUrl } from '../../config/mapConfig';
import ConfiguredMapTileLayer from './ConfiguredMapTileLayer';

const markerIcon = new L.Icon({
  iconUrl: markerIconUrl,
  shadowUrl: markerShadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  shadowSize: [41, 41],
});

const isValidCoordinate = (value, min, max) => {
  const coordinate = Number(value);
  return Number.isFinite(coordinate) && coordinate >= min && coordinate <= max;
};

function SyncIncidentPosition({ position }) {
  const map = useMap();

  useEffect(() => {
    map.setView(position, 16, { animate: false });
  }, [map, position]);

  return null;
}

function ResizeIncidentMap() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const parent = container.parentElement;
    const timeoutIds = [];
    let frameId = 0;

    const refreshSize = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => map.invalidateSize(false));
      });
    };

    refreshSize();
    timeoutIds.push(window.setTimeout(refreshSize, 120));
    timeoutIds.push(window.setTimeout(refreshSize, 320));

    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(refreshSize);
    observer?.observe(container);
    if (parent) observer?.observe(parent);
    window.addEventListener('resize', refreshSize);
    parent?.addEventListener('transitionend', refreshSize);

    return () => {
      window.cancelAnimationFrame(frameId);
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
      observer?.disconnect();
      window.removeEventListener('resize', refreshSize);
      parent?.removeEventListener('transitionend', refreshSize);
    };
  }, [map]);

  return null;
}

export function IncidentLocationMapCard({
  incidentId,
  latitude,
  longitude,
  locationText,
  areaName,
  tone = 'cyan',
  onOpenInternalMap,
  compact = false,
}) {
  const [tileLoadFailed, setTileLoadFailed] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const lat = Number(latitude);
  const lng = Number(longitude);
  const hasCoordinates = isValidCoordinate(lat, -90, 90) && isValidCoordinate(lng, -180, 180);
  const position = useMemo(() => [lat, lng], [lat, lng]);
  const headingId = `incident-location-${incidentId || 'detail'}`;
  const externalMapUrl = buildExternalMapUrl(lat, lng);
  const blueTone = tone === 'blue';

  useEffect(() => {
    setTileLoadFailed(false);
    setMapReady(false);
  }, [lat, lng]);

  return (
    <section
      className={`admin-panel flex flex-col overflow-hidden border-t-[3px] ${compact ? 'h-auto' : 'h-full'} ${
        blueTone
          ? 'border-t-blue-500 shadow-[0_18px_44px_rgba(37,99,235,0.07)]'
          : 'border-t-cyan-500 shadow-[0_18px_44px_rgba(6,182,212,0.07)]'
      }`}
      aria-labelledby={headingId}
    >
      <header className="shrink-0 flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:border-slate-800">
        <h2 id={headingId} className="admin-section-title">Bản đồ vị trí sự vụ</h2>

        {hasCoordinates ? (
          <div className="flex shrink-0 items-center gap-2 self-start sm:self-auto">
            {typeof onOpenInternalMap === 'function' ? (
              <button
                type="button"
                onClick={onOpenInternalMap}
                className={`inline-flex min-h-9 items-center justify-center whitespace-nowrap rounded-xl border px-3.5 py-2 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-4 ${
                  blueTone
                    ? 'border-blue-200 bg-blue-50 text-blue-800 hover:border-blue-300 hover:bg-blue-100 focus-visible:ring-blue-100 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200 dark:hover:bg-blue-900/50'
                    : 'border-cyan-200 bg-cyan-50 text-cyan-800 hover:border-cyan-300 hover:bg-cyan-100 focus-visible:ring-cyan-100 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200 dark:hover:bg-cyan-900/50'
                }`}
              >
                Xem trên bản đồ
              </button>
            ) : null}
            <a
              href={externalMapUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center justify-center rounded-xl px-2.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100"
              aria-label="Mở vị trí sự vụ trên Google Maps trong thẻ mới"
              title="Mở bằng Google Maps"
            >
              Mở ngoài
            </a>
          </div>
        ) : null}
      </header>

      {hasCoordinates ? (
        <div
          className={`relative w-full overflow-hidden bg-slate-100 dark:bg-slate-900 ${
            compact ? 'h-56 shrink-0 sm:h-64' : 'min-h-72 flex-1 sm:min-h-80'
          }`}
          role="region"
          aria-label={`Bản đồ sự vụ tại tọa độ ${lat.toFixed(5)}, ${lng.toFixed(5)}`}
        >
          <MapContainer
            center={position}
            zoom={16}
            scrollWheelZoom={false}
            doubleClickZoom
            touchZoom
            boxZoom
            keyboard
            zoomControl
            attributionControl
            className="h-full w-full"
          >
            <ConfiguredMapTileLayer
              onReady={() => {
                setTileLoadFailed(false);
                setMapReady(true);
              }}
              onUnavailable={() => {
                setTileLoadFailed(true);
                setMapReady(true);
              }}
            />
            <SyncIncidentPosition position={position} />
            <ResizeIncidentMap />
            <Marker position={position} icon={markerIcon} />
          </MapContainer>

          {!mapReady ? (
            <div
              className="pointer-events-none absolute inset-0 z-[450] flex items-center justify-center bg-slate-100/92 backdrop-blur-[1px] dark:bg-slate-900/92"
              role="status"
              aria-live="polite"
            >
              <div className="w-full max-w-xs px-6 text-center">
                <div className="mx-auto h-3 w-24 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
                <div className="mx-auto mt-3 h-2.5 w-40 animate-pulse rounded-full bg-slate-200/80 dark:bg-slate-800/80" />
                <p className="mt-4 text-xs font-semibold text-slate-500 dark:text-slate-400">Đang tải bản đồ...</p>
              </div>
            </div>
          ) : null}

          {(areaName || locationText) ? (
            <div className="pointer-events-none absolute bottom-4 left-4 z-[500] max-w-[min(72%,30rem)] rounded-xl border border-white/80 bg-white/94 px-3.5 py-3 shadow-[0_10px_30px_rgba(15,23,42,0.16)] backdrop-blur-md dark:border-slate-700/80 dark:bg-slate-950/90">
              {areaName ? (
                <p className={`text-xs font-bold ${blueTone ? 'text-blue-700 dark:text-blue-300' : 'text-cyan-700 dark:text-cyan-300'}`}>
                  {areaName}
                </p>
              ) : null}
              <p
                className={`line-clamp-2 text-sm leading-5 text-slate-700 dark:text-slate-200 ${areaName ? 'mt-1' : ''}`}
                title={locationText || areaName || 'Chưa có thông tin vị trí'}
              >
                {locationText || areaName || 'Chưa có thông tin vị trí'}
              </p>
            </div>
          ) : null}

          {tileLoadFailed ? (
            <div
              className="absolute inset-x-4 top-4 z-[500] rounded-xl border border-amber-200 bg-amber-50/95 px-3.5 py-3 text-xs leading-5 text-amber-950 shadow-lg backdrop-blur-sm dark:border-amber-900 dark:bg-amber-950/90 dark:text-amber-100"
              role="status"
            >
              Không thể tải nền bản đồ trong mạng hiện tại. Bạn vẫn có thể mở vị trí trên bản đồ quản lý hoặc Google Maps.
            </div>
          ) : null}
        </div>
      ) : (
        <div className={`flex flex-1 items-center justify-center bg-slate-50 px-6 text-center dark:bg-slate-900/60 ${
          compact ? 'min-h-48 py-7 sm:min-h-56' : 'min-h-[300px] py-10'
        }`}>
          <div className="max-w-sm">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-300 shadow-sm ring-1 ring-slate-200 dark:bg-slate-950 dark:text-slate-600 dark:ring-slate-800">
              <Lucide.MapPinOff size={24} aria-hidden="true" />
            </span>
            <h3 className="mt-4 text-sm font-semibold text-slate-700 dark:text-slate-200">Chưa có tọa độ sự vụ</h3>
            <p className="mx-auto mt-1.5 max-w-xs text-xs leading-5 text-slate-400 dark:text-slate-500">
              Chưa có vĩ độ và kinh độ để hiển thị vị trí sự vụ trên bản đồ.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

export default IncidentLocationMapCard;
