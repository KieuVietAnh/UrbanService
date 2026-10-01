 

function Timeline({ items = [] }) {
  return (
    <ol className="space-y-4">
      {items.map((it, idx) => (
        <li key={idx} className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-1 h-3 w-3 rounded-full bg-slate-300" aria-hidden />
          <div>
            <div className="text-sm font-semibold text-slate-900">{it.title}</div>
            {it.time && <div className="text-xs text-slate-500">{it.time}</div>}
            {it.content && <div className="mt-2 text-sm text-slate-700">{it.content}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}

export default Timeline;
