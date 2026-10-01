import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { analyticsApi } from '../../services/api/analyticsApi';
import {
  ManagerEmptyState,
  ManagerListRefreshIndicator,
  ManagerPageHeader,
  ManagerSelectMenu,
} from '../../components/manager/ManagerPageElements';
import {
  buildSentimentViewModel,
  filterNegativeItems,
  paginateItems,
} from './sentimentAnalytics';
import {
  getManagerIncidentPriorityLabel,
  getManagerIncidentSeverityLabel,
} from '../manager/managerIncidentUtils';

const EMPTY_ITEMS = [];
const CACHE_KEY = 'urbanmind:manager-sentiment:v2';
const CACHE_TTL_MS = 60_000;
const PAGE_SIZE = 20;

const TIME_OPTIONS = [
  { value: '7d', label: '7 ngày gần đây' },
  { value: '30d', label: '30 ngày gần đây' },
  { value: '90d', label: '90 ngày gần đây' },
  { value: 'all', label: 'Toàn bộ dữ liệu' },
];
const INCIDENT_OPTIONS = [
  { value: 'all', label: 'Tất cả trạng thái liên kết' },
  { value: 'linked', label: 'Đã có sự vụ' },
  { value: 'unlinked', label: 'Chưa có sự vụ' },
];

const readCache = () => {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
    if (!parsed?.savedAt || !Array.isArray(parsed?.data?.items)) return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeCache = (data) => {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, savedAt: Date.now() }));
  } catch {
    // Cache is optional.
  }
};

const formatDateTime = (value) => {
  if (!value) return 'Chưa rõ thời gian';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa rõ thời gian';
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const toneForLevel = (value) => {
  const normalized = String(value || '').toLowerCase();
  if (['critical', 'urgent', 'severe'].includes(normalized)) return 'border-rose-200 bg-rose-50 text-rose-700';
  if (normalized === 'high') return 'border-orange-200 bg-orange-50 text-orange-700';
  return 'border-slate-200 bg-slate-50 text-slate-600';
};

const buildEnumOptions = (items, field, getLabel, allLabel) => {
  const values = new Map();
  items.forEach((item) => {
    const feedback = item?.feedback || {};
    const analysis = item?.analysisResult || {};
    const raw = field === 'severity'
      ? feedback.severity || analysis.severityLevel
      : feedback.priority || analysis.urgencyLevel;
    const value = String(raw || '').trim();
    if (value) values.set(value, getLabel(value));
  });
  return [
    { value: 'all', label: allLabel },
    ...Array.from(values, ([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'vi')),
  ];
};

export const SentimentNegativeListPage = () => {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const cached = useMemo(() => readCache(), []);
  const [data, setData] = useState(() => cached?.data || null);
  const [loading, setLoading] = useState(() => !cached?.data);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const requestIdRef = useRef(0);

  const range = searchParams.get('range') || '30d';
  const areaId = searchParams.get('area') || 'all';
  const categoryId = searchParams.get('category') || 'all';
  const search = searchParams.get('q') || '';
  const severity = searchParams.get('severity') || 'all';
  const priority = searchParams.get('priority') || 'all';
  const incidentState = searchParams.get('incident') || 'all';
  const requestedPage = Math.max(1, Number(searchParams.get('page')) || 1);

  const updateParams = useCallback((changes) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      Object.entries(changes).forEach(([key, value]) => {
        if (!value || value === 'all' || (key === 'page' && Number(value) <= 1)) next.delete(key);
        else next.set(key, String(value));
      });
      if (!Object.prototype.hasOwnProperty.call(changes, 'page')) next.delete('page');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const fetchData = useCallback(async ({ background = false } = {}) => {
    const requestId = ++requestIdRef.current;
    if (background) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const response = await analyticsApi.getManagerSentimentStats();
      if (requestId !== requestIdRef.current) return;
      if (!response || !Array.isArray(response.items)) throw new Error('Sentiment analytics response is incomplete');
      setData(response);
      writeCache(response);
    } catch (fetchError) {
      if (requestId !== requestIdRef.current) return;
      console.error(fetchError);
      setError('Không thể tải danh sách phản ánh tiêu cực từ hệ thống.');
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    const fresh = cached?.savedAt && Date.now() - cached.savedAt < CACHE_TTL_MS;
    if (!fresh) void fetchData({ background: Boolean(cached?.data) });
    return () => { requestIdRef.current += 1; };
  }, [cached, fetchData]);

  const items = Array.isArray(data?.items) ? data.items : EMPTY_ITEMS;
  const scopeModel = useMemo(() => buildSentimentViewModel({
    items,
    filters: { range, areaId, categoryId },
  }), [areaId, categoryId, items, range]);

  const areaOptions = useMemo(() => {
    const map = new Map();
    items.forEach((item) => {
      const feedback = item?.feedback;
      if (feedback?.areaId != null) map.set(String(feedback.areaId), feedback.areaName || `Khu vực ${feedback.areaId}`);
    });
    return [{ value: 'all', label: 'Tất cả khu vực' }, ...Array.from(map, ([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, 'vi'))];
  }, [items]);

  const categoryOptions = useMemo(() => {
    const map = new Map();
    items.forEach((item) => {
      const feedback = item?.feedback;
      if (feedback?.categoryId != null) map.set(String(feedback.categoryId), feedback.categoryName || `Danh mục ${feedback.categoryId}`);
    });
    return [{ value: 'all', label: 'Tất cả danh mục' }, ...Array.from(map, ([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, 'vi'))];
  }, [items]);

  const severityOptions = useMemo(() => buildEnumOptions(
    scopeModel.negativeItems,
    'severity',
    getManagerIncidentSeverityLabel,
    'Tất cả mức nghiêm trọng',
  ), [scopeModel.negativeItems]);
  const priorityOptions = useMemo(() => buildEnumOptions(
    scopeModel.negativeItems,
    'priority',
    getManagerIncidentPriorityLabel,
    'Tất cả mức ưu tiên',
  ), [scopeModel.negativeItems]);

  const filteredItems = useMemo(() => filterNegativeItems(scopeModel.negativeItems, {
    search,
    severity,
    priority,
    incidentState,
  }), [incidentState, priority, scopeModel.negativeItems, search, severity]);
  const pagination = useMemo(() => paginateItems(filteredItems, requestedPage, PAGE_SIZE), [filteredItems, requestedPage]);
  const returnPath = `${location.pathname}${location.search || ''}`;
  const hasSecondaryFilters = Boolean(search || severity !== 'all' || priority !== 'all' || incidentState !== 'all');

  useEffect(() => {
    if (requestedPage !== pagination.currentPage) updateParams({ page: pagination.currentPage });
  }, [pagination.currentPage, requestedPage, updateParams]);

  if (loading) {
    return (
      <article className="admin-page-shell space-y-5" aria-busy="true" aria-label="Đang tải phản ánh tiêu cực">
        <ManagerPageHeader title="Phản ánh tiêu cực" description="Tìm kiếm, lọc và xử lý các phản ánh có sắc thái tiêu cực đã được AI phân tích." icon={Lucide.ShieldAlert} statusLabel="Trạng thái dữ liệu" statusValue="Đang tải" statusTone="warning" />
        <section className="admin-panel h-32 animate-pulse" />
        <section className="admin-panel h-96 animate-pulse" />
      </article>
    );
  }

  if (!data && error) {
    return (
      <article className="admin-page-shell space-y-5">
        <ManagerPageHeader title="Phản ánh tiêu cực" description="Tìm kiếm, lọc và xử lý các phản ánh có sắc thái tiêu cực đã được AI phân tích." icon={Lucide.ShieldAlert} statusLabel="Trạng thái dữ liệu" statusValue="Không thể tải" statusTone="danger" />
        <ManagerEmptyState icon={Lucide.CircleAlert} title="Chưa thể tải danh sách phản ánh tiêu cực" description={error} action={<button type="button" onClick={() => void fetchData()} className="btn admin-primary-action h-10 rounded-xl px-4 text-sm font-semibold normal-case"><Lucide.RefreshCw size={16} />Thử lại</button>} />
      </article>
    );
  }

  return (
    <article className="admin-page-shell space-y-5">
      <ManagerPageHeader
        title="Phản ánh tiêu cực"
        description="Tìm kiếm, lọc và phân trang thay vì cuộn qua toàn bộ dữ liệu. AI chỉ hỗ trợ sàng lọc; Manager vẫn quyết định xử lý."
        icon={Lucide.ShieldAlert}
        statusLabel="Kết quả"
        statusValue={`${filteredItems.length} phản ánh`}
        statusTone={filteredItems.length > 0 ? 'danger' : 'neutral'}
        actions={<div className="flex flex-wrap items-center gap-2"><Link to={`/analytics/sentiment${location.search ? `?${new URLSearchParams([...searchParams].filter(([key]) => ['range', 'area', 'category'].includes(key))).toString()}` : ''}`} className="btn admin-secondary-action h-10 rounded-xl px-4 text-sm font-semibold normal-case"><Lucide.ArrowLeft size={16} />Quay lại tổng quan</Link><button type="button" onClick={() => void fetchData({ background: true })} disabled={refreshing} className="btn admin-secondary-action h-10 rounded-xl px-4 text-sm font-semibold normal-case"><Lucide.RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />{refreshing ? 'Đang cập nhật' : 'Làm mới'}</button></div>}
      />

      {error ? <section className="admin-error-note flex items-center gap-3 p-4" role="alert"><Lucide.CircleAlert size={18} className="shrink-0" /><p className="text-sm font-medium">{error} Đang giữ dữ liệu đã tải gần nhất.</p></section> : null}

      <section className="admin-panel p-4 sm:p-5" aria-label="Bộ lọc phản ánh tiêu cực">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="relative block xl:col-span-2">
            <Lucide.Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input value={search} onChange={(event) => updateParams({ q: event.target.value })} placeholder="Tìm theo tiêu đề, mã, nội dung, khu vực..." className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10" aria-label="Tìm kiếm phản ánh tiêu cực" />
          </label>
          <ManagerSelectMenu value={range} onChange={(value) => updateParams({ range: value })} options={TIME_OPTIONS} ariaLabel="Lọc theo thời gian" />
          <ManagerSelectMenu value={incidentState} onChange={(value) => updateParams({ incident: value })} options={INCIDENT_OPTIONS} ariaLabel="Lọc theo trạng thái liên kết sự vụ" />
          <ManagerSelectMenu value={areaId} onChange={(value) => updateParams({ area: value })} options={areaOptions} ariaLabel="Lọc theo khu vực" />
          <ManagerSelectMenu value={categoryId} onChange={(value) => updateParams({ category: value })} options={categoryOptions} ariaLabel="Lọc theo danh mục" />
          <ManagerSelectMenu value={severity} onChange={(value) => updateParams({ severity: value })} options={severityOptions} ariaLabel="Lọc theo mức độ nghiêm trọng" />
          <ManagerSelectMenu value={priority} onChange={(value) => updateParams({ priority: value })} options={priorityOptions} ariaLabel="Lọc theo mức độ ưu tiên" />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <p className="text-xs text-slate-500">Phạm vi hiện có {scopeModel.negativeItems.length} phản ánh tiêu cực; hiển thị {pagination.items.length} mục trên trang này.</p>
          <div className="flex items-center gap-2"><ManagerListRefreshIndicator visible={refreshing} label="Đang làm mới" />{hasSecondaryFilters ? <button type="button" onClick={() => updateParams({ q: '', severity: 'all', priority: 'all', incident: 'all' })} className="btn admin-secondary-action h-9 rounded-xl px-3 text-xs font-semibold normal-case"><Lucide.RotateCcw size={14} />Xóa lọc chi tiết</button> : null}</div>
        </div>
      </section>

      <section className="admin-panel overflow-hidden">
        {pagination.totalItems === 0 ? (
          <div className="p-5 sm:p-6"><ManagerEmptyState icon={Lucide.SearchX} title="Không tìm thấy phản ánh phù hợp" description="Thử đổi từ khóa hoặc bộ lọc để mở rộng kết quả." /></div>
        ) : (
          <>
            <ol className="divide-y divide-slate-100">
              {pagination.items.map((item) => {
                const feedback = item.feedback || {};
                const analysis = item.analysisResult || {};
                const confidence = Number(analysis.confidenceScore);
                const confidenceText = Number.isFinite(confidence) ? `${Math.round(confidence * (confidence <= 1 ? 100 : 1))}% tin cậy` : 'Chưa có độ tin cậy';
                return (
                  <li key={feedback.feedbackId} className="px-4 py-4 sm:px-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${toneForLevel(feedback.severity || analysis.severityLevel)}`}>{getManagerIncidentSeverityLabel(feedback.severity || analysis.severityLevel)}</span>
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${toneForLevel(feedback.priority || analysis.urgencyLevel)}`}>{getManagerIncidentPriorityLabel(feedback.priority || analysis.urgencyLevel)}</span>
                          <span className="text-xs font-medium text-slate-500">{confidenceText}</span>
                          {feedback.incidentId ? <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">Đã có sự vụ</span> : <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">Chưa có sự vụ</span>}
                        </div>
                        <h2 className="mt-1.5 truncate text-sm font-semibold text-slate-950 sm:text-[15px]">{feedback.title || 'Phản ánh chưa có tiêu đề'}</h2>
                        <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-600">{analysis.summary || feedback.description || 'AI chưa cung cấp tóm tắt cho phản ánh này.'}</p>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500"><span>{feedback.areaName || 'Chưa rõ khu vực'}</span><span>{feedback.categoryName || 'Chưa rõ danh mục'}</span><span>{formatDateTime(analysis.createdAt || feedback.createdAt)}</span></div>
                      </div>
                      <div className="shrink-0">{feedback.incidentId ? <Link to={`/manager/incidents/${feedback.incidentId}`} state={{ from: returnPath }} className="btn admin-secondary-action h-9 rounded-xl px-3 text-xs font-semibold normal-case">Xem sự vụ <Lucide.ArrowUpRight size={14} /></Link> : <Link to="/manager/reports/review" state={{ mapState: { focusFeedbackId: feedback.feedbackId }, from: returnPath }} className="btn admin-secondary-action h-9 rounded-xl px-3 text-xs font-semibold normal-case">Xem phản ánh <Lucide.ArrowUpRight size={14} /></Link>}</div>
                    </div>
                  </li>
                );
              })}
            </ol>
            <footer className="manager-pagination flex flex-col gap-3 border-t border-slate-200 px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-slate-500">Trang <span className="font-semibold text-slate-700">{pagination.currentPage}</span> / {pagination.totalPages} · {pagination.totalItems} phản ánh</p>
              <div className="flex items-center gap-2"><button type="button" disabled={pagination.currentPage <= 1} onClick={() => updateParams({ page: pagination.currentPage - 1 })} className="btn btn-outline h-10 min-h-0 rounded-xl border-slate-300 px-3 text-sm disabled:opacity-50"><Lucide.ChevronLeft size={16} />Trước</button><button type="button" disabled={pagination.currentPage >= pagination.totalPages} onClick={() => updateParams({ page: pagination.currentPage + 1 })} className="btn btn-outline h-10 min-h-0 rounded-xl border-slate-300 px-3 text-sm disabled:opacity-50">Sau<Lucide.ChevronRight size={16} /></button></div>
            </footer>
          </>
        )}
      </section>
    </article>
  );
};
