import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import * as Lucide from 'lucide-react';
import { staffResponsibilityApi, toolsApi } from '@urbanmind/shared-api';
import { userApi } from '../../services/api/userApi';
import {
  ManagerConfirmDialog,
  ManagerListRefreshIndicator,
  ManagerMetricCard,
  ManagerPageHeader,
  ManagerSelectMenu,
  ManagerToast,
} from '../../components/manager/ManagerPageElements';
import {
  AdminEmptyState,
  AdminErrorState,
} from '../../components/admin/AdminDataStates';

const normalizeRole = (value) => String(value || '').trim().replace(/[-_\s]/g, '').toLowerCase();
const isStaffUser = (user) => normalizeRole(user?.roleName || user?.role) === 'systemstaff';
const getUserId = (user) => user?.userId || user?.id || '';
const getUserName = (user) => user?.fullName || user?.name || user?.email || 'Nhân viên chưa cập nhật tên';
const getAreaId = (area) => area?.areaId ?? area?.id;
const getAreaName = (area) => area?.areaName || area?.name || 'Khu vực chưa cập nhật';
const getCategoryId = (category) => category?.categoryId ?? category?.id;
const getCategoryName = (category) => category?.categoryName || category?.name || 'Danh mục chưa cập nhật';
const getAssignmentId = (item) => item?.staffAreaAssignmentId ?? item?.assignmentId ?? item?.id;

const EMPTY_FORM = {
  assignmentId: '',
  userId: '',
  areaId: '',
  categoryId: '',
  isPrimary: false,
};

const buttonBase = 'inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60';
const PAGE_SIZE = 8;

export const StaffResponsibilityManagement = () => {
  const [assignments, setAssignments] = useState([]);
  const [users, setUsers] = useState([]);
  const [areas, setAreas] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [query, setQuery] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('active');
  const [form, setForm] = useState(EMPTY_FORM);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [confirmAction, setConfirmAction] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async ({ background = false } = {}) => {
    if (background) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const [assignmentResult, userResult, areaResult, categoryResult] = await Promise.allSettled([
        staffResponsibilityApi.getAll(),
        userApi.getUsers(),
        toolsApi.getAreas({}, { throwOnError: true }),
        toolsApi.getCategories(),
      ]);

      if (assignmentResult.status === 'rejected') throw assignmentResult.reason;
      setAssignments(assignmentResult.value || []);
      setUsers(userResult.status === 'fulfilled' && Array.isArray(userResult.value) ? userResult.value.filter(isStaffUser) : []);
      setAreas(areaResult.status === 'fulfilled' && Array.isArray(areaResult.value) ? areaResult.value : []);
      setCategories(categoryResult.status === 'fulfilled' && Array.isArray(categoryResult.value) ? categoryResult.value : []);

      const unavailable = [
        userResult.status === 'rejected' ? 'danh sách nhân viên' : '',
        areaResult.status === 'rejected' ? 'khu vực' : '',
        categoryResult.status === 'rejected' ? 'danh mục' : '',
      ].filter(Boolean);

      if (unavailable.length > 0) {
        setToast({ type: 'error', message: `Chưa tải được ${unavailable.join(', ')}. Danh sách phạm vi vẫn được giữ để tra cứu.` });
      }
    } catch (loadError) {
      setError(loadError?.response?.data?.message || loadError?.message || 'Không thể tải phạm vi phụ trách nhân viên.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!modalOpen || typeof window === 'undefined') return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !saving) setModalOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalOpen, saving]);

  const staffOptions = useMemo(() => [
    { value: '', label: 'Chọn nhân viên' },
    ...users.map((user) => ({ value: getUserId(user), label: getUserName(user) })),
  ], [users]);

  const areaOptions = useMemo(() => [
    { value: '', label: 'Chọn phường / khu vực' },
    ...areas.map((area) => ({ value: String(getAreaId(area)), label: getAreaName(area) })),
  ], [areas]);

  const categoryOptions = useMemo(() => [
    { value: '', label: 'Tất cả danh mục' },
    ...categories.map((category) => ({ value: String(getCategoryId(category)), label: getCategoryName(category) })),
  ], [categories]);

  const filterAreaOptions = useMemo(() => [{ value: '', label: 'Tất cả khu vực' }, ...areaOptions.slice(1)], [areaOptions]);
  const filterCategoryOptions = useMemo(() => [{ value: '', label: 'Tất cả danh mục' }, ...categoryOptions.slice(1)], [categoryOptions]);
  const activeOptions = [
    { value: 'all', label: 'Tất cả trạng thái' },
    { value: 'active', label: 'Đang hoạt động' },
    { value: 'inactive', label: 'Tạm dừng' },
  ];

  const normalizedQuery = query.trim().toLocaleLowerCase('vi-VN');
  const filteredAssignments = assignments.filter((item) => {
    if (areaFilter && String(item?.areaId ?? '') !== String(areaFilter)) return false;
    if (categoryFilter && String(item?.categoryId ?? '') !== String(categoryFilter)) return false;
    if (activeFilter === 'active' && item?.isActive === false) return false;
    if (activeFilter === 'inactive' && item?.isActive !== false) return false;
    if (!normalizedQuery) return true;
    const searchable = [item?.staffName, item?.areaName, item?.categoryName, item?.assignedByUserName]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('vi-VN');
    return searchable.includes(normalizedQuery);
  });
  const totalPages = Math.max(1, Math.ceil(filteredAssignments.length / PAGE_SIZE));
  const activePage = Math.min(currentPage, totalPages);
  const pageAssignments = filteredAssignments.slice((activePage - 1) * PAGE_SIZE, activePage * PAGE_SIZE);

  const activeCount = assignments.filter((item) => item?.isActive !== false).length;
  const primaryCount = assignments.filter((item) => item?.isActive !== false && item?.isPrimary).length;
  const coveredStaffCount = new Set(assignments.filter((item) => item?.isActive !== false).map((item) => String(item?.userId || '')).filter(Boolean)).size;

  const resetForm = () => setForm(EMPTY_FORM);

  const openCreateModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const editAssignment = (item) => {
    setForm({
      assignmentId: String(getAssignmentId(item) || ''),
      userId: String(item?.userId || ''),
      areaId: String(item?.areaId || ''),
      categoryId: item?.categoryId == null ? '' : String(item.categoryId),
      isPrimary: Boolean(item?.isPrimary),
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    resetForm();
  };

  const persistForm = async () => {
    setSaving(true);
    try {
      if (form.assignmentId) {
        await staffResponsibilityApi.update(form.assignmentId, {
          areaId: form.areaId,
          categoryId: form.categoryId,
          isPrimary: form.isPrimary,
        });
        setToast({ type: 'success', message: 'Đã cập nhật phạm vi phụ trách nhân viên.' });
      } else {
        await staffResponsibilityApi.create({
          userId: form.userId,
          areaId: form.areaId,
          categoryId: form.categoryId,
          isPrimary: form.isPrimary,
        });
        setToast({ type: 'success', message: 'Đã thêm phạm vi phụ trách nhân viên.' });
      }
      setConfirmAction(null);
      setModalOpen(false);
      resetForm();
      await load({ background: true });
    } catch (saveError) {
      setToast({ type: 'error', message: saveError?.response?.data?.message || saveError?.message || 'Không thể lưu phạm vi phụ trách.' });
    } finally {
      setSaving(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!form.userId || !form.areaId) {
      setToast({ type: 'error', message: 'Vui lòng chọn nhân viên và khu vực phụ trách.' });
      return;
    }

    if (!form.assignmentId) {
      await persistForm();
      return;
    }

    const original = assignments.find((item) => String(getAssignmentId(item) || '') === String(form.assignmentId));
    const changes = [];
    if (String(original?.areaId ?? '') !== String(form.areaId)) changes.push('phường / khu vực');
    if (String(original?.categoryId ?? '') !== String(form.categoryId ?? '')) changes.push('danh mục');
    if (Boolean(original?.isPrimary) !== Boolean(form.isPrimary)) changes.push('phạm vi chính');

    if (changes.length === 0) {
      setToast({ type: 'info', message: 'Không có thay đổi nào để lưu.' });
      return;
    }

    setConfirmAction({
      type: 'save',
      title: 'Lưu thay đổi phạm vi?',
      description: `Các thay đổi về ${changes.join(', ')} sẽ được áp dụng cho nhân viên này.`,
      confirmLabel: 'Xác nhận lưu',
      cancelLabel: 'Quay lại',
      tone: 'info',
    });
  };

  const requestToggleActive = (item) => {
    const assignmentId = getAssignmentId(item);
    if (!assignmentId) return;
    const isActive = item?.isActive !== false;
    setConfirmAction({
      type: isActive ? 'pause' : 'activate',
      item,
      title: isActive ? 'Tạm dừng phạm vi này?' : 'Kích hoạt lại phạm vi này?',
      description: isActive
        ? 'Phạm vi này sẽ tạm thời không được dùng khi phân công công việc cho nhân viên.'
        : 'Phạm vi này sẽ được đưa trở lại danh sách phân công đang hoạt động.',
      confirmLabel: isActive ? 'Tạm dừng' : 'Kích hoạt',
      cancelLabel: 'Hủy',
      tone: isActive ? 'warning' : 'success',
    });
  };

  const confirmPendingAction = async () => {
    if (!confirmAction) return;
    if (confirmAction.type === 'save') {
      await persistForm();
      return;
    }

    const item = confirmAction.item;
    const assignmentId = getAssignmentId(item);
    if (!assignmentId) return;
    setActionLoading(true);
    try {
      await staffResponsibilityApi.setActive(assignmentId, item?.isActive === false);
      setToast({ type: 'success', message: item?.isActive === false ? 'Đã kích hoạt lại phạm vi phụ trách.' : 'Đã tạm dừng phạm vi phụ trách.' });
      setConfirmAction(null);
      await load({ background: true });
    } catch (toggleError) {
      setToast({ type: 'error', message: toggleError?.response?.data?.message || toggleError?.message || 'Không thể thay đổi trạng thái phạm vi phụ trách.' });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="manager-ui-page space-y-5">
      <ManagerPageHeader
        title="Phạm vi phụ trách nhân viên"
        description="Quản lý phạm vi phụ trách theo phường và danh mục."
        icon={Lucide.UserRoundCog}
        statusLabel="Đang hoạt động"
        statusValue={loading ? 'Đang tải…' : `${activeCount} phạm vi`}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => load({ background: true })} disabled={loading || refreshing} className={`${buttonBase} border border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200`}>
              <Lucide.RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
              Làm mới
            </button>
            <button type="button" onClick={openCreateModal} disabled={loading} className={`${buttonBase} bg-blue-600 text-white shadow-sm hover:bg-blue-700`}>
              <Lucide.Plus size={17} />
              Thêm phân công
            </button>
          </div>
        )}
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <ManagerMetricCard label="Phạm vi hoạt động" value={loading ? '—' : activeCount} description="Phân công đang có hiệu lực." icon={Lucide.MapPinned} toneClass="bg-blue-50 text-blue-700" />
        <ManagerMetricCard label="Nhân viên được phân công" value={loading ? '—' : coveredStaffCount} description="Nhân viên có ít nhất một phạm vi hoạt động." icon={Lucide.UsersRound} toneClass="bg-cyan-50 text-cyan-700" />
        <ManagerMetricCard label="Phạm vi chính" value={loading ? '—' : primaryCount} description="Phạm vi được đánh dấu ưu tiên chính." icon={Lucide.BadgeCheck} toneClass="bg-emerald-50 text-emerald-700" />
      </section>

      <section className="admin-panel relative overflow-hidden">
        <div className="manager-list-panel-header bg-transparent px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-100">Danh sách phạm vi phụ trách</h2>
                  <ManagerListRefreshIndicator visible={refreshing && !loading} label="Đang cập nhật" />
                </div>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {loading ? 'Đang tải dữ liệu...' : `Tổng cộng ${assignments.length} phạm vi · ${filteredAssignments.length} phù hợp`}
                </p>
              </div>
              {(query || areaFilter || categoryFilter || activeFilter !== 'active') ? (
                <button type="button" onClick={() => { setQuery(''); setAreaFilter(''); setCategoryFilter(''); setActiveFilter('active'); setCurrentPage(1); }} className="inline-flex h-9 shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  <Lucide.RotateCcw size={15} /> Xóa bộ lọc
                </button>
              ) : null}
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(320px,1.45fr)_minmax(190px,0.8fr)_minmax(190px,0.8fr)_minmax(180px,0.75fr)]">
              <label className="relative block min-w-0">
                <span className="sr-only">Tìm phạm vi phụ trách</span>
                <Lucide.Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setCurrentPage(1); }} placeholder="Tìm nhân viên, phường, danh mục..." className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-slate-700 dark:bg-slate-900" />
              </label>
              <ManagerSelectMenu value={areaFilter} options={filterAreaOptions} onChange={(value) => { setAreaFilter(value); setCurrentPage(1); }} placeholder="Tất cả khu vực" ariaLabel="Lọc khu vực" />
              <ManagerSelectMenu value={categoryFilter} options={filterCategoryOptions} onChange={(value) => { setCategoryFilter(value); setCurrentPage(1); }} placeholder="Tất cả danh mục" ariaLabel="Lọc danh mục" />
              <ManagerSelectMenu value={activeFilter} options={activeOptions} onChange={(value) => { setActiveFilter(value); setCurrentPage(1); }} placeholder="Tất cả trạng thái" ariaLabel="Lọc trạng thái" />
            </div>
          </div>
        </div>

        {error && assignments.length === 0 ? (
          <div className="p-5"><AdminErrorState title="Không thể tải phạm vi phụ trách" description={error} onRetry={() => load()} /></div>
        ) : loading ? (
          <div className="space-y-3 p-5">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-[76px] animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900" />)}</div>
        ) : filteredAssignments.length === 0 ? (
          <div className="p-5">
            <AdminEmptyState icon={Lucide.UserRoundSearch} title="Không có phạm vi phù hợp" description="Thử đổi bộ lọc hoặc thêm phân công mới cho nhân viên." />
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            <div className="hidden grid-cols-[minmax(190px,1.15fr)_minmax(150px,0.95fr)_minmax(170px,1fr)_120px_130px_190px] gap-4 px-5 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400 xl:grid">
              <span>Nhân viên</span>
              <span>Khu vực</span>
              <span>Danh mục</span>
              <span>Phạm vi</span>
              <span>Trạng thái</span>
              <span className="text-right">Thao tác</span>
            </div>

            {pageAssignments.map((item) => {
              const assignmentId = getAssignmentId(item);
              const staffName = item?.staffName || users.find((user) => String(getUserId(user)) === String(item?.userId))?.fullName || 'Nhân viên chưa cập nhật tên';
              const areaName = item?.areaName || getAreaName(areas.find((area) => String(getAreaId(area)) === String(item?.areaId))) || 'Chưa xác định';
              const categoryName = item?.categoryName || (item?.categoryId == null ? 'Tất cả danh mục' : getCategoryName(categories.find((category) => String(getCategoryId(category)) === String(item?.categoryId))) || 'Chưa xác định');
              const isActive = item?.isActive !== false;

              return (
                <article key={assignmentId} className="grid gap-4 px-5 py-4 transition hover:bg-slate-50/70 dark:hover:bg-slate-900/50 xl:grid-cols-[minmax(190px,1.15fr)_minmax(150px,0.95fr)_minmax(170px,1fr)_120px_130px_190px] xl:items-center">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{staffName}</p>
                    <p className="mt-1 truncate text-xs text-slate-400">Mã nhân viên: {String(item?.userId || '').slice(0, 12) || '—'}</p>
                  </div>

                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 xl:hidden">Khu vực</p>
                    <p className="mt-1 truncate text-sm font-medium text-slate-700 dark:text-slate-200 xl:mt-0">{areaName}</p>
                  </div>

                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 xl:hidden">Danh mục</p>
                    <p className="mt-1 truncate text-sm text-slate-600 dark:text-slate-300 xl:mt-0">{categoryName}</p>
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 xl:hidden">Phạm vi</p>
                    {item?.isPrimary ? (
                      <span className="mt-1 inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300 xl:mt-0">Chính</span>
                    ) : (
                      <span className="mt-1 inline-flex text-xs font-medium text-slate-500 xl:mt-0">Bổ sung</span>
                    )}
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 xl:hidden">Trạng thái</p>
                    <span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold xl:mt-0 ${isActive ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'}`}>{isActive ? 'Đang hoạt động' : 'Tạm dừng'}</span>
                  </div>

                  <div className="flex flex-wrap justify-start gap-2 xl:justify-end">
                    <button type="button" onClick={() => editAssignment(item)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                      <Lucide.Pencil size={13} />
                      Chỉnh sửa
                    </button>
                    <button type="button" onClick={() => requestToggleActive(item)} className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition ${isActive ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100' : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}>
                      {isActive ? <Lucide.Pause size={13} /> : <Lucide.Play size={13} />}
                      {isActive ? 'Tạm dừng' : 'Kích hoạt'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {!loading && filteredAssignments.length > 0 ? (
          <footer className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Hiển thị {(activePage - 1) * PAGE_SIZE + 1}–{Math.min(activePage * PAGE_SIZE, filteredAssignments.length)} trong {filteredAssignments.length} phạm vi
            </p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setCurrentPage(Math.max(1, activePage - 1))} disabled={activePage === 1} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                <Lucide.ChevronLeft size={15} /> Trước
              </button>
              <span className="min-w-[92px] text-center text-sm font-semibold text-slate-700 dark:text-slate-200">Trang {activePage}/{totalPages}</span>
              <button type="button" onClick={() => setCurrentPage(Math.min(totalPages, activePage + 1))} disabled={activePage === totalPages} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                Sau <Lucide.ChevronRight size={15} />
              </button>
            </div>
          </footer>
        ) : null}
      </section>

      {modalOpen && typeof document !== 'undefined' ? createPortal(
        <div className="fixed inset-0 z-[10000] flex min-h-[100dvh] items-center justify-center overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="staff-responsibility-modal-title" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}>
          <form onSubmit={submit} className="my-auto w-full max-w-xl overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_28px_90px_rgba(15,23,42,0.3)] dark:border-slate-700 dark:bg-slate-950">
            <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6 dark:border-slate-800">
              <div className="min-w-0">
                <h2 id="staff-responsibility-modal-title" className="text-xl font-black tracking-tight text-slate-950 dark:text-slate-100">{form.assignmentId ? 'Chỉnh sửa phạm vi' : 'Thêm phân công'}</h2>
                <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">Thiết lập nhân viên, phường và danh mục phụ trách.</p>
              </div>
              <button type="button" onClick={closeModal} disabled={saving} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-900" aria-label="Đóng cửa sổ">
                <Lucide.X size={17} />
              </button>
            </header>

            <div className="grid gap-4 px-5 py-4 sm:grid-cols-2 sm:px-6">
              <label className="block min-w-0 sm:col-span-2">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Nhân viên <span className="text-rose-500">*</span></span>
                <ManagerSelectMenu value={form.userId} options={staffOptions} onChange={(value) => setForm((current) => ({ ...current, userId: value }))} placeholder="Chọn nhân viên" ariaLabel="Chọn nhân viên" disabled={Boolean(form.assignmentId)} />
                {form.assignmentId ? <span className="mt-1.5 block text-xs text-slate-400">Không thể đổi nhân viên khi chỉnh sửa phân công đã có.</span> : null}
              </label>

              <label className="block min-w-0">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Phường / khu vực <span className="text-rose-500">*</span></span>
                <ManagerSelectMenu value={form.areaId} options={areaOptions} onChange={(value) => setForm((current) => ({ ...current, areaId: value }))} placeholder="Chọn khu vực" ariaLabel="Chọn khu vực" />
              </label>

              <label className="block min-w-0">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Danh mục</span>
                <ManagerSelectMenu value={form.categoryId} options={categoryOptions} onChange={(value) => setForm((current) => ({ ...current, categoryId: value }))} placeholder="Tất cả danh mục" ariaLabel="Chọn danh mục" />
              </label>

              <label className="sm:col-span-2 flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
                <input type="checkbox" checked={form.isPrimary} onChange={(event) => setForm((current) => ({ ...current, isPrimary: event.target.checked }))} className="checkbox checkbox-sm checkbox-primary" />
                <span>
                  <span className="block text-sm font-semibold text-slate-800 dark:text-slate-200">Đặt làm phạm vi chính</span>
                  <span className="mt-0.5 block text-xs leading-5 text-slate-500 dark:text-slate-400">Đánh dấu đây là phạm vi phụ trách chính của nhân viên.</span>
                </span>
              </label>
            </div>

            <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50/70 px-5 py-4 sm:flex-row sm:justify-end sm:px-6 dark:border-slate-800 dark:bg-slate-900/40">
              <button type="button" onClick={closeModal} disabled={saving} className={`${buttonBase} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200`}>
                Hủy
              </button>
              <button type="submit" disabled={saving || !form.userId || !form.areaId} className={`${buttonBase} bg-blue-600 text-white shadow-sm hover:bg-blue-700`}>
                {saving ? <span className="loading loading-spinner loading-sm" /> : <Lucide.Save size={16} />}
                {saving ? 'Đang lưu…' : form.assignmentId ? 'Lưu thay đổi' : 'Thêm phân công'}
              </button>
            </footer>
          </form>
        </div>,
        document.body
      ) : null}


      <ManagerConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmAction?.title || 'Xác nhận thao tác'}
        description={confirmAction?.description}
        confirmLabel={confirmAction?.confirmLabel || 'Xác nhận'}
        cancelLabel={confirmAction?.cancelLabel || 'Hủy'}
        tone={confirmAction?.tone || 'warning'}
        loading={saving || actionLoading}
        onConfirm={confirmPendingAction}
        onCancel={() => { if (!saving && !actionLoading) setConfirmAction(null); }}
      />

      <ManagerToast type={toast?.type} message={toast?.message} onClose={() => setToast(null)} />
    </div>
  );
};

export default StaffResponsibilityManagement;
