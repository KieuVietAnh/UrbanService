import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { APP_ROLES } from '@urbanmind/shared-types';
import { toolsApi } from '@urbanmind/shared-api';
import * as Lucide from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { normalizeRole } from '../../utils/roleMap';
import { managementFeedbackApi } from '../../services/api/managementFeedbackApi';
import { ErrorAlert } from '../../components/alerts/ErrorAlert';
import { ManagerConfirmDialog, ManagerSelectMenu, ManagerToast } from '../../components/manager/ManagerPageElements';
import { clearCoordinatorDirectoryCache } from '../../services/cache/adminCoordinatorDirectoryCache';
import { getCategoryLabel } from '../../utils/categoryLabels';

const EMPTY_COORDINATOR = {
  providerName: '', coordinatorName: '', phoneNumber: '', email: '', address: '', note: '',
};
const EMPTY_COVERAGE = { areaId: '', categoryId: '', isPrimary: false, priorityOrder: 1, isActive: true };

const unwrapList = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.data?.items)) return value.data.items;
  return [];
};
const unwrapItem = (value) => value?.data ?? value?.item ?? value?.result ?? value ?? null;
const translateApiMessage = (message, fallback) => {
  if (!message) return fallback;
  const normalized = String(message).toLowerCase();
  if (normalized.includes('phonenumber')) return 'Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng số 0.';
  if (normalized.includes('coordinatorname')) return 'Vui lòng nhập tên người phụ trách.';
  if (normalized.includes('providername')) return 'Vui lòng nhập tên đơn vị cung cấp.';
  return message;
};
const getErrorMessage = (error, fallback) => translateApiMessage(error?.response?.data?.message || error?.response?.data?.msg || error?.message, fallback);

function FieldHint({ message }) {
  if (!message) return null;
  return (
    <span className="group relative ml-1 inline-flex align-middle">
      <Lucide.CircleAlert size={15} className="cursor-help text-rose-500" aria-label={message} />
      <span className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden w-max max-w-64 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium leading-5 text-white shadow-xl group-hover:block group-focus-within:block">
        {message}
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
      </span>
    </span>
  );
}

export default function CoordinatorDetailPage() {
  const { coordinatorId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const setupCoverage = location.state?.setupCoverage || null;
  const managedCategory = location.state?.managedCategory || null;
  const coordinatorCreated = Boolean(location.state?.coordinatorCreated);
  const setupCoverageOpenedRef = useRef(false);
  const { user } = useAuth();
  const role = normalizeRole(user?.role);
  const canManage = role === APP_ROLES.ADMINISTRATOR || role === APP_ROLES.INTERACTION_MANAGER;

  const [item, setItem] = useState(null);
  const [form, setForm] = useState(EMPTY_COORDINATOR);
  const [originalForm, setOriginalForm] = useState(EMPTY_COORDINATOR);
  const [coverages, setCoverages] = useState([]);
  const [areas, setAreas] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [coverageLoading, setCoverageLoading] = useState(true);
  const [coverageError, setCoverageError] = useState('');
  const [metadataLoading, setMetadataLoading] = useState(true);
  const [metadataError, setMetadataError] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showCoverageModal, setShowCoverageModal] = useState(false);
  const [coverageForm, setCoverageForm] = useState(EMPTY_COVERAGE);
  const [editingCoverageId, setEditingCoverageId] = useState(null);
  const [coverageSaving, setCoverageSaving] = useState(false);
  const [coverageSubmitted, setCoverageSubmitted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showStatusConfirm, setShowStatusConfirm] = useState(false);
  const [showProfileSaveConfirm, setShowProfileSaveConfirm] = useState(false);
  const [showCoverageSaveConfirm, setShowCoverageSaveConfirm] = useState(false);

  useEffect(() => {
    if (!showCoverageModal && !showLeaveConfirm) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showCoverageModal, showLeaveConfirm]);

  const loadCoverages = useCallback(async ({ silent = false } = {}) => {
    if (!coordinatorId) return;
    if (!silent) setCoverageLoading(true);
    setCoverageError('');
    try {
      const coverageResult = await managementFeedbackApi.getCoordinatorCoverages(coordinatorId);
      setCoverages(unwrapList(coverageResult));
    } catch (err) {
      setCoverageError(getErrorMessage(err, 'Không thể tải phạm vi phụ trách.'));
    } finally {
      if (!silent) setCoverageLoading(false);
    }
  }, [coordinatorId]);

  const loadMetadata = useCallback(async () => {
    setMetadataLoading(true);
    setMetadataError('');
    const [areaResult, categoryResult] = await Promise.allSettled([toolsApi.getAreas(), toolsApi.getCategories()]);
    const nextAreas = areaResult.status === 'fulfilled' ? unwrapList(areaResult.value) : [];
    const nextCategories = categoryResult.status === 'fulfilled' ? unwrapList(categoryResult.value) : [];
    setAreas(nextAreas);
    setCategories(nextCategories);
    if (areaResult.status === 'rejected' || categoryResult.status === 'rejected') {
      setMetadataError('Không thể tải đầy đủ khu vực hoặc danh mục. Vui lòng thử lại trước khi thêm phạm vi.');
    }
    setMetadataLoading(false);
  }, []);

  const loadData = useCallback(async () => {
    if (!coordinatorId) return;
    setLoading(true);
    setError('');
    try {
      const detailResult = await managementFeedbackApi.getServiceProviderDetail(coordinatorId);
      const detail = unwrapItem(detailResult);
      setItem(detail);
      const nextForm = {
        providerName: detail?.providerName || '',
        coordinatorName: detail?.coordinatorName || detail?.name || '',
        phoneNumber: String(detail?.phoneNumber || detail?.phone || '').replace(/\D/g, '').slice(0, 10),
        email: detail?.email || '',
        address: detail?.address || '',
        note: detail?.note || '',
      };
      setForm(nextForm);
      setOriginalForm(nextForm);
      setSubmitted(false);
    } catch (err) {
      setError(getErrorMessage(err, 'Không thể tải thông tin điều phối viên.'));
    } finally {
      setLoading(false);
    }
  }, [coordinatorId]);

  useEffect(() => { loadData(); loadCoverages(); }, [loadCoverages, loadData]);
  useEffect(() => { loadMetadata(); }, [loadMetadata]);

  useEffect(() => {
    if (
      (!setupCoverage && !coordinatorCreated) ||
      !canManage ||
      loading ||
      setupCoverageOpenedRef.current ||
      categories.length === 0 ||
      areas.length === 0
    ) {
      return;
    }

    setupCoverageOpenedRef.current = true;
    setEditingCoverageId(null);
    setCoverageForm({
      ...EMPTY_COVERAGE,
      categoryId: String(setupCoverage?.categoryId || ''),
      isPrimary: Boolean(setupCoverage),
    });
    setShowCoverageModal(true);
  }, [areas.length, canManage, categories.length, coordinatorCreated, loading, setupCoverage]);

  const activeCoverages = useMemo(() => coverages.filter((coverage) => coverage.isActive).length, [coverages]);
  const managedCategoryId = managedCategory?.categoryId ? String(managedCategory.categoryId) : '';
  const visibleCoverages = useMemo(() => {
    if (!managedCategoryId) return coverages;

    return coverages.filter((coverage) => {
      const categoryId = coverage.categoryId ?? coverage.category?.categoryId;
      return String(categoryId ?? '') === managedCategoryId;
    });
  }, [coverages, managedCategoryId]);
  const isCategoryPreset = Boolean(setupCoverage && !editingCoverageId);
  const presetCategoryLabel = getCategoryLabel(
    setupCoverage?.categoryName ||
      categories.find((category) => String(category.categoryId ?? category.id) === String(coverageForm.categoryId))?.categoryName ||
      categories.find((category) => String(category.categoryId ?? category.id) === String(coverageForm.categoryId))?.name,
    setupCoverage?.categoryId ? `Danh mục #${setupCoverage.categoryId}` : 'Chưa chọn danh mục'
  );
  const validation = useMemo(() => ({
    providerName: form.providerName.trim() ? '' : 'Vui lòng nhập tên đơn vị cung cấp.',
    coordinatorName: form.coordinatorName.trim() ? '' : 'Vui lòng nhập tên người phụ trách.',
    phoneNumber: !form.phoneNumber.trim()
      ? 'Vui lòng nhập số điện thoại.'
      : !/^0\d{9}$/.test(form.phoneNumber)
        ? 'Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng số 0.'
        : '',
    email: form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
      ? 'Email chưa đúng định dạng.'
      : '',
  }), [form.coordinatorName, form.email, form.phoneNumber, form.providerName]);

  const coverageValidation = useMemo(() => {
    const priorityOrder = Number(coverageForm.priorityOrder);
    const areaExists = areas.some((area) => String(area.areaId ?? area.id) === String(coverageForm.areaId));
    const categoryExists = categories.some((category) => String(category.categoryId ?? category.id) === String(coverageForm.categoryId));
    const duplicate = coverages.some((coverage) => {
      const id = coverage.coverageId ?? coverage.id;
      if (editingCoverageId && String(id) === String(editingCoverageId)) return false;
      const areaId = coverage.areaId ?? coverage.area?.areaId;
      const categoryId = coverage.categoryId ?? coverage.category?.categoryId;
      return String(areaId ?? '') === String(coverageForm.areaId) && String(categoryId ?? '') === String(coverageForm.categoryId);
    });

    return {
      areaId: !coverageForm.areaId ? 'Vui lòng chọn khu vực.' : !areaExists ? 'Khu vực đã chọn không còn khả dụng.' : '',
      categoryId: !coverageForm.categoryId ? 'Vui lòng chọn danh mục.' : !categoryExists ? 'Danh mục đã chọn không còn khả dụng.' : '',
      priorityOrder: !Number.isInteger(priorityOrder) || priorityOrder < 1 ? 'Thứ tự ưu tiên phải là số nguyên từ 1 trở lên.' : '',
      duplicate: duplicate ? 'Phạm vi khu vực và danh mục này đã tồn tại.' : '',
    };
  }, [areas, categories, coverageForm.areaId, coverageForm.categoryId, coverageForm.priorityOrder, coverages, editingCoverageId]);
  const isDirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(originalForm), [form, originalForm]);

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (!isDirty || profileSaving) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, profileSaving]);

  const updateForm = (field, value) => {
    const nextValue = field === 'phoneNumber' ? value.replace(/\D/g, '').slice(0, 10) : value;
    setForm((current) => ({ ...current, [field]: nextValue }));
    if (message.type === 'error') setMessage({ type: '', text: '' });
  };
  const updateCoverageForm = (field, value) => setCoverageForm((current) => ({ ...current, [field]: value }));

  const requestSaveCoordinator = (event) => {
    event.preventDefault();
    setSubmitted(true);
    const firstInvalidField = Object.keys(validation).find((field) => validation[field]);
    if (firstInvalidField) {
      setMessage({ type: 'error', text: 'Vui lòng kiểm tra lại các trường được đánh dấu.' });
      requestAnimationFrame(() => document.querySelector(`[name="${firstInvalidField}"]`)?.focus());
      return;
    }
    if (!isDirty) {
      setMessage({ type: 'error', text: 'Không có thay đổi nào để lưu.' });
      return;
    }
    setShowProfileSaveConfirm(true);
  };

  const saveCoordinator = async () => {
    setProfileSaving(true);
    setMessage({ type: '', text: '' });
    try {
      const normalizedForm = {
        providerName: form.providerName.trim(),
        coordinatorName: form.coordinatorName.trim(),
        phoneNumber: form.phoneNumber.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        note: form.note.trim(),
      };
      const response = await managementFeedbackApi.updateServiceProvider(coordinatorId, normalizedForm);
      const updated = unwrapItem(response) || { ...item, ...normalizedForm };
      setItem((current) => ({ ...current, ...updated }));
      setForm(normalizedForm);
      setOriginalForm(normalizedForm);
      setSubmitted(false);
      setShowProfileSaveConfirm(false);
      clearCoordinatorDirectoryCache();
      setMessage({ type: 'success', text: 'Đã cập nhật điều phối viên.' });
    } catch (err) {
      setMessage({ type: 'error', text: getErrorMessage(err, 'Không thể cập nhật điều phối viên.') });
    } finally { setProfileSaving(false); }
  };

  const toggleActive = async () => {
    const nextActive = !item?.isActive;
    setStatusSaving(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await managementFeedbackApi.setServiceProviderActive(coordinatorId, nextActive);
      const updated = unwrapItem(response);
      setItem((current) => ({ ...current, ...updated, isActive: updated?.isActive ?? nextActive }));
      clearCoordinatorDirectoryCache();
      setShowStatusConfirm(false);
      setMessage({ type: 'success', text: nextActive ? 'Đã kích hoạt điều phối viên.' : 'Đã vô hiệu hóa điều phối viên.' });
    } catch (err) {
      setMessage({ type: 'error', text: getErrorMessage(err, 'Không thể thay đổi trạng thái.') });
    } finally { setStatusSaving(false); }
  };

  const requestToggleActive = () => {
    if (isDirty) {
      setMessage({ type: 'error', text: 'Hãy lưu hoặc bỏ các thay đổi thông tin trước khi đổi trạng thái điều phối viên.' });
      return;
    }
    setShowStatusConfirm(true);
  };

  const leaveDetail = () => navigate('/management/coordinators', { state: { restoreCoordinatorList: true } });
  const goBack = () => {
    if (isDirty && !profileSaving) {
      setShowLeaveConfirm(true);
      return;
    }
    leaveDetail();
  };

  const openNewCoverage = () => {
    if (coverageLoading || coverageError || metadataLoading || metadataError || areas.length === 0 || categories.length === 0) {
      setMessage({ type: 'error', text: coverageError || metadataError || 'Chưa tải đủ dữ liệu để thêm phạm vi.' });
      return;
    }
    setCoverageSubmitted(false);
    setEditingCoverageId(null);
    setCoverageForm({
      ...EMPTY_COVERAGE,
      categoryId: setupCoverage
        ? String(setupCoverage.categoryId || '')
        : managedCategory
          ? String(managedCategory.categoryId || '')
          : '',
      isPrimary: Boolean(setupCoverage),
    });
    setShowCoverageModal(true);
  };
  const openEditCoverage = (coverage) => {
    setCoverageSubmitted(false);
    setEditingCoverageId(coverage.coverageId ?? coverage.id);
    setCoverageForm({
      areaId: String(coverage.areaId ?? coverage.area?.areaId ?? ''),
      categoryId: String(coverage.categoryId ?? coverage.category?.categoryId ?? ''),
      isPrimary: Boolean(coverage.isPrimary),
      priorityOrder: Number(coverage.priorityOrder ?? coverage.priority ?? 1),
      isActive: coverage.isActive !== false,
    });
    setShowCoverageModal(true);
  };

  const requestSaveCoverage = (event) => {
    event.preventDefault();
    setCoverageSubmitted(true);
    const firstCoverageError = Object.values(coverageValidation).find(Boolean);
    if (firstCoverageError) {
      setMessage({ type: 'error', text: firstCoverageError });
      return;
    }
    setShowCoverageSaveConfirm(true);
  };

  const saveCoverage = async () => {
    setCoverageSaving(true);
    setMessage({ type: '', text: '' });
    const payload = {
      areaId: Number(coverageForm.areaId),
      categoryId: Number(coverageForm.categoryId),
      isPrimary: Boolean(coverageForm.isPrimary),
      priorityOrder: Number(coverageForm.priorityOrder),
      ...(editingCoverageId ? { isActive: Boolean(coverageForm.isActive) } : {}),
    };
    try {
      if (editingCoverageId) {
        await managementFeedbackApi.updateCoordinatorCoverage(coordinatorId, editingCoverageId, payload);
      } else {
        await managementFeedbackApi.createCoordinatorCoverage(coordinatorId, payload);
      }
      setShowCoverageModal(false);
      setShowCoverageSaveConfirm(false);
      clearCoordinatorDirectoryCache();

      if (!editingCoverageId && setupCoverage?.returnTo) {
        navigate(setupCoverage.returnTo, {
          state: {
            configuredCategoryId: String(setupCoverage.categoryId || ''),
          },
        });
        return;
      }

      await loadCoverages({ silent: true });
      setCoverageSubmitted(false);
      setMessage({ type: 'success', text: editingCoverageId ? 'Đã cập nhật phạm vi phụ trách.' : 'Đã thêm phạm vi phụ trách.' });
    } catch (err) {
      setMessage({ type: 'error', text: getErrorMessage(err, 'Không thể lưu phạm vi phụ trách.') });
    } finally { setCoverageSaving(false); }
  };

  if (loading) return <div className="flex min-h-[420px] items-center justify-center"><span className="loading loading-spinner loading-lg text-blue-600" /></div>;
  if (error) return <div className="space-y-4 p-4"><ErrorAlert title="Lỗi tải chi tiết" message={error} /><button onClick={loadData} className="btn btn-primary">Thử lại</button></div>;
  if (!item) return <div className="p-6 text-center"><h2 className="text-xl font-bold">Không tìm thấy điều phối viên</h2><button onClick={() => navigate('/management/coordinators', { state: { restoreCoordinatorList: true } })} className="btn btn-ghost mt-4">Quay lại</button></div>;

  return (
    <div className="admin-page-shell space-y-6">
      {managedCategory ? (
        <section className="rounded-[22px] border border-blue-200 bg-blue-50/90 p-4 shadow-sm dark:border-blue-400/20 dark:bg-blue-500/10 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white"><Lucide.Settings2 size={19} /></div>
              <div>
                <h2 className="font-semibold text-slate-950 dark:text-slate-100">Quản lý đầu mối cho {managedCategory.categoryName}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">Sửa phạm vi có danh mục này bằng nút bút chì trong bảng bên dưới, hoặc thêm một phạm vi mới.</p>
              </div>
            </div>
            <button type="button" onClick={() => navigate(managedCategory.returnTo || '/management/categories')} className="btn btn-sm rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200">
              <Lucide.ArrowLeft size={15} /> Về danh mục
            </button>
          </div>
        </section>
      ) : null}

      <section className="admin-page-hero">
        <button type="button" onClick={goBack} className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-blue-700 dark:text-slate-400 dark:hover:text-blue-300"><Lucide.ArrowLeft size={17} /> Quay lại danh sách</button>
        <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white"><Lucide.Building2 size={26} /></div>
            <div><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-semibold tracking-[-0.02em] text-slate-950 dark:text-slate-50">{item.providerName || '—'}</h1><span className={`badge border-0 font-bold ${item.isActive ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{item.isActive ? 'Đang hoạt động' : 'Đã tắt'}</span></div><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Người phụ trách: <strong className="font-semibold text-slate-700 dark:text-slate-200">{item.coordinatorName || item.name || '—'}</strong></p></div>
          </div>
          {canManage && <button type="button" onClick={requestToggleActive} disabled={statusSaving} className={`btn rounded-2xl border-0 ${item.isActive ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-500/15 dark:text-rose-300 dark:hover:bg-rose-500/25' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}>{statusSaving ? <span className="loading loading-spinner loading-sm" /> : item.isActive ? <Lucide.PowerOff size={17} /> : <Lucide.Power size={17} />}{item.isActive ? 'Vô hiệu hóa' : 'Kích hoạt'}</button>}
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700/80 dark:bg-slate-900/80"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Phạm vi phụ trách</div><div className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">{coverageLoading || coverageError ? '—' : coverages.length}</div></div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700/80 dark:bg-slate-900/80"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Phạm vi đang hoạt động</div><div className="mt-1 text-2xl font-semibold text-emerald-700 dark:text-emerald-300">{coverageLoading || coverageError ? '—' : activeCoverages}</div></div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700/80 dark:bg-slate-900/80"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Phạm vi chính</div><div className="mt-1 text-2xl font-semibold text-blue-700 dark:text-blue-300">{coverageLoading || coverageError ? '—' : coverages.filter((coverage) => coverage.isPrimary).length}</div></div>
        </div>
      </section>

      <ManagerToast type={message.type === 'error' ? 'error' : 'success'} message={message.text} onClose={() => setMessage({ type: '', text: '' })} />

      <div className="space-y-6">
        <form onSubmit={requestSaveCoordinator} className="admin-panel p-5 sm:p-6 dark:border-slate-700 dark:bg-slate-950/70">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">Thông tin điều phối viên</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">Thông tin đơn vị và người phụ trách.</p>
            </div>
            <Lucide.Contact size={22} className="shrink-0 text-blue-600 dark:text-blue-400" />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {[
              ['providerName', 'Tên đơn vị cung cấp', true],
              ['coordinatorName', 'Tên người phụ trách', true],
            ].map(([field, label, required]) => (
              <label key={field} className="block">
                <span className="mb-2 flex items-center text-sm font-medium text-slate-700 dark:text-slate-300">{label}{required ? ' *' : ''}{submitted && <FieldHint message={validation[field]} />}</span>
                <input name={field} type="text" disabled={!canManage} value={form[field]} onChange={(event) => updateForm(field, event.target.value)} aria-invalid={submitted && Boolean(validation[field])} className={`input input-bordered w-full rounded-xl font-normal ${submitted && validation[field] ? 'border-rose-300 bg-rose-50/50 focus:border-rose-400' : 'border-slate-200 dark:border-slate-700'} bg-white text-slate-900 focus:border-blue-500 focus:outline-none dark:bg-slate-950/70 dark:text-slate-100 disabled:bg-slate-50 dark:disabled:bg-slate-900`} />
              </label>
            ))}

            <label className="block">
              <span className="mb-2 flex items-center text-sm font-medium text-slate-700 dark:text-slate-300">Số điện thoại *{submitted && <FieldHint message={validation.phoneNumber} />}</span>
              <input name="phoneNumber" type="tel" inputMode="numeric" autoComplete="tel" maxLength={10} disabled={!canManage} value={form.phoneNumber} onChange={(event) => updateForm('phoneNumber', event.target.value)} aria-invalid={submitted && Boolean(validation.phoneNumber)} className={`input input-bordered w-full rounded-xl font-normal tabular-nums ${submitted && validation.phoneNumber ? 'border-rose-300 bg-rose-50/50 focus:border-rose-400' : 'border-slate-200 dark:border-slate-700'} bg-white text-slate-900 focus:border-blue-500 focus:outline-none dark:bg-slate-950/70 dark:text-slate-100 disabled:bg-slate-50 dark:disabled:bg-slate-900`} placeholder="Ví dụ: 0912345678" />
            </label>

            <label className="block">
              <span className="mb-2 flex items-center text-sm font-medium text-slate-700 dark:text-slate-300">Email{submitted && <FieldHint message={validation.email} />}</span>
              <input name="email" type="email" disabled={!canManage} value={form.email} onChange={(event) => updateForm('email', event.target.value)} aria-invalid={submitted && Boolean(validation.email)} className={`input input-bordered w-full rounded-xl font-normal ${submitted && validation.email ? 'border-rose-300 bg-rose-50/50 focus:border-rose-400' : 'border-slate-200 dark:border-slate-700'} bg-white text-slate-900 focus:border-blue-500 focus:outline-none dark:bg-slate-950/70 dark:text-slate-100 disabled:bg-slate-50 dark:disabled:bg-slate-900`} />
            </label>

            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Địa chỉ</span>
              <input type="text" disabled={!canManage} value={form.address} onChange={(event) => updateForm('address', event.target.value)} className="input input-bordered w-full rounded-xl border-slate-200 bg-white font-normal text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100 disabled:bg-slate-50 dark:disabled:bg-slate-900" />
            </label>

            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Ghi chú</span>
              <textarea disabled={!canManage} value={form.note} onChange={(event) => updateForm('note', event.target.value)} className="textarea textarea-bordered min-h-24 w-full rounded-xl border-slate-200 bg-white font-normal text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100 disabled:bg-slate-50 dark:disabled:bg-slate-900" />
            </label>
          </div>

          {canManage && (
            <div className="mt-6 flex justify-end">
              <button type="submit" disabled={profileSaving || !isDirty} className="btn h-11 min-h-11 rounded-xl border-0 bg-blue-600 px-5 text-sm font-medium text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700">
                {profileSaving ? <span className="loading loading-spinner loading-sm" /> : <Lucide.Save size={17} />} Lưu thay đổi
              </button>
            </div>
          )}
        </form>

        <section className="admin-panel p-5 sm:p-6 dark:border-slate-700 dark:bg-slate-950/70">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">Phạm vi phụ trách</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">Chỉ điều phối viên có phạm vi đang hoạt động khớp khu vực và danh mục mới xuất hiện trong danh sách đề xuất xử lý.</p>
            </div>
            {canManage && <button type="button" onClick={openNewCoverage} disabled={coverageLoading || Boolean(coverageError) || metadataLoading || Boolean(metadataError)} className="btn rounded-2xl border-0 bg-blue-600 text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700"><Lucide.Plus size={17} /> Thêm phạm vi</button>}
          </div>

          {metadataError ? (
            <div className="mt-5 flex items-start justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              <div><strong>Không tải đủ dữ liệu tham chiếu.</strong><p className="mt-1 text-amber-700/90 dark:text-amber-200/80">{metadataError}</p></div>
              <button type="button" onClick={loadMetadata} className="btn btn-sm rounded-xl border border-amber-300 bg-white text-amber-800 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-transparent dark:text-amber-200">Thử lại</button>
            </div>
          ) : null}

          {coverageError ? (
            <div className="mt-5 flex items-start justify-between gap-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
              <div><strong>Không thể tải phạm vi phụ trách.</strong><p className="mt-1">Dữ liệu bên dưới có thể chưa đầy đủ. Không sử dụng trạng thái rỗng để suy luận điều phối viên chưa có phạm vi.</p></div>
              <button type="button" onClick={() => loadCoverages()} className="btn btn-sm rounded-xl border border-rose-300 bg-white text-rose-700 hover:bg-rose-100 dark:border-rose-500/30 dark:bg-transparent dark:text-rose-200">Thử lại</button>
            </div>
          ) : null}

          <div className="mt-5">
            {coverageLoading ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
                <span className="loading loading-spinner loading-sm mr-2 text-blue-600" />
                Đang tải phạm vi phụ trách...
              </div>
            ) : coverageError ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
                Không thể hiển thị phạm vi phụ trách lúc này.
              </div>
            ) : visibleCoverages.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-5 py-10 text-center text-sm leading-6 text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
                {managedCategory
                  ? `Chưa có phạm vi phụ trách cho ${managedCategory.categoryName}.`
                  : 'Chưa có phạm vi phụ trách. Điều phối viên này chưa thể được đề xuất theo khu vực và danh mục.'}
              </div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {visibleCoverages.map((coverage) => {
                  const id = coverage.coverageId ?? coverage.id;
                  return (
                    <article key={id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-100/60 dark:border-slate-700 dark:bg-slate-950/55 dark:shadow-none">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-400 dark:text-slate-500">Khu vực</p>
                          <h3 className="mt-1 truncate text-sm font-semibold text-slate-950 dark:text-slate-100">{coverage.areaName ?? coverage.area?.name ?? '—'}</h3>
                        </div>
                        {canManage ? (
                          <button type="button" onClick={() => openEditCoverage(coverage)} className="btn btn-square btn-ghost btn-sm shrink-0" aria-label="Sửa phạm vi phụ trách" title="Sửa phạm vi phụ trách">
                            <Lucide.Pencil size={16} />
                          </button>
                        ) : null}
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="min-w-0 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-900/70">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">Danh mục</p>
                          <p className="mt-1 truncate text-sm font-medium text-slate-800 dark:text-slate-200">{getCategoryLabel(coverage.categoryName ?? coverage.category?.name, '—')}</p>
                        </div>
                        <div className="rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-900/70">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">Ưu tiên</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{coverage.priorityOrder ?? coverage.priority ?? '—'}</span>
                            {coverage.isPrimary && <span className="badge border-0 bg-amber-50 font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">Chính</span>}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Trạng thái phạm vi</span>
                        <span className={`badge border-0 font-semibold ${coverage.isActive ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                          {coverage.isActive ? 'Hoạt động' : 'Đã tắt'}
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      {showLeaveConfirm && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/55 p-4" role="dialog" aria-modal="true" aria-labelledby="leave-detail-title">
          <div className="w-full max-w-md rounded-[24px] border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-950">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"><Lucide.TriangleAlert size={21} /></div>
              <div>
                <h2 id="leave-detail-title" className="text-lg font-semibold text-slate-950 dark:text-slate-50">Bỏ các thay đổi chưa lưu?</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Thông tin điều phối viên đã được chỉnh sửa nhưng chưa lưu. Nếu quay lại danh sách, các thay đổi này sẽ bị mất.</p>
              </div>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setShowLeaveConfirm(false)} className="btn rounded-2xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">Tiếp tục chỉnh sửa</button>
              <button type="button" onClick={leaveDetail} className="btn rounded-2xl border-0 bg-rose-600 text-white hover:bg-rose-700">Bỏ thay đổi và quay lại</button>
            </div>
          </div>
        </div>
      , document.body)}

      <ManagerConfirmDialog
        open={showStatusConfirm}
        title={item?.isActive ? 'Vô hiệu hóa điều phối viên?' : 'Kích hoạt điều phối viên?'}
        description={item?.isActive
          ? 'Điều phối viên sẽ ngừng được đề xuất cho các sự vụ mới theo phạm vi phụ trách đang có. Dữ liệu và lịch sử vẫn được giữ lại.'
          : 'Điều phối viên sẽ hoạt động trở lại và có thể được đề xuất cho sự vụ phù hợp với phạm vi đang bật.'}
        confirmLabel={item?.isActive ? 'Vô hiệu hóa' : 'Kích hoạt'}
        cancelLabel="Hủy"
        tone={item?.isActive ? 'danger' : 'success'}
        loading={statusSaving}
        onConfirm={toggleActive}
        onCancel={() => setShowStatusConfirm(false)}
      />

      <ManagerConfirmDialog
        open={showProfileSaveConfirm}
        title="Lưu thay đổi điều phối viên?"
        description="Thông tin đơn vị và người phụ trách sẽ được cập nhật theo nội dung bạn vừa chỉnh sửa."
        confirmLabel="Xác nhận lưu"
        cancelLabel="Quay lại"
        tone="info"
        loading={profileSaving}
        onConfirm={saveCoordinator}
        onCancel={() => setShowProfileSaveConfirm(false)}
      />

      <ManagerConfirmDialog
        open={showCoverageSaveConfirm}
        title={editingCoverageId ? 'Lưu thay đổi phạm vi?' : 'Thêm phạm vi phụ trách?'}
        description={editingCoverageId
          ? 'Khu vực, danh mục, mức ưu tiên hoặc trạng thái phạm vi sẽ được cập nhật.'
          : 'Phạm vi mới sẽ được dùng khi hệ thống đề xuất điều phối viên phù hợp.'}
        confirmLabel={editingCoverageId ? 'Xác nhận lưu' : 'Thêm phạm vi'}
        cancelLabel="Quay lại"
        tone={editingCoverageId ? "info" : "success"}
        loading={coverageSaving}
        onConfirm={saveCoverage}
        onCancel={() => setShowCoverageSaveConfirm(false)}
      />

      {showCoverageModal && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-3 sm:p-5" role="dialog" aria-modal="true" aria-labelledby="coverage-modal-title">
          <form onSubmit={requestSaveCoverage} className="flex max-h-[min(680px,calc(100vh-2rem))] w-full max-w-xl flex-col overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.3)] dark:border-slate-700 dark:bg-slate-950">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800 sm:px-6 sm:py-5">
              <div className="min-w-0">
                <h2 id="coverage-modal-title" className="text-xl font-semibold tracking-[-0.02em] text-slate-950 dark:text-slate-50">{editingCoverageId ? 'Cập nhật phạm vi' : 'Thêm phạm vi'}</h2>
                <p className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">{setupCoverage && !editingCoverageId ? `Thiết lập đầu mối cho ${getCategoryLabel(setupCoverage.categoryName, `danh mục #${setupCoverage.categoryId}`)}.` : 'Chọn khu vực, danh mục và trạng thái áp dụng.'}</p>
              </div>
              <button type="button" onClick={() => setShowCoverageModal(false)} className="btn btn-circle btn-ghost btn-sm shrink-0" aria-label="Đóng cửa sổ"><Lucide.X size={18} /></button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-1.5 flex items-center text-sm font-semibold text-slate-800 dark:text-slate-200">Khu vực <span className="text-rose-500">*</span>{coverageSubmitted && <FieldHint message={coverageValidation.areaId} />}</span>
                  <ManagerSelectMenu
                    value={coverageForm.areaId}
                    onChange={(value) => updateCoverageForm('areaId', value)}
                    ariaLabel="Chọn khu vực phụ trách"
                    className="w-full"
                    options={[
                      { value: '', label: 'Chọn khu vực' },
                      ...areas.map((area) => ({ value: area.areaId ?? area.id, label: area.areaName ?? area.name })),
                    ]}
                  />
                </label>

                {isCategoryPreset ? (
                  <div>
                    <span className="mb-1.5 block text-sm font-semibold text-slate-800 dark:text-slate-200">Danh mục</span>
                    <div className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50/80 px-4 py-2.5 dark:border-blue-400/25 dark:bg-blue-500/10">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{presetCategoryLabel}</div>
                        <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Đã chọn từ trang Danh mục phản ánh</div>
                      </div>
                      <Lucide.LockKeyhole size={17} className="shrink-0 text-blue-600 dark:text-blue-300" />
                    </div>
                  </div>
                ) : (
                  <label className="block">
                    <span className="mb-1.5 flex items-center text-sm font-semibold text-slate-800 dark:text-slate-200">Danh mục <span className="text-rose-500">*</span>{coverageSubmitted && <FieldHint message={coverageValidation.categoryId || coverageValidation.duplicate} />}</span>
                    <ManagerSelectMenu
                      value={coverageForm.categoryId}
                      onChange={(value) => updateCoverageForm('categoryId', value)}
                      ariaLabel="Chọn danh mục phụ trách"
                      className="w-full"
                      options={[
                        { value: '', label: 'Chọn danh mục' },
                        ...categories.map((category) => ({ value: category.categoryId ?? category.id, label: getCategoryLabel(category.categoryName ?? category.name) })),
                      ]}
                    />
                  </label>
                )}

                {!isCategoryPreset && (
                  <label className="block">
                    <span className="mb-1.5 flex items-center text-sm font-semibold text-slate-800 dark:text-slate-200">Thứ tự ưu tiên{coverageSubmitted && <FieldHint message={coverageValidation.priorityOrder} />}</span>
                    <input type="number" min="1" step="1" value={coverageForm.priorityOrder} onChange={(event) => updateCoverageForm('priorityOrder', event.target.value)} className="input input-bordered h-11 min-h-11 w-full rounded-xl border-slate-200 bg-white font-normal text-slate-900 focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
                    <span className="mt-1.5 block text-xs text-slate-500 dark:text-slate-400">Số nhỏ hơn được ưu tiên trước khi hệ thống đề xuất đầu mối.</span>
                  </label>
                )}

                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/70">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input type="checkbox" checked={coverageForm.isPrimary} onChange={(event) => updateCoverageForm('isPrimary', event.target.checked)} className="checkbox checkbox-sm mt-0.5 border-slate-300 dark:border-slate-600" />
                    <span>
                      <span className="block text-sm font-semibold text-slate-800 dark:text-slate-200">Đặt làm phạm vi chính</span>
                      <span className="mt-0.5 block text-xs leading-5 text-slate-500 dark:text-slate-400">Ưu tiên điều phối viên này khi có nhiều đầu mối cùng khu vực và danh mục.</span>
                    </span>
                  </label>
                  {editingCoverageId && (
                    <label className="mt-3 flex cursor-pointer items-start gap-3 border-t border-slate-200 pt-3 dark:border-slate-800">
                      <input type="checkbox" checked={coverageForm.isActive} onChange={(event) => updateCoverageForm('isActive', event.target.checked)} className="checkbox checkbox-sm mt-0.5 border-slate-300 dark:border-slate-600" />
                      <span>
                        <span className="block text-sm font-semibold text-slate-800 dark:text-slate-200">Phạm vi đang hoạt động</span>
                        <span className="mt-0.5 block text-xs leading-5 text-slate-500 dark:text-slate-400">Tắt lựa chọn này để ngừng đề xuất đầu mối mà không xóa dữ liệu.</span>
                      </span>
                    </label>
                  )}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-950 sm:px-6">
              <button type="button" onClick={() => setShowCoverageModal(false)} className="btn h-11 min-h-11 rounded-xl border border-slate-200 bg-white px-5 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">Hủy</button>
              <button type="submit" disabled={coverageSaving} className="btn h-11 min-h-11 rounded-xl border-0 bg-blue-600 px-5 text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700">{coverageSaving ? <span className="loading loading-spinner loading-sm" /> : <Lucide.Save size={17} />} {editingCoverageId ? 'Lưu thay đổi' : 'Lưu phạm vi'}</button>
            </div>
          </form>
        </div>,
        document.body
      )}
    </div>
  );
}
