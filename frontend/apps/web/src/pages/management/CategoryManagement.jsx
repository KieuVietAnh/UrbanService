// src/pages/management/CategoryManagement.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { extractApiErrorMessage, toolsApi } from '@urbanmind/shared-api';
import { SuccessAlert, ErrorAlert } from '../../components/alerts/ErrorAlert';
import { managementFeedbackApi } from '../../services/api/managementFeedbackApi';
import { getCategoryLabel } from '../../utils/categoryLabels';
import * as Lucide from 'lucide-react';
import { ManagerConfirmDialog, ManagerListRefreshIndicator, ManagerSelectMenu } from '../../components/manager/ManagerPageElements';
import {
  AdminCardGridSkeleton,
  AdminEmptyState,
  AdminErrorState,
} from '../../components/admin/AdminDataStates';

const categoryIconSet = [
  Lucide.Trash2,
  Lucide.Lightbulb,
  Lucide.Droplets,
  Lucide.Car,
  Lucide.TreePine,
  Lucide.Building2,
];

const getCategoryIcon = (index) => categoryIconSet[index % categoryIconSet.length];
const getActiveText = (isActive) => (isActive ? 'Đang hoạt động' : 'Tạm khóa');
const formatPhone = (phone) => phone || 'Chưa cập nhật';
const PAGE_SIZE = 6;
const CONTACT_FILTERS = new Set(['assigned', 'unassigned', 'review']);

const normalizeCategoryName = (value) => String(value || '').trim().replace(/\s+/g, ' ');
const normalizeComparableText = (value) => normalizeCategoryName(value).toLocaleLowerCase('vi-VN');

const unwrapList = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.data?.items)) return value.data.items;
  return [];
};

const getCoordinatorId = (coordinator) => coordinator?.coordinatorId ?? coordinator?.id;
const getCoverageCategoryId = (coverage) => (
  coverage?.categoryId ?? coverage?.category?.categoryId ?? coverage?.category?.id
);
const getCoverageId = (coverage) => coverage?.coverageId ?? coverage?.id;
const getCoverageAreaId = (coverage) => coverage?.areaId ?? coverage?.area?.areaId ?? coverage?.area?.id;
const getAreaId = (area) => area?.areaId ?? area?.id;
const getAreaName = (area) => area?.areaName || area?.name || `Khu vực #${getAreaId(area)}`;

const getCoverageOrder = (coverage) => Number(
  coverage?.priorityOrder ?? coverage?.priority ?? Number.MAX_SAFE_INTEGER
);

const getCoordinatorDisplayName = (coordinator) => (
  coordinator?.providerName || coordinator?.coordinatorName || coordinator?.name || 'Đầu mối chưa cập nhật tên'
);


const getCategoryCoverageEntries = (categoryId, coordinators, coveragesByCoordinator) => {
  const coordinatorMap = new Map(
    coordinators.map((coordinator) => [String(getCoordinatorId(coordinator)), coordinator])
  );
  const entries = [];

  coveragesByCoordinator.forEach((coverages, coordinatorKey) => {
    coverages.forEach((coverage) => {
      if (String(getCoverageCategoryId(coverage)) !== String(categoryId)) return;
      const coordinator = coordinatorMap.get(String(coordinatorKey));
      entries.push({ coordinator, coordinatorId: coordinatorKey, coverage });
    });
  });

  return entries.sort((left, right) => {
    const activeDelta = Number(right.coverage?.isActive !== false) - Number(left.coverage?.isActive !== false);
    if (activeDelta !== 0) return activeDelta;
    const primaryDelta = Number(Boolean(right.coverage?.isPrimary)) - Number(Boolean(left.coverage?.isPrimary));
    if (primaryDelta !== 0) return primaryDelta;
    return getCoverageOrder(left.coverage) - getCoverageOrder(right.coverage);
  });
};

const buildCategoryContactMap = (coordinators, coveragesByCoordinator) => {
  const map = new Map();

  coordinators.forEach((coordinator) => {
    if (coordinator?.isActive === false) return;

    const coordinatorId = getCoordinatorId(coordinator);
    const coverages = coveragesByCoordinator.get(String(coordinatorId)) || [];

    coverages.forEach((coverage) => {
      if (coverage?.isActive === false) return;

      const categoryId = getCoverageCategoryId(coverage);
      if (categoryId === null || categoryId === undefined || categoryId === '') return;

      const key = String(categoryId);
      const candidate = {
        coordinator,
        coverage,
        isPrimary: Boolean(coverage?.isPrimary),
        priorityOrder: getCoverageOrder(coverage),
      };
      const current = map.get(key);

      if (
        !current ||
        (candidate.isPrimary && !current.isPrimary) ||
        (candidate.isPrimary === current.isPrimary && candidate.priorityOrder < current.priorityOrder)
      ) {
        map.set(key, candidate);
      }
    });
  });

  return map;
};

const StatCard = ({
  label,
  value,
  description,
  icon: Icon,
  tone = 'primary',
  active = false,
  onClick,
  disabled = false,
}) => {
  const toneClass = {
    primary: 'bg-blue-50 text-blue-700',
    success: 'bg-emerald-50 text-emerald-700',
    info: 'bg-blue-50 text-blue-700',
    warning: 'bg-amber-50 text-amber-700',
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`w-full rounded-2xl border bg-white p-5 text-left shadow-[0_10px_30px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-65 disabled:hover:translate-y-0 disabled:hover:border-slate-200 disabled:hover:shadow-[0_10px_30px_rgba(15,23,42,0.04)] dark:bg-slate-950/70 ${
        active
          ? 'border-blue-400 ring-2 ring-blue-100 dark:border-blue-500 dark:ring-blue-500/20'
          : 'border-slate-200 dark:border-slate-700'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">{value}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</p>
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${toneClass}`}>
          <Icon size={19} />
        </div>
      </div>
    </button>
  );
};

const CategoryFormModal = ({
  editingCategory,
  catName,
  catDesc,
  formError,
  saveLoading,
  onClose,
  onSubmit,
  onNameChange,
  onDescChange,
}) => createPortal(
  <div
    className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm"
    role="dialog"
    aria-modal="true"
    aria-labelledby="category-form-title"
    onMouseDown={(event) => {
      if (event.target === event.currentTarget && !saveLoading) onClose();
    }}
  >
    <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950">
      <div className="border-b border-slate-200 bg-slate-50/80 p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900/70">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
              {editingCategory ? <Lucide.PencilLine size={21} /> : <Lucide.PlusCircle size={22} />}
            </div>
            <div>
              <h3 id="category-form-title" className="text-lg font-semibold text-slate-950 dark:text-slate-100">
                {editingCategory ? 'Chỉnh sửa danh mục' : 'Thêm danh mục phản ánh'}
              </h3>
              <p className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">
                {editingCategory
                  ? 'Cập nhật tên và mô tả. Trạng thái hoạt động được quản lý riêng để tránh thay đổi ngoài ý muốn.'
                  : 'Tạo nhóm phân loại mới để tiếp nhận và điều phối phản ánh đúng đầu mối xử lý.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saveLoading}
            className="btn btn-circle btn-ghost btn-sm"
            aria-label="Đóng modal"
          >
            <Lucide.X size={18} />
          </button>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-5 p-5 sm:p-6">
        <div className="form-control">
          <label className="label" htmlFor="category-name">
            <span className="label-text text-sm font-semibold text-slate-600 dark:text-slate-300">Tên danh mục *</span>
          </label>
          <input
            id="category-name"
            type="text"
            placeholder="Ví dụ: Công viên cây xanh & chiếu sáng"
            value={catName}
            onChange={(event) => onNameChange(event.target.value)}
            className="input input-bordered h-12 w-full rounded-2xl text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            autoFocus
            required
          />
        </div>

        <div className="form-control">
          <label className="label" htmlFor="category-description">
            <span className="label-text text-sm font-semibold text-slate-600 dark:text-slate-300">Mô tả danh mục</span>
          </label>
          <textarea
            id="category-description"
            rows="5"
            placeholder="Mô tả phạm vi tiếp nhận các vấn đề thuộc danh mục này..."
            value={catDesc}
            onChange={(event) => onDescChange(event.target.value)}
            className="textarea textarea-bordered w-full rounded-2xl p-4 text-sm leading-6 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>

        {formError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
            {formError}
          </div>
        ) : (
          <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-sm leading-6 text-slate-600 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-slate-300">
            Tên rõ ràng và mô tả cụ thể giúp đội vận hành phân loại, tìm kiếm và cấu hình đầu mối chính xác hơn.
          </div>
        )}

        <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={saveLoading} className="btn btn-ghost rounded-2xl text-sm font-semibold">
            Hủy
          </button>
          <button type="submit" className="btn rounded-xl border-0 bg-blue-600 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700" disabled={saveLoading}>
            {saveLoading ? <span className="loading loading-spinner loading-sm" /> : <Lucide.Save size={16} />}
            {editingCategory ? 'Lưu thay đổi' : 'Tạo danh mục'}
          </button>
        </div>
      </form>
    </div>
  </div>,
  document.body
);


const CoverageManagementModal = ({
  category,
  entries,
  coordinators,
  areas,
  metadataLoading,
  areasLoading,
  saveLoading,
  actionKey,
  formMode,
  form,
  formError,
  editingEntry,
  onClose,
  onStartAdd,
  onStartEdit,
  onStartReplace,
  onCancelForm,
  onFormChange,
  onSubmit,
  onToggleCoverage,
  onOpenDirectory,
}) => {
  const [openActionMenuKey, setOpenActionMenuKey] = useState('');
  const activeCoordinators = coordinators.filter((item) => item?.isActive !== false);
  const activeAreas = areas.filter((item) => item?.isActive !== false);
  const mutationsDisabled = category?.isActive === false;

  const groupedEntries = useMemo(() => {
    const groups = new Map();
    entries.forEach((entry) => {
      const areaName = entry.coverage?.areaName || `Khu vực #${getCoverageAreaId(entry.coverage)}`;
      if (!groups.has(areaName)) groups.set(areaName, []);
      groups.get(areaName).push(entry);
    });
    return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right, 'vi'));
  }, [entries]);

  const replacementEntry = formMode === 'replace' ? editingEntry : null;

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/50 px-3 py-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="coverage-management-title">
      <div className="flex max-h-[min(820px,calc(100vh-2rem))] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950">
        <div className="shrink-0 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-start justify-between gap-4 px-5 py-5 sm:px-6">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"><Lucide.Network size={20} /></div>
              <div className="min-w-0">
                <h2 id="coverage-management-title" className="truncate text-xl font-semibold text-slate-950 dark:text-slate-100">Đầu mối · {getCategoryLabel(category?.categoryName)}</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Mỗi phường có thể dùng một đầu mối khác nhau. Chọn đúng phường rồi đổi đầu mối khi cần.</p>
              </div>
            </div>
            <button type="button" onClick={onClose} disabled={saveLoading} className="btn btn-circle btn-ghost btn-sm shrink-0" aria-label="Đóng"><Lucide.X size={18} /></button>
          </div>

          <div className="flex flex-col gap-2 border-t border-slate-100 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:border-slate-800/80">
            <p className="text-xs text-slate-500 dark:text-slate-400">{entries.length} phạm vi đã cấu hình</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={onOpenDirectory} className="btn btn-sm rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><Lucide.ExternalLink size={14} /> Quản lý điều phối viên</button>
              <button type="button" onClick={onStartAdd} disabled={areasLoading || mutationsDisabled} className="btn btn-sm rounded-xl border-0 bg-blue-600 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"><Lucide.PlusCircle size={14} /> Thêm phạm vi</button>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          {mutationsDisabled ? (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">Danh mục đang tạm khóa. Hãy kích hoạt danh mục trước khi chỉnh sửa đầu mối.</div>
          ) : null}

          {formMode && formMode !== 'replace' ? (
            <form onSubmit={onSubmit} className="mb-5 rounded-2xl border border-blue-100 bg-blue-50/40 p-4 dark:border-blue-500/20 dark:bg-blue-500/[0.06] sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-950 dark:text-slate-100">{formMode === 'edit' ? 'Sửa phạm vi' : 'Thêm phạm vi mới'}</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Thiết lập phường, đầu mối và thứ tự ưu tiên cho danh mục này.</p>
                </div>
                <button type="button" onClick={onCancelForm} disabled={saveLoading} className="btn btn-ghost btn-sm rounded-xl">Hủy</button>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">Đầu mối *</span>
                  <ManagerSelectMenu value={form.coordinatorId} onChange={(value) => onFormChange('coordinatorId', value)} disabled={formMode === 'edit'} ariaLabel="Chọn đầu mối" options={[{ value: '', label: 'Chọn đầu mối' }, ...activeCoordinators.map((item) => ({ value: getCoordinatorId(item), label: getCoordinatorDisplayName(item) }))]} />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">Phường / khu vực *</span>
                  <ManagerSelectMenu value={form.areaId} onChange={(value) => onFormChange('areaId', value)} disabled={areasLoading} ariaLabel="Chọn khu vực" options={[{ value: '', label: areasLoading ? 'Đang tải khu vực...' : 'Chọn khu vực' }, ...activeAreas.map((item) => ({ value: getAreaId(item), label: getAreaName(item) }))]} />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">Thứ tự ưu tiên</span>
                  <input type="number" min="1" step="1" value={form.priorityOrder} onChange={(event) => onFormChange('priorityOrder', event.target.value)} className="input input-bordered h-10 w-full rounded-xl border-slate-300 bg-white text-sm dark:border-slate-700 dark:bg-slate-900" />
                </label>
                <label className="flex min-h-10 items-center gap-3 self-end rounded-xl border border-slate-200 bg-white px-4 py-2.5 dark:border-slate-700 dark:bg-slate-900">
                  <input type="checkbox" checked={form.isPrimary} onChange={(event) => onFormChange('isPrimary', event.target.checked)} className="checkbox checkbox-sm" />
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Đặt làm phạm vi chính</span>
                </label>
              </div>
              {formError ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">{formError}</div> : null}
              <div className="mt-4 flex justify-end">
                <button type="submit" disabled={saveLoading || areasLoading || mutationsDisabled} className="btn rounded-xl border-0 bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{saveLoading ? <span className="loading loading-spinner loading-sm" /> : <Lucide.Save size={16} />} Lưu phạm vi</button>
              </div>
            </form>
          ) : null}

          {metadataLoading && entries.length === 0 ? (
            <div className="space-y-3">
              {[0, 1, 2].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900" />)}
            </div>
          ) : entries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 px-5 py-10 text-center dark:border-slate-700 dark:bg-slate-900/60">
              <Lucide.Link2 className="mx-auto text-slate-400" size={24} />
              <p className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-200">Chưa có phạm vi đầu mối cho danh mục này</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Bấm “Thêm phạm vi” để chọn phường và đầu mối xử lý.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {groupedEntries.map(([areaName, groupEntries]) => (
                <section key={areaName}>
                  <div className="mb-2 flex items-center gap-2 px-1">
                    <Lucide.MapPin size={15} className="text-blue-600" />
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{areaName}</h3>
                    <span className="text-xs text-slate-400">{groupEntries.length} đầu mối</span>
                  </div>
                  <div className="space-y-2">
                    {groupEntries.map((entry) => {
                      const coverage = entry.coverage;
                      const coverageId = getCoverageId(coverage);
                      const rowKey = `${entry.coordinatorId}:${coverageId}`;
                      const busy = actionKey === rowKey;
                      const isActive = coverage?.isActive !== false;
                      return (
                        <div key={rowKey} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-900/70">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold text-slate-950 dark:text-slate-100">{getCoordinatorDisplayName(entry.coordinator)}</p>
                                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${isActive ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-white/[0.07] dark:text-slate-300'}`}>{isActive ? 'Đang áp dụng' : 'Tạm khóa'}</span>
                                {coverage?.isPrimary ? <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">Phạm vi chính</span> : null}
                              </div>
                              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                                <span>Người phụ trách: {entry.coordinator?.coordinatorName || 'Chưa cập nhật'}</span>
                                <span>Ưu tiên {coverage?.priorityOrder ?? 1}</span>
                              </div>
                            </div>

                            <div className="flex shrink-0 items-center gap-2 self-start sm:self-auto">
                              {isActive ? (
                                <button type="button" onClick={() => onStartReplace(entry)} disabled={busy || saveLoading || mutationsDisabled} className="btn btn-sm rounded-xl border border-blue-200 bg-blue-50 font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200"><Lucide.RefreshCw size={14} /> Đổi đầu mối</button>
                              ) : null}
                              <div className="relative">
                                <button type="button" onClick={() => setOpenActionMenuKey((current) => current === rowKey ? '' : rowKey)} disabled={busy || saveLoading || mutationsDisabled} className="btn btn-square btn-sm rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300" aria-label="Mở thao tác"><Lucide.MoreHorizontal size={17} /></button>
                                {openActionMenuKey === rowKey ? (
                                  <div className="absolute right-0 top-10 z-30 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                                    <button type="button" onClick={() => { setOpenActionMenuKey(''); onStartEdit(entry); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/[0.06]"><Lucide.PencilLine size={14} /> Sửa phạm vi</button>
                                    <button type="button" onClick={() => { setOpenActionMenuKey(''); onToggleCoverage(entry); }} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium ${isActive ? 'text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-500/10' : 'text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-500/10'}`}>{busy ? <span className="loading loading-spinner loading-xs" /> : isActive ? <Lucide.PauseCircle size={14} /> : <Lucide.PlayCircle size={14} />} {isActive ? 'Tạm khóa' : 'Kích hoạt'}</button>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>

      {formMode === 'replace' ? (
        <div className="fixed inset-0 z-[1010] flex items-center justify-center bg-slate-950/35 px-4 py-6" onMouseDown={(event) => { if (event.target === event.currentTarget && !saveLoading) onCancelForm(); }}>
          <form onSubmit={onSubmit} className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-5 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-semibold text-slate-950 dark:text-slate-100">Đổi đầu mối xử lý</h3>
                <p className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">Chỉ thay đơn vị xử lý. Phường và thiết lập ưu tiên hiện tại được giữ nguyên.</p>
              </div>
              <button type="button" onClick={onCancelForm} disabled={saveLoading} className="btn btn-circle btn-ghost btn-sm" aria-label="Đóng"><Lucide.X size={17} /></button>
            </div>

            <div className="space-y-4 p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Phường</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{replacementEntry?.coverage?.areaName || `Khu vực #${form.areaId}`}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Đầu mối hiện tại</p>
                  <p className="mt-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{replacementEntry ? getCoordinatorDisplayName(replacementEntry.coordinator) : 'Đang cập nhật'}</p>
                </div>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">Đầu mối mới *</span>
                <ManagerSelectMenu value={form.coordinatorId} onChange={(value) => onFormChange('coordinatorId', value)} ariaLabel="Chọn đầu mối mới" options={[{ value: '', label: 'Chọn đầu mối mới' }, ...activeCoordinators.filter((item) => String(getCoordinatorId(item)) !== String(replacementEntry?.coordinatorId)).map((item) => ({ value: getCoordinatorId(item), label: getCoordinatorDisplayName(item) }))]} />
              </label>

              <div className="flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-white/[0.06]">Ưu tiên {form.priorityOrder || 1}</span>
                {form.isPrimary ? <span className="rounded-full bg-blue-50 px-2.5 py-1 font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">Phạm vi chính</span> : null}
              </div>

              {formError ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">{formError}</div> : null}
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-800">
              <button type="button" onClick={onCancelForm} disabled={saveLoading} className="btn btn-ghost rounded-xl text-sm font-semibold">Hủy</button>
              <button type="submit" disabled={saveLoading || mutationsDisabled || !form.coordinatorId} className="btn rounded-xl border-0 bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{saveLoading ? <span className="loading loading-spinner loading-sm" /> : <Lucide.RefreshCw size={15} />} Xác nhận thay</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>,
    document.body
  );
};

export const CategoryManagement = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [coordinators, setCoordinators] = useState([]);
  const [coveragesByCoordinator, setCoveragesByCoordinator] = useState(() => new Map());
  const [coverageIncomplete, setCoverageIncomplete] = useState(false);
  const [coverageWarning, setCoverageWarning] = useState('');
  const [coverageLoading, setCoverageLoading] = useState(false);
  const [areas, setAreas] = useState([]);
  const [areasLoading, setAreasLoading] = useState(false);
  const [coverageModalCategory, setCoverageModalCategory] = useState(null);
  const [coverageFormMode, setCoverageFormMode] = useState('');
  const [coverageEditingEntry, setCoverageEditingEntry] = useState(null);
  const [coverageForm, setCoverageForm] = useState({ coordinatorId: '', areaId: '', isPrimary: false, priorityOrder: '1' });
  const [coverageFormError, setCoverageFormError] = useState('');
  const [coverageSaveLoading, setCoverageSaveLoading] = useState(false);
  const [coverageActionKey, setCoverageActionKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [formError, setFormError] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const categoryRequestIdRef = useRef(0);
  const contactMetadataRef = useRef({ coordinators: [], coveragesByCoordinator: new Map() });

  const fetchCoverageMetadata = useCallback(async ({ requestId, keepCurrent = false } = {}) => {
    setCoverageLoading(true);
    setCoverageWarning('');

    let nextCoordinators;
    let nextCoveragesByCoordinator = new Map(contactMetadataRef.current.coveragesByCoordinator);
    let metadataIncomplete = false;
    let warning = '';

    try {
      const coordinatorResult = await managementFeedbackApi.getServiceProviders({ includeInactive: true });
      if (requestId && requestId !== categoryRequestIdRef.current) return;

      nextCoordinators = unwrapList(coordinatorResult);
      const coordinatorsWithCoverage = nextCoordinators.filter((coordinator) => {
        const coordinatorId = getCoordinatorId(coordinator);
        return coordinatorId !== null && coordinatorId !== undefined && coordinatorId !== '';
      });

      const coverageResults = await Promise.allSettled(
        coordinatorsWithCoverage.map(async (coordinator) => {
          const coordinatorId = getCoordinatorId(coordinator);
          const coverages = await managementFeedbackApi.getCoordinatorCoverages(coordinatorId);
          return [String(coordinatorId), unwrapList(coverages)];
        })
      );

      if (requestId && requestId !== categoryRequestIdRef.current) return;

      const failedCoverageCount = coverageResults.filter((result) => result.status === 'rejected').length;
      const successfulCoverageMap = new Map();
      coverageResults.forEach((result) => {
        if (result.status !== 'fulfilled') return;
        const [coordinatorId, coverages] = result.value;
        successfulCoverageMap.set(coordinatorId, coverages);
      });

      if (failedCoverageCount > 0) {
        metadataIncomplete = true;
        warning = `Không tải được phạm vi phụ trách của ${failedCoverageCount} đầu mối. Dữ liệu danh mục vẫn dùng được, nhưng chỉ số đầu mối có thể chưa đầy đủ.`;
        if (keepCurrent) successfulCoverageMap.forEach((value, key) => nextCoveragesByCoordinator.set(key, value));
        else nextCoveragesByCoordinator = successfulCoverageMap;
      } else {
        nextCoveragesByCoordinator = successfulCoverageMap;
      }

      contactMetadataRef.current = {
        coordinators: nextCoordinators,
        coveragesByCoordinator: new Map(nextCoveragesByCoordinator),
      };
      setCoordinators(nextCoordinators);
      setCoveragesByCoordinator(nextCoveragesByCoordinator);
      setCoverageIncomplete(metadataIncomplete);
      setCoverageWarning(warning);
    } catch (error) {
      console.error(error);
      setCoverageIncomplete(true);
      setCoverageWarning('Không tải được dữ liệu đầu mối xử lý. Danh mục vẫn hiển thị bình thường.');
    } finally {
      if (!requestId || requestId === categoryRequestIdRef.current) setCoverageLoading(false);
    }
  }, []);

  const fetchCats = useCallback(async ({ keepCurrent = false } = {}) => {
    const requestId = ++categoryRequestIdRef.current;
    if (keepCurrent) setRefreshing(true);
    else setLoading(true);
    setLoadError('');

    try {
      const categoryResult = await toolsApi.getCategories({ includeInactive: true });
      if (requestId !== categoryRequestIdRef.current) return;
      setCategories(unwrapList(categoryResult));
      setLoading(false);

      await fetchCoverageMetadata({ requestId, keepCurrent });
    } catch (err) {
      if (requestId !== categoryRequestIdRef.current) return;
      console.error(err);
      setLoadError(extractApiErrorMessage(err, 'Không thể tải danh mục phản ánh.'));
      if (!keepCurrent) setCategories([]);
    } finally {
      if (requestId === categoryRequestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [fetchCoverageMetadata]);

  useEffect(() => {
    void fetchCats();

    return () => {
      categoryRequestIdRef.current += 1;
    };
  }, [fetchCats]);

  const contactMetadataPending = coverageLoading && coordinators.length === 0;
  const contactMetadataUnavailable = coverageIncomplete || contactMetadataPending;

  useEffect(() => {
    if (contactMetadataUnavailable && CONTACT_FILTERS.has(statusFilter)) {
      setStatusFilter('all');
      setCurrentPage(1);
    }
  }, [contactMetadataUnavailable, statusFilter]);

  const categoryContactMap = useMemo(
    () => buildCategoryContactMap(coordinators, coveragesByCoordinator),
    [coordinators, coveragesByCoordinator]
  );

  const categoryStats = useMemo(() => {
    const total = categories.length;
    const active = categories.filter((cat) => cat.isActive).length;
    const inactive = total - active;
    const assigned = categories.filter((cat) => categoryContactMap.has(String(cat.categoryId))).length;
    const review = categories.filter(
      (cat) => !cat.isActive || !categoryContactMap.has(String(cat.categoryId))
    ).length;

    return {
      total,
      active,
      inactive,
      assigned: contactMetadataPending ? '…' : coverageIncomplete ? '—' : assigned,
      review: contactMetadataPending ? '…' : coverageIncomplete ? '—' : review,
    };
  }, [categories, categoryContactMap, contactMetadataPending, coverageIncomplete]);

  const filteredCategories = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('vi-VN');

    return categories.filter((cat) => {
      const contact = categoryContactMap.get(String(cat.categoryId));
      const coordinator = contact?.coordinator;
      const text = [
        cat.categoryId,
        cat.categoryName,
        getCategoryLabel(cat.categoryName, ''),
        cat.description,
        coordinator?.providerName,
        coordinator?.coordinatorName,
        coordinator?.name,
        coordinator?.phoneNumber,
        coordinator?.phone,
        coordinator?.email,
        getActiveText(cat.isActive),
      ].filter(Boolean).join(' ').toLocaleLowerCase('vi-VN');

      const matchesSearch = !keyword || text.includes(keyword);
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && cat.isActive) ||
        (statusFilter === 'inactive' && !cat.isActive) ||
        (!contactMetadataUnavailable && statusFilter === 'assigned' && contact) ||
        (!contactMetadataUnavailable && statusFilter === 'unassigned' && !contact) ||
        (!contactMetadataUnavailable && statusFilter === 'review' && (!cat.isActive || !contact));

      return matchesSearch && matchesStatus;
    });
  }, [categories, categoryContactMap, contactMetadataUnavailable, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredCategories.length / PAGE_SIZE));
  const activePage = Math.min(currentPage, totalPages);
  const paginatedCategories = filteredCategories.slice((activePage - 1) * PAGE_SIZE, activePage * PAGE_SIZE);
  const pageStart = filteredCategories.length === 0 ? 0 : (activePage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(activePage * PAGE_SIZE, filteredCategories.length);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const resetCategoryForm = () => {
    setEditingCategory(null);
    setCatName('');
    setCatDesc('');
    setFormError('');
  };

  const openCreateModal = () => {
    resetCategoryForm();
    setShowCategoryModal(true);
  };

  const openEditModal = (category) => {
    setEditingCategory(category);
    setCatName(category?.categoryName || '');
    setCatDesc(category?.description || '');
    setFormError('');
    setShowCategoryModal(true);
  };

  const closeCategoryModal = () => {
    if (saveLoading) return;
    setShowCategoryModal(false);
    resetCategoryForm();
  };

  const handleSaveCategory = async (event) => {
    event.preventDefault();
    const categoryName = normalizeCategoryName(catName);
    const description = String(catDesc || '').trim();

    if (!categoryName) {
      setFormError('Vui lòng nhập tên danh mục.');
      return;
    }

    const duplicate = categories.find((category) => (
      String(category?.categoryId) !== String(editingCategory?.categoryId ?? '') &&
      normalizeComparableText(category?.categoryName) === normalizeComparableText(categoryName)
    ));
    if (duplicate) {
      setFormError(`Tên danh mục đã tồn tại${duplicate.isActive === false ? ' nhưng đang tạm khóa' : ''}. Vui lòng chọn tên khác hoặc chỉnh sửa danh mục hiện có.`);
      return;
    }

    if (
      editingCategory &&
      normalizeCategoryName(editingCategory.categoryName) === categoryName &&
      String(editingCategory.description || '').trim() === description
    ) {
      setFormError('Không có thay đổi nào để lưu.');
      return;
    }

    setSaveLoading(true);
    setFormError('');
    try {
      const payload = { categoryName, description };
      if (editingCategory) {
        await toolsApi.updateCategory(editingCategory.categoryId, payload);
        setMessage({ type: 'success', text: 'Đã cập nhật danh mục phản ánh.' });
      } else {
        await toolsApi.createCategory(payload);
        setMessage({ type: 'success', text: 'Đã tạo danh mục phản ánh mới.' });
      }
      setShowCategoryModal(false);
      resetCategoryForm();
      await fetchCats({ keepCurrent: true });
    } catch (err) {
      console.error(err);
      setFormError(extractApiErrorMessage(err, editingCategory ? 'Không thể cập nhật danh mục.' : 'Không thể tạo danh mục.'));
    } finally {
      setSaveLoading(false);
    }
  };

  const requestToggleCategory = (category) => {
    const isActive = category?.isActive !== false;
    setConfirmAction({
      category,
      title: isActive ? 'Tạm khóa danh mục này?' : 'Kích hoạt lại danh mục này?',
      description: isActive
        ? 'Danh mục sẽ không còn được dùng cho dữ liệu mới, nhưng dữ liệu lịch sử vẫn được giữ nguyên.'
        : 'Danh mục sẽ được đưa trở lại danh sách có thể sử dụng trong hệ thống.',
      confirmLabel: isActive ? 'Tạm khóa' : 'Kích hoạt',
      tone: isActive ? 'warning' : 'success',
    });
  };

  const confirmToggleCategory = async () => {
    const category = confirmAction?.category;
    if (!category?.categoryId) return;

    setActionLoading(true);
    try {
      const nextActive = category.isActive === false;
      await toolsApi.setCategoryActive(category.categoryId, nextActive);
      setMessage({
        type: 'success',
        text: nextActive ? 'Đã kích hoạt lại danh mục phản ánh.' : 'Đã tạm khóa danh mục phản ánh.',
      });
      setConfirmAction(null);
      await fetchCats({ keepCurrent: true });
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: extractApiErrorMessage(err, 'Không thể thay đổi trạng thái danh mục.') });
    } finally {
      setActionLoading(false);
    }
  };


  const coverageEntries = useMemo(
    () => coverageModalCategory
      ? getCategoryCoverageEntries(coverageModalCategory.categoryId, coordinators, coveragesByCoordinator)
      : [],
    [coverageModalCategory, coordinators, coveragesByCoordinator]
  );

  const resetCoverageForm = () => {
    setCoverageFormMode('');
    setCoverageEditingEntry(null);
    setCoverageForm({ coordinatorId: '', areaId: '', isPrimary: false, priorityOrder: '1' });
    setCoverageFormError('');
  };

  const ensureAreasLoaded = useCallback(async () => {
    if (areas.length > 0 || areasLoading) return;
    setAreasLoading(true);
    try {
      const result = await toolsApi.getAreas({ includeInactive: true }, { throwOnError: true });
      setAreas(unwrapList(result));
    } catch (error) {
      console.error(error);
      setCoverageFormError(extractApiErrorMessage(error, 'Không thể tải danh sách khu vực.'));
    } finally {
      setAreasLoading(false);
    }
  }, [areas.length, areasLoading]);

  const openCoverageModal = async (category) => {
    setCoverageModalCategory(category);
    resetCoverageForm();
    void ensureAreasLoaded();
    if (coverageIncomplete || contactMetadataRef.current.coordinators.length === 0) {
      await fetchCoverageMetadata({ keepCurrent: true });
    }
  };

  const closeCoverageModal = () => {
    if (coverageSaveLoading || coverageActionKey) return;
    setCoverageModalCategory(null);
    resetCoverageForm();
  };

  const startAddCoverage = () => {
    setCoverageEditingEntry(null);
    setCoverageFormMode('add');
    setCoverageForm({ coordinatorId: '', areaId: '', isPrimary: false, priorityOrder: '1' });
    setCoverageFormError('');
    void ensureAreasLoaded();
  };

  const startEditCoverage = (entry) => {
    setCoverageEditingEntry(entry);
    setCoverageFormMode('edit');
    setCoverageForm({
      coordinatorId: String(entry.coordinatorId),
      areaId: String(getCoverageAreaId(entry.coverage) ?? ''),
      isPrimary: Boolean(entry.coverage?.isPrimary),
      priorityOrder: String(entry.coverage?.priorityOrder ?? 1),
    });
    setCoverageFormError('');
    void ensureAreasLoaded();
  };

  const startReplaceCoverage = (entry) => {
    setCoverageEditingEntry(entry);
    setCoverageFormMode('replace');
    setCoverageForm({
      coordinatorId: '',
      areaId: String(getCoverageAreaId(entry.coverage) ?? ''),
      isPrimary: Boolean(entry.coverage?.isPrimary),
      priorityOrder: String(entry.coverage?.priorityOrder ?? 1),
    });
    setCoverageFormError('');
    void ensureAreasLoaded();
  };

  const updateCoverageForm = (field, value) => {
    setCoverageForm((current) => ({ ...current, [field]: value }));
    setCoverageFormError('');
  };

  const findExistingCoverage = (coordinatorId, areaId, categoryId, excludedCoverageId = null) => {
    const list = coveragesByCoordinator.get(String(coordinatorId)) || [];
    return list.find((coverage) => (
      String(getCoverageCategoryId(coverage)) === String(categoryId) &&
      String(getCoverageAreaId(coverage)) === String(areaId) &&
      String(getCoverageId(coverage)) !== String(excludedCoverageId ?? '')
    ));
  };

  const refreshCoverageOnly = async () => {
    await fetchCoverageMetadata({ keepCurrent: true });
  };

  const handleSaveCoverage = async (event) => {
    event.preventDefault();
    const categoryId = coverageModalCategory?.categoryId;
    const coordinatorId = Number(coverageForm.coordinatorId);
    const areaId = Number(coverageForm.areaId);
    const priorityOrder = Number(coverageForm.priorityOrder || 1);

    if (!categoryId || !Number.isInteger(coordinatorId) || coordinatorId <= 0) {
      setCoverageFormError('Vui lòng chọn đầu mối xử lý.');
      return;
    }
    if (!Number.isInteger(areaId) || areaId <= 0) {
      setCoverageFormError('Vui lòng chọn phường hoặc khu vực.');
      return;
    }
    if (!Number.isInteger(priorityOrder) || priorityOrder <= 0) {
      setCoverageFormError('Thứ tự ưu tiên phải là số nguyên lớn hơn 0.');
      return;
    }

    const currentCoverageId = getCoverageId(coverageEditingEntry?.coverage);
    const duplicate = findExistingCoverage(coordinatorId, areaId, categoryId, coverageFormMode === 'edit' ? currentCoverageId : null);
    if (duplicate?.isActive !== false) {
      setCoverageFormError('Đầu mối này đã có phạm vi hoạt động cho cùng khu vực và danh mục.');
      return;
    }

    setCoverageSaveLoading(true);
    setCoverageFormError('');
    const payload = { areaId, categoryId: Number(categoryId), isPrimary: Boolean(coverageForm.isPrimary), priorityOrder };

    try {
      if (coverageFormMode === 'edit') {
        await managementFeedbackApi.updateCoordinatorCoverage(coordinatorId, currentCoverageId, payload);
        setMessage({ type: 'success', text: 'Đã cập nhật phạm vi đầu mối.' });
      } else if (coverageFormMode === 'replace') {
        const oldCoordinatorId = Number(coverageEditingEntry?.coordinatorId);
        const oldCoverageId = getCoverageId(coverageEditingEntry?.coverage);
        await managementFeedbackApi.updateCoordinatorCoverage(oldCoordinatorId, oldCoverageId, { isActive: false });
        try {
          if (duplicate) {
            await managementFeedbackApi.updateCoordinatorCoverage(coordinatorId, getCoverageId(duplicate), { ...payload, isActive: true });
          } else {
            await managementFeedbackApi.createCoordinatorCoverage(coordinatorId, payload);
          }
        } catch (replaceError) {
          try {
            await managementFeedbackApi.updateCoordinatorCoverage(oldCoordinatorId, oldCoverageId, { isActive: true });
          } catch (rollbackError) {
            console.error('Không thể khôi phục phạm vi cũ sau khi thay đầu mối thất bại', rollbackError);
          }
          throw replaceError;
        }
        setMessage({ type: 'success', text: 'Đã thay đầu mối xử lý cho phạm vi đã chọn.' });
      } else {
        if (duplicate) {
          await managementFeedbackApi.updateCoordinatorCoverage(coordinatorId, getCoverageId(duplicate), { ...payload, isActive: true });
        } else {
          await managementFeedbackApi.createCoordinatorCoverage(coordinatorId, payload);
        }
        setMessage({ type: 'success', text: 'Đã thêm đầu mối cho danh mục.' });
      }

      resetCoverageForm();
      await refreshCoverageOnly();
    } catch (error) {
      console.error(error);
      setCoverageFormError(extractApiErrorMessage(error, coverageFormMode === 'replace' ? 'Không thể thay đầu mối.' : 'Không thể lưu phạm vi đầu mối.'));
    } finally {
      setCoverageSaveLoading(false);
    }
  };

  const toggleCoverageActive = async (entry) => {
    const coordinatorId = Number(entry.coordinatorId);
    const coverageId = getCoverageId(entry.coverage);
    const nextActive = entry.coverage?.isActive === false;
    const key = `${entry.coordinatorId}:${coverageId}`;
    setCoverageActionKey(key);
    try {
      await managementFeedbackApi.updateCoordinatorCoverage(coordinatorId, coverageId, { isActive: nextActive });
      setMessage({ type: 'success', text: nextActive ? 'Đã kích hoạt lại phạm vi đầu mối.' : 'Đã tạm khóa phạm vi đầu mối.' });
      await refreshCoverageOnly();
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: extractApiErrorMessage(error, 'Không thể thay đổi trạng thái phạm vi đầu mối.') });
    } finally {
      setCoverageActionKey('');
    }
  };

  return (
    <div className="admin-page-shell space-y-6">
      {message.type === 'success' && (
        <SuccessAlert message={message.text} onClose={() => setMessage({ type: '', text: '' })} />
      )}
      {message.type === 'error' && (
        <ErrorAlert message={message.text} onClose={() => setMessage({ type: '', text: '' })} />
      )}

      <section className="admin-page-hero">
        <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-blue-100/70 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-32 h-44 w-44 rounded-full bg-cyan-100/50 blur-3xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="admin-hero-icon">
              <Lucide.FolderKanban size={22} />
            </div>
            <div className="min-w-0">
              <h2 className="admin-hero-title">
                Danh mục phản ánh
              </h2>
              <p className="admin-hero-description">
                Quản lý nhóm phản ánh đô thị, trạng thái hoạt động và đầu mối xử lý mặc định cho từng danh mục.
              </p>
            </div>
          </div>

          <button
            onClick={openCreateModal}
            className="admin-primary-action btn rounded-xl px-5 text-sm font-semibold normal-case"
          >
            <Lucide.PlusCircle size={17} />
            Thêm danh mục
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Tổng danh mục"
          value={categoryStats.total}
          description="Nhóm phản ánh đang cấu hình."
          icon={Lucide.Layers3}
          active={statusFilter === 'all'}
          onClick={() => { setStatusFilter('all'); setCurrentPage(1); }}
        />
        <StatCard
          label="Đang hoạt động"
          value={categoryStats.active}
          description="Có thể tiếp nhận phản ánh mới."
          icon={Lucide.CheckCircle2}
          tone="success"
          active={statusFilter === 'active'}
          onClick={() => { setStatusFilter('active'); setCurrentPage(1); }}
        />
        <StatCard
          label="Đã gắn đầu mối"
          value={categoryStats.assigned}
          description="Có đầu mối xử lý mặc định."
          icon={Lucide.Network}
          tone="info"
          active={statusFilter === 'assigned'}
          disabled={contactMetadataUnavailable}
          onClick={() => { setStatusFilter('assigned'); setCurrentPage(1); }}
        />
        <StatCard
          label="Cần rà soát"
          value={categoryStats.review}
          description="Chưa gắn đầu mối hoặc đang khóa."
          icon={Lucide.AlertTriangle}
          tone="warning"
          active={statusFilter === 'review'}
          disabled={contactMetadataUnavailable}
          onClick={() => { setStatusFilter('review'); setCurrentPage(1); }}
        />
      </section>

      {coverageWarning ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <Lucide.TriangleAlert size={18} className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Chưa tải đủ dữ liệu đầu mối</p>
            <p className="mt-0.5">{coverageWarning}</p>
          </div>
          <button type="button" onClick={() => setCoverageWarning('')} className="rounded-lg p-1 text-amber-700 transition hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-500/10" aria-label="Đóng cảnh báo">
            <Lucide.X size={16} />
          </button>
        </div>
      ) : null}

      {loadError && categories.length > 0 ? (
        <ErrorAlert
          title="Không thể cập nhật danh mục"
          message={`${loadError} Dữ liệu gần nhất vẫn đang được hiển thị.`}
          onClose={() => setLoadError('')}
        />
      ) : null}

      <section className="admin-panel relative overflow-hidden">
        <div className="manager-list-panel-header bg-transparent px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-100">Danh sách danh mục</h2>
                  <ManagerListRefreshIndicator visible={refreshing && !loading} label="Đang cập nhật" />
                </div>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Tổng cộng {categories.length} danh mục · {filteredCategories.length} phù hợp</p>
              </div>
              {(search || statusFilter !== 'all') ? (
                <button type="button" onClick={() => { setSearch(''); setStatusFilter('all'); setCurrentPage(1); }} className="inline-flex h-9 shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  <Lucide.RotateCcw size={15} /> Xóa bộ lọc
                </button>
              ) : null}
            </div>
            <div className="grid w-full gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(320px,1.45fr)_minmax(220px,0.8fr)]">
              <label className="relative block min-w-0">
                <Lucide.Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="search" value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }} className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-slate-700 dark:bg-slate-900" placeholder="Tìm tên, mô tả, đầu mối..." />
              </label>
              <ManagerSelectMenu
                value={statusFilter}
                onChange={(value) => { setStatusFilter(value); setCurrentPage(1); }}
                ariaLabel="Lọc trạng thái danh mục"
                options={[
                  { value: 'all', label: 'Tất cả trạng thái' },
                  { value: 'active', label: 'Đang hoạt động' },
                  { value: 'inactive', label: 'Tạm khóa' },
                  { value: 'assigned', label: 'Đã gắn đầu mối', disabled: contactMetadataUnavailable },
                  { value: 'unassigned', label: 'Chưa gắn đầu mối', disabled: contactMetadataUnavailable },
                  { value: 'review', label: 'Cần rà soát', disabled: contactMetadataUnavailable },
                ]}
              />
            </div>
          </div>
        </div>

        {loading ? (
          <AdminCardGridSkeleton cards={6} />
        ) : loadError && categories.length === 0 ? (
          <AdminErrorState
            title="Không thể tải danh mục phản ánh"
            description={loadError}
            onRetry={() => fetchCats()}
          />
        ) : filteredCategories.length === 0 ? (
          <AdminEmptyState
            icon={Lucide.FolderPlus}
            title={categories.length === 0 ? 'Chưa có danh mục phản ánh' : 'Không có danh mục phù hợp'}
            description={
              categories.length === 0
                ? 'Tạo danh mục đầu tiên để hệ thống có thể phân loại và điều phối phản ánh.'
                : 'Thử đổi từ khóa hoặc bộ lọc để xem các danh mục khác.'
            }
            action={(
              <button
                type="button"
                onClick={() => {
                  if (categories.length === 0) {
                    openCreateModal();
                  } else {
                    setSearch('');
                    setStatusFilter('all');
                    setCurrentPage(1);
                  }
                }}
                className="btn btn-sm rounded-xl border-0 bg-blue-600 font-semibold text-white hover:bg-blue-700"
              >
                {categories.length === 0 ? <Lucide.PlusCircle size={15} /> : <Lucide.RotateCcw size={15} />}
                {categories.length === 0 ? 'Thêm danh mục' : 'Xóa bộ lọc'}
              </button>
            )}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {paginatedCategories.map((cat, index) => {
              const contact = categoryContactMap.get(String(cat.categoryId));
              const coordinator = contact?.coordinator;
              const CategoryIcon = getCategoryIcon(index);

              return (
                <article
                  key={cat.categoryId}
                  className="group rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_36px_rgba(15,23,42,0.05)] transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md dark:border-white/10 dark:bg-slate-900/70 dark:hover:border-blue-400/30"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                        <CategoryIcon size={20} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs text-slate-400">Mã #{cat.categoryId}</div>
                        <h4 className="mt-1 truncate text-base font-semibold text-slate-950 dark:text-slate-100">{getCategoryLabel(cat.categoryName)}</h4>
                      </div>
                    </div>

                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${cat.isActive
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                      : 'bg-slate-100 text-slate-500 dark:bg-white/[0.07] dark:text-slate-300'
                      }`}
                    >
                      {getActiveText(cat.isActive)}
                    </span>
                  </div>

                  <p className="mt-4 min-h-[66px] text-sm leading-6 text-slate-500 dark:text-slate-400">
                    {cat.description || 'Chưa có mô tả chi tiết cho danh mục này.'}
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => openEditModal(cat)}
                      className="btn btn-sm rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    >
                      <Lucide.PencilLine size={15} />
                      Chỉnh sửa
                    </button>
                    <button
                      type="button"
                      onClick={() => requestToggleCategory(cat)}
                      className={`btn btn-sm rounded-xl font-semibold ${cat.isActive
                        ? 'border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200'
                        : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200'
                      }`}
                    >
                      {cat.isActive ? <Lucide.PauseCircle size={15} /> : <Lucide.PlayCircle size={15} />}
                      {cat.isActive ? 'Tạm khóa' : 'Kích hoạt'}
                    </button>
                  </div>

                  <div className="admin-inset-panel mt-5 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-slate-400">Đầu mối xử lý</span>
                      {contact ? (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">Đã gắn</span>
                      ) : contactMetadataPending ? (
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">Đang tải</span>
                      ) : coverageIncomplete ? (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-white/[0.07] dark:text-slate-300">Chưa xác định</span>
                      ) : (
                        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">Chưa gắn</span>
                      )}
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-blue-700 shadow-sm dark:bg-slate-900 dark:text-blue-300">
                        <Lucide.HardHat size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        {contactMetadataPending ? (
                          <div className="space-y-2 py-0.5" aria-label="Đang tải đầu mối">
                            <div className="h-4 w-40 max-w-full animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                            <div className="h-3 w-28 max-w-full animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                          </div>
                        ) : (
                          <>
                            <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-100">
                              {contact ? getCoordinatorDisplayName(coordinator) : coverageIncomplete ? 'Chưa tải đủ dữ liệu đầu mối' : 'Chưa thiết lập phạm vi phụ trách'}
                            </p>
                            {contact && coordinator?.providerName && coordinator?.coordinatorName ? (
                              <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">Phụ trách: {coordinator.coordinatorName}</p>
                            ) : null}
                            <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
                              <Lucide.Phone size={13} />
                              Hotline: {formatPhone(coordinator?.phoneNumber || coordinator?.phone || coordinator?.contactPhone)}
                            </p>
                          </>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => openCoverageModal(cat)}
                      disabled={contactMetadataPending}
                      className={`btn btn-sm mt-4 w-full rounded-xl font-semibold ${
                        contact || coverageIncomplete
                          ? 'border border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-blue-500/10 dark:hover:text-blue-300'
                          : 'border-0 bg-blue-600 text-white shadow-lg shadow-blue-600/15 hover:bg-blue-700'
                      }`}
                    >
                      {contactMetadataPending ? <span className="loading loading-spinner loading-xs" /> : contact ? <Lucide.RefreshCw size={15} /> : coverageIncomplete ? <Lucide.Search size={15} /> : <Lucide.Link2 size={15} />}
                      {contactMetadataPending ? 'Đang tải đầu mối' : contact ? 'Quản lý đầu mối' : coverageIncomplete ? 'Kiểm tra đầu mối' : 'Thiết lập đầu mối'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {!loading && !loadError && filteredCategories.length > 0 ? (
          <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400">Hiển thị {pageStart}–{pageEnd} / {filteredCategories.length} danh mục</span>
            <div className="flex items-center gap-2">
              <button type="button" disabled={activePage <= 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} className="btn btn-sm rounded-xl border border-slate-200 bg-white px-3 font-semibold text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">Trước</button>
              <span className="min-w-24 text-center font-semibold text-slate-700 dark:text-slate-200">Trang {activePage} / {totalPages}</span>
              <button type="button" disabled={activePage >= totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} className="btn btn-sm rounded-xl border border-slate-200 bg-white px-3 font-semibold text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">Sau</button>
            </div>
          </div>
        ) : null}
      </section>

      {showCategoryModal && (
        <CategoryFormModal
          editingCategory={editingCategory}
          catName={catName}
          catDesc={catDesc}
          formError={formError}
          saveLoading={saveLoading}
          onClose={closeCategoryModal}
          onSubmit={handleSaveCategory}
          onNameChange={(value) => { setCatName(value); setFormError(''); }}
          onDescChange={(value) => { setCatDesc(value); setFormError(''); }}
        />
      )}

      {coverageModalCategory && (
        <CoverageManagementModal
          category={coverageModalCategory}
          entries={coverageEntries}
          coordinators={coordinators}
          areas={areas}
          metadataLoading={coverageLoading}
          areasLoading={areasLoading}
          saveLoading={coverageSaveLoading}
          actionKey={coverageActionKey}
          formMode={coverageFormMode}
          form={coverageForm}
          formError={coverageFormError}
          editingEntry={coverageEditingEntry}
          onClose={closeCoverageModal}
          onStartAdd={startAddCoverage}
          onStartEdit={startEditCoverage}
          onStartReplace={startReplaceCoverage}
          onCancelForm={resetCoverageForm}
          onFormChange={updateCoverageForm}
          onSubmit={handleSaveCoverage}
          onToggleCoverage={toggleCoverageActive}
          onOpenDirectory={() => navigate('/management/coordinators', { state: { returnTo: '/management/categories' } })}
        />
      )}

      <ManagerConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmAction?.title || 'Xác nhận thao tác'}
        description={confirmAction?.description}
        confirmLabel={confirmAction?.confirmLabel || 'Xác nhận'}
        cancelLabel="Hủy"
        tone={confirmAction?.tone || 'warning'}
        loading={actionLoading}
        onConfirm={confirmToggleCategory}
        onCancel={() => { if (!actionLoading) setConfirmAction(null); }}
      />
    </div>
  );
};
