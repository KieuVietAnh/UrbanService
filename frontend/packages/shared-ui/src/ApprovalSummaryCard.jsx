export default function ApprovalSummaryCard({ title, children, className = '' }) {
  return (
    <section className={`rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6 ${className}`.trim()}>
      <div className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">{title}</div>
      <div className="mt-4 rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-600">
        {children}
      </div>
    </section>
  );
}
