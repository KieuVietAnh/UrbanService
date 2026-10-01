import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import {
  getPriorityIntent,
  getSeverityIntent,
  getStatusIntent,
} from '@urbanmind/shared-types';
import { toolsApi } from '@urbanmind/shared-api';

import Button from '../../components/design-system/Button';
import Badge from '../../components/design-system/Badge';
import EmptyState from '../../components/design-system/EmptyState';
import Input from '../../components/design-system/Input';
import Select from '../../components/design-system/Select';
import { useAuth } from '../../contexts/AuthContext';
import { getCategoryLabel } from '../../utils/categoryLabels';
import {
  STAFF_INCIDENT_LIST_STATE,
  useStaffIncidentList,
} from '../../hooks/useStaffIncidentList';

const PAGE_SIZE_OPTIONS = [10, 20, 30];

const QUICK_STATUS_FILTERS = Object.freeze([
  { value: '', label: 'Tất cả', icon: Lucide.LayoutList },
  { value: 'Assigned', label: 'Được phân công', icon: Lucide.UserRoundCheck },
  { value: 'InProgress', label: 'Đang xử lý', icon: Lucide.LoaderCircle },
  { value: 'NeedRework', label: 'Cần xử lý lại', icon: Lucide.RotateCcw },
  { value: 'SubmittedForApproval', label: 'Chờ duyệt', icon: Lucide.Clock3 },
]);

const STATUS_FILTER_OPTIONS = Object.freeze([
  'Assigned',
  'InProgress',
  'NeedRework',
  'SubmittedForApproval',
  'Approved',
  'Resolved',
  'Closed',
  'Merged',
]);

const PRIORITY_FILTER_OPTIONS = Object.freeze(['Urgent', 'High', 'Medium', 'Low']);
const SEVERITY_FILTER_OPTIONS = Object.freeze(['Critical', 'High', 'Medium', 'Low']);

const STATUS_LABELS = {
  new: 'Mới',
  open: 'Đang mở',
  verified: 'Đã xác minh',
  assigned: 'Được phân công',
  inprogress: 'Đang xử lý',
  submittedforapproval: 'Chờ Manager duyệt',
  needrework: 'Cần xử lý lại',
  resolved: 'Đã giải quyết',
  approved: 'Đã phê duyệt',
  closed: 'Đã đóng',
  cancelled: 'Đã hủy',
  rejected: 'Đã từ chối',
  merged: 'Đã gộp',
};

const PRIORITY_LABELS = {
  critical: 'Khẩn cấp',
  urgent: 'Khẩn cấp',
  high: 'Cao',
  medium: 'Trung bình',
  normal: 'Trung bình',
  low: 'Thấp',
};

const SEVERITY_LABELS = {
  critical: 'Nghiêm trọng',
  urgent: 'Nghiêm trọng',
  major: 'Cao',
  high: 'Cao',
  medium: 'Trung bình',
  normal: 'Trung bình',
  minor: 'Thấp',
  low: 'Thấp',
};

const normalizeEnumKey = (value) => String(value ?? '')
  .trim()
  .replace(/[-_\s]+/g, '')
  .toLowerCase();

const getEnumLabel = (value, labels) => {
  if (value === null || value === undefined || value === '') return 'Chưa có dữ liệu';
  return labels[normalizeEnumKey(value)] || 'Khác';
};

const formatIncidentCode = (incidentId) => {
  const normalized = String(incidentId ?? '').trim();
  return normalized ? `SV-${normalized.slice(0, 8).toUpperCase()}` : 'Chưa có dữ liệu';
};

const formatDateTime = (value) => {
  if (!value) return 'Chưa có dữ liệu';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa có dữ liệu';

  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
};

const formatCount = (value) => {
  if (value === null || value === undefined || value === '') return 'Chưa có dữ liệu';
  const count = Number(value);
  return Number.isFinite(count) ? count.toLocaleString('vi-VN') : 'Chưa có dữ liệu';
};

const getAreaLabel = (area) => (
  area?.areaName || area?.name || area?.displayName || 'Khu vực chưa đặt tên'
);

const getPositiveInteger = (value, fallback) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const getOperationalState = (status) => {
  const key = normalizeEnumKey(status);
  if (key === 'needrework') return 'rework';
  if (key === 'submittedforapproval') return 'review';
  if (['approved', 'resolved', 'closed'].includes(key)) return 'complete';
  return 'active';
};

const getOperationalNote = (status) => ({
  rework: 'Ưu tiên cập nhật theo yêu cầu của Manager',
  review: 'Đã gửi kết quả, đang chờ Manager kiểm tra',
  complete: 'Đã hoàn thành, vẫn có thể mở để tra cứu',
})[getOperationalState(status)] || '';

function FilterField({ label, htmlFor, icon: Icon, children }) {
  return (
    <div className="space-y-2">
      <label htmlFor={htmlFor} className="flex min-h-4 items-center gap-2 whitespace-nowrap text-xs font-bold uppercase tracking-[0.055em] text-slate-500 dark:text-slate-400">
        {Icon ? <Icon className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" aria-hidden="true" /> : null}
        {label}
      </label>
      {children}
    </div>
  );
}

function IncidentListSkeleton() {
  return (
    <section className="admin-panel overflow-hidden" aria-busy="true" aria-label="Đang tải danh sách sự vụ">
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-slate-50/70 px-5 py-4 sm:px-6 dark:border-slate-800 dark:bg-slate-950/30">
        <div>
          <div className="h-5 w-36 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
          <div className="mt-2 h-3 w-64 max-w-full animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800/70" />
        </div>
        <div className="h-8 w-24 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="grid gap-5 px-5 py-5 sm:px-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(12rem,1fr)_minmax(13rem,1fr)_8rem] xl:items-center">
            <div>
              <div className="h-4 w-24 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
              <div className="mt-3 h-5 w-3/4 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
              <div className="mt-3 h-3 w-1/2 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800/70" />
            </div>
            <div className="flex gap-2">
              <div className="h-7 w-24 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
              <div className="h-7 w-20 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
            </div>
            <div className="h-10 w-full animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
          </div>
        ))}
      </div>
      <span className="sr-only">Đang tải dữ liệu</span>
    </section>
  );
}

export function StaffIncidentListState({ state, hasActiveFilters = false, onRetry, scopeUnavailable = false }) {
  if (state === STAFF_INCIDENT_LIST_STATE.LOADING) {
    return <IncidentListSkeleton />;
  }

  const stateContent = {
    [STAFF_INCIDENT_LIST_STATE.API_UNAVAILABLE]: {
      icon: Lucide.ClipboardList,
      title: 'Chưa thể tải danh sách sự vụ',
      description: 'Dữ liệu sự vụ hiện chưa khả dụng. Vui lòng quay lại sau.',
    },
    [STAFF_INCIDENT_LIST_STATE.ERROR]: {
      icon: Lucide.TriangleAlert,
      title: 'Không thể tải danh sách sự vụ',
      description: scopeUnavailable === 'missing-user'
        ? 'Không xác định được tài khoản Staff hiện tại để lọc phạm vi công việc.'
        : scopeUnavailable === 'scope-mismatch'
          ? 'Danh sách có sự vụ ngoài phạm vi của bạn nên đã được ẩn để tránh xử lý nhầm.'
          : 'Không thể tải dữ liệu sự vụ. Vui lòng thử lại.',
      action: scopeUnavailable ? null : (
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          <Lucide.RefreshCw size={16} aria-hidden="true" />
          Thử lại
        </Button>
      ),
    },
    [STAFF_INCIDENT_LIST_STATE.EMPTY]: {
      icon: Lucide.ClipboardList,
      title: 'Bạn chưa có sự vụ nào được phân công',
      description: 'Các sự vụ được phân công cho bạn sẽ xuất hiện tại đây.',
    },
    [STAFF_INCIDENT_LIST_STATE.NO_RESULTS]: {
      icon: Lucide.SearchX,
      title: 'Không tìm thấy sự vụ phù hợp',
      description: 'Hãy thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.',
    },
  };

  const content = stateContent[
    state === STAFF_INCIDENT_LIST_STATE.EMPTY && hasActiveFilters
      ? STAFF_INCIDENT_LIST_STATE.NO_RESULTS
      : state
  ];

  if (!content) return null;

  return (
    <section aria-live="polite">
      <EmptyState {...content} />
    </section>
  );
}

function IncidentBadges({ incident }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <Badge intent={getStatusIntent(incident?.status)} className="whitespace-nowrap">
        {getEnumLabel(incident?.status, STATUS_LABELS)}
      </Badge>
      <Badge intent={getPriorityIntent(incident?.priority)} className="whitespace-nowrap">
        Ưu tiên: {getEnumLabel(incident?.priority, PRIORITY_LABELS)}
      </Badge>
      <Badge intent={getSeverityIntent(incident?.severity)} className="whitespace-nowrap">
        Mức độ: {getEnumLabel(incident?.severity, SEVERITY_LABELS)}
      </Badge>
      {incident?.mergedIntoIncidentId ? <Badge intent="neutral">Đã gộp</Badge> : null}
    </div>
  );
}

function IncidentDetailLink({ incidentId }) {
  if (!incidentId) {
    return <span className="text-sm font-medium text-slate-500">Chưa có dữ liệu</span>;
  }

  const incidentCode = formatIncidentCode(incidentId);

  return (
    <Link
      to={`/staff/incidents/${incidentId}`}
      className="group/link inline-flex min-h-10 min-w-[8.75rem] items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-[0_8px_18px_rgba(37,99,235,0.18)] transition hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-[0_12px_24px_rgba(37,99,235,0.24)] active:translate-y-0 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 dark:bg-blue-500 dark:hover:bg-blue-400"
      aria-label={`Xem chi tiết sự vụ ${incidentCode}`}
    >
      Xem chi tiết
      <Lucide.ArrowRight size={16} className="transition-transform group-hover/link:translate-x-0.5" aria-hidden="true" />
    </Link>
  );
}

function IncidentList({ incidents, totalItems }) {
  return (
    <section className="admin-panel overflow-hidden" aria-label="Danh sách sự vụ được giao">
      <header className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/65 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:border-slate-800 dark:bg-slate-950/25">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300" aria-hidden="true">
            <Lucide.Rows3 size={18} />
          </span>
          <div>
            <h2 id="staff-incident-list-title" className="text-sm font-black text-slate-900 dark:text-slate-100">Danh sách sự vụ</h2>
            <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">Danh sách được lọc và phân trang theo dữ liệu mới nhất.</p>
          </div>
        </div>
        <span className="inline-flex w-fit items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 dark:border-blue-800 dark:bg-blue-950/45 dark:text-blue-200">
          {Number(totalItems || 0).toLocaleString('vi-VN')} sự vụ
        </span>
      </header>

      <div className="hidden xl:block">
        <table className="table table-fixed w-full text-sm">
          <caption className="sr-only">Các sự vụ được phân công cho tài khoản nhân viên hiện tại</caption>
          <colgroup>
            <col className="w-[25%]" />
            <col className="w-[18%]" />
            <col className="w-[18%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
            <col className="w-[19%]" />
          </colgroup>
          <thead className="admin-table-head">
            <tr className="text-[11px] font-semibold uppercase tracking-[0.06em]">
              <th scope="col">Sự vụ</th>
              <th scope="col">Khu vực và danh mục</th>
              <th scope="col">Trạng thái xử lý</th>
              <th scope="col">Phản ánh</th>
              <th scope="col">Cập nhật</th>
              <th scope="col"><span className="sr-only">Thao tác</span></th>
            </tr>
          </thead>
          <tbody className="admin-table-body divide-y divide-slate-100 dark:divide-slate-800">
            {incidents.map((incident) => {
              const incidentId = incident?.incidentId;
              const code = formatIncidentCode(incidentId);
              const operationalState = getOperationalState(incident?.status);
              const operationalNote = getOperationalNote(incident?.status);
              return (
                <tr
                  key={incidentId}
                  className={`admin-table-row group align-middle transition-colors ${operationalState === 'rework' ? 'bg-amber-50/55 dark:bg-amber-950/10' : operationalState === 'complete' ? 'bg-slate-50/45 dark:bg-slate-950/20' : ''}`}
                >
                  <th scope="row" className={`font-normal ${operationalState === 'rework' ? 'border-l-4 border-l-amber-500' : ''}`}>
                    <p className="inline-flex items-center gap-1.5 text-xs font-black tracking-[0.03em] text-blue-700 dark:text-blue-300" title={incidentId}>
                      <Lucide.Hash size={13} aria-hidden="true" />
                      {code}
                    </p>
                    <p className="mt-1.5 line-clamp-2 font-semibold leading-6 text-slate-900 dark:text-slate-100">
                      {incident?.title || 'Chưa có dữ liệu'}
                    </p>
                    {operationalNote ? (
                      <p className={`mt-1.5 text-xs font-semibold leading-5 ${operationalState === 'rework' ? 'text-amber-700 dark:text-amber-300' : operationalState === 'review' ? 'text-blue-700 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'}`}>
                        {operationalNote}
                      </p>
                    ) : null}
                  </th>
                  <td>
                    <p className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
                      <Lucide.MapPin className="h-4 w-4 shrink-0 text-blue-500" aria-hidden="true" />
                      {incident?.areaName || 'Chưa có dữ liệu'}
                    </p>
                    <p className="mt-1.5 line-clamp-1 pl-6 text-xs text-slate-500 dark:text-slate-400">
                      {incident?.locationText || getCategoryLabel(incident?.categoryName, 'Chưa có dữ liệu')}
                    </p>
                    {incident?.locationText ? (
                      <p className="mt-1 line-clamp-1 pl-6 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {getCategoryLabel(incident?.categoryName, 'Chưa có dữ liệu')}
                      </p>
                    ) : null}
                  </td>
                  <td><IncidentBadges incident={incident} /></td>
                  <td>
                    <p className="flex items-baseline gap-1.5 font-black text-slate-900 dark:text-slate-100">
                      <span className="text-lg leading-none">{formatCount(incident?.reportCount)}</span>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">phản ánh</span>
                    </p>
                    <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                      {formatCount(incident?.subscriberCount)} người theo dõi
                    </p>
                  </td>
                  <td>
                    <time dateTime={incident?.updatedAt || incident?.createdAt || undefined} className="inline-flex items-start gap-1.5 text-xs leading-5 text-slate-600 dark:text-slate-300">
                      <Lucide.Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                      {formatDateTime(incident?.updatedAt || incident?.createdAt)}
                    </time>
                  </td>
                  <td className="px-3 text-right"><IncidentDetailLink incidentId={incidentId} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-slate-100 xl:hidden dark:divide-slate-800">
        {incidents.map((incident) => {
          const incidentId = incident?.incidentId;
          const operationalState = getOperationalState(incident?.status);
          const operationalNote = getOperationalNote(incident?.status);
          return (
            <article
              key={incidentId}
              className={`relative px-5 py-5 transition-colors sm:px-6 ${operationalState === 'rework' ? 'bg-amber-50/55 hover:bg-amber-50 dark:bg-amber-950/10 dark:hover:bg-amber-950/20' : operationalState === 'complete' ? 'bg-slate-50/45 hover:bg-slate-100/60 dark:bg-slate-950/20 dark:hover:bg-slate-950/30' : 'hover:bg-blue-50/35 dark:hover:bg-blue-950/15'}`}
            >
              <span className={`absolute inset-y-5 left-0 w-1 rounded-r-full ${operationalState === 'rework' ? 'bg-amber-500' : operationalState === 'complete' ? 'bg-slate-300 dark:bg-slate-700' : 'bg-blue-500'}`} aria-hidden="true" />
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="inline-flex items-center gap-1.5 text-xs font-black tracking-[0.03em] text-blue-700 dark:text-blue-300" title={incidentId}>
                    <Lucide.Hash size={13} aria-hidden="true" />
                    {formatIncidentCode(incidentId)}
                  </p>
                  <h3 className="mt-1.5 text-base font-bold leading-6 text-slate-900 dark:text-slate-100">
                    {incident?.title || 'Chưa có dữ liệu'}
                  </h3>
                  {operationalNote ? (
                    <p className={`mt-1.5 text-xs font-semibold leading-5 ${operationalState === 'rework' ? 'text-amber-700 dark:text-amber-300' : operationalState === 'review' ? 'text-blue-700 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'}`}>
                      {operationalNote}
                    </p>
                  ) : null}
                </div>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/45 dark:text-blue-300" aria-hidden="true">
                  <Lucide.BriefcaseBusiness className="h-5 w-5" />
                </span>
              </div>

              <div className="mt-4"><IncidentBadges incident={incident} /></div>

              <dl className="mt-4 grid gap-2.5 text-sm sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 px-3.5 py-3 dark:bg-slate-950/35">
                  <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400">Phường / Khu vực</dt>
                  <dd className="mt-1 font-semibold text-slate-800 dark:text-slate-200">
                    {incident?.areaName || 'Chưa có dữ liệu'}
                  </dd>
                </div>
                <div className="rounded-xl bg-slate-50 px-3.5 py-3 dark:bg-slate-950/35">
                  <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400">Danh mục</dt>
                  <dd className="mt-1 font-semibold text-slate-800 dark:text-slate-200">
                    {getCategoryLabel(incident?.categoryName, 'Chưa có dữ liệu')}
                  </dd>
                </div>
                <div className="rounded-xl bg-slate-50 px-3.5 py-3 dark:bg-slate-950/35">
                  <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400">Số phản ánh</dt>
                  <dd className="mt-1 font-semibold text-slate-800 dark:text-slate-200">
                    {formatCount(incident?.reportCount)} phản ánh
                  </dd>
                </div>
                <div className="rounded-xl bg-slate-50 px-3.5 py-3 dark:bg-slate-950/35">
                  <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400">Cập nhật lần cuối</dt>
                  <dd className="mt-1 font-semibold text-slate-800 dark:text-slate-200">
                    {formatDateTime(incident?.updatedAt || incident?.createdAt)}
                  </dd>
                </div>
              </dl>

              {incident?.locationText ? (
                <p className="mt-4 flex items-start gap-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  <Lucide.MapPin className="mt-1 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                  {incident.locationText}
                </p>
              ) : null}

              <div className="mt-5 [&>a]:w-full sm:[&>a]:w-auto"><IncidentDetailLink incidentId={incidentId} /></div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

const buildPageItems = (currentPage, totalPages) => {
  if (totalPages <= 9) return Array.from({ length: totalPages }, (_, index) => index + 1);

  const startPage = Math.max(2, Math.min(currentPage - 2, totalPages - 5));
  const endPage = Math.min(totalPages - 1, startPage + 4);
  const items = [1];

  if (startPage > 2) items.push('ellipsis-start');
  for (let page = startPage; page <= endPage; page += 1) items.push(page);
  if (endPage < totalPages - 1) items.push('ellipsis-end');
  items.push(totalPages);

  return items;
};

function Pagination({ pagination, pageNumber, pageSize, loading, onPageChange, onPageSizeChange }) {
  const totalPages = Math.max(Number(pagination?.totalPages) || 1, 1);
  const totalItems = Number(pagination?.totalItems) || 0;
  const currentPage = Math.min(Math.max(Number(pageNumber) || 1, 1), totalPages);
  const pageItems = buildPageItems(currentPage, totalPages);

  return (
    <footer className="mt-4 space-y-4 rounded-2xl border border-slate-200 bg-white/75 px-4 py-4 dark:border-slate-800 dark:bg-slate-900/60">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600 dark:text-slate-300" aria-live="polite">
          <span className="font-semibold text-slate-900 dark:text-slate-100">{totalItems.toLocaleString('vi-VN')}</span> sự vụ được giao · Trang {currentPage}/{totalPages}
        </p>
        <label htmlFor="staff-incident-page-size" className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
          Số dòng
          <Select
            id="staff-incident-page-size"
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="h-10 w-20"
            disabled={loading}
          >
            {PAGE_SIZE_OPTIONS.map((value) => <option key={value} value={value}>{value}</option>)}
          </Select>
        </label>
      </div>

      <nav className="flex flex-wrap items-center justify-center gap-1.5" aria-label="Phân trang danh sách sự vụ được giao">
        <button
          type="button"
          aria-label="Trang trước"
          disabled={loading || !pagination?.hasPreviousPage}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          className="inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-blue-800 dark:hover:bg-blue-950/40"
        >
          <Lucide.ChevronLeft size={16} aria-hidden="true" />
          <span className="hidden sm:inline">Trước</span>
        </button>

        {pageItems.map((item) => (typeof item === 'number' ? (
          <button
            key={item}
            type="button"
            disabled={loading}
            aria-label={`Đến trang ${item}`}
            aria-current={item === currentPage ? 'page' : undefined}
            onClick={() => onPageChange(item)}
            className={`inline-flex h-9 min-w-9 items-center justify-center rounded-xl border px-2 text-sm font-black transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60 ${item === currentPage ? 'border-blue-600 bg-blue-600 text-white shadow-[0_8px_18px_rgba(37,99,235,0.2)]' : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-blue-800 dark:hover:bg-blue-950/40'}`}
          >
            {item}
          </button>
        ) : (
          <span key={item} className="inline-flex h-9 min-w-7 items-center justify-center text-sm font-bold text-slate-400" aria-hidden="true">…</span>
        )))}

        <button
          type="button"
          aria-label="Trang sau"
          disabled={loading || !pagination?.hasNextPage}
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          className="inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-blue-800 dark:hover:bg-blue-950/40"
        >
          <span className="hidden sm:inline">Sau</span>
          <Lucide.ChevronRight size={16} aria-hidden="true" />
        </button>
      </nav>
    </footer>
  );
}

export default function StaffIncidentListPage() {
  const { user } = useAuth();
  const assignedStaffUserId = String(user?.userId ?? '').trim();
  const [searchParams, setSearchParams] = useSearchParams();
  const [areas, setAreas] = useState([]);
  const [categories, setCategories] = useState([]);
  const requestedPageSize = getPositiveInteger(searchParams.get('pageSize'), 10);
  const pageNumber = getPositiveInteger(searchParams.get('page'), 1);
  const pageSize = PAGE_SIZE_OPTIONS.includes(requestedPageSize) ? requestedPageSize : 10;
  const filters = useMemo(() => ({
    areaId: searchParams.get('areaId') || '',
    categoryId: searchParams.get('categoryId') || '',
    status: searchParams.get('status') || '',
    priority: searchParams.get('priority') === 'Critical' ? 'Urgent' : (searchParams.get('priority') || ''),
    severity: searchParams.get('severity') || '',
    search: searchParams.get('search') || '',
    includeMerged: searchParams.get('includeMerged') === 'true',
  }), [searchParams]);
  const [draftSearch, setDraftSearch] = useState(filters.search);

  useEffect(() => {
    setDraftSearch(filters.search);
  }, [filters.search]);

  useEffect(() => {
    let active = true;

    const loadLookups = async () => {
      const [areasResult, categoriesResult] = await Promise.allSettled([
        toolsApi.getAreas(),
        toolsApi.getCategories(),
      ]);

      if (!active) return;
      setAreas(areasResult.status === 'fulfilled' && Array.isArray(areasResult.value) ? areasResult.value : []);
      setCategories(categoriesResult.status === 'fulfilled' && Array.isArray(categoriesResult.value) ? categoriesResult.value : []);
    };

    void loadLookups();
    return () => { active = false; };
  }, []);

  const queryParams = useMemo(() => ({
    pageNumber,
    pageSize,
    areaId: filters.areaId,
    categoryId: filters.categoryId,
    status: filters.status,
    priority: filters.priority,
    severity: filters.severity,
    search: filters.search,
    includeMerged: filters.includeMerged,
    assignedStaffUserId,
  }), [assignedStaffUserId, filters, pageNumber, pageSize]);

  const {
    error,
    incidents,
    pagination,
    retry,
    state,
  } = useStaffIncidentList(queryParams, { enabled: Boolean(assignedStaffUserId) });

  const hasActiveFilters = Boolean(
    filters.areaId
    || filters.categoryId
    || filters.status
    || filters.priority
    || filters.severity
    || filters.search
    || filters.includeMerged
  );
  const activeFilterCount = [
    filters.areaId,
    filters.categoryId,
    filters.status,
    filters.priority,
    filters.severity,
    filters.search,
    filters.includeMerged,
  ].filter(Boolean).length;
  const loading = state === STAFF_INCIDENT_LIST_STATE.LOADING;
  const scopeUnavailable = error?.message === 'STAFF_SCOPE_UNAVAILABLE'
    ? 'missing-user'
    : error?.message === 'STAFF_SCOPE_MISMATCH'
      ? 'scope-mismatch'
      : false;

  const updateQuery = (updates, { replace = false } = {}) => {
    const next = new URLSearchParams(searchParams);

    Object.entries(updates).forEach(([key, value]) => {
      const isDefaultPage = key === 'page' && Number(value) === 1;
      const isDefaultPageSize = key === 'pageSize' && Number(value) === 10;
      if (value === '' || value === false || value == null || isDefaultPage || isDefaultPageSize) {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
    });

    setSearchParams(next, { replace });
  };

  const updateFilter = (key, value) => {
    updateQuery({ [key]: value, page: 1 });
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    updateFilter('search', draftSearch.trim());
  };

  const handleResetFilters = () => {
    setDraftSearch('');
    setSearchParams({});
  };

  useEffect(() => {
    if (![STAFF_INCIDENT_LIST_STATE.READY, STAFF_INCIDENT_LIST_STATE.EMPTY].includes(state)) return;

    const totalPages = Math.max(Number(pagination?.totalPages) || 1, 1);
    if (pageNumber <= totalPages) return;

    const next = new URLSearchParams(searchParams);
    if (totalPages === 1) next.delete('page');
    else next.set('page', String(totalPages));
    setSearchParams(next, { replace: true });
  }, [pageNumber, pagination?.totalPages, searchParams, setSearchParams, state]);

  return (
    <article className="admin-page-shell space-y-6">
      <header className="admin-page-hero px-5 py-6 sm:px-7 sm:py-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="admin-hero-icon">
              <Lucide.ClipboardList size={22} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="mb-2 text-[11px] font-black uppercase tracking-[0.14em] text-blue-700 dark:text-blue-300">
                Không gian xử lý công việc
              </p>
              <h1 className="admin-hero-title">Sự vụ của tôi</h1>
              <p className="admin-hero-description">
                Theo dõi các sự vụ được phân công, mức độ ưu tiên và tiến độ xử lý.
              </p>
            </div>
          </div>

          <aside className="flex w-full max-w-md items-center gap-4 rounded-2xl border border-white/80 bg-white/75 p-3.5 shadow-[0_12px_28px_rgba(30,64,175,0.08)] backdrop-blur-sm lg:w-auto dark:border-slate-700/70 dark:bg-slate-900/65">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-[0_8px_20px_rgba(37,99,235,0.22)]" aria-hidden="true">
              <Lucide.UserRoundCheck size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Phạm vi hiển thị</p>
              <p className="mt-0.5 text-sm font-black text-slate-900 dark:text-slate-100">Sự vụ được giao cho bạn</p>
            </div>
            <div className="border-l border-slate-200 pl-4 text-right dark:border-slate-700">
              <p className="text-xl font-black tracking-tight text-blue-700 dark:text-blue-300">
                {loading ? '…' : Number(pagination?.totalItems || 0).toLocaleString('vi-VN')}
              </p>
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">sự vụ</p>
            </div>
          </aside>
        </div>
      </header>

      <section className="admin-panel overflow-hidden" aria-labelledby="staff-incident-filters-title">
        <header className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/65 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:border-slate-800 dark:bg-slate-950/25">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-200/70 text-slate-700 dark:bg-slate-800 dark:text-slate-200" aria-hidden="true">
              <Lucide.ListFilter size={18} />
            </span>
            <div>
              <h2 id="staff-incident-filters-title" className="admin-section-title">Bộ lọc sự vụ</h2>
              <p className="admin-section-description mt-1">Thu hẹp danh sách trong đúng phạm vi công việc được giao.</p>
            </div>
          </div>
          {activeFilterCount > 0 ? (
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1.5 text-xs font-bold text-blue-700 dark:bg-blue-950/55 dark:text-blue-200" aria-live="polite">
              <Lucide.SlidersHorizontal size={13} aria-hidden="true" />
              {activeFilterCount} bộ lọc đang áp dụng
            </span>
          ) : (
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">Chưa áp dụng bộ lọc</span>
          )}
        </header>

        <div className="border-b border-slate-200 px-5 py-3.5 sm:px-6 dark:border-slate-800">
          <p id="staff-incident-quick-filter-label" className="mb-2 text-xs font-bold text-slate-600 dark:text-slate-300">
            Lọc nhanh theo tiến độ
          </p>
          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <div className="flex min-w-max gap-2" role="group" aria-labelledby="staff-incident-quick-filter-label">
              {QUICK_STATUS_FILTERS.map(({ value, label, icon: Icon }) => {
                const active = filters.status === value;
                return (
                  <button
                    key={value || 'all'}
                    type="button"
                    aria-pressed={active}
                    onClick={() => updateFilter('status', value)}
                    className={`inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 dark:focus-visible:ring-blue-950 ${active ? 'border-blue-600 bg-blue-600 text-white shadow-[0_8px_18px_rgba(37,99,235,0.18)]' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-blue-800 dark:hover:bg-blue-950/40 dark:hover:text-blue-200'}`}
                  >
                    <Icon size={15} aria-hidden="true" />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <form onSubmit={handleSearchSubmit} className="px-5 py-5 sm:px-6">
          <div className="grid gap-x-3 gap-y-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[minmax(240px,1.6fr)_repeat(5,minmax(0,1fr))]">
            <div className="sm:col-span-2 lg:col-span-1">
              <FilterField label="Tìm kiếm" htmlFor="staff-incident-search" icon={Lucide.Search}>
                <div className="relative">
                  <Lucide.Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <Input
                    id="staff-incident-search"
                    type="search"
                    value={draftSearch}
                    onChange={(event) => setDraftSearch(event.target.value)}
                    placeholder="Tìm theo từ khóa sự vụ"
                    className="h-11 pl-10"
                  />
                </div>
              </FilterField>
            </div>

            <FilterField label="Trạng thái" htmlFor="staff-incident-status" icon={Lucide.Activity}>
              <Select id="staff-incident-status" value={filters.status} onChange={(event) => updateFilter('status', event.target.value)} className="h-11">
                <option value="">Tất cả trạng thái</option>
                {STATUS_FILTER_OPTIONS.map((value) => <option key={value} value={value}>{getEnumLabel(value, STATUS_LABELS)}</option>)}
              </Select>
            </FilterField>

            <FilterField label="Mức ưu tiên" htmlFor="staff-incident-priority" icon={Lucide.Flag}>
              <Select id="staff-incident-priority" value={filters.priority} onChange={(event) => updateFilter('priority', event.target.value)} className="h-11">
                <option value="">Tất cả mức ưu tiên</option>
                {PRIORITY_FILTER_OPTIONS.map((value) => <option key={value} value={value}>{getEnumLabel(value, PRIORITY_LABELS)}</option>)}
              </Select>
            </FilterField>

            <FilterField label="Độ nghiêm trọng" htmlFor="staff-incident-severity" icon={Lucide.TriangleAlert}>
              <Select id="staff-incident-severity" value={filters.severity} onChange={(event) => updateFilter('severity', event.target.value)} className="h-11">
                <option value="">Tất cả mức độ</option>
                {SEVERITY_FILTER_OPTIONS.map((value) => <option key={value} value={value}>{getEnumLabel(value, SEVERITY_LABELS)}</option>)}
              </Select>
            </FilterField>

            <FilterField label="Phường / Khu vực" htmlFor="staff-incident-area" icon={Lucide.MapPin}>
              <Select id="staff-incident-area" value={filters.areaId} onChange={(event) => updateFilter('areaId', event.target.value)} className="h-11">
                <option value="">Tất cả khu vực</option>
                {areas.map((area) => (
                  <option key={area?.areaId ?? area?.id} value={area?.areaId ?? area?.id}>
                    {getAreaLabel(area)}
                  </option>
                ))}
              </Select>
            </FilterField>

            <FilterField label="Danh mục" htmlFor="staff-incident-category" icon={Lucide.Tags}>
              <Select id="staff-incident-category" value={filters.categoryId} onChange={(event) => updateFilter('categoryId', event.target.value)} className="h-11">
                <option value="">Tất cả danh mục</option>
                {categories.map((category) => (
                  <option key={category?.categoryId ?? category?.id} value={category?.categoryId ?? category?.id}>
                    {getCategoryLabel(category?.categoryName || category?.name)}
                  </option>
                ))}
              </Select>
            </FilterField>
          </div>

          <div className="mt-5 flex flex-col gap-4 rounded-2xl bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:bg-slate-950/35">
            <label className="flex min-h-10 cursor-pointer items-center gap-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                className="checkbox checkbox-sm checkbox-primary"
                checked={filters.includeMerged}
                onChange={(event) => updateFilter('includeMerged', event.target.checked)}
              />
              Hiển thị sự vụ đã gộp
            </label>

            <div className="flex flex-wrap gap-2 sm:justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={handleResetFilters} disabled={!hasActiveFilters && !draftSearch}>
                <Lucide.RotateCcw size={16} aria-hidden="true" />
                Xóa bộ lọc
              </Button>
              <Button type="submit" size="sm" className="admin-primary-action min-w-[7.5rem]">
                <Lucide.Search size={16} aria-hidden="true" />
                Tìm kiếm
              </Button>
            </div>
          </div>
        </form>
      </section>

      <section aria-label="Danh sách sự vụ được giao" className="relative">
        {loading && incidents.length > 0 ? (
          <span className="absolute right-5 top-5 z-10 inline-flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <Lucide.LoaderCircle size={15} className="animate-spin" aria-hidden="true" />
            Đang làm mới
          </span>
        ) : null}
        {state === STAFF_INCIDENT_LIST_STATE.READY ? (
          <>
            <IncidentList incidents={incidents} totalItems={pagination?.totalItems} />
            <Pagination
              pagination={pagination}
              pageNumber={pageNumber}
              pageSize={pageSize}
              loading={loading}
              onPageChange={(value) => updateQuery({ page: value })}
              onPageSizeChange={(value) => updateQuery({ pageSize: value, page: 1 })}
            />
          </>
        ) : (
          <StaffIncidentListState
            state={state}
            hasActiveFilters={hasActiveFilters}
            onRetry={retry}
            scopeUnavailable={scopeUnavailable}
          />
        )}
      </section>

    </article>
  );
}
