import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { analyticsApi } from '../../services/api/analyticsApi';
import { SentimentDonutChart } from '../../components/charts/CustomCharts';
import {
  ManagerEmptyState,
  ManagerListRefreshIndicator,
  ManagerMetricCard,
  ManagerPageHeader,
  ManagerSectionHeader,
  ManagerSelectMenu,
} from '../../components/manager/ManagerPageElements';
import { buildSentimentViewModel, getNegativeListDisplay, getSentimentContentState } from './sentimentAnalytics';
import {
  getManagerIncidentPriorityLabel,
  getManagerIncidentSeverityLabel,
} from '../manager/managerIncidentUtils';

const EMPTY_ITEMS = [];
const CACHE_KEY = 'urbanmind:manager-sentiment:v2';
const CACHE_TTL_MS = 60_000;
const TIME_OPTIONS = [
  { value: '7d', label: '7 ngày gần đây' },
  { value: '30d', label: '30 ngày gần đây' },
  { value: '90d', label: '90 ngày gần đây' },
  { value: 'all', label: 'Toàn bộ dữ liệu' },
];
const SENTIMENT_ROWS = [
  { key: 'positive', label: 'Tích cực', icon: Lucide.SmilePlus, tone: 'bg-emerald-50 text-emerald-700', bar: 'bg-emerald-500' },
  { key: 'neutral', label: 'Trung tính', icon: Lucide.Meh, tone: 'bg-amber-50 text-amber-700', bar: 'bg-amber-500' },
  { key: 'negative', label: 'Tiêu cực', icon: Lucide.Frown, tone: 'bg-rose-50 text-rose-700', bar: 'bg-rose-500' },
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

const getHealthPresentation = (availability) => {
  if (availability === 'available') return { label: 'AI khả dụng', tone: 'text-emerald-700', dot: 'bg-emerald-500' };
  if (availability === 'unavailable') return { label: 'AI tạm không khả dụng', tone: 'text-rose-700', dot: 'bg-rose-500' };
  return { label: 'Chưa xác định trạng thái AI', tone: 'text-slate-500', dot: 'bg-slate-400' };
};

const formatDateTime = (value) => {
  if (!value) return 'Chưa rõ thời gian';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa rõ thời gian';
  return date.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
};

const toneForLevel = (value) => {
  const normalized = String(value || '').toLowerCase();
  if (['critical', 'urgent', 'severe'].includes(normalized)) return 'border-rose-200 bg-rose-50 text-rose-700';
  if (normalized === 'high') return 'border-orange-200 bg-orange-50 text-orange-700';
  return 'border-slate-200 bg-slate-50 text-slate-600';
};

const TrendBars = ({ points }) => {
  const maxTotal = Math.max(...points.map((point) => point.positive + point.neutral + point.negative), 1);
  return (
    <div className="min-w-0" role="img" aria-label="Xu hướng số phản ánh theo sắc thái trong khoảng thời gian đã chọn">
      <div className="flex h-52 items-end gap-2 sm:gap-3">
        {points.map((point) => {
          const total = point.positive + point.neutral + point.negative;
          const height = total > 0 ? Math.max(12, Math.round((total / maxTotal) * 176)) : 4;
          return (
            <div key={point.label} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
              <div className="flex w-full max-w-14 flex-col-reverse overflow-hidden rounded-t-lg bg-slate-100" style={{ height }} title={`${point.label}: ${total} phản ánh`}>
                {total > 0 ? <>
                  <span className="bg-emerald-500" style={{ height: `${(point.positive / total) * 100}%` }} />
                  <span className="bg-amber-500" style={{ height: `${(point.neutral / total) * 100}%` }} />
                  <span className="bg-rose-500" style={{ height: `${(point.negative / total) * 100}%` }} />
                </> : null}
              </div>
              <span className="w-full truncate text-center text-[10px] font-semibold text-slate-500 sm:text-[11px]">{point.label}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-slate-500">
        <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Tích cực</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-amber-500" />Trung tính</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-rose-500" />Tiêu cực</span>
      </div>
    </div>
  );
};

export const SentimentDashboard = () => {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const cached = useMemo(() => readCache(), []);
  const [data, setData] = useState(() => cached?.data || null);
  const [loading, setLoading] = useState(() => !cached?.data);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [negativeExpanded, setNegativeExpanded] = useState(false);
  const requestIdRef = useRef(0);

  const range = searchParams.get('range') || '30d';
  const areaId = searchParams.get('area') || 'all';
  const categoryId = searchParams.get('category') || 'all';
  const filters = useMemo(() => ({ range, areaId, categoryId }), [areaId, categoryId, range]);

  const updateFilter = useCallback((key, value) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (value === 'all' && key !== 'range') next.delete(key);
      else next.set(key, value);
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
      setError('Không thể tải dữ liệu cảm xúc từ hệ thống.');
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
  const model = useMemo(() => buildSentimentViewModel({ items, filters }), [filters, items]);
  const sentimentContentState = useMemo(() => getSentimentContentState(model.reviewedCount, model.classifiedCount), [model.classifiedCount, model.reviewedCount]);
  const negativeDisplay = useMemo(
    () => getNegativeListDisplay(model.negativeItems.length, negativeExpanded),
    [model.negativeItems.length, negativeExpanded],
  );
  const health = getHealthPresentation(data?.aiAvailability);
  const returnPath = `${location.pathname}${location.search || ''}`;

  useEffect(() => {
    setNegativeExpanded(false);
  }, [areaId, categoryId, range]);

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

  if (loading) {
    return (
      <article className="admin-page-shell space-y-5" aria-busy="true" aria-label="Đang tải phân tích cảm xúc">
        <ManagerPageHeader title="Cảm xúc người dân" description="Theo dõi sắc thái trong các phản ánh đã được AI phân tích để nhận biết tín hiệu cần ưu tiên." icon={Lucide.BrainCircuit} statusLabel="Trạng thái dữ liệu" statusValue="Đang tải" statusTone="warning" />
        <section className="grid gap-3 lg:grid-cols-3"><div className="h-20 animate-pulse rounded-2xl bg-slate-100 lg:col-span-3" /></section>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="admin-stat-card h-36 animate-pulse" />)}</section>
        <section className="grid gap-5 xl:grid-cols-2"><div className="admin-panel h-[390px] animate-pulse" /><div className="admin-panel h-[390px] animate-pulse" /></section>
        <section className="admin-panel h-72 animate-pulse" />
      </article>
    );
  }

  if (!data && error) {
    return (
      <article className="admin-page-shell space-y-5">
        <ManagerPageHeader title="Cảm xúc người dân" description="Theo dõi sắc thái trong các phản ánh đã được AI phân tích để nhận biết tín hiệu cần ưu tiên." icon={Lucide.BrainCircuit} statusLabel="Trạng thái dữ liệu" statusValue="Không thể tải" statusTone="danger" />
        <ManagerEmptyState icon={Lucide.CircleAlert} title="Chưa thể tải phân tích cảm xúc" description={`${error} Hệ thống không hiển thị số 0 thay cho dữ liệu bị lỗi.`} action={<button type="button" onClick={() => void fetchData()} className="btn admin-primary-action h-10 rounded-xl px-4 text-sm font-semibold normal-case"><Lucide.RefreshCw size={16} />Thử lại</button>} />
      </article>
    );
  }

  return (
    <article className="admin-page-shell space-y-5">
      <ManagerPageHeader
        title="Cảm xúc người dân"
        description="Theo dõi sắc thái trong các phản ánh đã được AI phân tích để nhận biết tín hiệu cần ưu tiên."
        icon={Lucide.BrainCircuit}
        statusLabel="Sắc thái nổi bật"
        statusValue={model.dominantLabel}
        statusTone={model.dominantLabel === 'Tiêu cực' ? 'danger' : model.dominantLabel === 'Tích cực' ? 'success' : 'neutral'}
        actions={<button type="button" onClick={() => void fetchData({ background: true })} disabled={refreshing} className="btn admin-secondary-action h-10 rounded-xl px-4 text-sm font-semibold normal-case"><Lucide.RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />{refreshing ? 'Đang cập nhật' : 'Làm mới'}</button>}
      />

      {error ? <section className="admin-error-note flex items-center gap-3 p-4" role="alert"><Lucide.CircleAlert size={18} className="shrink-0" /><p className="text-sm font-medium">{error} Đang giữ dữ liệu đã tải gần nhất.</p></section> : null}

      <section className="admin-panel px-4 py-4 sm:px-5" aria-label="Bộ lọc phân tích cảm xúc">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-3">
            <ManagerSelectMenu value={range} onChange={(value) => updateFilter('range', value)} options={TIME_OPTIONS} ariaLabel="Lọc theo thời gian" />
            <ManagerSelectMenu value={areaId} onChange={(value) => updateFilter('area', value)} options={areaOptions} ariaLabel="Lọc theo khu vực" />
            <ManagerSelectMenu value={categoryId} onChange={(value) => updateFilter('category', value)} options={categoryOptions} ariaLabel="Lọc theo danh mục" />
          </div>
          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-100 pt-3 xl:border-l xl:border-t-0 xl:pl-4 xl:pt-0">
            <span className={`inline-flex items-center gap-2 text-xs font-semibold ${health.tone}`}><i className={`h-2 w-2 rounded-full ${health.dot}`} />{health.label}</span>
            <ManagerListRefreshIndicator visible={refreshing} label="Đang làm mới" />
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Chỉ số cảm xúc tổng quan">
        <ManagerMetricCard label="Đã phân loại" value={model.classifiedCount} description={model.unclassifiedCount > 0 ? `${model.unclassifiedCount} phản ánh đã được AI phân tích nhưng chưa có nhãn cảm xúc hợp lệ.` : `${model.reviewedCount} phản ánh đã được AI phân tích trong phạm vi lọc.`} icon={Lucide.ScanText} toneClass="bg-blue-50 text-blue-700" />
        <ManagerMetricCard label="Tích cực" value={model.counts.positive} description={`${model.rates.positive}% phản ánh đã phân loại.`} icon={Lucide.SmilePlus} toneClass="bg-emerald-50 text-emerald-700" />
        <ManagerMetricCard label="Trung tính" value={model.counts.neutral} description={`${model.rates.neutral}% phản ánh đã phân loại.`} icon={Lucide.Meh} toneClass="bg-amber-50 text-amber-700" />
        <ManagerMetricCard label="Tiêu cực" value={model.counts.negative} description={`${model.rates.negative}% phản ánh đã phân loại.`} icon={Lucide.Frown} toneClass="bg-rose-50 text-rose-700" />
      </section>

      {sentimentContentState.kind !== 'ready' ? (
        <ManagerEmptyState
          icon={sentimentContentState.kind === 'no-classified' ? Lucide.ScanText : Lucide.MessagesSquare}
          title={sentimentContentState.title}
          description={sentimentContentState.description}
        />
      ) : (
        <section className="grid gap-5 xl:grid-cols-2">
          <article className="admin-panel overflow-hidden">
            <ManagerSectionHeader title="Phân bố cảm xúc" description="Tỷ trọng được tính trên các phản ánh có nhãn cảm xúc hợp lệ trong phạm vi lọc." icon={Lucide.ChartPie} />
            <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-center xl:grid-cols-1 2xl:grid-cols-[220px_minmax(0,1fr)]">
              <SentimentDonutChart positive={model.counts.positive} neutral={model.counts.neutral} negative={model.counts.negative} />
              <div className="space-y-4">
                {SENTIMENT_ROWS.map((item) => {
                  const Icon = item.icon;
                  const count = model.counts[item.key];
                  const rate = model.rates[item.key];
                  return <div key={item.key}><div className="mb-2 flex items-center justify-between gap-3"><span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700"><i className={`flex h-8 w-8 items-center justify-center rounded-lg ${item.tone}`}><Icon size={15} /></i>{item.label}</span><strong className="text-sm tabular-nums text-slate-950">{count} · {rate}%</strong></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${item.bar}`} style={{ width: `${rate}%` }} /></div></div>;
                })}
                <p className="rounded-xl bg-slate-50 px-3.5 py-3 text-sm leading-6 text-slate-600">{model.classifiedCount > 0 ? model.dominantLabel === 'Phân bố cân bằng' ? `Không có một nhóm cảm xúc chiếm ưu thế rõ ràng; nhóm cao nhất chiếm ${model.dominantRate}%.` : `${model.dominantLabel} là sắc thái chiếm tỷ trọng cao nhất (${model.dominantRate}%).` : 'Các phản ánh trong phạm vi này chưa có nhãn cảm xúc hợp lệ.'}</p>
              </div>
            </div>
          </article>

          <article className="admin-panel overflow-hidden">
            <ManagerSectionHeader title="Diễn biến theo thời gian" description="Số phản ánh tích cực, trung tính và tiêu cực theo từng kỳ trong phạm vi đang xem." icon={Lucide.ChartNoAxesCombined} />
            <div className="p-5 sm:p-6"><TrendBars points={model.trend} /></div>
          </article>
        </section>
      )}

      <section className="admin-panel overflow-hidden">
        <ManagerSectionHeader
          title="Phản ánh tiêu cực cần chú ý"
          description={`Hiển thị ${negativeDisplay.visibleCount} / ${model.negativeItems.length} phản ánh tiêu cực ưu tiên theo mức độ nghiêm trọng, độ ưu tiên và thời gian.`}
          icon={Lucide.ShieldAlert}
        />
        {model.negativeItems.length === 0 ? (
          <div className="p-5 sm:p-6"><ManagerEmptyState icon={Lucide.CircleCheckBig} title="Không có phản ánh tiêu cực trong phạm vi này" description="Hiện chưa có phản ánh mang nhãn tiêu cực theo bộ lọc đang chọn." /></div>
        ) : (
          <ol className="divide-y divide-slate-100">
            {model.negativeItems.slice(0, negativeDisplay.visibleCount).map((item) => {
              const feedback = item.feedback || {};
              const analysis = item.analysisResult || {};
              const confidence = Number(analysis.confidenceScore);
              const confidenceText = Number.isFinite(confidence) ? `${Math.round(confidence * (confidence <= 1 ? 100 : 1))}% tin cậy` : 'Chưa có độ tin cậy';
              return (
                <li key={feedback.feedbackId} className="px-4 py-3.5 sm:px-5 sm:py-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${toneForLevel(feedback.severity || analysis.severityLevel)}`}>{getManagerIncidentSeverityLabel(feedback.severity || analysis.severityLevel)}</span>
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${toneForLevel(feedback.priority || analysis.urgencyLevel)}`}>{getManagerIncidentPriorityLabel(feedback.priority || analysis.urgencyLevel)}</span>
                        <span className="text-xs font-medium text-slate-500">{confidenceText}</span>
                      </div>
                      <h3 className="mt-1.5 truncate text-sm font-semibold text-slate-950 sm:text-[15px]">{feedback.title || 'Phản ánh chưa có tiêu đề'}</h3>
                      <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-600">{analysis.summary || 'AI chưa cung cấp tóm tắt cho phản ánh này.'}</p>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500"><span>{feedback.areaName || 'Chưa rõ khu vực'}</span><span>{feedback.categoryName || 'Chưa rõ danh mục'}</span><span>{formatDateTime(analysis.createdAt || feedback.createdAt)}</span></div>
                    </div>
                    <div className="shrink-0">
                      {feedback.incidentId ? <Link to={`/manager/incidents/${feedback.incidentId}`} state={{ from: returnPath }} className="btn admin-secondary-action h-9 rounded-xl px-3 text-xs font-semibold normal-case">Xem sự vụ <Lucide.ArrowUpRight size={14} /></Link> : <Link to="/manager/reports/review" state={{ mapState: { focusFeedbackId: feedback.feedbackId }, from: returnPath }} className="btn admin-secondary-action h-9 rounded-xl px-3 text-xs font-semibold normal-case">Xem phản ánh <Lucide.ArrowUpRight size={14} /></Link>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        {model.negativeItems.length > 4 ? (
          <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="text-xs leading-5 text-slate-500">
              Bảng phân tích chỉ hiển thị tối đa 6 phản ánh ưu tiên; mở danh sách đầy đủ để tìm kiếm, lọc và phân trang khi cần.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setNegativeExpanded((current) => !current)}
                className="btn admin-secondary-action h-9 shrink-0 rounded-xl px-3 text-xs font-semibold normal-case"
              >
                {negativeExpanded ? 'Thu gọn' : `Xem thêm ${negativeDisplay.hiddenCount} phản ánh`}
                <Lucide.ChevronDown
                  size={14}
                  className={negativeExpanded ? 'rotate-180 transition-transform' : 'transition-transform'}
                  aria-hidden="true"
                />
              </button>
              <Link
                to={`/analytics/sentiment/negative${location.search || ''}`}
                className="btn admin-primary-action h-9 shrink-0 rounded-xl px-3 text-xs font-semibold normal-case"
              >
                Xem tất cả {model.negativeItems.length} phản ánh
                <Lucide.ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
          </div>
        ) : model.negativeItems.length > 0 ? (
          <div className="flex justify-end border-t border-slate-100 px-4 py-3 sm:px-5">
            <Link
              to={`/analytics/sentiment/negative${location.search || ''}`}
              className="btn admin-secondary-action h-9 rounded-xl px-3 text-xs font-semibold normal-case"
            >
              Xem danh sách đầy đủ
              <Lucide.ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        ) : null}
      </section>

      <aside className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/50 px-4 py-3.5 sm:px-5" aria-label="Lưu ý về phân tích cảm xúc"><Lucide.Info className="mt-0.5 shrink-0 text-blue-700" size={17} /><p className="text-sm leading-6 text-slate-600"><strong className="font-semibold text-slate-950">Lưu ý:</strong> Cảm xúc là tín hiệu hỗ trợ sàng lọc. Cần đối chiếu nội dung phản ánh, bối cảnh, lịch sử tương tác và trạng thái sự vụ trước khi ra quyết định.</p></aside>
    </article>
  );
};
