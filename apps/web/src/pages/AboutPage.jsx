import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import * as Lucide from 'lucide-react';

export const AboutPage = () => {
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
            <Link to="/" className="hover:text-slate-900 transition-colors">Trang chủ</Link>
            <Link to="/login?redirect=/tickets/create" className="hover:text-slate-900 transition-colors">Gửi phản ánh</Link>
            {isCitizen && (
              <Link to="/tickets" className="hover:text-slate-900 transition-colors">Phản ánh đã gửi</Link>
            )}
            <Link to="/community/feed" className="hover:text-slate-900 transition-colors">Tin tức gần đây</Link>
            <Link to="/about" className="text-[#0052CC] border-b-2 border-[#0052CC] pb-1">Giới thiệu</Link>
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
      <section className="py-16 lg:py-24 px-6 lg:px-20 max-w-7xl mx-auto w-full">
        <div className="space-y-8">
          <div className="space-y-4">
            <div className="badge border-none bg-[#EFF6FF] text-[#2563EB] py-3.5 px-4 font-bold rounded-lg text-xs uppercase tracking-wide">
              Về UrbanMind
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 leading-tight">
              Nền tảng phản ánh đô thị thông minh
            </h1>
            <p className="text-lg text-slate-600 font-semibold leading-relaxed max-w-3xl">
              UrbanMind là giải pháp công nghệ hiện đại giúp kết nối cộng đồng, cải thiện chất lượng sống đô thị và xây dựng thành phố thông minh bền vững.
            </p>
          </div>
        </div>
      </section>

      {/* Mission & Vision Section */}
      <section className="bg-white border-y border-slate-200 py-16 lg:py-20 px-6 lg:px-20">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {/* Mission */}
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-full bg-blue-50 text-[#0052CC] flex items-center justify-center">
                <Lucide.Target size={24} />
              </div>
              <h3 className="text-2xl font-black text-slate-900">Sứ mệnh</h3>
              <p className="text-slate-600 font-semibold leading-relaxed">
                Trao quyền cho người dân trong việc cải thiện môi trường sống, tạo ra kênh giao tiếp hai chiều minh bạch giữa cộng đồng và chính quyền địa phương.
              </p>
            </div>

            {/* Vision */}
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Lucide.Lightbulb size={24} />
              </div>
              <h3 className="text-2xl font-black text-slate-900">Tầm nhìn</h3>
              <p className="text-slate-600 font-semibold leading-relaxed">
                Xây dựng các thành phố thông minh nơi mọi công dân đều có tiếng nói, công nghệ phục vụ con người, và chất lượng sống được nâng cao liên tục.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Core Features Section */}
      <section className="py-16 lg:py-20 px-6 lg:px-20">
        <div className="max-w-7xl mx-auto">
          <div className="space-y-12">
            <div className="text-center space-y-2">
              <h2 className="text-3xl md:text-4xl font-black text-slate-900">Dịch vụ chính</h2>
              <p className="text-slate-500 font-semibold text-lg">Những công cụ giúp bạn cải thiện thành phố</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Service 1 */}
              <div className="card bg-white border border-slate-200 p-8 rounded-3xl shadow-sm hover:shadow-lg transition-all space-y-4">
                <div className="w-14 h-14 rounded-full bg-blue-50 text-[#0052CC] flex items-center justify-center">
                  <Lucide.MessageSquare size={28} />
                </div>
                <h4 className="text-lg font-black text-slate-900">Gửi Phản Ánh</h4>
                <p className="text-slate-600 font-semibold leading-relaxed">
                  Tạo phản ánh về các vấn đề đô thị trực tiếp từ ứng dụng. Chỉ cần ảnh, vị trí và mô tả chi tiết.
                </p>
              </div>

              {/* Service 2 */}
              <div className="card bg-white border border-slate-200 p-8 rounded-3xl shadow-sm hover:shadow-lg transition-all space-y-4">
                <div className="w-14 h-14 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Lucide.Eye size={28} />
                </div>
                <h4 className="text-lg font-black text-slate-900">Theo Dõi Tiến Độ</h4>
                <p className="text-slate-600 font-semibold leading-relaxed">
                  Xem trạng thái xử lý phản ánh của bạn theo thời gian thực. Cập nhật từ các cơ quan chức năng trực tiếp.
                </p>
              </div>

              {/* Service 3 */}
              <div className="card bg-white border border-slate-200 p-8 rounded-3xl shadow-sm hover:shadow-lg transition-all space-y-4">
                <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Lucide.Map size={28} />
                </div>
                <h4 className="text-lg font-black text-slate-900">Bản Đồ Cộng Đồng</h4>
                <p className="text-slate-600 font-semibold leading-relaxed">
                  Khám phá các vấn đề đang xử lý gần bạn. Cộng đồng hóa thông tin và xây dựng ý thức chung.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="bg-slate-50 border-y border-slate-200 py-16 lg:py-20 px-6 lg:px-20">
        <div className="max-w-7xl mx-auto">
          <div className="space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-3xl md:text-4xl font-black text-slate-900">Giá trị cốt lõi</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 text-[#0052CC] flex items-center justify-center">
                  <Lucide.CheckCircle2 size={20} />
                </div>
                <h4 className="font-black text-slate-900">Minh Bạch</h4>
                <p className="text-sm text-slate-600 font-semibold">Công khai mọi quá trình xử lý phản ánh</p>
              </div>

              <div className="space-y-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <Lucide.Users size={20} />
                </div>
                <h4 className="font-black text-slate-900">Cộng Đồng</h4>
                <p className="text-sm text-slate-600 font-semibold">Trao quyền cho người dân tham gia</p>
              </div>

              <div className="space-y-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                  <Lucide.Zap size={20} />
                </div>
                <h4 className="font-black text-slate-900">Hiệu Quả</h4>
                <p className="text-sm text-slate-600 font-semibold">Xử lý nhanh và hiệu quả các vấn đề</p>
              </div>

              <div className="space-y-3">
                <div className="w-10 h-10 rounded-full bg-cyan-100 text-cyan-600 flex items-center justify-center">
                  <Lucide.Shield size={20} />
                </div>
                <h4 className="font-black text-slate-900">Bảo Mật</h4>
                <p className="text-sm text-slate-600 font-semibold">Bảo vệ dữ liệu cá nhân tuyệt đối</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-16 lg:py-20 px-6 lg:px-20">
        <div className="max-w-7xl mx-auto">
          <div className="space-y-12">
            <div className="text-center space-y-2">
              <h2 className="text-3xl md:text-4xl font-black text-slate-900">Liên Hệ Với Chúng Tôi</h2>
              <p className="text-slate-500 font-semibold text-lg">Chúng tôi luôn sẵn sàng lắng nghe ý kiến của bạn</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Phone */}
              <div className="card bg-white border border-slate-200 p-8 rounded-3xl shadow-sm hover:shadow-lg transition-all space-y-4">
                <div className="w-14 h-14 rounded-full bg-blue-50 text-[#0052CC] flex items-center justify-center">
                  <Lucide.Phone size={28} />
                </div>
                <h4 className="text-lg font-black text-slate-900">Điện Thoại</h4>
                <p className="text-slate-600 font-semibold">
                  <a href="tel:+84287654321" className="text-[#0052CC] hover:underline font-bold">
                    (028) 7654 321
                  </a>
                </p>
                <p className="text-xs text-slate-500 font-semibold">Thứ Hai - Thứ Sáu, 8:00 - 17:00</p>
              </div>

              {/* Email */}
              <div className="card bg-white border border-slate-200 p-8 rounded-3xl shadow-sm hover:shadow-lg transition-all space-y-4">
                <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Lucide.Mail size={28} />
                </div>
                <h4 className="text-lg font-black text-slate-900">Email</h4>
                <p className="text-slate-600 font-semibold">
                  <a href="mailto:support@urbanmind.io" className="text-[#0052CC] hover:underline font-bold">
                    support@urbanmind.io
                  </a>
                </p>
                <p className="text-xs text-slate-500 font-semibold">Phản hồi trong 24 giờ</p>
              </div>

              {/* Address */}
              <div className="card bg-white border border-slate-200 p-8 rounded-3xl shadow-sm hover:shadow-lg transition-all space-y-4">
                <div className="w-14 h-14 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Lucide.MapPin size={28} />
                </div>
                <h4 className="text-lg font-black text-slate-900">Địa Chỉ</h4>
                <p className="text-slate-600 font-semibold">
                  Tòa Nhà FPT<br />
                  Số 8 Tôn Thất Tuyết, Quận 1<br />
                  TP. Hồ Chí Minh
                </p>
              </div>
            </div>

            {/* Social Links */}
            <div className="bg-gradient-to-r from-blue-50 to-emerald-50 border border-slate-200 rounded-3xl p-8 md:p-12 space-y-6">
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-slate-900">Kết Nối Với Chúng Tôi</h3>
                <p className="text-slate-600 font-semibold">Theo dõi những tin tức và cập nhật mới nhất từ UrbanMind</p>
              </div>
              <div className="flex flex-wrap gap-4">
                <a
                  href="https://facebook.com/urbanmind"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-lg rounded-xl font-bold bg-[#1877F2] hover:bg-[#0A66C2] text-white border-none gap-2"
                >
                  <Lucide.Share2 size={20} />
                  Facebook
                </a>
                <a
                  href="https://zalo.me/urbanmind"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-lg rounded-xl font-bold bg-[#0084FF] hover:bg-[#006FD6] text-white border-none gap-2"
                >
                  <Lucide.MessageCircle size={20} />
                  Zalo
                </a>
                <a
                  href="tel:+84287654321"
                  className="btn btn-lg rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white border-none gap-2"
                >
                  <Lucide.PhoneCall size={20} />
                  Gọi Ngay
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-white border-t border-slate-200 py-12 lg:py-16 px-6 lg:px-20">
        <div className="max-w-7xl mx-auto text-center space-y-6">
          <h2 className="text-2xl md:text-3xl font-black text-slate-900">Sẵn sàng tạo thay đổi?</h2>
          <p className="text-slate-600 font-semibold text-lg max-w-2xl mx-auto">
            Bắt đầu gửi phản ánh ngay hôm nay và trở thành phần của cộng đồng xây dựng thành phố tốt hơn.
          </p>
          <Link
            to="/login?redirect=/tickets/create"
            className="btn btn-lg bg-[#0052CC] hover:bg-[#0043a4] text-white border-none rounded-xl font-bold inline-gap-2 px-8"
          >
            <Lucide.Play size={18} className="rotate-90" />
            Gửi Phản Ánh Ngay
          </Link>
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
                <li><Link to="/about" className="hover:text-slate-900">Giới thiệu</Link></li>
                <li><a href="#" className="hover:text-slate-900">Điều khoản sử dụng</a></li>
              </ul>
            </div>
            <div className="space-y-3">
              <span className="font-extrabold text-slate-900 uppercase text-[10px] tracking-wider block">Hỗ trợ</span>
              <ul className="space-y-2 text-[11px]">
                <li><a href="#" className="hover:text-slate-900">Chính sách bảo mật</a></li>
                <li><a href="mailto:support@urbanmind.io" className="hover:text-slate-900">Liên hệ</a></li>
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
