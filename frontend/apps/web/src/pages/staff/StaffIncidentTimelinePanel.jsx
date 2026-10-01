import { useEffect, useMemo, useState } from 'react';
import * as Lucide from 'lucide-react';

import Button from '../../components/design-system/Button';
import EmptyState from '../../components/design-system/EmptyState';
import {
  STAFF_INCIDENT_TIMELINE_STATE,
  useStaffIncidentTimeline,
} from '../../hooks/useStaffIncidentTimeline';
import {
  formatOperationalDateTime,
  formatReportCode,
  getIncidentEventDescription,
  getIncidentEventMetadata,
  getIncidentEventTitle,
} from './incidentDetailPresentation';

const PAGE_SIZE = 20;

function TimelineSkeleton() {
  return (
    <section className="admin-panel overflow-hidden" aria-busy="true" aria-label="Đang tải dòng thời gian sự vụ">
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-slate-50/65 px-5 py-5 sm:px-6 dark:border-slate-800 dark:bg-slate-950/25">
        <div>
          <div className="h-5 w-44 animate-pulse rounded-md bg-slate-200 dark:bg-slate-800" />
          <div className="mt-2 h-3 w-64 max-w-full animate-pulse rounded-md bg-slate-100 dark:bg-slate-800/70" />
        </div>
        <div className="h-8 w-24 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
      </div>
      <div className="space-y-3 px-5 py-5 sm:px-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3">
            <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700" />
            <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
              <div className="h-4 w-52 max-w-full animate-pulse rounded-md bg-slate-200 dark:bg-slate-800" />
              <div className="mt-2 h-3 w-3/4 animate-pulse rounded-md bg-slate-100 dark:bg-slate-800/70" />
              <div className="mt-3 h-3 w-40 animate-pulse rounded-md bg-slate-100 dark:bg-slate-800/70" />
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">Đang tải dữ liệu</span>
    </section>
  );
}

function TimelineState({ state, onRetry }) {
  const content = {
    [STAFF_INCIDENT_TIMELINE_STATE.API_UNAVAILABLE]: {
      icon: Lucide.History,
      title: 'Dòng thời gian chưa khả dụng',
      description: 'Chưa thể tải lịch sử hoạt động của sự vụ này.',
    },
    [STAFF_INCIDENT_TIMELINE_STATE.EMPTY]: {
      icon: Lucide.History,
      title: 'Chưa có hoạt động nào',
      description: 'Các hoạt động của sự vụ sẽ xuất hiện tại đây khi có dữ liệu.',
    },
    [STAFF_INCIDENT_TIMELINE_STATE.ERROR]: {
      icon: Lucide.TriangleAlert,
      title: 'Không thể tải dòng thời gian',
      description: 'Không thể tải dòng thời gian. Vui lòng thử lại.',
      action: (
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          <Lucide.RefreshCw size={16} aria-hidden="true" />
          Thử lại
        </Button>
      ),
    },
  }[state];

  return content ? <EmptyState {...content} /> : null;
}

function EventIcon({ eventType }) {
  const title = getIncidentEventTitle(eventType);
  if (title.includes('Phản ánh')) return <Lucide.FileText size={16} />;
  if (title.includes('phân công')) return <Lucide.UserRoundCheck size={16} />;
  if (title.includes('Trạng thái')) return <Lucide.RefreshCcw size={16} />;
  if (title.includes('gộp')) return <Lucide.GitMerge size={16} />;
  if (title.includes('AI')) return <Lucide.Sparkles size={16} />;
  if (title.includes('tạo')) return <Lucide.Plus size={16} />;
  return <Lucide.Activity size={16} />;
}

function TimelineEvent({ event, isLast }) {
  const metadata = getIncidentEventMetadata(event);
  const actorName = String(event?.actorUserName ?? '').trim() || 'Hệ thống';

  return (
    <li className="relative grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3 sm:gap-4">
      {!isLast ? (
        <span className="absolute bottom-[-1rem] left-[1.22rem] top-10 w-0.5 bg-blue-100 dark:bg-blue-950/70" aria-hidden="true" />
      ) : null}
      <span className="relative z-10 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-[0_8px_18px_rgba(37,99,235,0.18)]" aria-hidden="true">
        <EventIcon eventType={event?.eventType} />
      </span>

      <article className="min-w-0 rounded-2xl border border-slate-200/90 bg-white/75 p-4 shadow-[0_8px_22px_rgba(15,23,42,0.035)] transition hover:border-blue-200 hover:bg-blue-50/25 sm:p-5 dark:border-slate-800 dark:bg-slate-900/55 dark:hover:border-blue-900 dark:hover:bg-blue-950/10">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <h3 className="text-sm font-black leading-6 text-slate-950 dark:text-white">
            {getIncidentEventTitle(event?.eventType)}
          </h3>
          <time dateTime={event?.createdAt || undefined} className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <Lucide.Clock3 size={13} aria-hidden="true" />
            {formatOperationalDateTime(event?.createdAt)}
          </time>
        </div>

        <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
          {getIncidentEventDescription(event)}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 dark:bg-slate-950/35">
            <Lucide.UserRound size={13} className="text-blue-500" aria-hidden="true" />
            Thực hiện bởi: <strong className="font-semibold text-slate-700 dark:text-slate-200">{actorName}</strong>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 dark:bg-slate-950/35">
            <Lucide.Database size={13} className="text-blue-500" aria-hidden="true" />
            Nguồn: <strong className="font-semibold text-slate-700 dark:text-slate-200">
              {event?.feedbackId ? `Phản ánh ${formatReportCode(event.feedbackId)}` : 'Sự vụ'}
            </strong>
          </span>
        </div>

        {metadata.length > 0 ? (
          <dl className="mt-3 grid gap-2.5 rounded-xl border border-blue-100 bg-blue-50/45 px-3.5 py-3 sm:grid-cols-2 dark:border-blue-900/60 dark:bg-blue-950/15">
            {metadata.map((item) => (
              <div key={`${item.label}-${item.value}`} className="min-w-0 text-xs">
                <dt className="font-medium text-slate-500 dark:text-slate-400">{item.label}</dt>
                <dd className="mt-0.5 break-words font-semibold text-slate-800 dark:text-slate-100">{item.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </article>
    </li>
  );
}

export default function StaffIncidentTimelinePanel({ incidentId }) {
  const [pageNumber, setPageNumber] = useState(1);
  const { events, pagination, retry, state } = useStaffIncidentTimeline({
    incidentId,
    pageNumber,
    pageSize: PAGE_SIZE,
  });

  useEffect(() => {
    setPageNumber(1);
  }, [incidentId]);

  const orderedEvents = useMemo(() => [...events].sort((left, right) => {
    const leftTime = new Date(left?.createdAt || 0).getTime();
    const rightTime = new Date(right?.createdAt || 0).getTime();
    return rightTime - leftTime;
  }), [events]);

  return (
    <div
      id="incident-panel-timeline"
      role="tabpanel"
      aria-labelledby="incident-tab-timeline"
      tabIndex={0}
      className="focus-visible:outline-none"
    >
      {state === STAFF_INCIDENT_TIMELINE_STATE.LOADING ? <TimelineSkeleton /> : null}

      {state !== STAFF_INCIDENT_TIMELINE_STATE.LOADING && state !== STAFF_INCIDENT_TIMELINE_STATE.READY ? (
        <TimelineState state={state} onRetry={retry} />
      ) : null}

      {state === STAFF_INCIDENT_TIMELINE_STATE.READY ? (
        <section className="admin-panel overflow-hidden" aria-labelledby="incident-timeline-title">
          <header className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/65 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:border-slate-800 dark:bg-slate-950/25">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950/55 dark:text-blue-300" aria-hidden="true">
                <Lucide.History size={18} />
              </span>
              <div>
                <h2 id="incident-timeline-title" className="admin-section-title">Dòng thời gian sự vụ</h2>
                <p className="admin-section-description mt-1">Các hoạt động mới nhất được hiển thị trước.</p>
              </div>
            </div>
            <span className="inline-flex w-fit items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 dark:border-blue-800 dark:bg-blue-950/45 dark:text-blue-200">
              {pagination.totalItems.toLocaleString('vi-VN')} hoạt động
            </span>
          </header>

          <ol className="space-y-4 px-5 py-5 sm:px-6">
            {orderedEvents.map((event, index) => (
              <TimelineEvent
                key={event?.incidentEventId || `${event?.eventType || 'event'}-${event?.createdAt || index}`}
                event={event}
                isLast={index === orderedEvents.length - 1}
              />
            ))}
          </ol>

          <footer className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/65 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:border-slate-800 dark:bg-slate-950/25">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400" aria-live="polite">
              Trang {pagination.pageNumber} / {Math.max(1, pagination.totalPages)}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!pagination.hasPreviousPage}
                onClick={() => setPageNumber((current) => Math.max(1, current - 1))}
              >
                <Lucide.ChevronLeft size={16} aria-hidden="true" />
                Trang trước
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!pagination.hasNextPage}
                onClick={() => setPageNumber((current) => current + 1)}
              >
                Trang sau
                <Lucide.ChevronRight size={16} aria-hidden="true" />
              </Button>
            </div>
          </footer>
        </section>
      ) : null}
    </div>
  );
}
