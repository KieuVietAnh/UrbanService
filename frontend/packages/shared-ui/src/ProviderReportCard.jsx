export default function ProviderReportCard({ report = {} }) {
  const coordinator = report?.coordinator || report?.coordinatorName || report?.assignedCoordinator || '—';
  const status = report?.status || report?.currentStatus || '—';
  const assignmentDate = report?.assignmentDate || report?.assignedAt || report?.createdAt || '—';
  const lastUpdated = report?.lastUpdated || report?.updatedAt || report?.updatedOn || '—';

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Provider Report</div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-3 text-sm">
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Coordinator</div>
          <div className="mt-2 font-semibold text-slate-700">{coordinator}</div>
        </div>
        <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-3 text-sm">
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Current Status</div>
          <div className="mt-2 font-semibold text-slate-700">{status}</div>
        </div>
        <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-3 text-sm">
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Assignment Date</div>
          <div className="mt-2 font-semibold text-slate-700">{assignmentDate}</div>
        </div>
        <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-3 text-sm">
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Last Updated</div>
          <div className="mt-2 font-semibold text-slate-700">{lastUpdated}</div>
        </div>
      </div>
    </section>
  );
}
