// src/pages/settings/SettingsPage.jsx
import * as Lucide from 'lucide-react';
import { ManagerPageHeader } from '../../components/manager/ManagerPageElements';
import { useTheme } from '../../contexts/ThemeContext';

export const SettingsPage = () => {
  const { theme, setTheme } = useTheme();

  const themeOptions = [
    {
      value: 'light',
      name: 'Sáng chuyên nghiệp',
      description: 'Nền sáng, độ tương phản rõ và phù hợp thao tác quản trị ban ngày.',
      icon: Lucide.Sun,
      previewClass: 'bg-gradient-to-br from-blue-500 to-cyan-400',
    },
    {
      value: 'dark',
      name: 'Tối tập trung',
      description: 'Nền tối đồng bộ toàn hệ thống, giảm chói khi theo dõi trong thời gian dài.',
      icon: Lucide.Moon,
      previewClass: 'bg-gradient-to-br from-slate-800 to-slate-600',
    },
  ];

  const activeTheme = themeOptions.find((item) => item.value === theme) || themeOptions[0];

  return (
    <div className="admin-page-shell space-y-5 pb-5">
      <ManagerPageHeader
        title="Cài đặt cá nhân"
        description="Tùy biến giao diện làm việc trên thiết bị hiện tại. Thay đổi được áp dụng và lưu tự động."
        icon={Lucide.Settings2}
        statusLabel="Giao diện"
        statusValue={activeTheme.name}
        statusTone="success"
      />

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="admin-panel p-5 sm:p-6">
          <div className="flex items-start gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
              <Lucide.Palette size={18} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-950 dark:text-white">Giao diện ứng dụng</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                Chọn giao diện phù hợp với môi trường làm việc. Lựa chọn này chỉ thay đổi cách hiển thị, không ảnh hưởng dữ liệu nghiệp vụ.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {themeOptions.map((option) => {
              const Icon = option.icon;
              const isActive = theme === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTheme(option.value)}
                  aria-pressed={isActive}
                  className={`group rounded-[24px] border p-4 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    isActive
                      ? 'border-blue-300 bg-blue-50/80 shadow-sm ring-1 ring-blue-100 dark:border-blue-400/40 dark:bg-blue-500/10 dark:ring-blue-500/10'
                      : 'border-slate-200 bg-slate-50/70 hover:border-blue-200 hover:bg-white hover:shadow-sm dark:border-slate-700 dark:bg-slate-950/25 dark:hover:border-blue-500/30 dark:hover:bg-slate-900/70'
                  }`}
                >
                  <div className="relative mb-4 h-28 overflow-hidden rounded-2xl border border-white/60 bg-white/80 shadow-inner dark:border-white/10 dark:bg-slate-950/40">
                    <div className={`h-full ${option.previewClass} p-3`}>
                      <div className="h-3 w-20 rounded-full bg-white/80" />
                      <div className="mt-6 grid grid-cols-3 gap-2">
                        <div className="h-11 rounded-xl bg-white/85" />
                        <div className="h-11 rounded-xl bg-white/65" />
                        <div className="h-11 rounded-xl bg-white/45" />
                      </div>
                    </div>
                    {isActive ? (
                      <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
                        <Lucide.Check size={12} /> Đang dùng
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-start gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300'
                    }`}>
                      <Icon size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-950 dark:text-white">{option.name}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{option.description}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-[24px] border border-emerald-200 bg-emerald-50/80 p-5 shadow-sm dark:border-emerald-400/20 dark:bg-emerald-500/[0.08]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">Trạng thái</p>
                <h3 className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">Đã lưu tự động</h3>
                <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
                  Giao diện hiện tại được lưu trên trình duyệt này và áp dụng ngay trên toàn bộ hệ thống.
                </p>
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
                <Lucide.CheckCircle2 size={19} />
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-emerald-200/80 bg-white/60 p-4 dark:border-emerald-400/15 dark:bg-slate-950/25">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Đang sử dụng</span>
                <span className="text-xs font-semibold text-slate-900 dark:text-white">{activeTheme.name}</span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Phạm vi lưu</span>
                <span className="text-xs font-semibold text-slate-900 dark:text-white">Trình duyệt hiện tại</span>
              </div>
            </div>
          </section>

          <section className="admin-panel p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
                <Lucide.Info size={18} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-950 dark:text-white">Phạm vi cài đặt</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  Hiện tại hệ thống chưa có API cài đặt tài khoản. Vì vậy trang này chỉ giữ những tùy chọn thực sự có hiệu lực trên thiết bị này.
                </p>
              </div>
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
};
