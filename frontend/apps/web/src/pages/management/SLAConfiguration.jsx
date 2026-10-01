import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as Lucide from 'lucide-react';
import { slaApi } from '../../services/api/slaApi';
import { ErrorAlert, SuccessAlert } from '../../components/alerts/ErrorAlert';
import {
  AdminEmptyState,
  AdminErrorState,
} from '../../components/admin/AdminDataStates';
import { getCategoryLabel } from '../../utils/categoryLabels';
import {
  ManagerConfirmDialog,
  ManagerListRefreshIndicator,
  ManagerSelectMenu,
} from '../../components/manager/ManagerPageElements';

const PRIORITIES = [
  { value: 'Urgent', label: 'Khẩn cấp', className: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300' },
  { value: 'High', label: 'Cao', className: 'bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300' },
  { value: 'Medium', label: 'Trung bình', className: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  { value: 'Low', label: 'Thấp', className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
];

const EMPTY_FORM = {
  policyName: '',
  areaId: '',
  categoryId: '',
  priority: 'Medium',
  responseTimeMinutes: '60',
  resolutionTimeMinutes: '1440',
  effectiveFrom: '',
  effectiveTo: '',
  isActive: true,
};

const EMPTY_FILTERS = {
  priority: '',
  areaId: '',
  categoryId: '',
  isActive: '',
  isCurrentlyEffective: '',
};

const toLocalInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
};

const formatDate = (value) => {
  if (!value) return 'Không giới hạn';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatMinutes = (value) => {
  const minutes = Number(value || 0);
  if (minutes < 60) return `${minutes} phút`;
  if (minutes % 1440 === 0) return `${minutes / 1440} ngày`;
  if (minutes % 60 === 0) return `${minutes / 60} giờ`;
  return `${Math.floor(minutes / 60)} giờ ${minutes % 60} phút`;
};

const normalizePriorityValue = (value) => value === 'Critical' ? 'Urgent' : value;
const getPriority = (value) => PRIORITIES.find((item) => item.value === normalizePriorityValue(value)) || PRIORITIES[2];
const getErrorMessage = (error, fallback) => error?.response?.data?.msg || error?.response?.data?.message || error?.message || fallback;

const normalizeForm = (policy) => policy ? {
  policyName: policy.policyName || '',
  areaId: policy.areaId ?? '',
  categoryId: policy.categoryId ?? '',
  priority: normalizePriorityValue(policy.priority) || 'Medium',
  responseTimeMinutes: String(policy.responseTimeMinutes ?? ''),
  resolutionTimeMinutes: String(policy.resolutionTimeMinutes ?? ''),
  effectiveFrom: toLocalInput(policy.effectiveFrom),
  effectiveTo: toLocalInput(policy.effectiveTo),
  isActive: Boolean(policy.isActive),
} : { ...EMPTY_FORM, effectiveFrom: toLocalInput(new Date()) };

const buildPayload = (form) => ({
  policyName: form.policyName.trim(),
  areaId: form.areaId === '' ? null : Number(form.areaId),
  categoryId: form.categoryId === '' ? null : Number(form.categoryId),
  priority: form.priority,
  responseTimeMinutes: Number(form.responseTimeMinutes),
  resolutionTimeMinutes: Number(form.resolutionTimeMinutes),
  effectiveFrom: new Date(form.effectiveFrom).toISOString(),
  effectiveTo: form.effectiveTo ? new Date(form.effectiveTo).toISOString() : null,
  isActive: Boolean(form.isActive),
});

const PolicySkeleton = () => (
  <div className="space-y-3" role="status">
    {Array.from({ length: 6 }).map((_, index) => (
      <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-100 dark:bg-white/[0.06]" />
    ))}
    <span className="sr-only">Đang tải chính sách SLA</span>
  </div>
);

export const SLAConfiguration = () => {
  const [policies, setPolicies] = useState([]);
  const [dashboardOverview, setDashboardOverview] = useState(null);
  const [areas, setAreas] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(true);
  const [lookupError, setLookupError] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ totalItems: 0, totalPages: 0, hasPreviousPage: false, hasNextPage: false });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [form, setForm] = useState(() => normalizeForm(null));
  const [initialForm, setInitialForm] = useState(() => normalizeForm(null));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const policyRequestRef = useRef(0);

  const isDirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initialForm), [form, initialForm]);
  const hasFilters = Boolean(search || filters.priority || filters.areaId || filters.categoryId || filters.isActive || filters.isCurrentlyEffective);

  const areaOptions = useMemo(() => [
    { value: '', label: lookupLoading ? 'Đang tải khu vực...' : 'Tất cả khu vực' },
    ...areas.map((item) => ({ value: item.areaId ?? item.id, label: item.areaName || item.name })),
  ], [areas, lookupLoading]);

  const categoryOptions = useMemo(() => [
    { value: '', label: lookupLoading ? 'Đang tải danh mục...' : 'Tất cả danh mục' },
    ...categories.map((item) => ({ value: item.categoryId ?? item.id, label: getCategoryLabel(item.categoryName || item.name) })),
  ], [categories, lookupLoading]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadLookups = useCallback(async () => {
    setLookupLoading(true);
    setLookupError('');
    const [areaResult, categoryResult] = await Promise.allSettled([
      slaApi.getAreas(),
      slaApi.getCategories(),
    ]);

    const failed = [];
    if (areaResult.status === 'fulfilled') {
      setAreas(Array.isArray(areaResult.value) ? areaResult.value : []);
    } else {
      failed.push('khu vực');
    }

    if (categoryResult.status === 'fulfilled') {
      setCategories(Array.isArray(categoryResult.value) ? categoryResult.value : []);
    } else {
      failed.push('danh mục');
    }

    if (failed.length > 0) {
      setLookupError(`Không thể tải ${failed.join(' và ')}. Hãy làm mới trước khi tạo hoặc chỉnh sửa chính sách.`);
    }
    setLookupLoading(false);
  }, []);

  const loadPolicies = useCallback(async ({ keepCurrent = false } = {}) => {
    const requestId = policyRequestRef.current + 1;
    policyRequestRef.current = requestId;
    keepCurrent ? setRefreshing(true) : setLoading(true);
    setError('');

    try {
      const response = await slaApi.getPolicies({
        search: debouncedSearch,
        priority: filters.priority,
        areaId: filters.areaId,
        categoryId: filters.categoryId,
        isActive: filters.isActive === '' ? undefined : filters.isActive === 'true',
        isCurrentlyEffective: filters.isCurrentlyEffective === '' ? undefined : filters.isCurrentlyEffective === 'true',
        pageNumber: page,
        pageSize: 10,
      });
      if (requestId !== policyRequestRef.current) return;

      const items = Array.isArray(response?.items) ? response.items : [];
      setPolicies(items);
      setPagination({
        totalItems: Number(response?.totalItems ?? items.length),
        totalPages: Number(response?.totalPages ?? 0),
        hasPreviousPage: Boolean(response?.hasPreviousPage),
        hasNextPage: Boolean(response?.hasNextPage),
      });
    } catch {
      if (requestId !== policyRequestRef.current) return;
      if (!keepCurrent) setPolicies([]);
      setError('Không thể tải chính sách SLA. Vui lòng thử lại sau hoặc liên hệ quản trị hệ thống.');
    } finally {
      if (requestId === policyRequestRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [debouncedSearch, filters, page]);

  const loadDashboardOverview = useCallback(async () => {
    try {
      const response = await slaApi.getDashboardOverview();
      setDashboardOverview(response || null);
    } catch {
      setDashboardOverview(null);
    }
  }, []);

  useEffect(() => { loadLookups(); }, [loadLookups]);
  useEffect(() => { loadDashboardOverview(); }, [loadDashboardOverview]);
  useEffect(() => { loadPolicies({ keepCurrent: policies.length > 0 }); }, [loadPolicies]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!modalOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [modalOpen]);

  useEffect(() => {
    const beforeUnload = (event) => {
      if (!modalOpen || !isDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [isDirty, modalOpen]);

  const openModal = (policy = null) => {
    const next = normalizeForm(policy);
    setEditingPolicy(policy);
    setForm(next);
    setInitialForm(next);
    setFormError('');
    setModalOpen(true);
  };

  const closeModalNow = () => {
    setModalOpen(false);
    setConfirmAction(null);
  };

  const requestCloseModal = () => {
    if (!isDirty) {
      closeModalNow();
      return;
    }
    setConfirmAction({
      type: 'discard',
      title: 'Bỏ các thay đổi chưa lưu?',
      description: 'Các thay đổi trong biểu mẫu sẽ bị mất nếu bạn đóng ngay bây giờ.',
      confirmLabel: 'Bỏ thay đổi',
      tone: 'warning',
    });
  };

  const handleRefresh = () => {
    if (modalOpen && isDirty) {
      setConfirmAction({
        type: 'refresh',
        title: 'Làm mới và bỏ thay đổi?',
        description: 'Biểu mẫu hiện có thay đổi chưa lưu. Làm mới sẽ đóng biểu mẫu và tải lại dữ liệu.',
        confirmLabel: 'Làm mới',
        tone: 'warning',
      });
      return;
    }
    if (modalOpen) setModalOpen(false);
    void Promise.all([
      loadPolicies({ keepCurrent: policies.length > 0 }),
      loadDashboardOverview(),
      loadLookups(),
    ]);
  };

  const validateForm = () => {
    const responseMinutes = Number(form.responseTimeMinutes);
    const resolutionMinutes = Number(form.resolutionTimeMinutes);
    const fromDate = new Date(form.effectiveFrom);
    const toDate = form.effectiveTo ? new Date(form.effectiveTo) : null;

    if (!form.policyName.trim()) return 'Vui lòng nhập tên chính sách.';
    if (!form.effectiveFrom || Number.isNaN(fromDate.getTime())) return 'Vui lòng chọn ngày bắt đầu hiệu lực hợp lệ.';
    if (!Number.isInteger(responseMinutes) || responseMinutes <= 0) return 'Thời gian phản hồi phải là số nguyên lớn hơn 0 phút.';
    if (!Number.isInteger(resolutionMinutes) || resolutionMinutes <= 0) return 'Thời gian hoàn thành phải là số nguyên lớn hơn 0 phút.';
    if (resolutionMinutes < responseMinutes) return 'Thời gian hoàn thành phải lớn hơn hoặc bằng thời gian phản hồi.';
    if (toDate && (Number.isNaN(toDate.getTime()) || toDate <= fromDate)) return 'Ngày kết thúc phải sau ngày bắt đầu.';
    if (lookupLoading) return 'Danh sách khu vực và danh mục vẫn đang tải. Vui lòng chờ một chút.';
    if (lookupError) return lookupError;
    return '';
  };

  const requestSave = (event) => {
    event.preventDefault();
    const validation = validateForm();
    if (validation) {
      setFormError(validation);
      return;
    }
    setFormError('');
    setConfirmAction({
      type: 'save',
      title: editingPolicy ? 'Lưu thay đổi chính sách SLA?' : 'Tạo chính sách SLA mới?',
      description: editingPolicy
        ? 'Các thay đổi về phạm vi, thời gian cam kết và hiệu lực sẽ được áp dụng cho chính sách này.'
        : 'Chính sách mới sẽ được tạo theo phạm vi và thời gian cam kết đã cấu hình.',
      confirmLabel: editingPolicy ? 'Lưu thay đổi' : 'Tạo chính sách',
      tone: 'info',
    });
  };

  const performSave = async () => {
    setSaving(true);
    setActionLoading(true);
    setFormError('');
    try {
      const payload = buildPayload(form);
      if (editingPolicy?.slaPolicyId) await slaApi.updatePolicy(editingPolicy.slaPolicyId, payload);
      else await slaApi.createPolicy(payload);
      setModalOpen(false);
      setConfirmAction(null);
      setMessage({ type: 'success', text: editingPolicy ? 'Đã cập nhật chính sách SLA.' : 'Đã tạo chính sách SLA.' });
      await Promise.all([
        loadPolicies({ keepCurrent: true }),
        loadDashboardOverview(),
      ]);
    } catch (err) {
      setConfirmAction(null);
      setFormError(getErrorMessage(err, 'Không thể lưu chính sách SLA.'));
    } finally {
      setSaving(false);
      setActionLoading(false);
    }
  };

  const requestToggleActive = (policy) => {
    setConfirmAction({
      type: 'toggle',
      policy,
      title: policy.isActive ? 'Tạm dừng chính sách SLA?' : 'Kích hoạt chính sách SLA?',
      description: policy.isActive
        ? `Chính sách “${policy.policyName}” sẽ không được hệ thống lựa chọn trong thời gian bị tạm dừng.`
        : `Chính sách “${policy.policyName}” sẽ có thể được hệ thống lựa chọn khi nằm trong thời gian hiệu lực.`,
      confirmLabel: policy.isActive ? 'Tạm dừng' : 'Kích hoạt',
      tone: policy.isActive ? 'warning' : 'success',
    });
  };

  const performToggleActive = async (policy) => {
    setActionLoading(true);
    try {
      await slaApi.setPolicyActive(policy.slaPolicyId, !policy.isActive);
      setConfirmAction(null);
      setMessage({ type: 'success', text: policy.isActive ? 'Đã tạm dừng chính sách.' : 'Đã kích hoạt chính sách.' });
      await Promise.all([
        loadPolicies({ keepCurrent: true }),
        loadDashboardOverview(),
      ]);
    } catch (err) {
      setConfirmAction(null);
      setMessage({ type: 'error', text: getErrorMessage(err, 'Không thể đổi trạng thái chính sách.') });
    } finally {
      setActionLoading(false);
    }
  };

  const requestRemovePolicy = (policy) => {
    setConfirmAction({
      type: 'delete',
      policy,
      title: 'Xóa chính sách SLA?',
      description: `Xóa “${policy.policyName}”. Chính sách đã được sử dụng có thể bị backend từ chối xóa để bảo toàn lịch sử.`,
      confirmLabel: 'Xóa chính sách',
      tone: 'danger',
    });
  };

  const performRemovePolicy = async (policy) => {
    setActionLoading(true);
    try {
      await slaApi.deletePolicy(policy.slaPolicyId);
      setConfirmAction(null);
      setMessage({ type: 'success', text: 'Đã xóa chính sách SLA.' });
      await loadDashboardOverview();
      if (policies.length === 1 && page > 1) {
        setPage((value) => Math.max(1, value - 1));
      } else {
        await loadPolicies({ keepCurrent: policies.length > 1 });
      }
    } catch (err) {
      setConfirmAction(null);
      setMessage({ type: 'error', text: getErrorMessage(err, 'Không thể xóa chính sách SLA.') });
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!confirmAction) return;
    if (confirmAction.type === 'discard') {
      closeModalNow();
      return;
    }
    if (confirmAction.type === 'refresh') {
      closeModalNow();
      void Promise.all([
        loadPolicies({ keepCurrent: policies.length > 0 }),
        loadDashboardOverview(),
        loadLookups(),
      ]);
      return;
    }
    if (confirmAction.type === 'save') {
      await performSave();
      return;
    }
    if (confirmAction.type === 'toggle') {
      await performToggleActive(confirmAction.policy);
      return;
    }
    if (confirmAction.type === 'delete') {
      await performRemovePolicy(confirmAction.policy);
    }
  };

  return (
    <div className="admin-page-shell space-y-6">
      {message.type === 'success' && <SuccessAlert message={message.text} onClose={() => setMessage({ type: '', text: '' })} />}
      {message.type === 'error' && <ErrorAlert message={message.text} onClose={() => setMessage({ type: '', text: '' })} />}

      <section className="admin-page-hero">
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="admin-hero-icon"><Lucide.TimerReset size={22} /></div>
            <div>
              <h2 className="admin-hero-title">Chính sách SLA</h2>
              <p className="admin-hero-description">Quy định hạn phản hồi và hoàn thành theo khu vực, danh mục và mức ưu tiên.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={handleRefresh} className="admin-secondary-action btn rounded-xl"><Lucide.RefreshCw size={17} /> Làm mới</button>
            <button type="button" onClick={() => openModal()} className="admin-primary-action btn rounded-xl border-0"><Lucide.Plus size={18} /> Tạo chính sách</button>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <Lucide.Activity size={17} className="text-blue-600" />
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Tình hình SLA vận hành</h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ['Tổng SLA đang theo dõi', dashboardOverview?.totalSla ?? '—', Lucide.ListChecks],
            ['Đang chạy', dashboardOverview?.runningSla ?? '—', Lucide.Activity],
            [
              'Tỷ lệ đạt SLA',
              dashboardOverview?.successRate != null ? `${dashboardOverview.successRate}%` : '—',
              Lucide.BadgeCheck,
            ],
          ].map(([label, value, Icon]) => (
            <div key={label} className="admin-stat-card p-5">
              <div className="flex items-center justify-between">
                <div><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-slate-100">{value}</p></div>
                <div className="admin-mini-icon"><Icon size={19} /></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="admin-panel relative overflow-hidden">
        <div className="manager-list-panel-header bg-transparent px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-100">Danh sách chính sách SLA</h2>
                  <ManagerListRefreshIndicator visible={refreshing && !loading} label="Đang cập nhật" />
                </div>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Tổng cộng {pagination.totalItems} chính sách</p>
              </div>
              {hasFilters ? (
                <button type="button" onClick={() => { setSearch(''); setFilters(EMPTY_FILTERS); setPage(1); }} className="inline-flex h-9 shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  <Lucide.RotateCcw size={15} /> Xóa bộ lọc
                </button>
              ) : null}
            </div>

            {lookupError && (
              <div className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200 sm:flex-row sm:items-center sm:justify-between">
                <span>{lookupError}</span>
                <button type="button" onClick={loadLookups} className="btn btn-ghost btn-sm self-start rounded-lg sm:self-auto">Thử lại</button>
              </div>
            )}

            <div className="grid w-full gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <label className="relative block min-w-0 xl:col-span-1">
                <Lucide.Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-slate-700 dark:bg-slate-900" placeholder="Tên chính sách SLA..." />
              </label>
              <ManagerSelectMenu value={filters.priority} onChange={(value) => { setFilters((v) => ({ ...v, priority: value })); setPage(1); }} ariaLabel="Lọc theo ưu tiên" options={[{ value: '', label: 'Tất cả ưu tiên' }, ...PRIORITIES.map((item) => ({ value: item.value, label: item.label }))]} />
              <ManagerSelectMenu value={filters.areaId} onChange={(value) => { setFilters((v) => ({ ...v, areaId: value })); setPage(1); }} disabled={lookupLoading || Boolean(lookupError)} ariaLabel="Lọc theo khu vực" options={areaOptions} />
              <ManagerSelectMenu value={filters.categoryId} onChange={(value) => { setFilters((v) => ({ ...v, categoryId: value })); setPage(1); }} disabled={lookupLoading || Boolean(lookupError)} ariaLabel="Lọc theo danh mục" options={categoryOptions} />
              <ManagerSelectMenu value={filters.isActive} onChange={(value) => { setFilters((v) => ({ ...v, isActive: value })); setPage(1); }} ariaLabel="Lọc theo trạng thái" options={[{ value: '', label: 'Tất cả trạng thái' }, { value: 'true', label: 'Đang bật' }, { value: 'false', label: 'Đã tắt' }]} />
              <ManagerSelectMenu value={filters.isCurrentlyEffective} onChange={(value) => { setFilters((v) => ({ ...v, isCurrentlyEffective: value })); setPage(1); }} ariaLabel="Lọc theo hiệu lực" options={[{ value: '', label: 'Tất cả hiệu lực' }, { value: 'true', label: 'Đang có hiệu lực' }, { value: 'false', label: 'Chưa/đã hết hiệu lực' }]} />
            </div>
          </div>
        </div>

        {error && policies.length > 0 && (
          <div className="border-t border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200 sm:px-6">
            {error} Dữ liệu hiện tại vẫn được giữ lại.
          </div>
        )}

        {loading ? (
          <div className="p-6"><PolicySkeleton /></div>
        ) : error && policies.length === 0 ? (
          <AdminErrorState description={error} onRetry={() => loadPolicies()} />
        ) : policies.length === 0 ? (
          <AdminEmptyState
            icon={Lucide.TimerOff}
            title={hasFilters ? 'Không có chính sách SLA phù hợp' : 'Chưa có chính sách SLA'}
            description={hasFilters ? 'Không có chính sách nào khớp với bộ lọc hiện tại. Hãy thử điều chỉnh hoặc xóa bộ lọc.' : 'Tạo chính sách SLA đầu tiên để bắt đầu cấu hình thời hạn xử lý.'}
          />
        ) : (
          <div className="min-w-0">
            <table className="table w-full table-fixed">
              <thead>
                <tr>
                  <th className="w-[22%]">Chính sách</th>
                  <th className="w-[20%]">Phạm vi áp dụng</th>
                  <th className="w-[19%]">Cam kết thời gian</th>
                  <th className="w-[19%]">Hiệu lực</th>
                  <th className="w-[13%] whitespace-normal">Trạng thái / ưu tiên</th>
                  <th className="w-[7%] whitespace-nowrap text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {policies.map((policy) => {
                  const priority = getPriority(policy.priority);
                  return (
                    <tr key={policy.slaPolicyId} className="hover:bg-blue-50/50 dark:hover:bg-blue-500/5">
                      <td className="align-top">
                        <div className="break-words font-semibold text-slate-950 dark:text-slate-100">{policy.policyName || `Chính sách #${policy.slaPolicyId}`}</div>
                        <div className="mt-1 text-xs text-slate-400">Mã #{policy.slaPolicyId}</div>
                      </td>
                      <td className="align-top">
                        <div className="break-words text-sm font-medium text-slate-800 dark:text-slate-200">{policy.areaName || 'Tất cả khu vực'}</div>
                        <div className="mt-1 break-words text-xs text-slate-500">{getCategoryLabel(policy.categoryName, 'Tất cả danh mục')}</div>
                      </td>
                      <td className="align-top">
                        <div className="text-sm"><span className="font-semibold">Phản hồi:</span> {formatMinutes(policy.responseTimeMinutes)}</div>
                        <div className="mt-1 text-sm"><span className="font-semibold">Hoàn thành:</span> {formatMinutes(policy.resolutionTimeMinutes)}</div>
                      </td>
                      <td className="align-top">
                        <div className="text-sm">Từ {formatDate(policy.effectiveFrom)}</div>
                        <div className="mt-1 text-xs text-slate-500">Đến {formatDate(policy.effectiveTo)}</div>
                      </td>
                      <td className="align-top">
                        <div className="flex flex-col items-start gap-1.5">
                          <span className={`badge border-0 ${policy.isActive ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{policy.isActive ? 'Đang bật' : 'Đã tắt'}</span>
                          <span className={`badge border-0 font-semibold ${priority.className}`}>{priority.label}</span>
                          {policy.isCurrentlyEffective && <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-300">Đang hiệu lực</span>}
                        </div>
                      </td>
                      <td className="align-top">
                        <div className="flex flex-col items-end gap-1">
                          <button type="button" onClick={() => openModal(policy)} className="btn btn-ghost btn-xs rounded-lg" aria-label="Chỉnh sửa"><Lucide.Pencil size={15} /></button>
                          <button type="button" onClick={() => requestToggleActive(policy)} className="btn btn-ghost btn-xs rounded-lg" aria-label={policy.isActive ? 'Tạm dừng' : 'Kích hoạt'}>{policy.isActive ? <Lucide.PauseCircle size={15} /> : <Lucide.PlayCircle size={15} />}</button>
                          <button type="button" onClick={() => requestRemovePolicy(policy)} className="btn btn-ghost btn-xs rounded-lg text-rose-600" aria-label="Xóa"><Lucide.Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4 dark:border-white/10">
            <p className="text-sm text-slate-500">Trang {page}/{pagination.totalPages} · {pagination.totalItems} chính sách</p>
            <div className="flex gap-2">
              <button type="button" disabled={!pagination.hasPreviousPage} onClick={() => setPage((v) => Math.max(1, v - 1))} className="btn btn-sm rounded-xl"><Lucide.ChevronLeft size={16} /> Trước</button>
              <button type="button" disabled={!pagination.hasNextPage} onClick={() => setPage((v) => v + 1)} className="btn btn-sm rounded-xl">Sau <Lucide.ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </section>

      {modalOpen && createPortal(
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) requestCloseModal(); }}>
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5 dark:border-white/10">
              <div>
                <h3 className="text-lg font-semibold text-slate-950 dark:text-slate-100">{editingPolicy ? 'Cập nhật chính sách SLA' : 'Tạo chính sách SLA'}</h3>
                <p className="mt-1 text-sm text-slate-500">Thiết lập phạm vi và hai mốc thời gian cam kết.</p>
              </div>
              <button type="button" onClick={requestCloseModal} className="btn btn-ghost btn-sm btn-circle"><Lucide.X size={18} /></button>
            </div>

            <form id="sla-policy-form" onSubmit={requestSave} className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              {formError && <ErrorAlert message={formError} onClose={() => setFormError('')} />}
              {lookupError && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">{lookupError}</div>}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="form-control sm:col-span-2">
                  <span className="mb-2 text-sm font-semibold">Tên chính sách *</span>
                  <input value={form.policyName} onChange={(event) => setForm((value) => ({ ...value, policyName: event.target.value }))} className="input input-bordered h-11 rounded-xl" placeholder="Ví dụ: SLA chiếu sáng đô thị mức cao" />
                </label>

                <div className="form-control">
                  <span className="mb-2 text-sm font-semibold">Khu vực</span>
                  <ManagerSelectMenu value={form.areaId} onChange={(value) => setForm((current) => ({ ...current, areaId: value }))} disabled={lookupLoading || Boolean(lookupError)} ariaLabel="Chọn khu vực áp dụng" options={areaOptions} />
                </div>
                <div className="form-control">
                  <span className="mb-2 text-sm font-semibold">Danh mục</span>
                  <ManagerSelectMenu value={form.categoryId} onChange={(value) => setForm((current) => ({ ...current, categoryId: value }))} disabled={lookupLoading || Boolean(lookupError)} ariaLabel="Chọn danh mục áp dụng" options={categoryOptions} />
                </div>
                <div className="form-control">
                  <span className="mb-2 text-sm font-semibold">Mức ưu tiên *</span>
                  <ManagerSelectMenu value={form.priority} onChange={(value) => setForm((current) => ({ ...current, priority: value }))} ariaLabel="Chọn mức ưu tiên" options={PRIORITIES.map((item) => ({ value: item.value, label: item.label }))} />
                </div>
                <div className="hidden sm:block" />

                <label className="form-control">
                  <span className="mb-2 text-sm font-semibold">Thời gian phản hồi (phút) *</span>
                  <input type="number" min="1" step="1" value={form.responseTimeMinutes} onChange={(event) => setForm((value) => ({ ...value, responseTimeMinutes: event.target.value }))} className="input input-bordered h-11 rounded-xl" />
                </label>
                <label className="form-control">
                  <span className="mb-2 text-sm font-semibold">Thời gian hoàn thành (phút) *</span>
                  <input type="number" min="1" step="1" value={form.resolutionTimeMinutes} onChange={(event) => setForm((value) => ({ ...value, resolutionTimeMinutes: event.target.value }))} className="input input-bordered h-11 rounded-xl" />
                </label>
                <label className="form-control">
                  <span className="mb-2 text-sm font-semibold">Bắt đầu hiệu lực *</span>
                  <input type="datetime-local" value={form.effectiveFrom} onChange={(event) => setForm((value) => ({ ...value, effectiveFrom: event.target.value }))} className="input input-bordered h-11 rounded-xl" />
                </label>
                <label className="form-control">
                  <span className="mb-2 text-sm font-semibold">Kết thúc hiệu lực</span>
                  <input type="datetime-local" value={form.effectiveTo} onChange={(event) => setForm((value) => ({ ...value, effectiveTo: event.target.value }))} className="input input-bordered h-11 rounded-xl" />
                </label>
                <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 p-4 dark:border-white/10 sm:col-span-2">
                  <input type="checkbox" checked={form.isActive} onChange={(event) => setForm((value) => ({ ...value, isActive: event.target.checked }))} className="checkbox checkbox-primary" />
                  <span>
                    <span className="block text-sm font-semibold">Kích hoạt chính sách</span>
                    <span className="mt-1 block text-xs text-slate-500">Chính sách chỉ được hệ thống lựa chọn khi đang bật và nằm trong thời gian hiệu lực.</span>
                  </span>
                </label>
              </div>
            </form>

            <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-6 py-4 dark:border-white/10">
              <p className={`text-xs ${isDirty ? 'font-semibold text-amber-600' : 'text-slate-400'}`}>{isDirty ? 'Có thay đổi chưa lưu' : 'Chưa có thay đổi'}</p>
              <div className="flex gap-2">
                <button type="button" onClick={requestCloseModal} className="btn rounded-xl">Hủy</button>
                <button type="submit" form="sla-policy-form" disabled={saving || !isDirty || lookupLoading || Boolean(lookupError)} className="admin-primary-action btn rounded-xl border-0">
                  {saving ? <span className="loading loading-spinner loading-sm" /> : <Lucide.Save size={17} />} Lưu chính sách
                </button>
              </div>
            </div>
          </div>
        </div>, document.body
      )}

      <ManagerConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmAction?.title || 'Xác nhận thao tác'}
        description={confirmAction?.description}
        confirmLabel={confirmAction?.confirmLabel || 'Xác nhận'}
        cancelLabel="Hủy"
        tone={confirmAction?.tone || 'warning'}
        loading={actionLoading}
        onConfirm={handleConfirm}
        onCancel={() => { if (!actionLoading) setConfirmAction(null); }}
      />
    </div>
  );
};
