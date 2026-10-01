import { Link } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import PublicLayout from '../components/public/PublicLayout';
import PublicRecentFeedbacks from '../components/public/PublicRecentFeedbacks';
import usePublicLandingFeed from '../hooks/usePublicLandingFeed';
import PublicMapPreview from '../components/public/PublicMapPreview';
import PublicPageMotion from '../components/public/PublicPageMotion';
import { useAuth } from '../contexts/AuthContext';

const PUBLIC_CREATE_FEEDBACK_URL = '/login?redirect=/tickets/create&intent=create-feedback';
const PUBLIC_MY_FEEDBACKS_URL = '/login?redirect=/tickets&intent=my-feedbacks';
const PUBLIC_AREA_ALERTS_URL = '/login?redirect=/area-alerts&intent=area-alerts';

const getQuickAccessItems = ({ createFeedbackUrl, myFeedbacksUrl, areaAlertsUrl }) => [
  {
    title: 'Gửi phản ánh mới',
    description: 'Gửi hình ảnh, vị trí và mô tả để cơ quan phụ trách tiếp nhận.',
    to: createFeedbackUrl,
    icon: Lucide.MessageSquarePlus,
    tone: 'primary',
  },
  {
    title: 'Phản ánh của tôi',
    description: 'Theo dõi trạng thái, trao đổi và kết quả xử lý của từng phản ánh.',
    to: myFeedbacksUrl,
    icon: Lucide.ListChecks,
    tone: 'blue',
  },
  {
    title: 'Bản đồ sự cố',
    description: 'Xem sự vụ theo phường, danh mục và tình trạng xử lý.',
    to: '/community/map',
    icon: Lucide.MapPinned,
    tone: 'cyan',
  },
  {
    title: 'Cảnh báo khu vực',
    description: 'Theo dõi thông tin đáng chú ý tại khu vực bạn quan tâm.',
    to: areaAlertsUrl,
    icon: Lucide.BellRing,
    tone: 'violet',
  },
];

const processSteps = [
  {
    number: '01',
    title: 'Gửi thông tin',
    description: 'Mô tả vấn đề, thêm hình ảnh và xác định vị trí xảy ra sự cố.',
    icon: Lucide.Camera,
  },
  {
    number: '02',
    title: 'Theo dõi xử lý',
    description: 'Xem phản ánh đã được tiếp nhận, xác minh và xử lý đến đâu.',
    icon: Lucide.Route,
  },
  {
    number: '03',
    title: 'Xem kết quả',
    description: 'Nhận kết quả xử lý và đánh giá khi phản ánh đã hoàn tất.',
    icon: Lucide.CircleCheckBig,
  },
];

const QUICK_TONES = {
  primary: 'bg-blue-600 text-white shadow-[0_10px_24px_rgba(37,99,235,.22)]',
  blue: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
  cyan: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-300',
  violet: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300',
};

const LandingPageStyles = () => (
  <style>{`
    .resident-home {
      background:
        radial-gradient(circle at 8% 3%, rgba(59,130,246,.07), transparent 24%),
        linear-gradient(180deg, #f8fbff 0%, #ffffff 32%, #f7faff 100%);
    }

    .resident-home__hero {
      border-color: rgba(203, 213, 225, .82);
      background:
        radial-gradient(circle at 88% 8%, rgba(34,211,238,.11), transparent 26%),
        radial-gradient(circle at 6% 6%, rgba(59,130,246,.12), transparent 26%),
        rgba(255,255,255,.86);
      box-shadow: 0 26px 70px rgba(15,23,42,.07);
    }

    .resident-home__quick-card,
    .resident-home__section {
      border-color: rgba(203, 213, 225, .82);
      background: rgba(255,255,255,.9);
      box-shadow: 0 16px 42px rgba(15,23,42,.055);
    }

    html[data-theme="dark"] .resident-home {
      background:
        radial-gradient(circle at 10% 4%, rgba(37,99,235,.12), transparent 26%),
        linear-gradient(180deg, #071426 0%, #08172b 100%);
    }

    html[data-theme="dark"] .resident-home__hero,
    html[data-theme="dark"] .resident-home__quick-card,
    html[data-theme="dark"] .resident-home__section {
      border-color: rgba(96,165,250,.16);
      background: linear-gradient(145deg, rgba(13,29,54,.97), rgba(8,20,40,.98));
      box-shadow: 0 24px 64px rgba(0,0,0,.26);
    }
  `}</style>
);

export const LandingPage = () => {
  const { isAuthenticated } = useAuth();
  const createFeedbackUrl = isAuthenticated ? '/tickets/create' : PUBLIC_CREATE_FEEDBACK_URL;
  const myFeedbacksUrl = isAuthenticated ? '/tickets' : PUBLIC_MY_FEEDBACKS_URL;
  const areaAlertsUrl = isAuthenticated ? '/area-alerts' : PUBLIC_AREA_ALERTS_URL;
  const quickAccessItems = getQuickAccessItems({
    createFeedbackUrl,
    myFeedbacksUrl,
    areaAlertsUrl,
  });

  const {
    items,
    loading,
    error,
    reload,
  } = usePublicLandingFeed();

  return (
    <PublicLayout>
      <PublicPageMotion>
        <main className="resident-home">
          <LandingPageStyles />

          <section
            data-public-reveal
            className="mx-auto w-full max-w-[1600px] px-4 pb-5 pt-5 sm:px-6 sm:pt-7 lg:px-8 2xl:px-10"
            aria-labelledby="landing-hero-title"
          >
            <div className="resident-home__hero relative isolate overflow-hidden rounded-[30px] border px-5 py-6 sm:px-8 sm:py-8 lg:px-9">
              <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
                <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full border-[38px] border-blue-100/55 dark:border-blue-500/5" />
                <div className="absolute -bottom-20 left-[34%] h-56 w-56 rounded-full bg-cyan-200/20 blur-3xl dark:bg-cyan-500/5" />
              </div>

              <div className="grid gap-7 lg:grid-cols-[minmax(0,.86fr)_minmax(560px,1.14fr)] lg:items-center">
                <header className="max-w-[650px]">
                  <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3.5 py-2 text-xs font-semibold text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
                    <Lucide.Home size={14} aria-hidden="true" />
                    Dành cho người dân
                  </span>

                  <h1
                    id="landing-hero-title"
                    className="mt-4 text-[36px] font-bold leading-[1.1] tracking-[-0.04em] text-slate-950 sm:text-[48px] lg:text-[54px] dark:text-white"
                  >
                    Phản ánh dễ hơn.
                    <span className="mt-1 block text-blue-600 dark:text-blue-400">
                      Theo dõi rõ hơn.
                    </span>
                  </h1>

                  <p className="mt-4 max-w-[590px] text-[15px] leading-7 text-slate-600 sm:text-base dark:text-slate-300">
                    Gửi vấn đề đô thị, xem tiến độ xử lý và theo dõi những sự vụ đang diễn ra quanh khu vực bạn quan tâm.
                  </p>

                  <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
                    <Link
                      to={createFeedbackUrl}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4.5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(37,99,235,.22)] transition hover:-translate-y-0.5 hover:bg-blue-700"
                    >
                      <Lucide.MessageSquarePlus size={16} aria-hidden="true" />
                      Gửi phản ánh
                    </Link>

                    <Link
                      to={myFeedbacksUrl}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4.5 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                    >
                      <Lucide.ListChecks size={16} aria-hidden="true" />
                      Phản ánh của tôi
                    </Link>

                    <Link
                      to="/community/map"
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-3.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-500/10"
                    >
                      <Lucide.MapPinned size={16} aria-hidden="true" />
                      Xem bản đồ
                    </Link>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1.5">
                      <Lucide.Eye size={13} className="text-blue-600" aria-hidden="true" />
                      Bảng tin và bản đồ công khai
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Lucide.ShieldCheck size={13} className="text-emerald-600" aria-hidden="true" />
                      {isAuthenticated ? 'Đã đăng nhập, có thể gửi ngay' : 'Đăng nhập để gửi và theo dõi'}
                    </span>
                  </div>
                </header>

                <div className="min-w-0">
                  <PublicMapPreview compact />
                </div>
              </div>
            </div>
          </section>

          <section
            data-public-reveal
            className="mx-auto w-full max-w-[1600px] px-4 py-4 sm:px-6 lg:px-8 2xl:px-10"
            aria-label="Truy cập nhanh"
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {quickAccessItems.map(({ title, description, to, icon: Icon, tone }) => (
                <Link
                  key={title}
                  to={to}
                  className="resident-home__quick-card group flex min-h-[118px] items-start gap-3.5 rounded-[22px] border p-4 transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_18px_42px_rgba(37,99,235,.08)]"
                >
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${QUICK_TONES[tone]}`}>
                    <Icon size={18} aria-hidden="true" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <strong className="block text-sm font-bold text-slate-900 dark:text-white">
                      {title}
                    </strong>
                    <span className="mt-1.5 block text-xs leading-5 text-slate-500 dark:text-slate-400">
                      {description}
                    </span>
                  </span>

                  <Lucide.ChevronRight
                    size={16}
                    className="mt-1 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-600"
                    aria-hidden="true"
                  />
                </Link>
              ))}
            </div>
          </section>

          <section
            id="recent-feedbacks"
            data-public-reveal
            className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 2xl:px-10"
            aria-labelledby="recent-feedbacks-title"
          >
            <div className="resident-home__section rounded-[28px] border p-5 sm:p-7">
              <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-blue-600">
                    <Lucide.Newspaper size={14} aria-hidden="true" />
                    Bảng tin cộng đồng
                  </div>
                  <h2
                    id="recent-feedbacks-title"
                    className="mt-2 text-2xl font-bold tracking-[-0.03em] text-slate-950 sm:text-[32px] dark:text-white"
                  >
                    Sự vụ mới được cập nhật
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                    Xem nhanh những sự vụ công khai gần đây trước khi mở bảng tin đầy đủ.
                  </p>
                </div>

                <Link
                  to="/community/feed"
                  className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                >
                  Xem bảng tin
                  <Lucide.ArrowRight size={15} aria-hidden="true" />
                </Link>
              </header>

              <div className="mt-6">
                <PublicRecentFeedbacks
                  items={items}
                  loading={loading}
                  error={error}
                  onRetry={reload}
                />
              </div>
            </div>
          </section>

          <section
            id="how-it-works"
            data-public-reveal
            className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 2xl:px-10"
            aria-labelledby="how-it-works-title"
          >
            <div className="grid gap-5 lg:grid-cols-[minmax(260px,.72fr)_minmax(0,1.28fr)] lg:items-center">
              <header>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-600">
                  Quy trình dành cho người dân
                </p>
                <h2
                  id="how-it-works-title"
                  className="mt-2 text-2xl font-bold tracking-[-0.03em] text-slate-950 sm:text-[32px] dark:text-white"
                >
                  Từ phản ánh đến kết quả
                </h2>
                <p className="mt-3 max-w-lg text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Không cần nhớ quy trình phức tạp. Bạn chỉ cần gửi đúng thông tin và theo dõi từng bước xử lý.
                </p>
              </header>

              <ol className="grid gap-3 md:grid-cols-3">
                {processSteps.map(({ number, title, description, icon: Icon }) => (
                  <li
                    key={number}
                    className="resident-home__quick-card relative overflow-hidden rounded-[22px] border p-4.5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                        <Icon size={18} aria-hidden="true" />
                      </span>
                      <span className="text-[11px] font-bold tracking-[0.16em] text-slate-300 dark:text-slate-600">
                        {number}
                      </span>
                    </div>
                    <h3 className="mt-4 text-sm font-bold text-slate-900 dark:text-white">
                      {title}
                    </h3>
                    <p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
                      {description}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <section
            data-public-reveal
            className="mx-auto w-full max-w-[1600px] px-4 pb-8 pt-4 sm:px-6 lg:px-8 2xl:px-10"
          >
            <div className="relative overflow-hidden rounded-[28px] bg-[linear-gradient(120deg,#0b3b91_0%,#0b56d9_58%,#0e7490_125%)] px-5 py-6 text-white shadow-[0_20px_54px_rgba(11,86,217,.18)] sm:px-7 sm:py-7">
              <div className="pointer-events-none absolute -right-14 -top-16 h-52 w-52 rounded-full border-[30px] border-white/5" aria-hidden="true" />
              <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-100">
                    Có vấn đề cần phản ánh?
                  </p>
                  <h2 className="mt-2 max-w-3xl text-xl font-bold tracking-tight sm:text-2xl">
                    Gửi thông tin rõ ràng để việc tiếp nhận và xử lý bắt đầu nhanh hơn.
                  </h2>
                </div>

                <Link
                  to={createFeedbackUrl}
                  className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4.5 text-sm font-bold text-blue-700 transition hover:-translate-y-0.5"
                >
                  Gửi phản ánh mới
                  <Lucide.ArrowUpRight size={15} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </section>
        </main>
      </PublicPageMotion>
    </PublicLayout>
  );
};

export default LandingPage;
