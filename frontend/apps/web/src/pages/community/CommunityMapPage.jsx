// src/pages/community/CommunityMapPage.jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toolsApi } from '@urbanmind/shared-api';
import * as Lucide from 'lucide-react';
import { IncidentMap } from '../../components/maps/IncidentMap';
import { useIncidentMapData } from '../../hooks/useIncidentMapData';
import PublicPageMotion from '../../components/public/PublicPageMotion';
import { ManagerSelectMenu } from '../../components/manager/ManagerPageElements';

const MAP_SCROLL_OFFSET = 16;

const STATUS_FILTERS = {
  ALL: 'all',
  PROCESSING: 'processing',
  ENDED: 'ended',
};

const PROCESSING_STATUSES = new Set([
  'new',
  'open',
  'verified',
  'pending',
  'assigned',
  'inprogress',
  'needrework',
  'resolved',
  'submittedforapproval',
]);

const ENDED_STATUSES = new Set(['approved', 'closed']);

const normalizeToken = (value) => String(value || '')
  .trim()
  .replace(/[^a-zA-Z0-9]/g, '')
  .toLocaleLowerCase('en-US');

const normalizeSearchText = (value) => String(value || '')
  .trim()
  .toLocaleLowerCase('vi-VN');

const getIncidentStatus = (incident) => (
  incident?.status ||
  incident?.feedbackStatus ||
  incident?.ticketStatus ||
  ''
);

const getIncidentCoordinates = (incident) => {
  const latitude = (
    incident?.latitude ??
    incident?.lat ??
    incident?.location?.latitude ??
    incident?.location?.lat
  );
  const longitude = (
    incident?.longitude ??
    incident?.lng ??
    incident?.lon ??
    incident?.location?.longitude ??
    incident?.location?.lng ??
    incident?.location?.lon
  );

  return {
    latitude: Number(latitude),
    longitude: Number(longitude),
  };
};

const hasValidCoordinates = (incident) => {
  const { latitude, longitude } = getIncidentCoordinates(incident);

  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
  );
};

const getIncidentAreaId = (incident) => (
  incident?.areaId ??
  incident?.wardId ??
  incident?.area?.areaId ??
  incident?.area?.id ??
  incident?.location?.areaId ??
  null
);

const getIncidentAreaName = (incident) => (
  incident?.areaName ||
  incident?.wardName ||
  incident?.area?.areaName ||
  incident?.area?.name ||
  incident?.location?.areaName ||
  incident?.location?.wardName ||
  ''
);

const getIncidentCategory = (incident) => (
  incident?.categoryName ||
  incident?.category ||
  incident?.categoryType ||
  incident?.category?.categoryName ||
  incident?.category?.name ||
  ''
);

const getIncidentTitle = (incident) => (
  incident?.title ||
  incident?.summary ||
  incident?.subject ||
  'Sự vụ đô thị'
);

const getIncidentLocationText = (incident) => (
  incident?.locationText ||
  incident?.address ||
  incident?.approximateAddress ||
  incident?.location?.address ||
  getIncidentAreaName(incident) ||
  'Chưa cập nhật khu vực'
);

const getIncidentId = (incident) => (
  incident?.incidentId ?? incident?.id ?? null
);

const getAreaId = (area) => area?.areaId ?? area?.id ?? area?.areaID ?? null;
const getAreaName = (area) => area?.areaName ?? area?.name ?? area?.displayName ?? '';

const parseBoundaryGeoJson = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const formatUpdatedAt = (incident) => {
  const value = incident?.updatedAt || incident?.lastUpdatedAt || incident?.createdAt;
  if (!value) return 'Chưa cập nhật';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa cập nhật';

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const getStatusMeta = (status) => {
  const normalized = normalizeToken(status);
  if (ENDED_STATUSES.has(normalized)) {
    return {
      label: 'Đã hoàn tất',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    };
  }

  if (PROCESSING_STATUSES.has(normalized)) {
    return {
      label: 'Đang xử lý',
      className: 'border-amber-200 bg-amber-50 text-amber-700',
    };
  }

  return {
    label: 'Đã tiếp nhận',
    className: 'border-blue-200 bg-blue-50 text-blue-700',
  };
};

const MapCanvasSkeleton = () => (
  <div className="relative h-[620px] overflow-hidden bg-slate-100" aria-hidden="true">
    <div className="absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_35%_28%,rgba(59,130,246,0.12),transparent_24%),linear-gradient(135deg,#f8fafc,#eef2f7)]" />
    <div className="absolute inset-0 flex items-center justify-center">
      <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/92 px-4 py-2 text-sm font-semibold text-slate-600 shadow-lg backdrop-blur">
        <span className="loading loading-spinner loading-sm text-blue-600" />
        Đang tải bản đồ sự cố
      </span>
    </div>
  </div>
);

const LoadingValue = ({ className = '' }) => (
  <span
    aria-hidden="true"
    className={`mt-1 inline-block h-6 w-10 animate-pulse rounded-lg bg-current/10 ${className}`}
  />
);

const RecentIncidentSkeleton = () => (
  <div className="rounded-2xl border border-[var(--public-border-soft)] bg-[var(--public-surface-strong)] p-3" aria-hidden="true">
    <div className="h-4 w-4/5 animate-pulse rounded bg-slate-200/80" />
    <div className="mt-2 flex gap-2">
      <div className="h-5 w-16 animate-pulse rounded-full bg-amber-100" />
      <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
    </div>
    <div className="mt-2 h-3 w-20 animate-pulse rounded bg-slate-100" />
  </div>
);

const CommunityMapThemeStyles = () => (
  <style>{`
    .community-map-page .citizen-map-card {
      border-color: var(--public-border) !important;
      background: var(--public-surface) !important;
      box-shadow: var(--public-shadow);
    }

    .community-map-page .citizen-map-toolbar,
    .community-map-page .citizen-map-side-panel {
      border-color: var(--public-border) !important;
      background: var(--public-surface) !important;
    }

    .community-map-page .citizen-map-search {
      border-color: var(--public-border) !important;
      background: var(--public-surface-strong) !important;
      color: var(--public-title) !important;
    }

    .community-map-page .incident-map-popup .leaflet-popup-content {
      margin: 12px 14px 14px !important;
    }

    .community-map-page .incident-map-popup .leaflet-popup-content-wrapper {
      border-radius: 20px !important;
      box-shadow: 0 18px 46px rgba(15, 23, 42, 0.16) !important;
    }

    .community-map-page .incident-map-popup-list {
      gap: 7px !important;
      padding-right: 0 !important;
    }

    .community-map-page .incident-map-popup-list > button {
      border-radius: 14px !important;
      border-color: rgba(191, 219, 254, 0.95) !important;
      background: rgba(248, 250, 252, 0.96) !important;
      padding: 10px 12px !important;
      box-shadow: none !important;
    }

    .community-map-page .incident-map-popup-list > button:hover {
      border-color: rgba(96, 165, 250, 0.95) !important;
      background: #eff6ff !important;
    }

    .community-map-page .incident-map-popup .leaflet-popup-close-button {
      right: 7px !important;
      top: 5px !important;
      width: 28px !important;
      height: 28px !important;
      border-radius: 999px;
      font-size: 20px !important;
      line-height: 27px !important;
    }

    html[data-theme="dark"] .community-map-page .citizen-map-card,
    html[data-theme="dark"] .community-map-page .citizen-map-toolbar,
    html[data-theme="dark"] .community-map-page .citizen-map-side-panel {
      border-color: rgba(96,165,250,.18) !important;
      background: linear-gradient(145deg, rgba(13,29,54,.98), rgba(8,20,40,.98)) !important;
      box-shadow: 0 24px 64px rgba(0,0,0,.28) !important;
    }
  `}</style>
);

export const CommunityMapPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { incidents, loading, error } = useIncidentMapData();
  const [statusFilter, setStatusFilter] = useState(STATUS_FILTERS.ALL);
  const [selectedAreaId, setSelectedAreaId] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [areas, setAreas] = useState([]);
  const [areasLoading, setAreasLoading] = useState(true);
  const [fitRequestKey, setFitRequestKey] = useState(0);
  const [selectedMapIncidentId, setSelectedMapIncidentId] = useState(null);
  const mapSectionRef = useRef(null);
  const handledFocusRequestRef = useRef('');
  const [ignoreRouteFocus, setIgnoreRouteFocus] = useState(false);
  const focusState = location.state?.mapState || location.state || {};

  const safeIncidents = useMemo(
    () => (Array.isArray(incidents) ? incidents : []),
    [incidents]
  );

  useEffect(() => {
    let active = true;

    const loadAreas = async () => {
      setAreasLoading(true);
      try {
        const response = await toolsApi.getAreas();
        if (!active) return;
        const items = Array.isArray(response)
          ? response
          : Array.isArray(response?.items)
            ? response.items
            : Array.isArray(response?.data)
              ? response.data
              : [];

        setAreas(
          items
            .filter((area) => area?.isActive !== false && getAreaId(area) != null)
            .sort((a, b) => getAreaName(a).localeCompare(getAreaName(b), 'vi'))
        );
      } catch {
        if (active) setAreas([]);
      } finally {
        if (active) setAreasLoading(false);
      }
    };

    loadAreas();
    return () => {
      active = false;
    };
  }, []);

  const validIncidents = useMemo(
    () => safeIncidents.filter(hasValidCoordinates),
    [safeIncidents]
  );

  const selectedArea = useMemo(
    () => areas.find((area) => String(getAreaId(area)) === String(selectedAreaId)) || null,
    [areas, selectedAreaId]
  );

  const selectedAreaBoundary = useMemo(
    () => parseBoundaryGeoJson(selectedArea?.boundaryGeoJson),
    [selectedArea]
  );

  const categories = useMemo(() => {
    const values = new Set();
    validIncidents.forEach((incident) => {
      const category = getIncidentCategory(incident).trim();
      if (category) values.add(category);
    });
    return [...values].sort((a, b) => a.localeCompare(b, 'vi'));
  }, [validIncidents]);

  const visibleIncidents = useMemo(() => {
    const normalizedQuery = normalizeSearchText(searchQuery);
    const selectedAreaName = getAreaName(selectedArea);

    return validIncidents.filter((incident) => {
      const status = normalizeToken(getIncidentStatus(incident));
      if (
        statusFilter === STATUS_FILTERS.PROCESSING &&
        !PROCESSING_STATUSES.has(status)
      ) return false;
      if (
        statusFilter === STATUS_FILTERS.ENDED &&
        !ENDED_STATUSES.has(status)
      ) return false;

      if (selectedCategory && getIncidentCategory(incident) !== selectedCategory) {
        return false;
      }

      if (selectedAreaId) {
        const incidentAreaId = getIncidentAreaId(incident);
        const incidentAreaName = getIncidentAreaName(incident);
        const idMatches = incidentAreaId != null && String(incidentAreaId) === String(selectedAreaId);
        const nameMatches = selectedAreaName && incidentAreaName && (
          normalizeSearchText(incidentAreaName) === normalizeSearchText(selectedAreaName)
        );
        if (!idMatches && !nameMatches) return false;
      }

      if (normalizedQuery) {
        const haystack = normalizeSearchText([
          getIncidentTitle(incident),
          getIncidentLocationText(incident),
          getIncidentAreaName(incident),
          getIncidentCategory(incident),
        ].filter(Boolean).join(' '));
        if (!haystack.includes(normalizedQuery)) return false;
      }

      return true;
    });
  }, [searchQuery, selectedArea, selectedAreaId, selectedCategory, statusFilter, validIncidents]);

  const hasLoadedMapData = validIncidents.length > 0;

  const processingCount = useMemo(
    () => visibleIncidents.filter((incident) => PROCESSING_STATUSES.has(normalizeToken(getIncidentStatus(incident)))).length,
    [visibleIncidents]
  );

  const endedCount = useMemo(
    () => visibleIncidents.filter((incident) => ENDED_STATUSES.has(normalizeToken(getIncidentStatus(incident)))).length,
    [visibleIncidents]
  );

  const recentVisibleIncidents = useMemo(
    () => [...visibleIncidents]
      .sort((a, b) => {
        const aTime = new Date(a?.updatedAt || a?.createdAt || 0).getTime();
        const bTime = new Date(b?.updatedAt || b?.createdAt || 0).getTime();
        return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
      })
      .slice(0, 3),
    [visibleIncidents]
  );

  const selectedMapIncident = useMemo(
    () => visibleIncidents.find((incident) => String(getIncidentId(incident)) === String(selectedMapIncidentId)) || null,
    [selectedMapIncidentId, visibleIncidents]
  );

  const selectedMapCoordinates = useMemo(
    () => selectedMapIncident ? getIncidentCoordinates(selectedMapIncident) : null,
    [selectedMapIncident]
  );

  useEffect(() => {
    // A fresh navigation back to the map may intentionally request one incident focus.
    // Filters below consume/clear that focus so it cannot keep overriding the user's area view.
    setIgnoreRouteFocus(false);
  }, [location.key]);

  useEffect(() => {
    if (ignoreRouteFocus) return undefined;

    const focusIncidentId = focusState?.focusIncidentId || focusState?.focusFeedbackId;
    if (!focusIncidentId || loading || !mapSectionRef.current) return undefined;

    const focusRequestKey = [
      focusIncidentId,
      focusState?.focusLatitude,
      focusState?.focusLongitude,
    ].join(':');

    if (handledFocusRequestRef.current === focusRequestKey) return undefined;

    setStatusFilter(STATUS_FILTERS.ALL);
    setSelectedAreaId('');
    setSelectedCategory('');
    setSearchQuery('');

    const timer = window.setTimeout(() => {
      mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      handledFocusRequestRef.current = focusRequestKey;
    }, 180);

    return () => window.clearTimeout(timer);
  }, [
    focusState?.focusIncidentId,
    focusState?.focusFeedbackId,
    focusState?.focusLatitude,
    focusState?.focusLongitude,
    ignoreRouteFocus,
    loading,
  ]);

  const requestMapFit = () => {
    setFitRequestKey((current) => current + 1);
  };

  const scrollToMap = () => {
    window.setTimeout(() => {
      const mapSection = mapSectionRef.current;
      if (!mapSection) return;

      // PublicLayout already scrolls inside a container that starts below the fixed header.
      // Keep only a small visual gap here; a large header-sized offset would double-count
      // the header and leave the filter toolbar visible above the map.
      mapSection.style.scrollMarginTop = `${MAP_SCROLL_OFFSET}px`;

      window.requestAnimationFrame(() => {
        mapSection.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      });
    }, 160);
  };

  const handleStatusFilter = (nextFilter) => {
    setIgnoreRouteFocus(true);
    setStatusFilter(nextFilter);
    setSelectedMapIncidentId(null);
    requestMapFit();
    scrollToMap();
  };

  const handleAreaFilter = (value) => {
    setIgnoreRouteFocus(true);
    setSelectedAreaId(value);
    setSelectedMapIncidentId(null);
    requestMapFit();
    scrollToMap();
  };

  const handleCategoryFilter = (value) => {
    setIgnoreRouteFocus(true);
    setSelectedCategory(value);
    setSelectedMapIncidentId(null);
    requestMapFit();
    scrollToMap();
  };

  const clearFilters = () => {
    setIgnoreRouteFocus(true);
    setStatusFilter(STATUS_FILTERS.ALL);
    setSelectedAreaId('');
    setSelectedCategory('');
    setSearchQuery('');
    setSelectedMapIncidentId(null);
    requestMapFit();
    scrollToMap();
  };

  const hasActiveFilters = (
    statusFilter !== STATUS_FILTERS.ALL ||
    Boolean(selectedAreaId) ||
    Boolean(selectedCategory) ||
    Boolean(searchQuery.trim())
  );

  return (
    <PublicPageMotion>
      <main data-public-reveal className="community-map-page relative isolate space-y-4 text-base-content">
        <CommunityMapThemeStyles />

        <section className="citizen-map-card rounded-[28px] border px-5 py-5 sm:px-7 sm:py-6" aria-labelledby="community-map-title">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-[0_10px_26px_rgba(37,99,235,0.2)]">
                <Lucide.MapPinned size={21} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h1 id="community-map-title" className="text-2xl font-bold tracking-tight sm:text-[30px]">
                  Bản đồ sự cố đô thị
                </h1>
                <p className="mt-1.5 max-w-2xl text-sm leading-6 text-base-content/58">
                  Xem các sự vụ công khai theo khu vực, tình trạng xử lý và mở chi tiết ngay trên bản đồ.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:min-w-[360px]">
              <div className="rounded-2xl border border-blue-100 bg-blue-50/70 px-3 py-2.5">
                <div className="text-[11px] font-medium text-slate-500">Đang hiển thị</div>
                <div className="mt-0.5 min-h-7 text-xl font-bold text-blue-700">{loading && !hasLoadedMapData ? <LoadingValue /> : visibleIncidents.length}</div>
              </div>
              <div className="rounded-2xl border border-amber-100 bg-amber-50/70 px-3 py-2.5">
                <div className="text-[11px] font-medium text-slate-500">Đang xử lý</div>
                <div className="mt-0.5 min-h-7 text-xl font-bold text-amber-700">{loading && !hasLoadedMapData ? <LoadingValue /> : processingCount}</div>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-3 py-2.5">
                <div className="text-[11px] font-medium text-slate-500">Đã hoàn tất</div>
                <div className="mt-0.5 min-h-7 text-xl font-bold text-emerald-700">{loading && !hasLoadedMapData ? <LoadingValue /> : endedCount}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="citizen-map-toolbar rounded-[24px] border p-4 sm:p-5" aria-label="Bộ lọc bản đồ sự cố">
          <div className="grid gap-3 xl:grid-cols-[minmax(230px,1.15fr)_minmax(175px,.8fr)_minmax(175px,.8fr)_auto] xl:items-end">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-base-content/62">Tìm sự vụ</span>
              <span className="citizen-map-search flex h-11 items-center gap-2 rounded-xl border px-3.5">
                <Lucide.Search size={16} className="shrink-0 text-base-content/38" aria-hidden="true" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Tên sự vụ, địa điểm..."
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-base-content/35"
                />
              </span>
            </label>

            <div className="block">
              <span className="mb-1.5 block text-xs font-semibold text-base-content/62">Phường / khu vực</span>
              <ManagerSelectMenu
                value={selectedAreaId}
                onChange={handleAreaFilter}
                disabled={areasLoading}
                ariaLabel="Lọc theo phường hoặc khu vực"
                className="h-11"
                options={[
                  { value: '', label: 'Tất cả khu vực' },
                  ...areas.map((area) => ({
                    value: getAreaId(area),
                    label: getAreaName(area),
                  })),
                ]}
              />
            </div>

            <div className="block">
              <span className="mb-1.5 block text-xs font-semibold text-base-content/62">Danh mục</span>
              <ManagerSelectMenu
                value={selectedCategory}
                onChange={handleCategoryFilter}
                ariaLabel="Lọc theo danh mục sự vụ"
                className="h-11"
                options={[
                  { value: '', label: 'Tất cả danh mục' },
                  ...categories.map((category) => ({ value: category, label: category })),
                ]}
              />
            </div>

            <div className="flex items-center gap-2 xl:justify-end">
              <button
                type="button"
                onClick={clearFilters}
                disabled={!hasActiveFilters}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--public-border)] bg-[var(--public-surface-strong)] px-3.5 text-sm font-semibold text-base-content/65 transition hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Lucide.RotateCcw size={15} aria-hidden="true" />
                Đặt lại
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {[
              { value: STATUS_FILTERS.ALL, label: 'Tất cả trạng thái', icon: Lucide.MapPin },
              { value: STATUS_FILTERS.PROCESSING, label: 'Đang xử lý', icon: Lucide.LoaderCircle },
              { value: STATUS_FILTERS.ENDED, label: 'Đã hoàn tất', icon: Lucide.CircleCheckBig },
            ].map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => handleStatusFilter(value)}
                aria-pressed={statusFilter === value}
                className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition ${
                  statusFilter === value
                    ? 'border-blue-300 bg-blue-50 text-blue-700 shadow-sm'
                    : 'border-[var(--public-border)] bg-[var(--public-surface-strong)] text-base-content/58 hover:border-blue-200 hover:text-blue-700'
                }`}
              >
                <Icon size={14} aria-hidden="true" />
                {label}
              </button>
            ))}

            {selectedArea ? (
              <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700">
                <Lucide.Map size={14} aria-hidden="true" />
                Đang làm nổi bật {getAreaName(selectedArea)}
              </span>
            ) : null}
          </div>
        </section>

        <section ref={mapSectionRef} id="incident-map" className="scroll-mt-28">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
            <div className="citizen-map-card overflow-hidden rounded-[26px] border">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--public-border-soft)] px-5 py-4">
                <div>
                  <h2 className="text-base font-bold">Sự vụ trên bản đồ</h2>
                  <p className="mt-1 text-xs text-base-content/48">
                    {selectedArea
                      ? `Đang xem ${getAreaName(selectedArea)}. Ranh giới khu vực được làm nổi bật trên bản đồ.`
                      : 'Chọn phường hoặc bộ lọc để thu hẹp các sự vụ cần xem.'}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                  <Lucide.MapPin size={13} aria-hidden="true" />
                  {visibleIncidents.length} điểm
                </span>
              </header>

              <div className="relative isolate overflow-hidden">
                {loading && !hasLoadedMapData ? (
                  <MapCanvasSkeleton />
                ) : (
                  <div data-testid="incident-map-container" className="relative overflow-hidden">
                    <IncidentMap
                      key={`community-map-${selectedAreaId || 'all'}`}
                      incidents={visibleIncidents}
                      fitRequestKey={fitRequestKey}
                      focusIncidentId={selectedMapIncidentId || (!ignoreRouteFocus ? focusState?.focusIncidentId : null)}
                      focusFeedbackId={selectedMapIncidentId || (!ignoreRouteFocus ? (focusState?.focusIncidentId || focusState?.focusFeedbackId) : null)}
                      focusLatitude={selectedMapCoordinates?.latitude ?? (!ignoreRouteFocus ? focusState?.focusLatitude : undefined)}
                      focusLongitude={selectedMapCoordinates?.longitude ?? (!ignoreRouteFocus ? focusState?.focusLongitude : undefined)}
                      entityLabel="sự vụ"
                      detailPathBuilder={(incident) => `/community/feed/${getIncidentId(incident)}`}
                      areaBoundaryGeoJson={selectedAreaBoundary}
                      areaCenterLatitude={selectedArea?.centerLatitude}
                      areaCenterLongitude={selectedArea?.centerLongitude}
                      areaBoundaryKey={selectedAreaId || 'all'}
                      autoFitIncidents={!selectedArea}
                    />
                    {loading && hasLoadedMapData ? (
                      <div className="pointer-events-none absolute right-4 top-4 z-[450]">
                        <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/95 px-3 py-2 text-xs font-semibold text-blue-700 shadow-lg backdrop-blur">
                          <span className="loading loading-spinner loading-xs" />
                          Đang cập nhật dữ liệu
                        </div>
                      </div>
                    ) : null}
                    {visibleIncidents.length === 0 ? (
                      <div className="pointer-events-none absolute left-1/2 top-5 z-[450] -translate-x-1/2">
                        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-3.5 py-2 text-xs font-semibold text-slate-600 shadow-lg backdrop-blur">
                          <Lucide.MapPinOff size={14} className="text-blue-600" aria-hidden="true" />
                          Không có sự vụ phù hợp trong khu vực này
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>

            <aside className="citizen-map-side-panel rounded-[26px] border p-4 sm:p-5 xl:sticky xl:top-24" aria-label="Tóm tắt sự vụ đang hiển thị">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-600">Khu vực đang xem</p>
                    <h2 className="mt-1.5 text-lg font-bold">{selectedArea ? getAreaName(selectedArea) : 'Tất cả khu vực'}</h2>
                  </div>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                    <Lucide.MapPinned size={18} aria-hidden="true" />
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-slate-50 px-2.5 py-2.5 text-center">
                    <div className="min-h-7 text-lg font-bold text-slate-900">{loading && !hasLoadedMapData ? <LoadingValue /> : visibleIncidents.length}</div>
                    <div className="mt-0.5 text-[10px] font-medium text-slate-500">Tổng</div>
                  </div>
                  <div className="rounded-xl bg-amber-50 px-2.5 py-2.5 text-center">
                    <div className="min-h-7 text-lg font-bold text-amber-700">{loading && !hasLoadedMapData ? <LoadingValue /> : processingCount}</div>
                    <div className="mt-0.5 text-[10px] font-medium text-amber-600/75">Xử lý</div>
                  </div>
                  <div className="rounded-xl bg-emerald-50 px-2.5 py-2.5 text-center">
                    <div className="min-h-7 text-lg font-bold text-emerald-700">{loading && !hasLoadedMapData ? <LoadingValue /> : endedCount}</div>
                    <div className="mt-0.5 text-[10px] font-medium text-emerald-600/75">Hoàn tất</div>
                  </div>
                </div>
              </div>

              <div className="mt-5 border-t border-[var(--public-border-soft)] pt-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-bold">Sự vụ mới cập nhật</h3>
                  <span className="text-[11px] font-medium text-base-content/40">Tối đa 3</span>
                </div>

                <div className="mt-3 space-y-2">
                  {loading && !hasLoadedMapData ? (
                    <>
                      <RecentIncidentSkeleton />
                      <RecentIncidentSkeleton />
                      <RecentIncidentSkeleton />
                    </>
                  ) : recentVisibleIncidents.length > 0 ? recentVisibleIncidents.map((incident) => {
                    const statusMeta = getStatusMeta(getIncidentStatus(incident));
                    const incidentId = getIncidentId(incident);
                    return (
                      <article
                        key={incidentId || `${getIncidentTitle(incident)}-${formatUpdatedAt(incident)}`}
                        className={`overflow-hidden rounded-2xl border bg-[var(--public-surface-strong)] transition ${
                          selectedMapIncidentId && String(selectedMapIncidentId) === String(incidentId)
                            ? 'border-blue-300 shadow-[0_10px_28px_rgba(37,99,235,0.10)]'
                            : 'border-[var(--public-border-soft)] hover:border-blue-200 hover:shadow-sm'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (!incidentId) return;
                            setSelectedMapIncidentId(incidentId);
                            scrollToMap();
                          }}
                          className="w-full p-3 text-left"
                          aria-label={`Hiển thị ${getIncidentTitle(incident)} trên bản đồ`}
                        >
                          <div className="line-clamp-2 text-sm font-semibold leading-5 text-base-content">
                            {getIncidentTitle(incident)}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusMeta.className}`}>
                              {statusMeta.label}
                            </span>
                            <span className="inline-flex min-w-0 items-center gap-1 text-[10px] text-base-content/48">
                              <Lucide.MapPin size={11} aria-hidden="true" />
                              <span className="truncate">{getIncidentAreaName(incident) || 'Chưa xác định'}</span>
                            </span>
                          </div>
                          <div className="mt-2 text-[10px] text-base-content/38">Cập nhật {formatUpdatedAt(incident)}</div>
                        </button>

                        {incidentId ? (
                          <div className="border-t border-[var(--public-border-soft)] px-3 py-2">
                            <button
                              type="button"
                              onClick={() => navigate(`/community/feed/${incidentId}`, {
                                state: {
                                  from: '/community/map',
                                  mapState: {
                                    focusMap: true,
                                    focusIncidentId: incidentId,
                                    focusLatitude: getIncidentCoordinates(incident).latitude,
                                    focusLongitude: getIncidentCoordinates(incident).longitude,
                                  },
                                },
                              })}
                              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-700 transition hover:text-blue-800"
                            >
                              Xem chi tiết
                              <Lucide.ArrowUpRight size={12} aria-hidden="true" />
                            </button>
                          </div>
                        ) : null}
                      </article>
                    );
                  }) : (
                    <div className="rounded-2xl border border-dashed border-[var(--public-border)] px-4 py-6 text-center text-sm text-base-content/45">
                      Chưa có sự vụ phù hợp để hiển thị.
                    </div>
                  )}
                </div>
              </div>

            </aside>
          </div>

          {error ? (
            <div className="mt-3 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              <Lucide.CircleAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <div className="font-semibold">Không thể cập nhật đầy đủ dữ liệu bản đồ</div>
                <div className="mt-1 text-xs leading-5 text-rose-600/80">{error}</div>
              </div>
            </div>
          ) : null}
        </section>
      </main>
    </PublicPageMotion>
  );
};

export default CommunityMapPage;
