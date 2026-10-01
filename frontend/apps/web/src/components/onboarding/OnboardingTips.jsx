import * as Lucide from 'lucide-react';

export default function OnboardingTips({ className = '' }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm ${className}`}>
      <h4 className="font-extrabold text-sm text-slate-900">Mẹo gửi phản ánh đầu tiên</h4>
      <p className="text-xs text-slate-600 mt-1">Một vài hướng dẫn để phản ánh được xử lý nhanh hơn:</p>
      <ul className="mt-3 space-y-2 text-sm text-slate-700">
        <li className="flex items-start gap-2"><Lucide.Camera className="text-slate-500 mt-1" /> Chụp ảnh rõ ràng, cả khung cảnh xung quanh.</li>
        <li className="flex items-start gap-2"><Lucide.MapPin className="text-blue-500 mt-1" /> Chọn vị trí chính xác trên bản đồ.</li>
        <li className="flex items-start gap-2"><Lucide.Clock className="text-slate-500 mt-1" /> Ghi rõ thời điểm xảy ra sự cố.</li>
        <li className="flex items-start gap-2"><Lucide.CheckCircle2 className="text-emerald-500 mt-1" /> Nếu có sự cố tương tự, hãy tham khảo trước để tránh trùng lặp.</li>
      </ul>
      <div className="mt-4">
        <a href="/tickets/create" className="btn btn-primary rounded-xl">Gửi phản ánh</a>
      </div>
    </div>
  );
}
