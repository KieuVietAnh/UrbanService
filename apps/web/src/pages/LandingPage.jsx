// src/pages/LandingPage.jsx
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import * as Lucide from 'lucide-react';

export const LandingPage = () => {
  const { user } = useAuth();
  const isCitizen = user?.role === 'service-user';

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans text-slate-800">
      {/* Navbar */}
      <nav className="navbar bg-white sticky top-0 z-50 border-b border-slate-200 px-6 lg:px-20 h-16">
        <div className="flex flex-nowrap h-full items-center justify-between w-full gap-6">
          <div className="flex items-center flex-1 min-w-0">
            <Link to="/" className="flex items-center gap-2">
              <span className="font-extrabold text-2xl text-[#0052CC] tracking-tight">
                UrbanMind
              </span>
            </Link>
          </div>

          <div className="hidden lg:flex flex-nowrap items-center justify-center flex-1 gap-6 text-sm font-bold text-slate-600 whitespace-nowrap">
            <Link to="/" className="text-[#0052CC] border-b-2 border-[#0052CC] pb-1">Trang chủ</Link>
            <Link to="/login?redirect=/tickets/create" className="hover:text-slate-900 transition-colors">Gửi phản ánh</Link>
            {isCitizen && (
              <Link to="/tickets" className="hover:text-slate-900 transition-colors">Phản ánh đã gửi</Link>
            )}
            <Link to="/community/feed" className="hover:text-slate-900 transition-colors">Tin tức gần đây</Link>
            <Link to="/about" className="hover:text-slate-900 transition-colors">Giới thiệu</Link>
          </div>

          <div className="flex items-center justify-end flex-1 gap-3 min-w-0">
            <Link to="/login" className="btn btn-ghost btn-sm font-bold rounded-xl text-slate-600">
              Đăng nhập
            </Link>
            <Link to="/register" className="btn btn-sm rounded-xl font-bold bg-[#0052CC] hover:bg-[#0043a4] text-white border-none px-5">
              Đăng ký
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-12 lg:py-20 px-6 lg:px-20 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {/* Left column info */}
        <div className="space-y-6">
          <div className="badge border-none bg-[#EFF6FF] text-[#2563EB] py-3.5 px-4 font-bold rounded-lg text-xs uppercase tracking-wide">
            Kiến tạo đô thị tương lai
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 leading-tight">
            UrbanMind – Nền tảng phản ánh đô thị thông minh
          </h1>
          <p className="text-sm md:text-base text-slate-500 font-semibold leading-relaxed">
            Giúp người dân gửi phản ánh, theo dõi tiến độ xử lý và cập nhật thông tin đô thị gần khu vực của mình một cách minh bạch và nhanh chóng.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
            <Link 
              to="/login?redirect=/tickets/create" 
              className="btn bg-[#0052CC] hover:bg-[#0043a4] text-white border-none rounded-xl font-bold gap-2 w-full sm:w-auto px-6 h-11 min-h-0"
            >
              <Lucide.Play size={14} fill="currentColor" className="rotate-90" />
              Gửi phản ánh ngay
            </Link>
            <Link 
              to="/community/map" 
              className="btn btn-outline border-[#0052CC] text-[#0052CC] hover:bg-[#0052CC]/5 rounded-xl font-bold w-full sm:w-auto px-6 h-11 min-h-0"
            >
              Xem báo cáo gần đó
            </Link>
          </div>
        </div>

        {/* Right column connected city graphic */}
        <div className="relative">
          <div className="rounded-3xl overflow-hidden shadow-2xl border border-slate-200">
            <img 
              src="https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=600&q=80" 
              alt="Connected Smart City Dusk" 
              className="w-full object-cover aspect-[4/3]"
            />
          </div>
          {/* Floating HUD Location Card overlay */}
          <div className="absolute bottom-6 left-6 right-6 bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-slate-200 shadow-xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#EFF6FF] text-[#2563EB]">
                <Lucide.MapPin size={20} />
              </div>
              <div className="text-xs">
                <span className="font-bold text-slate-900 block">Vị trí của bạn</span>
                <span className="text-slate-500 font-semibold mt-0.5 block">Quận 1, TP. Hồ Chí Minh</span>
              </div>
            </div>
            <span className="text-xs font-bold text-[#0052CC] bg-[#EFF6FF] py-2 px-3.5 rounded-xl">
              12 Phản ánh mới
            </span>
          </div>
        </div>
      </section>

      {/* Featured Features Section */}
      <section className="bg-white border-y border-slate-200 py-16 px-6 lg:px-20 text-center space-y-12">
        <div className="max-w-2xl mx-auto space-y-2">
          <h2 className="text-2xl md:text-3xl font-black text-slate-900">Tính năng nổi bật</h2>
          <p className="text-sm text-slate-500 font-semibold">Công cụ hiệu quả cho cộng đồng văn minh</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {/* Card 1 */}
          <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow text-left space-y-4">
            <div className="p-2.5 rounded-xl bg-[#EFF6FF] text-[#2563EB] w-fit">
              <Lucide.Zap size={20} fill="currentColor" />
            </div>
            <h3 className="font-extrabold text-sm text-slate-900">Gửi phản ánh nhanh chóng</h3>
            <p className="text-xs text-slate-500 font-semibold leading-relaxed">
              Chỉ với 3 bước đơn giản: Chụp ảnh, chọn vị trí và gửi thông tin.
            </p>
          </div>

          {/* Card 2 */}
          <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow text-left space-y-4">
            <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600 w-fit">
              <Lucide.Eye size={20} />
            </div>
            <h3 className="font-extrabold text-sm text-slate-900">Theo dõi tiến độ minh bạch</h3>
            <p className="text-xs text-slate-500 font-semibold leading-relaxed">
              Cập nhật trạng thái xử lý từ các cơ quan chức năng theo thời gian thực.
            </p>
          </div>

          {/* Card 3 */}
          <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow text-left space-y-4">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 w-fit">
              <Lucide.Calendar size={20} />
            </div>
            <h3 className="font-extrabold text-sm text-slate-900">Cập nhật tin tức gần khu vực</h3>
            <p className="text-xs text-slate-500 font-semibold leading-relaxed">
              Thông báo kịp thời về các sự cố, quy hoạch tại nơi bạn sinh sống.
            </p>
          </div>

          {/* Card 4 */}
          <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow text-left space-y-4">
            <div className="p-2.5 rounded-xl bg-slate-100 text-slate-600 w-fit">
              <Lucide.BarChart3 size={20} />
            </div>
            <h3 className="font-extrabold text-sm text-slate-900">Xem báo cáo gần đó</h3>
            <p className="text-xs text-slate-500 font-semibold leading-relaxed">
              Tổng hợp dữ liệu và đánh giá chất lượng hạ tầng trong khu vực.
            </p>
          </div>
        </div>
      </section>

      {/* Recent Feedbacks Section */}
      <section className="py-16 px-6 lg:px-20 max-w-7xl mx-auto w-full space-y-8">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-black text-slate-900">Phản ánh gần đây</h2>
          <Link to="/community/feed" className="text-xs font-bold text-[#0052CC] hover:underline flex items-center gap-1">
            Xem tất cả
            <Lucide.ChevronRight size={14} />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Pavement */}
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-[360px]">
            <div className="relative aspect-[16/10] w-full">
              <img 
                src="https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&w=400&q=80" 
                alt="Broken pavement" 
                className="w-full h-full object-cover"
              />
              <span className="absolute top-3 left-3 badge border-none bg-blue-600 text-white font-extrabold text-[8px] py-2 px-2.5 uppercase rounded-lg">
                🛠 Hạ tầng
              </span>
            </div>
            <div className="p-5 flex-1 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[10px] font-bold text-gray-400">
                  <span className="text-red-500 bg-red-50 py-0.5 px-2 rounded-lg">Đã tiếp nhận</span>
                  <span>2 giờ trước</span>
                </div>
                <h4 className="font-black text-sm text-slate-900 leading-tight truncate">Vỉa hè bị hỏng nặng tại...</h4>
                <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                  <Lucide.MapPin size={10} className="text-[#0052CC]" />
                  <span>Quận 1, TP. HCM</span>
                </div>
              </div>
              <Link to="/login" className="btn btn-xs bg-slate-100 border-none text-slate-600 hover:bg-slate-200 rounded-xl font-bold w-full mt-3 py-2 text-[10px]">
                Chi tiết phản ánh
              </Link>
            </div>
          </div>

          {/* Card 2: Trash */}
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-[360px]">
            <div className="relative aspect-[16/10] w-full">
              <img 
                src="https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&w=400&q=80" 
                alt="Trash in park" 
                className="w-full h-full object-cover"
              />
              <span className="absolute top-3 left-3 badge border-none bg-emerald-600 text-white font-extrabold text-[8px] py-2 px-2.5 uppercase rounded-lg">
                🌱 Môi trường
              </span>
            </div>
            <div className="p-5 flex-1 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[10px] font-bold text-gray-400">
                  <span className="text-[#0052CC] bg-[#EFF6FF] py-0.5 px-2 rounded-lg">Đang xử lý</span>
                  <span>5 giờ trước</span>
                </div>
                <h4 className="font-black text-sm text-slate-900 leading-tight truncate">Rác thải ùn ứ tại công viên...</h4>
                <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                  <Lucide.MapPin size={10} className="text-[#0052CC]" />
                  <span>Quận 1, TP. HCM</span>
                </div>
              </div>
              <Link to="/login" className="btn btn-xs bg-slate-100 border-none text-slate-600 hover:bg-slate-200 rounded-xl font-bold w-full mt-3 py-2 text-[10px]">
                Chi tiết phản ánh
              </Link>
            </div>
          </div>

          {/* Card 3: Light */}
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-[360px]">
            <div className="relative aspect-[16/10] w-full">
              <img 
                src="https://images.unsplash.com/photo-1542382257-201b7f686e06?auto=format&fit=crop&w=400&q=80" 
                alt="Streetlight outage" 
                className="w-full h-full object-cover"
              />
              <span className="absolute top-3 left-3 badge border-none bg-cyan-600 text-white font-extrabold text-[8px] py-2 px-2.5 uppercase rounded-lg">
                💡 Chiếu sáng
              </span>
            </div>
            <div className="p-5 flex-1 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[10px] font-bold text-gray-400">
                  <span className="text-emerald-600 bg-emerald-50 py-0.5 px-2 rounded-lg">Hoàn thành</span>
                  <span>1 ngày trước</span>
                </div>
                <h4 className="font-black text-sm text-slate-900 leading-tight truncate">Đèn đường không sáng tại...</h4>
                <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                  <Lucide.MapPin size={10} className="text-[#0052CC]" />
                  <span>Đống Đa, Hà Nội</span>
                </div>
              </div>
              <Link to="/login" className="btn btn-xs bg-slate-100 border-none text-slate-600 hover:bg-slate-200 rounded-xl font-bold w-full mt-3 py-2 text-[10px]">
                Chi tiết phản ánh
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-12 px-6 lg:px-20 mt-auto text-xs font-semibold text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between gap-8 pb-8 border-b border-slate-200">
          <div className="space-y-3 max-w-sm">
            <span className="font-extrabold text-2xl text-[#0052CC] tracking-tight">UrbanMind</span>
            <p className="leading-relaxed text-[11px] font-medium text-slate-400">
              © 2024 UrbanMind. Nền tảng phản ánh ý kiến công dân hiện đại, chung tay vì một cộng đồng đô thị văn minh và phát triển bền vững.
            </p>
          </div>
          <div className="flex gap-16">
            <div className="space-y-3">
              <span className="font-extrabold text-slate-900 uppercase text-[10px] tracking-wider block">Thông tin</span>
              <ul className="space-y-2 text-[11px]">
                <li><a href="#" className="hover:text-slate-900">Về chúng tôi</a></li>
                <li><a href="#" className="hover:text-slate-900">Điều khoản sử dụng</a></li>
              </ul>
            </div>
            <div className="space-y-3">
              <span className="font-extrabold text-slate-900 uppercase text-[10px] tracking-wider block">Hỗ trợ</span>
              <ul className="space-y-2 text-[11px]">
                <li><a href="#" className="hover:text-slate-900">Chính sách bảo mật</a></li>
                <li><a href="#" className="hover:text-slate-900">Liên hệ</a></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto flex justify-between items-center pt-6 text-[10px] font-bold text-slate-400">
          <span>Phát triển bởi Đội ngũ Công nghệ Đô thị Thông minh</span>
          <div className="flex gap-4">
            <Lucide.Award size={16} />
            <Lucide.PlusCircle size={16} className="text-[#0052CC] cursor-pointer" />
          </div>
        </div>
      </footer>
    </div>
  );
};
