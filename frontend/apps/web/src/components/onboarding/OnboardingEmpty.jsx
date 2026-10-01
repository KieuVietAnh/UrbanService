import { Link } from 'react-router-dom';
import * as Lucide from 'lucide-react';

export default function OnboardingEmpty({ className = '' }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}>
      <div className="flex items-start gap-4">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-lg bg-blue-50 text-[28px] text-[color:var(--brand-primary)]">
          <Lucide.MapPin size={28} />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-extrabold text-slate-900">Chưa có phản ánh nào</h3>
          <p className="mt-1 text-sm text-slate-600">Bắt đầu gửi báo cáo đầu tiên để giúp cải thiện khu vực sống của bạn. Dưới đây là một số mẹo để gửi phản ánh có ích:</p>

          <ul className="mt-3 text-sm text-slate-700 space-y-2">
            <li className="flex items-start gap-2">
              <Lucide.CheckCircle2 className="text-emerald-500 mt-1" />
              <span>Tiêu đề ngắn gọn, rõ ràng (ví dụ: "Đèn đường hỏng - trước 123 Lê Lợi").</span>
            </li>
            <li className="flex items-start gap-2">
              <Lucide.Camera className="text-slate-500 mt-1" />
              <span>Gửi ảnh/video minh chứng, chụp cả khung cảnh để xác định điểm tham chiếu.</span>
            </li>
            <li className="flex items-start gap-2">
              <Lucide.MapPin className="text-blue-500 mt-1" />
              <span>Đính kèm vị trí chính xác bằng cách chạm vào bản đồ.</span>
            </li>
          </ul>

          <div className="mt-4 flex gap-3">
            <Link to="/tickets/create" className="btn btn-primary rounded-xl font-bold">Gửi phản ánh mới</Link>
            <Link to="/community/feed" className="btn btn-outline rounded-xl">Khám phá cộng đồng</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
