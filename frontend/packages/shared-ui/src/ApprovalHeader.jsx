export default function ApprovalHeader({ title, description, onBack, backLabel = 'Back' }) {
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.24em] text-emerald-700">
            {title}
          </div>
          {description ? <p className="mt-2 max-w-2xl text-sm text-slate-500">{description}</p> : null}
        </div>
        {onBack ? (
          <button type="button" onClick={onBack} className="btn btn-ghost rounded-2xl text-sm">
            {backLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
