import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import * as Lucide from 'lucide-react';
import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet/dist/leaflet.css';

import ConfiguredMapTileLayer from './ConfiguredMapTileLayer';

const markerIcon = new L.Icon({
  iconUrl: markerIconUrl,
  shadowUrl: markerShadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  shadowSize: [41, 41],
});

const publicMarkerIcon = L.divIcon({
  className: '',
  html: `
    <span style="
      display:flex;
      align-items:center;
      justify-content:center;
      width:34px;
      height:34px;
      border-radius:999px;
      border:3px solid rgba(255,255,255,.98);
      background:#2563eb;
      box-shadow:0 8px 22px rgba(15,23,42,.24),0 0 0 6px rgba(37,99,235,.12);
    ">
      <span style="display:block;width:8px;height:8px;border-radius:999px;background:#fff"></span>
    </span>
  `,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

const SyncView = ({ position }) => {
  const map = useMap();

  useEffect(() => {
    map.setView(position, 16, { animate: false });
  }, [map, position]);

  return null;
};

const ResizeMap = () => {
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

    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(refreshSize);

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
};

export const FeedbackLocationMapCard = ({
  feedbackId,
  focusIncidentId = '',
  entityLabel = 'phản ánh',
  latitude,
  longitude,
  locationText,
  areaName,
  className = '',
  variant = 'public',
  externalMapUrl = '',
  internalMapPath = '',
  iconClassName = '',
  iconSize = 18,
}) => {
  const navigate = useNavigate();
  const lat = Number(latitude);
  const lng = Number(longitude);
  const hasCoordinates = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  const position = useMemo(() => [lat, lng], [lat, lng]);

  const isAdmin = variant === 'admin';

  const openFullMap = () => {
    if (externalMapUrl && typeof window !== 'undefined') {
      window.open(externalMapUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    if (isAdmin) {
      navigate(internalMapPath || '/management/map', {
        state: {
          mapState: {
            focusFeedbackId: feedbackId,
            focusLatitude: lat,
            focusLongitude: lng,
          },
        },
      });
      return;
    }

    if (!focusIncidentId) return;

    navigate('/community/map', {
      state: {
        focusIncidentId,
        focusLatitude: lat,
        focusLongitude: lng,
      },
    });
  };

  return (
    <section className={`${isAdmin ? 'admin-panel' : 'rounded-[24px] border border-[var(--public-border)] bg-[var(--public-surface)] shadow-[0_14px_34px_rgba(15,23,42,0.07)]'} overflow-hidden ${className}`} aria-labelledby={`feedback-location-${feedbackId}`}>
      <header className={`flex items-start justify-between gap-3 px-5 py-4 sm:px-6 ${isAdmin ? 'border-b border-slate-200 dark:border-white/10' : ''}`}>
        <div className="flex min-w-0 items-start gap-3">
          <span className={iconClassName || (isAdmin ? 'admin-mini-icon' : 'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600')} aria-hidden="true">
            <Lucide.MapPinned size={iconSize} />
          </span>
          <div className="min-w-0">
            <h2 id={`feedback-location-${feedbackId}`} className={isAdmin ? 'admin-section-title' : 'text-base font-bold'}>{`Vị trí ${entityLabel}`}</h2>
            <p className={isAdmin ? 'mt-1 break-words text-sm font-medium text-slate-700 dark:text-slate-300' : 'mt-1 break-words text-sm font-medium text-slate-700'}>
              {locationText || areaName || 'Chưa xác định vị trí'}
            </p>
            {locationText && areaName && locationText !== areaName ? (
              <p className={isAdmin ? 'mt-1 text-xs text-slate-400 dark:text-slate-500' : 'mt-1 text-xs text-slate-400'}>
                {areaName}
              </p>
            ) : null}
          </div>
        </div>

        {!isAdmin && hasCoordinates && (Boolean(externalMapUrl) || Boolean(focusIncidentId)) ? (
          <button
            type="button"
            onClick={openFullMap}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-blue-600 transition hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
          >
            Mở bản đồ
            <Lucide.ArrowUpRight size={14} aria-hidden="true" />
          </button>
        ) : null}
      </header>

      {hasCoordinates ? (
        <div
          className={`relative block w-full overflow-hidden ${isAdmin ? 'h-72' : 'h-56 border-y border-[var(--public-border)] bg-slate-100'}`}
          role="img"
          aria-label={`Bản đồ vị trí ${entityLabel}`}
        >
          <MapContainer center={position} zoom={16} dragging={false} scrollWheelZoom={false} doubleClickZoom={false} touchZoom={false} boxZoom={false} keyboard={false} zoomControl={false} attributionControl={false} className="pointer-events-none h-full w-full">
            <ConfiguredMapTileLayer />
            <SyncView position={position} />
            <ResizeMap />
            <Marker position={position} icon={isAdmin ? markerIcon : publicMarkerIcon} />
          </MapContainer>
          {!isAdmin ? (
            <div className="pointer-events-none absolute bottom-3 left-3 rounded-xl border border-white/80 bg-white/92 px-3 py-2 text-xs font-medium text-slate-600 shadow-md backdrop-blur">
              Vị trí gần đúng
            </div>
          ) : null}
        </div>
      ) : (
        <div className={`flex h-44 items-center justify-center border-y border-dashed px-5 text-center ${isAdmin ? 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50' : 'border-[var(--public-border)] bg-[var(--public-surface-soft)]'}`}>
          <div>
            <Lucide.MapPin size={24} className={`mx-auto ${isAdmin ? 'text-slate-300 dark:text-slate-600' : 'text-base-content/30'}`} aria-hidden="true" />
            <p className={`mt-2 text-sm ${isAdmin ? 'text-slate-500 dark:text-slate-400' : 'text-base-content/50'}`}>{`${entityLabel.charAt(0).toUpperCase()}${entityLabel.slice(1)} chưa có tọa độ để hiển thị trên bản đồ.`}</p>
          </div>
        </div>
      )}
    </section>
  );
};

export default FeedbackLocationMapCard;
