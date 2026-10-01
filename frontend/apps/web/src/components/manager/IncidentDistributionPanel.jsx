import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import * as Lucide from 'lucide-react';
import {
  INCIDENT_DASHBOARD_RANGES,
  extractApiErrorMessage,
  incidentDashboardApi,
  toolsApi,
} from '@urbanmind/shared-api';
import { ManagerSectionHeader, ManagerSelectMenu } from './ManagerPageElements';

/*
 * Bản đồ kéo theo Leaflet nên chỉ nạp khi thực sự hiển thị, tránh làm nặng lần
 * tải đầu của dashboard.
 */
const IncidentMap = lazy(() => import('../maps/IncidentMap').then((module) => ({ default: module.IncidentMap })));

const ALL_VALUE = '';

const RANGE_OPTIONS = [
  { value: INCIDENT_DASHBOARD_RANGES.ALL, label: 'Toàn bộ thời gian' },
  { value: INCIDENT_DASHBOARD_RANGES.LAST_7_DAYS, label: '7 ngày gần nhất' },
  { value: INCIDENT_DASHBOARD_RANGES.LAST_1_MONTH, label: '1 tháng gần nhất' },
  { value: INCIDENT_DASHBOARD_RANGES.LAST_6_MONTHS, label: '6 tháng gần nhất' },
  { value: INCIDENT_DASHBOARD_RANGES.LAST_1_YEAR, label: '1 năm gần nhất' },
];

const toCount = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeAreaBoundaryGeoJson = (value) => {
  if (!value) return null;
  if (typeof value === 'object') {
    return ['Polygon', 'MultiPolygon', 'Feature', 'FeatureCollection'].includes(value?.type) ? value : null;
  }

  const trimmed = String(value).trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null;

  const withoutWrappingQuotes = (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) ? trimmed.slice(1, -1) : trimmed;

  const candidates = [
    trimmed,
    withoutWrappingQuotes,
    trimmed.replace(/""/g, '"'),
    withoutWrappingQuotes.replace(/""/g, '"'),
    trimmed.replace(/\\"/g, '"'),
    withoutWrappingQuotes.replace(/\\"/g, '"'),
  ];

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (typeof parsed === 'string' && parsed !== candidate) return normalizeAreaBoundaryGeoJson(parsed);
      return parsed && ['Polygon', 'MultiPolygon', 'Feature', 'FeatureCollection'].includes(parsed.type)
        ? parsed
        : null;
    } catch {
      // Thử tiếp biến thể serialized khác từ backend.
    }
  }

  return null;
};

const SummaryStat = ({ label, value, toneClass }) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
    <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-400">{label}</p>
    <p className={`mt-1 text-xl font-bold tracking-[-0.02em] ${toneClass || 'text-slate-900 dark:text-slate-100'}`}>{value}</p>
  </div>
);

/**
 * Phân bố sự vụ theo danh mục và phường, kèm bản đồ các điểm đã có tọa độ.
 *
 * Ba tiêu chí lọc đều tùy chọn và gửi thẳng cho backend, nên con số hiển thị
 * luôn là con số backend tính chứ không phải lọc lại ở trình duyệt.
 */
export const IncidentDistributionPanel = () => {
  const [report, setReport] = useState(null);
  const [areas, setAreas] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({
    categoryId: ALL_VALUE,
    areaId: ALL_VALUE,
    range: INCIDENT_DASHBOARD_RANGES.LAST_1_MONTH,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedCategoryId, setExpandedCategoryId] = useState(null);
  const [showMap, setShowMap] = useState(true);

  useEffect(() => {
    let cancelled = false;

    Promise.allSettled([toolsApi.getAreas({ includeInactive: false }), toolsApi.getCategories()])
      .then(([areaResult, categoryResult]) => {
        if (cancelled) return;
        if (areaResult.status === 'fulfilled' && Array.isArray(areaResult.value)) setAreas(areaResult.value);
        if (categoryResult.status === 'fulfilled' && Array.isArray(categoryResult.value)) setCategories(categoryResult.value);
      });

    return () => { cancelled = true; };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await incidentDashboardApi.getDistribution({
        categoryId: filters.categoryId || undefined,
        areaId: filters.areaId || undefined,
        range: filters.range,
      });
      setReport(result);
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Không thể tải phân bố sự vụ.'));
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { void load(); }, [load]);

  const categoryOptions = useMemo(() => ([
    { value: ALL_VALUE, label: 'Tất cả danh mục' },
    ...categories.map((item) => ({
      value: String(item?.categoryId ?? item?.id ?? ''),
      label: item?.categoryName ?? item?.name ?? 'Không tên',
    })).filter((option) => option.value),
  ]), [categories]);

  const areaOptions = useMemo(() => ([
    { value: ALL_VALUE, label: 'Tất cả phường' },
    ...areas.map((item) => ({
      value: String(item?.areaId ?? item?.id ?? ''),
      label: item?.areaName ?? item?.name ?? 'Không tên',
    })).filter((option) => option.value),
  ]), [areas]);

  const selectedArea = useMemo(() => {
    if (!filters.areaId) return null;
    return areas.find((item) => String(item?.areaId ?? item?.id ?? '') === String(filters.areaId)) ?? null;
  }, [areas, filters.areaId]);

  const selectedAreaBoundary = useMemo(
    () => normalizeAreaBoundaryGeoJson(selectedArea?.boundaryGeoJson),
    [selectedArea?.boundaryGeoJson],
  );

  /*
   * Phải ổn định giữa các lần render vì mapIncidents lấy nó làm dependency;
   * nếu tạo mảng mới mỗi lần thì useMemo bên dưới không bao giờ dùng lại được.
   */
  const categoriesData = useMemo(
    () => (Array.isArray(report?.categories) ? report.categories : []),
    [report],
  );
  const maxCategoryCount = Math.max(1, ...categoriesData.map((item) => toCount(item?.count)));

  /*
   * IncidentMap dùng feedbackId làm khóa của marker, nên điểm sự vụ được ánh xạ
   * sang đúng khóa đó và điều hướng được chuyển về trang chi tiết sự vụ.
   */
  const mapIncidents = useMemo(() => categoriesData.flatMap((category) => (
    (Array.isArray(category?.areas) ? category.areas : []).flatMap((area) => (
      (Array.isArray(area?.points) ? area.points : []).map((point) => ({
        feedbackId: point?.incidentId,
        incidentId: point?.incidentId,
        title: point?.title,
        latitude: Number(point?.latitude),
        longitude: Number(point?.longitude),
        status: point?.status,
        priority: point?.priority,
        categoryName: point?.categoryName ?? category?.categoryName,
        locationText: point?.locationText,
        areaName: area?.areaName,
      }))
    ))
  )).filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude)), [categoriesData]);

  const hasActiveFilter = Boolean(filters.categoryId || filters.areaId)
    || filters.range !== INCIDENT_DASHBOARD_RANGES.ALL;

  const expandedCategory = useMemo(() => {
    if (!expandedCategoryId) return null;
    return categoriesData.find((category) => (
      String(category?.categoryId ?? category?.categoryName) === String(expandedCategoryId)
    )) ?? null;
  }, [categoriesData, expandedCategoryId]);

  const expandedAreaRows = Array.isArray(expandedCategory?.areas) ? expandedCategory.areas : [];

  const topAreaRows = useMemo(() => {
    const grouped = new Map();

    categoriesData.forEach((category) => {
      const categoryAreas = Array.isArray(category?.areas) ? category.areas : [];
      categoryAreas.forEach((area) => {
        const areaName = String(area?.areaName ?? '').trim() || 'Chưa xác định phường';
        const key = String(area?.areaId ?? areaName);
        const current = grouped.get(key) ?? { areaName, count: 0 };
        current.count += toCount(area?.count);
        grouped.set(key, current);
      });
    });

    const totalCount = Math.max(1, toCount(report?.totalCount));
    return [...grouped.values()]
      .sort((left, right) => right.count - left.count || left.areaName.localeCompare(right.areaName, 'vi'))
      .slice(0, 3)
      .map((area) => ({
        ...area,
        percentage: Number(((area.count / totalCount) * 100).toFixed(2)),
      }));
  }, [categoriesData, report?.totalCount]);

  const areaInsightRows = expandedCategory
    ? expandedAreaRows
      .map((area) => ({
        areaName: area?.areaName || 'Chưa xác định phường',
        count: toCount(area?.count),
        percentage: Number(area?.percentageInCategory ?? 0),
      }))
      .sort((left, right) => right.count - left.count || left.areaName.localeCompare(right.areaName, 'vi'))
      .slice(0, 3)
    : topAreaRows;

  const areaInsightMax = Math.max(1, ...areaInsightRows.map((area) => area.count));

  return (
    <section className="admin-panel overflow-hidden" aria-labelledby="incident-distribution-title">
      <ManagerSectionHeader
        id="incident-distribution-title"
        title="Phân bố sự vụ"
        description="Lọc theo danh mục, phường và khoảng thời gian, kèm vị trí các sự vụ trên bản đồ."
        icon={Lucide.ChartPie}
        actions={(
          <button
            type="button"
            onClick={() => setShowMap((open) => !open)}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
          >
            {showMap ? <Lucide.List size={14} aria-hidden="true" /> : <Lucide.Map size={14} aria-hidden="true" />}
            {showMap ? 'Ẩn bản đồ' : 'Hiện bản đồ'}
          </button>
        )}
      />

      <div className="space-y-4 px-5 pb-5 sm:px-6 sm:pb-6">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
          <ManagerSelectMenu
            value={filters.categoryId}
            options={categoryOptions}
            onChange={(value) => { setFilters((current) => ({ ...current, categoryId: value })); setExpandedCategoryId(null); }}
            ariaLabel="Lọc theo danh mục"
            className="w-full"
          />
          <ManagerSelectMenu
            value={filters.areaId}
            options={areaOptions}
            onChange={(value) => { setFilters((current) => ({ ...current, areaId: value })); setExpandedCategoryId(null); }}
            ariaLabel="Lọc theo phường"
            className="w-full"
          />
          <ManagerSelectMenu
            value={filters.range}
            options={RANGE_OPTIONS}
            onChange={(value) => setFilters((current) => ({ ...current, range: value }))}
            ariaLabel="Lọc theo khoảng thời gian"
            className="w-full"
          />
          {hasActiveFilter ? (
            <button
              type="button"
              onClick={() => { setFilters({ categoryId: ALL_VALUE, areaId: ALL_VALUE, range: INCIDENT_DASHBOARD_RANGES.ALL }); setExpandedCategoryId(null); }}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-500 transition hover:border-blue-200 hover:bg-blue-50/60 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-blue-500/30 dark:hover:bg-blue-500/10 dark:hover:text-blue-300"
            >
              <Lucide.RotateCcw size={14} aria-hidden="true" />
              Xóa lọc
            </button>
          ) : (
            <div className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-blue-100 bg-blue-50/60 px-3 text-xs font-semibold text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
              <Lucide.Layers3 size={15} aria-hidden="true" />
              <span className="whitespace-nowrap">Đang xem toàn bộ dữ liệu</span>
            </div>
          )}
        </div>

        {error ? (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
            <Lucide.TriangleAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            <p className="min-w-0 flex-1 leading-6">{error}</p>
            <button type="button" onClick={() => void load()} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3 text-xs font-semibold hover:bg-amber-100 dark:bg-transparent">
              <Lucide.RefreshCcw size={14} aria-hidden="true" />Thử lại
            </button>
          </div>
        ) : null}

        <div className={`grid gap-3 sm:grid-cols-2 xl:grid-cols-4 ${loading ? 'opacity-60' : ''}`}>
          <SummaryStat label="Tổng sự vụ" value={toCount(report?.totalCount)} />
          <SummaryStat label="Đang mở" value={toCount(report?.openCount)} toneClass="text-blue-700 dark:text-blue-300" />
          <SummaryStat label="Đã hoàn thành" value={toCount(report?.completedCount)} toneClass="text-emerald-700 dark:text-emerald-300" />
          <SummaryStat label="Có tọa độ" value={toCount(report?.mappedCount)} />
        </div>

        {loading && !report ? (
          <div className="h-64 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900" />
        ) : categoriesData.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/60">
            Không có sự vụ nào khớp với bộ lọc hiện tại.
          </p>
        ) : (
          <div className={`grid gap-4 ${showMap ? 'xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] xl:items-start' : ''}`}>
            <div className={`overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 ${showMap ? 'xl:h-[470px]' : ''}`}>
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.05em] text-slate-400">Danh mục sự vụ</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">Bấm một danh mục để xem phân bố theo phường</p>
                </div>
                {expandedCategory ? (
                  <span className="hidden rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 sm:inline-flex dark:bg-blue-500/10 dark:text-blue-300">
                    {expandedAreaRows.length} phường
                  </span>
                ) : null}
              </div>

              <div className="p-3">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {categoriesData.map((category) => {
                    const key = String(category?.categoryId ?? category?.categoryName);
                    const expanded = expandedCategoryId === key;
                    const count = toCount(category?.count);
                    const width = Math.max(4, (count / maxCategoryCount) * 100);
                    const areaRows = Array.isArray(category?.areas) ? category.areas : [];

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setExpandedCategoryId(expanded ? null : key)}
                        className={`min-w-0 rounded-xl border px-3 py-2.5 text-left transition ${
                          expanded
                            ? 'border-blue-200 bg-blue-50/70 shadow-sm dark:border-blue-500/30 dark:bg-blue-500/10'
                            : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-blue-500/30 dark:hover:bg-slate-900'
                        }`}
                        aria-expanded={expanded}
                      >
                        <div className="flex items-start gap-2.5">
                          <Lucide.ChevronRight
                            size={14}
                            className={`mt-0.5 shrink-0 text-slate-400 transition-transform ${expanded ? 'rotate-90 text-blue-600' : ''}`}
                            aria-hidden="true"
                          />
                          <span className="min-w-0 flex-1">
                            <strong className="block line-clamp-2 text-sm font-semibold leading-5 text-slate-900 dark:text-slate-100">
                              {category?.categoryName}
                            </strong>
                            <span className="mt-0.5 block text-[11px] leading-4 text-slate-400">
                              {toCount(category?.openCount)} mở · {toCount(category?.completedCount)} hoàn thành · {areaRows.length} phường
                            </span>
                          </span>
                          <span className="shrink-0 text-right">
                            <strong className="block text-sm font-semibold text-blue-700 dark:text-blue-300">{count}</strong>
                            <span className="block text-[10px] text-slate-400">{Number(category?.percentage ?? 0)}%</span>
                          </span>
                        </div>
                        <div className="ml-6 mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <span className="block h-full rounded-full bg-blue-500" style={{ width: `${width}%` }} />
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3 dark:border-slate-800 dark:bg-slate-900/40">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-400">
                        {expandedCategory ? 'Phường trong danh mục' : 'Phường có nhiều sự vụ'}
                      </p>
                      {expandedCategory ? (
                        <p className="mt-0.5 truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
                          {expandedCategory?.categoryName}
                        </p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-[11px] text-slate-400">{areaInsightRows.length} phường</span>
                  </div>

                  {areaInsightRows.length > 0 ? (
                    <div className="space-y-2">
                      {areaInsightRows.map((area, index) => {
                        const width = Math.max(6, (area.count / areaInsightMax) * 100);
                        return (
                          <div key={`${area.areaName}-${index}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
                            <strong className="min-w-0 truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
                              {area.areaName}
                            </strong>
                            <span className="text-[11px] font-semibold tabular-nums text-slate-500 dark:text-slate-300">
                              {area.count} sự vụ · {area.percentage}%
                            </span>
                            <div className="col-span-2 h-1.5 overflow-hidden rounded-full bg-white dark:bg-slate-800">
                              <span className="block h-full rounded-full bg-blue-500" style={{ width: `${width}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">Chưa có dữ liệu phân bố theo phường.</p>
                  )}
                </div>
              </div>
            </div>

            {showMap ? (
              <div className="h-[430px] self-start overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 xl:h-[470px] [&_.incident-map-shell]:!h-full">
                {mapIncidents.length === 0 ? (
                  <div className="flex h-full items-center justify-center px-6 text-center">
                    <div>
                      <Lucide.MapPinOff size={26} className="mx-auto text-slate-300 dark:text-slate-600" aria-hidden="true" />
                      <p className="mt-3 text-sm font-semibold text-slate-600 dark:text-slate-300">Chưa có sự vụ nào có tọa độ</p>
                      <p className="mt-1 text-xs text-slate-400">Sự vụ khớp bộ lọc nhưng chưa gắn vị trí sẽ không hiện trên bản đồ.</p>
                    </div>
                  </div>
                ) : (
                  <Suspense fallback={<div className="h-full animate-pulse bg-slate-100 dark:bg-slate-900" />}>
                    <IncidentMap
                      incidents={mapIncidents}
                      autoFitIncidents
                      fitRequestKey={`${filters.categoryId}:${filters.areaId}:${filters.range}:${mapIncidents.length}`}
                      areaBoundaryGeoJson={selectedAreaBoundary}
                      areaBoundaryKey={filters.areaId || null}
                      areaCenterLatitude={selectedArea?.centerLatitude ?? null}
                      areaCenterLongitude={selectedArea?.centerLongitude ?? null}
                      returnPath="/dashboard"
                      detailPathBuilder={(ticket) => `/manager/incidents/${ticket?.incidentId ?? ticket?.feedbackId}`}
                    />
                  </Suspense>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
};

export default IncidentDistributionPanel;
