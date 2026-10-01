import * as Lucide from 'lucide-react';

export default function CelebrationBadge({ title = 'Đóng góp cộng đồng', subtitle = 'Bạn đóng góp tích cực', className = '' }) {
  return (
    <div className={`inline-flex items-center gap-3 rounded-xl bg-gradient-to-r from-amber-50 to-emerald-50 border border-slate-100 p-3 ${className}`}>
      <div className="w-10 h-10 rounded-lg bg-white grid place-items-center shadow-sm text-amber-600">
        <Lucide.Sparkles size={18} />
      </div>
      <div className="text-left">
        <div className="text-xs font-black text-slate-900">{title}</div>
        <div className="text-[11px] text-slate-500">{subtitle}</div>
      </div>
    </div>
  );
}
