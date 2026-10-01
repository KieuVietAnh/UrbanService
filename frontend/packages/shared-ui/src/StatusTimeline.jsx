export default function StatusTimeline({ items = [], activeIndex = -1 }) {
  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const isActive = index === activeIndex;
        const isCompleted = index < activeIndex;
        return (
          <div key={`${item.title}-${index}`} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`h-3.5 w-3.5 rounded-full border-2 ${isActive ? 'border-emerald-500 bg-emerald-500' : isCompleted ? 'border-emerald-300 bg-emerald-300' : 'border-slate-300 bg-white'}`} />
              {index < items.length - 1 ? <div className={`mt-1 w-px flex-1 ${isCompleted ? 'bg-emerald-300' : 'bg-slate-200'}`} /> : null}
            </div>
            <div className={`flex-1 rounded-2xl border p-3 ${isActive ? 'border-emerald-200 bg-emerald-50' : isCompleted ? 'border-emerald-100 bg-emerald-50/70' : 'border-slate-200 bg-white'}`}>
              <div className="text-sm font-semibold text-slate-800">{item.title}</div>
              {item.subtitle ? <div className="mt-1 text-xs text-slate-500">{item.subtitle}</div> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
