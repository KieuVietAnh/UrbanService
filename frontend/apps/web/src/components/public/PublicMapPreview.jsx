import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import {
  MapContainer,
  Marker,
  Popup,
  useMap,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

import ConfiguredMapTileLayer from '../maps/ConfiguredMapTileLayer';
import { useIncidentMapData } from '../../hooks/useIncidentMapData';
import { useTheme } from '../../contexts/ThemeContext';
import { createIncidentMarkerIcon, getGroupedIncidentMarkerStatus } from '../maps/incidentMarkerIcon';

const DEFAULT_CENTER = [10.77653, 106.700981];
const DEFAULT_ZOOM = 12;

const PROCESSING_STATUSES = new Set([
  'new',
  'open',
  'verified',
  'pending',
  'assigned',
  'inprogress',
  'submittedforapproval',
  'needrework',
  'resolved',
]);

const ENDED_STATUSES = new Set([
  'approved',
  'closed',
]);

const FILTERS = {
  ALL: 'all',
  PROCESSING: 'processing',
  ENDED: 'ended',
};

const STATUS_LABELS = {
  new: 'Đã tiếp nhận',
  open: 'Đã tiếp nhận',
  verified: 'Đã tiếp nhận',
  pending: 'Chờ xử lý',
  assigned: 'Đã chuyển xử lý',
  inprogress: 'Đang xử lý',
  resolved: 'Đã có kết quả',
  submittedforapproval: 'Đang kiểm tra',
  needrework: 'Cần xử lý lại',
  approved: 'Đã duyệt',
  closed: 'Đã kết thúc',
};

const normalizeStatus = (value) => String(value || '')
  .trim()
  .replace(/[^a-zA-Z0-9]/g, '')
  .toLocaleLowerCase('en-US');

const getStatusLabel = (value) => STATUS_LABELS[normalizeStatus(value)] || value || 'Đang cập nhật';

const getIncidentDetailState = () => ({});

const groupIncidents = (incidents) => {
  const groups = new Map();

  incidents.forEach((incident) => {
    const key = `${incident.latitude.toFixed(5)}:${incident.longitude.toFixed(5)}`;
    const group = groups.get(key);
    if (group) {
      group.items.push(incident);
      return;
    }

    groups.set(key, {
      latitude: incident.latitude,
      longitude: incident.longitude,
      items: [incident],
    });
  });

  return Array.from(groups.values());
};

function FitPreviewBounds({ groups, requestKey }) {
  const map = useMap();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      map.invalidateSize();

      if (groups.length === 0) {
        map.setView(DEFAULT_CENTER, DEFAULT_ZOOM, { animate: true });
        return;
      }

      if (groups.length === 1) {
        map.setView([groups[0].latitude, groups[0].longitude], 15, { animate: true });
        return;
      }

      map.fitBounds(
        groups.map((group) => [group.latitude, group.longitude]),
        {
          padding: [42, 42],
          maxZoom: 15,
          animate: true,
        }
      );
    }, 80);

    return () => window.clearTimeout(timer);
  }, [groups, map, requestKey]);

  return null;
}

const Metric = ({ label, value, tone = 'blue' }) => {
  const toneClass = {
    blue: 'text-blue-600 dark:text-blue-300',
    amber: 'text-amber-600 dark:text-amber-300',
    emerald: 'text-emerald-600 dark:text-emerald-300',
  }[tone];

  return (
    <div className="public-map-preview__metric rounded-2xl border border-slate-200/80 bg-white/85 px-4 py-3 shadow-sm backdrop-blur">
      <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">{label}</span>
      <strong className={`mt-1 block text-2xl font-semibold tracking-tight ${toneClass}`}>{value}</strong>
    </div>
  );
};

const IncidentListItem = ({ incident }) => (
  <Link
    to={`/community/feed/${incident.incidentId}`}
    state={getIncidentDetailState(incident)}
    className="public-map-preview__item group block rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
  >
    <div className="flex items-center justify-between gap-3">
      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.09em] text-blue-700 dark:text-blue-300">
        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
        {getStatusLabel(incident.status)}
      </span>
      <Lucide.ArrowUpRight size={14} className="text-slate-300 transition group-hover:text-blue-500" aria-hidden="true" />
    </div>
    <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-slate-950 dark:text-white">
      {incident.title}
    </h3>
    <p className="mt-2 flex items-center gap-1.5 truncate text-xs text-slate-500 dark:text-slate-400">
      <Lucide.Layers3 size={13} aria-hidden="true" />
      {incident.categoryName || 'Sự vụ đô thị'}
    </p>
  </Link>
);


const PublicMapPreviewStyles = () => (
  <style>{`
    .public-map-preview {
      border-color: rgba(203, 213, 225, 0.84);
      background:
        radial-gradient(circle at 92% 0%, rgba(59, 130, 246, 0.07), transparent 26%),
        rgba(255, 255, 255, 0.9);
    }

    .public-map-preview__header {
      background: rgba(248, 251, 255, 0.78);
    }

    .public-map-preview__aside {
      background:
        radial-gradient(circle at 96% 6%, rgba(59, 130, 246, 0.08), transparent 26%),
        rgba(248, 250, 252, 0.82);
    }

    html[data-theme="dark"] .public-map-preview {
      border-color: rgba(96, 165, 250, 0.2);
      background:
        radial-gradient(circle at 92% 0%, rgba(37, 99, 235, 0.13), transparent 28%),
        linear-gradient(145deg, #0b1830 0%, #071426 100%);
      box-shadow:
        0 30px 90px rgba(0, 0, 0, 0.42),
        inset 0 1px 0 rgba(255, 255, 255, 0.035);
    }

    html[data-theme="dark"] .public-map-preview__header {
      border-color: rgba(96, 165, 250, 0.16);
      background:
        linear-gradient(180deg, rgba(14, 31, 57, 0.96), rgba(9, 23, 44, 0.94));
    }

    html[data-theme="dark"] .public-map-preview__header h2,
    html[data-theme="dark"] .public-map-preview__aside h3,
    html[data-theme="dark"] .public-map-preview__item h3 {
      color: #f8fafc !important;
    }

    html[data-theme="dark"] .public-map-preview__header p,
    html[data-theme="dark"] .public-map-preview__aside p,
    html[data-theme="dark"] .public-map-preview__item p,
    html[data-theme="dark"] .public-map-preview__metric span {
      color: #9fb0c7 !important;
    }

    html[data-theme="dark"] .public-map-preview__aside {
      background:
        radial-gradient(circle at 100% 0%, rgba(8, 145, 178, 0.1), transparent 26%),
        linear-gradient(180deg, rgba(8, 20, 40, 0.98), rgba(6, 17, 34, 0.98));
    }

    html[data-theme="dark"] .public-map-preview__metric,
    html[data-theme="dark"] .public-map-preview__item {
      border-color: rgba(96, 165, 250, 0.17) !important;
      background: rgba(13, 29, 54, 0.88) !important;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.025);
    }

    html[data-theme="dark"] .public-map-preview__item:hover {
      border-color: rgba(56, 189, 248, 0.38) !important;
      background: rgba(17, 38, 70, 0.92) !important;
    }

    html[data-theme="dark"] .public-map-preview .leaflet-control-zoom a,
    html[data-theme="dark"] .public-map-preview .leaflet-control-attribution {
      border-color: rgba(96, 165, 250, 0.18) !important;
      background: rgba(7, 20, 39, 0.92) !important;
      color: #dbeafe !important;
    }

    html[data-theme="dark"] .public-map-preview .leaflet-control-zoom a:hover {
      background: rgba(17, 38, 70, 0.96) !important;
    }

    html[data-theme="dark"] .public-map-preview .leaflet-popup-content-wrapper,
    html[data-theme="dark"] .public-map-preview .leaflet-popup-tip {
      background: #0b1830;
      color: #e8eef8;
    }

    html[data-theme="dark"] .public-map-preview .leaflet-popup-content h3 {
      color: #f8fafc !important;
    }

    html[data-theme="dark"] .public-map-preview .leaflet-popup-content p {
      color: #9fb0c7 !important;
    }
  `}</style>
);

export const PublicMapPreview = ({ compact = false }) => {
  const { theme } = useTheme();
  const { incidents, loading, error, reloadIncidents } = useIncidentMapData();
  const [activeFilter, setActiveFilter] = useState(FILTERS.ALL);
  const [fitRequestKey, setFitRequestKey] = useState(0);

  const validIncidents = useMemo(
    () => (Array.isArray(incidents) ? incidents : []).filter((incident) => (
      Number.isFinite(incident.latitude) && Number.isFinite(incident.longitude)
    )),
    [incidents]
  );

  const processingIncidents = useMemo(
    () => validIncidents.filter((incident) => PROCESSING_STATUSES.has(normalizeStatus(incident.status))),
    [validIncidents]
  );

  const endedIncidents = useMemo(
    () => validIncidents.filter((incident) => ENDED_STATUSES.has(normalizeStatus(incident.status))),
    [validIncidents]
  );

  const visibleIncidents = useMemo(() => {
    if (activeFilter === FILTERS.PROCESSING) return processingIncidents;
    if (activeFilter === FILTERS.ENDED) return endedIncidents;
    return validIncidents;
  }, [activeFilter, endedIncidents, processingIncidents, validIncidents]);

  const groups = useMemo(() => groupIncidents(visibleIncidents), [visibleIncidents]);
  const recentItems = visibleIncidents.slice(0, compact ? 2 : 3);

  const handleFilter = (nextFilter) => {
    setActiveFilter(nextFilter);
    setFitRequestKey((current) => current + 1);
  };

  if (compact) {
    return (
      <>
        <PublicMapPreviewStyles />
        <aside className="public-map-preview public-overview-panel relative overflow-hidden rounded-[28px] border p-4 shadow-[0_18px_48px_rgba(15,23,42,0.10)] backdrop-blur sm:p-5" aria-label="Tổng quan dữ liệu sự vụ công khai">
          <div className="public-overview-divider flex items-center justify-between gap-4 border-b border-slate-100 pb-4 dark:border-white/10">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                Dữ liệu cộng đồng
              </p>
              <h2 className="public-heading mt-1 text-base font-semibold">
                Tổng quan đô thị gần đây
              </h2>
            </div>
            <span className="public-live-badge inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              Dữ liệu trực tiếp
            </span>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.08fr)_minmax(190px,0.92fr)]">
            <div className="relative min-h-[285px] overflow-hidden rounded-[22px] border border-slate-200/80 bg-slate-100 dark:border-white/10 dark:bg-slate-900">
              <MapContainer
                center={DEFAULT_CENTER}
                zoom={DEFAULT_ZOOM}
                scrollWheelZoom={false}
                zoomControl
                className="h-full min-h-[285px] w-full"
              >
                <ConfiguredMapTileLayer
                  key={theme}
                />
                <FitPreviewBounds groups={groups} requestKey={fitRequestKey} />
                {groups.map((group) => {
                  const primaryIncident = group.items[0];
                  return (
                    <Marker
                      key={`${group.latitude}:${group.longitude}`}
                      position={[group.latitude, group.longitude]}
                      icon={createIncidentMarkerIcon(getGroupedIncidentMarkerStatus(group.items), { count: group.items.length })}
                    >
                      <Popup minWidth={220} maxWidth={270}>
                        <div className="space-y-2 font-sans">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-blue-600">
                            {group.items.length > 1 ? `${group.items.length} sự vụ tại điểm này` : getStatusLabel(primaryIncident.status)}
                          </p>
                          <h3 className="text-sm font-semibold leading-5 text-slate-950">
                            {primaryIncident.title}
                          </h3>
                          <Link
                            to={`/community/feed/${primaryIncident.incidentId}`}
                            state={getIncidentDetailState(primaryIncident)}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700"
                          >
                            Xem chi tiết
                            <Lucide.ArrowUpRight size={13} aria-hidden="true" />
                          </Link>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>

              <div className="pointer-events-none absolute left-4 top-4 z-[500] rounded-full border border-white/80 bg-white/90 px-3 py-2 text-[11px] font-semibold text-slate-700 shadow-md backdrop-blur dark:border-white/10 dark:bg-slate-950/85 dark:text-slate-200">
                {loading ? 'Đang tải dữ liệu' : `${visibleIncidents.length} điểm đang hiển thị`}
              </div>

              <Link
                to="/community/map#incident-map"
                state={{ focusMap: true }}
                className="absolute right-4 top-4 z-[500] inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/80 bg-white/90 px-3 text-xs font-semibold text-slate-700 shadow-md backdrop-blur transition hover:text-blue-700 dark:border-white/10 dark:bg-slate-950/85 dark:text-slate-200"
              >
                Mở bản đồ
                <Lucide.ArrowUpRight size={13} aria-hidden="true" />
              </Link>

              <div className="pointer-events-none absolute bottom-4 left-4 right-4 z-[500] grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-white/70 bg-white/88 px-3 py-2.5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-950/80">
                  <span className="block text-[10px] text-slate-500 dark:text-slate-400">Công khai</span>
                  <strong className="mt-0.5 block text-base font-semibold text-slate-900 dark:text-white">{loading ? '—' : validIncidents.length}</strong>
                </div>
                <div className="rounded-xl border border-white/70 bg-white/88 px-3 py-2.5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-950/80">
                  <span className="block text-[10px] text-slate-500 dark:text-slate-400">Đang xử lý</span>
                  <strong className="mt-0.5 block text-base font-semibold text-amber-600 dark:text-amber-300">{loading ? '—' : processingIncidents.length}</strong>
                </div>
                <div className="rounded-xl border border-white/70 bg-white/88 px-3 py-2.5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-950/80">
                  <span className="block text-[10px] text-slate-500 dark:text-slate-400">Đã kết thúc</span>
                  <strong className="mt-0.5 block text-base font-semibold text-emerald-600 dark:text-emerald-300">{loading ? '—' : endedIncidents.length}</strong>
                </div>
              </div>
            </div>

            <div className="public-overview-list flex min-h-[285px] flex-col rounded-[22px] border border-slate-100 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-white/[0.035]">
              <div className="flex items-center justify-between px-1 pb-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Mới cập nhật</span>
                <Lucide.Radio size={14} className="text-blue-600 dark:text-blue-300" aria-hidden="true" />
              </div>

              <div className="space-y-2.5">
                {loading ? (
                  [0, 1].map((item) => (
                    <div key={item} className="rounded-2xl border border-slate-100 bg-white p-3 dark:border-white/10 dark:bg-white/[0.045]">
                      <div className="h-3 w-20 animate-pulse rounded bg-slate-200 dark:bg-white/10" />
                      <div className="mt-3 h-4 w-full animate-pulse rounded bg-slate-200 dark:bg-white/10" />
                      <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-slate-100 dark:bg-white/[0.07]" />
                    </div>
                  ))
                ) : error ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200">
                    <p>Chưa tải được dữ liệu bản đồ.</p>
                    <button type="button" onClick={reloadIncidents} className="mt-2 font-semibold">Tải lại</button>
                  </div>
                ) : recentItems.length > 0 ? (
                  recentItems.map((incident) => (
                    <Link
                      key={incident.incidentId}
                      to={`/community/feed/${incident.incidentId}`}
                      state={getIncidentDetailState(incident)}
                      className="public-overview-item block rounded-2xl border border-slate-100 bg-white p-3 transition hover:border-blue-200 hover:shadow-sm dark:border-white/10 dark:bg-white/[0.045]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-blue-700 dark:text-blue-300">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" aria-hidden="true" />
                          {getStatusLabel(incident.status)}
                        </span>
                        <Lucide.ChevronRight size={14} className="text-slate-300" aria-hidden="true" />
                      </div>
                      <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-slate-900 dark:text-white">
                        {incident.title || 'Sự vụ đô thị'}
                      </h3>
                      <p className="mt-2 flex items-center gap-1.5 truncate text-[11px] text-slate-400">
                        <Lucide.Layers3 size={12} aria-hidden="true" />
                        {incident.categoryName || 'Sự vụ đô thị'}
                      </p>
                    </Link>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-center dark:border-white/10 dark:bg-white/[0.035]">
                    <Lucide.Inbox size={18} className="mx-auto text-slate-400" aria-hidden="true" />
                    <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">Chưa có dữ liệu gần đây.</p>
                  </div>
                )}
              </div>

              <Link
                to="/community/feed"
                className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-white hover:text-blue-700 dark:text-slate-300 dark:hover:bg-white/[0.05] dark:hover:text-blue-300"
              >
                Xem toàn bộ bảng tin
                <Lucide.ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </aside>
      </>
    );
  }

  return (
    <>
      <PublicMapPreviewStyles />
      <div className={`public-map-preview overflow-hidden border backdrop-blur ${compact ? 'rounded-[28px] shadow-[0_20px_55px_rgba(15,23,42,0.11)]' : 'rounded-[30px] shadow-[0_24px_70px_rgba(15,23,42,0.12)]'}`}>
      <header
        className={`public-map-preview__header flex flex-col border-b ${compact ? 'gap-3 px-5 py-4' : 'gap-5 px-5 py-5 sm:px-7 lg:flex-row lg:items-center lg:justify-between'}`}
        style={{
          borderColor: theme === 'dark'
            ? 'rgba(96, 165, 250, 0.16)'
            : 'rgba(203, 213, 225, 0.8)',
          background: theme === 'dark'
            ? 'linear-gradient(180deg, rgba(14, 31, 57, 0.98), rgba(9, 23, 44, 0.96))'
            : 'rgba(248, 251, 255, 0.84)',
        }}
      >
        <div>
          <span
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em]"
            style={{ color: theme === 'dark' ? '#7dd3fc' : '#1d4ed8' }}
          >
            <Lucide.MapPinned size={15} aria-hidden="true" />
            Bản đồ sự vụ công khai
          </span>
          <h2
            id={compact ? undefined : 'public-tools-title'}
            className={`${compact ? 'mt-1 text-lg sm:text-xl' : 'mt-2 text-2xl sm:text-3xl'} font-semibold tracking-[-0.025em]`}
            style={{ color: theme === 'dark' ? '#f8fafc' : '#0f172a' }}
          >
            {compact ? 'Bản đồ sự vụ gần đây' : 'Khám phá vấn đề đô thị theo từng khu vực'}
          </h2>
          <p
            className={`${compact ? 'mt-1 text-xs leading-5' : 'mt-2 max-w-2xl text-sm leading-6'}`}
            style={{ color: theme === 'dark' ? '#a8b7cc' : '#475569' }}
          >
            {compact ? 'Chọn marker để xem sự vụ và mở chi tiết.' : 'Chọn marker để xem sự vụ, theo dõi trạng thái và mở chi tiết ngay trên bảng tin cộng đồng.'}
          </p>
        </div>

        <div className={`${compact ? 'hidden' : 'flex'} flex-wrap items-center gap-2`} aria-label="Lọc nhanh sự vụ trên bản đồ">
          {[
            [FILTERS.ALL, 'Tất cả', validIncidents.length],
            [FILTERS.PROCESSING, 'Đang xử lý', processingIncidents.length],
            [FILTERS.ENDED, 'Đã kết thúc', endedIncidents.length],
          ].map(([value, label, count]) => (
            <button
              key={value}
              type="button"
              onClick={() => handleFilter(value)}
              aria-pressed={activeFilter === value}
              className={`inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-xs font-semibold transition ${
                activeFilter === value
                  ? 'border-blue-600 bg-blue-600 text-white shadow-sm dark:border-blue-400 dark:bg-blue-500'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-700 dark:border-white/10 dark:bg-white/[0.045] dark:text-slate-300 dark:hover:border-blue-400/40 dark:hover:text-blue-300'
              }`}
            >
              {label}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${activeFilter === value ? 'bg-white/16' : 'bg-slate-100 dark:bg-white/10'}`}>
                {loading ? '—' : count}
              </span>
            </button>
          ))}
        </div>
      </header>

      <div className={`grid ${compact ? 'lg:grid-cols-[minmax(0,1.45fr)_minmax(260px,0.55fr)]' : 'lg:grid-cols-[minmax(0,1.38fr)_minmax(330px,0.62fr)]'}`}>
        <div className={`relative overflow-hidden border-b border-slate-200/80 lg:border-b-0 lg:border-r dark:border-white/10 ${compact ? 'min-h-[360px] lg:min-h-[420px]' : 'min-h-[440px] lg:min-h-[520px]'}`}>
          <MapContainer
            center={DEFAULT_CENTER}
            zoom={DEFAULT_ZOOM}
            scrollWheelZoom={false}
            zoomControl
            className={`h-full w-full ${compact ? 'min-h-[360px] lg:min-h-[420px]' : 'min-h-[440px] lg:min-h-[520px]'}`}
          >
            <ConfiguredMapTileLayer
              key={theme}
            />
            <FitPreviewBounds groups={groups} requestKey={fitRequestKey} />
            {groups.map((group) => {
              const primaryIncident = group.items[0];
              return (
                <Marker
                  key={`${group.latitude}:${group.longitude}`}
                  position={[group.latitude, group.longitude]}
                  icon={createIncidentMarkerIcon(getGroupedIncidentMarkerStatus(group.items), { count: group.items.length })}
                >
                  <Popup minWidth={245} maxWidth={300}>
                    <div className="space-y-3 font-sans">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-blue-600">
                          {group.items.length > 1 ? `${group.items.length} sự vụ tại điểm này` : getStatusLabel(primaryIncident.status)}
                        </p>
                        <h3 className="mt-1 text-sm font-semibold leading-5 text-slate-950">
                          {primaryIncident.title}
                        </h3>
                      </div>
                      <p className="text-xs leading-5 text-slate-500">
                        {primaryIncident.categoryName || 'Sự vụ đô thị'}
                      </p>
                      <Link
                        to={`/community/feed/${primaryIncident.incidentId}`}
                        state={getIncidentDetailState(primaryIncident)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700"
                      >
                        Xem chi tiết sự vụ
                        <Lucide.ArrowUpRight size={13} aria-hidden="true" />
                      </Link>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>

          <div className="pointer-events-none absolute left-4 top-4 z-[500] flex items-center gap-2 rounded-full border border-white/75 bg-white/90 px-3 py-2 text-xs font-semibold text-slate-700 shadow-lg backdrop-blur dark:border-white/10 dark:bg-slate-950/85 dark:text-slate-200">
            <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_5px_rgba(16,185,129,0.12)]" aria-hidden="true" />
            {loading ? 'Đang tải dữ liệu' : `${visibleIncidents.length} điểm đang hiển thị`}
          </div>

          <Link
            to="/community/map#incident-map"
            state={{ focusMap: true }}
            className="absolute bottom-4 right-4 z-[500] inline-flex h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-xl transition hover:-translate-y-0.5 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            Mở bản đồ đầy đủ
            <Lucide.Maximize2 size={15} aria-hidden="true" />
          </Link>
        </div>

        <aside className={`public-map-preview__aside flex flex-col ${compact ? 'min-h-[360px] p-4 sm:min-h-[420px]' : 'min-h-[440px] p-5 sm:p-6 lg:min-h-[520px]'}`} aria-label="Sự vụ gần đây trên bản đồ">
          <div className={`grid grid-cols-3 ${compact ? 'gap-2' : 'gap-2.5'}`}>
            <Metric label="Có tọa độ" value={loading ? '—' : validIncidents.length} />
            <Metric label="Đang xử lý" value={loading ? '—' : processingIncidents.length} tone="amber" />
            <Metric label="Kết thúc" value={loading ? '—' : endedIncidents.length} tone="emerald" />
          </div>

          <div className={`${compact ? 'mt-4' : 'mt-6'} flex items-center justify-between gap-3`}>
            <div>
              <h3 className="text-base font-semibold text-slate-950 dark:text-white">Gần đây trên bản đồ</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Chọn một sự vụ để xem đầy đủ nội dung.</p>
            </div>
            <Lucide.Radio size={17} className="text-blue-600 dark:text-blue-300" aria-hidden="true" />
          </div>

          <div className="mt-4 space-y-3">
            {loading ? (
              Array.from({ length: compact ? 2 : 3 }, (_, item) => item).map((item) => (
                <div key={item} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.045]">
                  <div className="h-3 w-24 animate-pulse rounded bg-slate-200 dark:bg-white/10" />
                  <div className="mt-3 h-4 w-full animate-pulse rounded bg-slate-200 dark:bg-white/10" />
                  <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-slate-100 dark:bg-white/[0.07]" />
                </div>
              ))
            ) : error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-400/20 dark:bg-rose-500/10">
                <div className="flex items-start gap-3">
                  <Lucide.TriangleAlert size={18} className="mt-0.5 shrink-0 text-rose-500" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold text-rose-800 dark:text-rose-200">Chưa tải được bản đồ</p>
                    <p className="mt-1 text-xs leading-5 text-rose-700/80 dark:text-rose-200/70">{error}</p>
                    <button
                      type="button"
                      onClick={reloadIncidents}
                      className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 dark:text-rose-200"
                    >
                      <Lucide.RefreshCw size={13} aria-hidden="true" />
                      Tải lại dữ liệu
                    </button>
                  </div>
                </div>
              </div>
            ) : recentItems.length > 0 ? (
              recentItems.map((incident) => (
                <IncidentListItem key={incident.incidentId} incident={incident} />
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-6 text-center dark:border-white/15 dark:bg-white/[0.035]">
                <Lucide.MapPinOff size={22} className="mx-auto text-slate-400" aria-hidden="true" />
                <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Chưa có sự vụ phù hợp</p>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Thử chọn một bộ lọc khác hoặc mở bản đồ đầy đủ.</p>
              </div>
            )}
          </div>

          <Link
            to="/community/feed"
            className="mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700 dark:border-white/10 dark:bg-white/[0.045] dark:text-slate-200 dark:hover:border-blue-400/35 dark:hover:text-blue-300"
          >
            Xem toàn bộ bảng tin
            <Lucide.ArrowRight size={15} aria-hidden="true" />
          </Link>
        </aside>
      </div>
      </div>
    </>
  );
};

export default PublicMapPreview;
