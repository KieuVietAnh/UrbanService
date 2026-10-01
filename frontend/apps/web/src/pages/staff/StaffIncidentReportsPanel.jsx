import { Link } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { getStatusIntent } from '@urbanmind/shared-types';

import Badge from '../../components/design-system/Badge';
import EmptyState from '../../components/design-system/EmptyState';
import {
  EMPTY_VALUE,
  formatConfidence,
  formatOperationalDateTime,
  formatReportCode,
  getReportLinkMethodLabel,
  getReportLinkRoleLabel,
  getReportLinkStatusLabel,
  getReportStatusLabel,
  getSubmissionChannelLabel,
} from './incidentDetailPresentation';

function ReportMetadata({ label, value, icon: Icon }) {
  return (
    <div className="min-w-0 rounded-xl bg-white/80 px-3 py-2.5 ring-1 ring-slate-200/80 dark:bg-slate-900/75 dark:ring-slate-700/80">
      <dt className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.04em] text-slate-500 dark:text-slate-400">
        <Icon size={13} className="shrink-0 text-blue-600 dark:text-blue-300" aria-hidden="true" />
        {label}
      </dt>
      <dd className="mt-1.5 break-words text-sm font-bold leading-5 text-slate-900 dark:text-slate-100">{value}</dd>
    </div>
  );
}

function ReportRow({ report, incidentId }) {
  const feedbackId = String(report?.feedbackId ?? '').trim();
  const reportTitle = String(report?.title ?? '').trim() || 'Phản ánh chưa có tiêu đề';
  const reporterName = String(report?.reporterName ?? '').trim() || EMPTY_VALUE;
  const locationText = String(report?.locationText ?? '').trim() || EMPTY_VALUE;
  const linkedBy = String(report?.linkedByUserName ?? '').trim() || EMPTY_VALUE;
  const reason = String(report?.reason ?? '').trim();

  return (
    <li>
      <article className="group/report relative grid gap-5 px-5 py-5 transition-colors hover:bg-blue-50/30 sm:px-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(19rem,0.85fr)_auto] xl:items-start dark:hover:bg-blue-950/10">
        <span className="absolute inset-y-5 left-0 w-1 rounded-r-full bg-blue-500 opacity-70 transition-opacity group-hover/report:opacity-100" aria-hidden="true" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-lg bg-blue-100 px-2.5 py-1 font-mono text-xs font-black tracking-[0.03em] text-blue-700 dark:bg-blue-950/55 dark:text-blue-300">
              <Lucide.FileText size={13} aria-hidden="true" />
              {formatReportCode(feedbackId)}
            </span>
            <Badge intent={getStatusIntent(report?.feedbackStatus)}>
              {getReportStatusLabel(report?.feedbackStatus)}
            </Badge>
            {report?.linkStatus ? (
              <Badge intent="neutral">{getReportLinkStatusLabel(report.linkStatus)}</Badge>
            ) : null}
          </div>

          <h3 className="mt-3 break-words text-base font-bold leading-6 text-slate-950 dark:text-white">
            {reportTitle}
          </h3>

          <div className="mt-4 grid gap-2.5 text-sm sm:grid-cols-2">
            <div className="flex min-w-0 items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-slate-600 dark:bg-slate-950/35 dark:text-slate-300">
              <Lucide.UserRound size={16} className="mt-0.5 shrink-0 text-blue-500" aria-hidden="true" />
              <span className="break-words"><span className="sr-only">Người gửi: </span>{reporterName}</span>
            </div>
            <div className="flex min-w-0 items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-slate-600 dark:bg-slate-950/35 dark:text-slate-300">
              <Lucide.MapPin size={16} className="mt-0.5 shrink-0 text-blue-500" aria-hidden="true" />
              <span className="break-words"><span className="sr-only">Vị trí: </span>{locationText}</span>
            </div>
          </div>

          {reason ? (
            <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/55 px-3.5 py-3 dark:border-blue-900/60 dark:bg-blue-950/20">
              <p className="flex items-center gap-1.5 text-xs font-bold text-blue-700 dark:text-blue-300">
                <Lucide.Link2 size={13} aria-hidden="true" />
                Lý do liên kết
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-200">{reason}</p>
            </div>
          ) : null}
        </div>

        <dl className="grid gap-2.5 rounded-2xl bg-slate-50/80 p-3 sm:grid-cols-2 dark:bg-slate-950/30">
          <ReportMetadata
            label="Kênh gửi"
            value={getSubmissionChannelLabel(report?.submissionChannel)}
            icon={Lucide.Send}
          />
          <ReportMetadata
            label="Cách liên kết"
            value={getReportLinkMethodLabel(report?.linkMethod)}
            icon={Lucide.Link2}
          />
          <ReportMetadata
            label="Vai trò liên kết"
            value={getReportLinkRoleLabel(report?.linkRole)}
            icon={Lucide.Network}
          />
          <ReportMetadata
            label="Độ tin cậy"
            value={formatConfidence(report?.confidenceScore)}
            icon={Lucide.Gauge}
          />
          <ReportMetadata
            label="Liên kết lúc"
            value={formatOperationalDateTime(report?.linkedAt)}
            icon={Lucide.CalendarClock}
          />
          <ReportMetadata
            label="Người liên kết"
            value={linkedBy}
            icon={Lucide.UserRoundCheck}
          />
        </dl>

        <div className="xl:pt-1">
          {feedbackId ? (
            <Link
              to={`/staff/feedbacks/${feedbackId}`}
              state={{
                fromIncidentId: String(incidentId ?? ''),
                returnLabel: 'Quay lại các phản ánh của sự vụ',
              }}
              className="group/link inline-flex min-h-10 w-full items-center justify-center gap-2 whitespace-nowrap rounded-[1rem] bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-[0_8px_18px_rgba(37,99,235,0.18)] transition hover:-translate-y-0.5 hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 xl:w-auto dark:bg-blue-500 dark:hover:bg-blue-400 dark:focus-visible:ring-blue-950"
            >
              Xem phản ánh
              <Lucide.ArrowUpRight size={16} className="transition-transform group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5" aria-hidden="true" />
            </Link>
          ) : (
            <span className="text-sm font-medium text-slate-500">Chưa có mã phản ánh</span>
          )}
        </div>
      </article>
    </li>
  );
}

export default function StaffIncidentReportsPanel({ incident, capability }) {
  const reportsFieldExists = Object.prototype.hasOwnProperty.call(incident ?? {}, 'reports');
  const reports = Array.isArray(incident?.reports) ? incident.reports : [];
  const reportedCount = Number(incident?.reportCount);
  const hasReportedCount = Number.isFinite(reportedCount) && reportedCount >= 0;
  const embeddedListMissing = !capability?.reportsEmbedded
    || !reportsFieldExists
    || (!Array.isArray(incident?.reports) && hasReportedCount && reportedCount > 0);

  if (embeddedListMissing) {
    return (
      <div id="incident-panel-reports" role="tabpanel" aria-labelledby="incident-tab-reports" tabIndex={0} className="focus-visible:outline-none">
        <EmptyState
          icon={Lucide.MessagesSquare}
          title="Danh sách phản ánh chưa khả dụng"
          description="Chưa thể tải các phản ánh thuộc sự vụ này."
        />
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div id="incident-panel-reports" role="tabpanel" aria-labelledby="incident-tab-reports" tabIndex={0} className="focus-visible:outline-none">
        <EmptyState
          icon={Lucide.MessagesSquare}
          title="Chưa có phản ánh trong sự vụ này"
          description="Các phản ánh được liên kết với sự vụ sẽ xuất hiện tại đây."
        />
      </div>
    );
  }

  const visibleCount = reports.length;

  return (
    <div
      id="incident-panel-reports"
      role="tabpanel"
      aria-labelledby="incident-tab-reports"
      tabIndex={0}
      className="space-y-4 focus-visible:outline-none"
    >
      <aside className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50/70 px-4 py-4 text-sm leading-6 text-blue-950 dark:border-blue-900/70 dark:bg-blue-950/25 dark:text-blue-100" role="note">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-[0_8px_18px_rgba(37,99,235,0.18)]" aria-hidden="true">
          <Lucide.Info size={17} />
        </span>
        <p>
          Một sự vụ có thể được nhiều người dân phản ánh. Mỗi phản ánh vẫn được lưu giữ và cung cấp thêm thông tin cho quá trình xử lý.
        </p>
      </aside>

      <section className="admin-panel overflow-hidden" aria-labelledby="incident-reports-title">
        <header className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/65 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:border-slate-800 dark:bg-slate-950/25">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950/55 dark:text-blue-300" aria-hidden="true">
              <Lucide.MessagesSquare size={18} />
            </span>
            <div>
              <h2 id="incident-reports-title" className="admin-section-title">Danh sách phản ánh</h2>
              <p className="admin-section-description mt-1">Đọc từng nguồn thông tin đã được liên kết với sự vụ.</p>
            </div>
          </div>
          <span className="inline-flex w-fit items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 dark:border-blue-800 dark:bg-blue-950/45 dark:text-blue-200">
            {visibleCount.toLocaleString('vi-VN')} phản ánh
          </span>
        </header>

        <ol className="divide-y divide-slate-100 dark:divide-slate-800">
          {reports.map((report, index) => (
            <ReportRow
              key={report?.incidentReportLinkId || report?.feedbackId || `report-${index}`}
              report={report}
              incidentId={incident?.incidentId}
            />
          ))}
        </ol>
      </section>
    </div>
  );
}
