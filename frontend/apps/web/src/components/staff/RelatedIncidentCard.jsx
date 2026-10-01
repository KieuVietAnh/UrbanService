import { Link } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { getStatusIntent } from '@urbanmind/shared-types';

import Badge from '../design-system/Badge';
import Button from '../design-system/Button';
import {
  STAFF_INCIDENT_DETAIL_STATE,
  useStaffIncidentDetail,
} from '../../hooks/useStaffIncidentDetail';
import {
  EMPTY_VALUE,
  formatIncidentCode,
  getIncidentStatusLabel,
} from '../../pages/staff/incidentDetailPresentation';

function RelatedIncidentLoading() {
  return (
    <section className="admin-panel overflow-hidden" aria-busy="true" aria-label="Đang tải sự vụ liên quan">
      <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <div className="h-5 w-36 animate-pulse rounded-md bg-slate-200 dark:bg-slate-800" />
      </div>
      <div className="space-y-3 px-5 py-5">
        <div className="h-4 w-28 animate-pulse rounded-md bg-slate-100 dark:bg-slate-800/70" />
        <div className="h-5 w-3/4 animate-pulse rounded-md bg-slate-200 dark:bg-slate-800" />
        <div className="h-4 w-full animate-pulse rounded-md bg-slate-100 dark:bg-slate-800/70" />
      </div>
      <span className="sr-only">Đang tải dữ liệu</span>
    </section>
  );
}

function RelatedIncidentNotice({ icon: Icon, title, description, action = null }) {
  return (
    <section className="admin-panel overflow-hidden" aria-labelledby="related-incident-title">
      <header className="flex items-center gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <span className="admin-mini-icon" aria-hidden="true"><Lucide.Landmark size={17} /></span>
        <h2 id="related-incident-title" className="admin-section-title">Sự vụ liên quan</h2>
      </header>
      <div className="px-5 py-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" aria-hidden="true">
            <Icon size={17} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</p>
            <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
          </div>
        </div>
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </section>
  );
}

export default function RelatedIncidentCard({ incidentId }) {
  const normalizedIncidentId = String(incidentId ?? '').trim();
  const { incident, retry, state } = useStaffIncidentDetail(normalizedIncidentId);

  if (!normalizedIncidentId) {
    return (
      <RelatedIncidentNotice
        icon={Lucide.Link2Off}
        title="Chưa có sự vụ liên quan"
        description="Phản ánh này hiện chưa được liên kết với sự vụ nào."
      />
    );
  }

  if (state === STAFF_INCIDENT_DETAIL_STATE.LOADING) return <RelatedIncidentLoading />;

  if (state === STAFF_INCIDENT_DETAIL_STATE.API_UNAVAILABLE) {
    return null;
  }

  if (state === STAFF_INCIDENT_DETAIL_STATE.NOT_FOUND) {
    return (
      <RelatedIncidentNotice
        icon={Lucide.FileQuestion}
        title="Không tìm thấy sự vụ liên quan"
        description="Mã sự vụ được trả về từ phản ánh hiện không còn khả dụng."
      />
    );
  }

  if (state === STAFF_INCIDENT_DETAIL_STATE.ERROR || !incident) {
    return (
      <RelatedIncidentNotice
        icon={Lucide.TriangleAlert}
        title="Không thể tải sự vụ liên quan"
        description="Đã xảy ra lỗi khi tải thông tin sự vụ. Vui lòng thử lại."
        action={(
          <Button type="button" variant="outline" size="sm" onClick={retry}>
            <Lucide.RefreshCw size={16} aria-hidden="true" />
            Thử lại
          </Button>
        )}
      />
    );
  }

  const title = String(incident?.title ?? '').trim() || 'Sự vụ chưa có tiêu đề';
  const areaName = String(incident?.areaName ?? '').trim() || EMPTY_VALUE;
  const categoryName = String(incident?.categoryName ?? '').trim() || EMPTY_VALUE;

  return (
    <section className="admin-panel overflow-hidden" aria-labelledby="related-incident-title">
      <header className="flex items-center gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <span className="admin-mini-icon" aria-hidden="true"><Lucide.Landmark size={17} /></span>
        <div className="min-w-0">
          <h2 id="related-incident-title" className="admin-section-title">Sự vụ liên quan</h2>
          <p className="admin-section-description mt-1">Phản ánh là một nguồn thông tin thuộc sự vụ này.</p>
        </div>
      </header>

      <div className="px-5 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-semibold text-blue-700 dark:text-blue-300">
            {formatIncidentCode(incident?.incidentId)}
          </span>
          <Badge intent={getStatusIntent(incident?.status)}>
            {getIncidentStatusLabel(incident?.status)}
          </Badge>
        </div>

        <h3 className="mt-3 break-words text-base font-bold leading-6 text-slate-950 dark:text-white">
          {title}
        </h3>

        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <div className="min-w-0">
            <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">Phường / Khu vực</dt>
            <dd className="mt-1 break-words font-semibold text-slate-900 dark:text-slate-100">{areaName}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">Danh mục</dt>
            <dd className="mt-1 break-words font-semibold text-slate-900 dark:text-slate-100">{categoryName}</dd>
          </div>
        </dl>

        <Link
          to={`/staff/incidents/${incident.incidentId}`}
          className="mt-5 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-[1rem] bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 dark:bg-blue-500 dark:hover:bg-blue-400 dark:focus-visible:ring-blue-950"
        >
          Xem chi tiết sự vụ
          <Lucide.ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
