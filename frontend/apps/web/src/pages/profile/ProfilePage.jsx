// src/pages/profile/ProfilePage.jsx
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getRoleLabel } from '../../utils/roleMap';
import { managementTypes } from '@urbanmind/shared-types';
import { formatPhone, userApi } from '@urbanmind/shared-api';
import { ticketApi } from '../../services/api/ticketApi';
import { canUseResidentProfileApi, getSessionProfile } from './profileAccess';

const ROLE_LABELS = {
  administrator: 'Quản trị viên',
  'service-user': 'Người dân',
  'system-staff': 'Nhân viên hệ thống',
  'service-provider': 'Đơn vị xử lý',
  'interaction-manager': 'Quản lý tương tác',
};

const STATUS_LABELS = {
  New: 'Đã tiếp nhận',
  AIReviewed: 'AI đã phân tích',
  AiReviewed: 'AI đã phân tích',
  'AI Reviewed': 'AI đã phân tích',
  Verified: 'Đã xác minh',
  Assigned: 'Đang xử lý',
  InProgress: 'Đang xử lý',
  Resolved: 'Kiểm tra kết quả',
  Approved: 'Chờ đánh giá',
  ReworkRequested: 'Cần xử lý bổ sung',
  Closed: 'Đã đóng',
  Rejected: 'Đã từ chối',
};

const normalizeRole = role => {
  const rawRole = String(role || '').trim();
  const normalizedRole = rawRole
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replaceAll('_', '-')
    .replaceAll(' ', '-')
    .toLowerCase();

  const roleAliases = {
    administrator: 'administrator',
    admin: 'administrator',
    serviceuser: 'service-user',
    'service-user': 'service-user',
    citizen: 'service-user',
    user: 'service-user',
    systemstaff: 'system-staff',
    'system-staff': 'system-staff',
    staff: 'system-staff',
    serviceprovider: 'service-provider',
    'service-provider': 'service-provider',
    serviceoperator: 'service-provider',
    'service-operator': 'service-provider',
    serviceoperatorstaff: 'service-provider',
    'service-operator-staff': 'service-provider',
    operator: 'service-provider',
    provider: 'service-provider',
    interactionmanager: 'interaction-manager',
    'interaction-manager': 'interaction-manager',
  };

  return roleAliases[normalizedRole] || normalizedRole;
};

const getUserInitials = value => {
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue) return 'U';

  const parts = normalizedValue.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }

  return normalizedValue.slice(0, 2).toUpperCase();
};

const formatDate = timestamp => {
  if (!timestamp) return 'Chưa có dữ liệu';
  return new Date(timestamp).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const formatMembership = timestamp => {
  if (!timestamp) return 'Chưa có dữ liệu';
  const created = new Date(timestamp).getTime();
  const now = Date.now();
  const days = Math.max(0, Math.floor((now - created) / (1000 * 60 * 60 * 24)));
  if (days >= 365) return `${Math.floor(days / 365)} năm`;
  if (days >= 30) return `${Math.floor(days / 30)} tháng`;
  return `${days} ngày`;
};

const statusTone = status => {
  if ([managementTypes.feedbackStatus.CLOSED, 'Closed'].includes(status)) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-300';
  }
  if ([managementTypes.feedbackStatus.ASSIGNED, managementTypes.feedbackStatus.IN_PROGRESS, 'Assigned', 'InProgress'].includes(status)) {
    return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/25 dark:bg-blue-400/10 dark:text-blue-300';
  }
  if (['Resolved', 'Approved'].includes(status)) {
    return 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-400/25 dark:bg-cyan-400/10 dark:text-cyan-300';
  }
  return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-300';
};

export const ProfilePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  const normalizedRole = useMemo(() => normalizeRole(user?.role), [user?.role]);
  const canManageProfile = canUseResidentProfileApi(normalizedRole);
  const displayName = fullName || profile?.fullName || user?.fullName || user?.email || 'Người dùng';
  const userInitials = useMemo(() => getUserInitials(displayName), [displayName]);
  const roleLabel = ROLE_LABELS[normalizedRole] || getRoleLabel(user?.role) || 'Người dùng';
  const avatarUrl = profile?.avatarUrl || user?.avatarUrl;
  const showAvatarImage = Boolean(avatarUrl) && !avatarError;
  const createdAt = profile?.createdAt || user?.createdAt;
  const createdAtLabel = formatDate(createdAt);
  const membershipAge = formatMembership(createdAt);
  const isVerified = profile?.isVerified ?? user?.isVerified;

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      setLoadingProfile(true);

      const sessionProfile = getSessionProfile(user);
      if (!canManageProfile) {
        setProfile(sessionProfile);
        setFullName(sessionProfile.fullName);
        setPhone(sessionProfile.phoneNumber);
        setAddress(sessionProfile.address);
        setLoadingProfile(false);
        return;
      }

      try {
        const data = await userApi.getProfile();
        if (cancelled) return;

        setProfile(data);
        setFullName(data?.fullName || '');
        setPhone(data?.phoneNumber || '');
        setAddress(data?.address || '');
      } catch (error) {
        console.error('ProfilePage profile load failed', error);
        if (!cancelled) {
          setProfile(sessionProfile);
          setFullName(sessionProfile.fullName);
          setPhone(sessionProfile.phoneNumber);
          setAddress(sessionProfile.address);
          setToastMessage('Không thể tải thông tin hồ sơ');
        }
      } finally {
        if (!cancelled) setLoadingProfile(false);
      }
    };

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [canManageProfile, user]);

  useEffect(() => {
    if (!user) return;

    const loadTickets = async () => {
      setLoadingTickets(true);
      try {
        const filters = {};
        if (normalizedRole === 'service-user') {
          filters.userId = user.userId;
        } else if (normalizedRole === 'service-provider') {
          filters.operatorId = user.operatorId;
        } else {
          filters.userId = user.userId;
        }

        const response = await ticketApi.getTickets(filters, { role: normalizedRole });
        setTickets(Array.isArray(response) ? response : []);
      } catch (error) {
        console.error('ProfilePage ticket load failed', error);
        setTickets([]);
      } finally {
        setLoadingTickets(false);
      }
    };

    loadTickets();
  }, [user, normalizedRole]);

  const userTickets = Array.isArray(tickets) ? tickets : [];
  const totalTickets = userTickets.length;
  const resolvedTickets = userTickets.filter(ticket =>
    [managementTypes.feedbackStatus.RESOLVED, managementTypes.feedbackStatus.CLOSED].includes(ticket.status)
  ).length;
  const openTickets = userTickets.filter(ticket =>
    ![managementTypes.feedbackStatus.RESOLVED, managementTypes.feedbackStatus.CLOSED].includes(ticket.status)
  ).length;
  const reportedThisMonth = userTickets.filter(ticket => {
    if (!ticket.createdAt) return false;
    const created = new Date(ticket.createdAt);
    const now = new Date();
    return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
  }).length;

  const latestTickets = [...userTickets]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 3);

  const hasProfileChanges = canManageProfile && (
    String(fullName || '').trim() !== String(profile?.fullName || '').trim()
    || String(address || '').trim() !== String(profile?.address || '').trim()
  );

  const handleUpdate = async event => {
    event.preventDefault();
    if (!canManageProfile || savingProfile) return;

    setSavingProfile(true);
    try {
      const updatedProfile = await userApi.updateProfile({
        fullName: fullName.trim() || null,
        address: address.trim() || null,
        avatarUrl: avatarUrl || null,
      });

      const nextProfile = updatedProfile || {
        ...profile,
        fullName: fullName.trim() || null,
        address: address.trim() || null,
        avatarUrl: avatarUrl || null,
      };

      setProfile(nextProfile);
      setFullName(nextProfile?.fullName || '');
      setPhone(nextProfile?.phoneNumber || '');
      setAddress(nextProfile?.address || '');
      setToastMessage('Đã lưu thay đổi hồ sơ');
    } catch (error) {
      console.error('ProfilePage profile update failed', error);
      /*
       * Tài khoản chưa xác thực số điện thoại bị backend chặn mọi thao tác ghi, kể
       * cả sửa hồ sơ. Nói thẳng điều đó thay vì một câu chung chung khiến người
       * dùng bấm lưu đi lưu lại mà không hiểu vì sao.
       */
      const blockedCode = error?.response?.data?.data?.code;
      setToastMessage(
        blockedCode === 'PHONE_NOT_VERIFIED'
          ? 'Bạn cần xác thực số điện thoại trước khi sửa hồ sơ.'
          : error?.response?.data?.msg
            || error?.response?.data?.message
            || 'Không thể cập nhật hồ sơ. Vui lòng thử lại.'
      );
    } finally {
      setSavingProfile(false);
      window.setTimeout(() => setToastMessage(''), 2600);
    }
  };

  return (
    <div className="profile-page space-y-5 sm:space-y-6">
      <style>{`
        .profile-page {
          --public-surface: rgba(255, 255, 255, 0.94);
          --public-surface-soft: rgba(248, 251, 255, 0.94);
          --public-surface-strong: #ffffff;
          --public-border: rgba(203, 213, 225, 0.82);
          --public-title: #0f172a;
          --public-copy: #5b6b82;
          --public-muted: #8796aa;
          --public-shadow: 0 20px 54px rgba(30, 64, 175, 0.08);
          color: var(--public-title);
        }

        html[data-theme="dark"] .profile-page {
          --public-surface: rgba(12, 27, 50, 0.94);
          --public-surface-soft: rgba(10, 24, 46, 0.9);
          --public-surface-strong: #0b1830;
          --public-border: rgba(96, 165, 250, 0.18);
          --public-title: #f8fafc;
          --public-copy: #afbdd0;
          --public-muted: #7f90a8;
          --public-shadow: 0 24px 64px rgba(0, 0, 0, 0.28);
        }

        .profile-page .public-overview-panel,
        .profile-page .public-recent-shell {
          border-color: var(--public-border) !important;
          background: var(--public-surface) !important;
          box-shadow: var(--public-shadow) !important;
        }

        html[data-theme="dark"] .profile-page .public-overview-panel,
        html[data-theme="dark"] .profile-page .public-recent-shell {
          background:
            radial-gradient(circle at 92% 2%, rgba(37, 99, 235, 0.08), transparent 24%),
            linear-gradient(145deg, rgba(13, 29, 54, 0.98), rgba(8, 20, 40, 0.98)) !important;
        }

        .profile-hero-metric {
          color: #0f172a;
        }

        .profile-hero-surface {
          border-color: rgba(147, 197, 253, 0.55);
          background:
            linear-gradient(135deg, rgba(226, 240, 255, 0.98), rgba(241, 247, 255, 0.96)),
            linear-gradient(180deg, rgba(255,255,255,0.45), rgba(255,255,255,0));
          box-shadow: 0 20px 55px rgba(59, 130, 246, 0.10);
        }

        .profile-hero-orb {
          background: radial-gradient(circle, rgba(186,230,253,0.55), rgba(186,230,253,0.14) 68%, transparent 100%);
        }

        .profile-hero-wave {
          color: rgba(59, 130, 246, 0.30);
        }

        html[data-theme="dark"] .profile-hero-surface {
          border-color: rgba(96, 165, 250, 0.18) !important;
          background:
            linear-gradient(135deg, rgba(7, 24, 49, 0.96), rgba(4, 18, 40, 0.98)),
            radial-gradient(circle at top right, rgba(34,211,238,0.10), transparent 28%) !important;
          box-shadow: 0 22px 60px rgba(0, 0, 0, 0.32) !important;
        }

        html[data-theme="dark"] .profile-hero-wave {
          color: rgba(96, 165, 250, 0.22) !important;
        }

        html[data-theme="dark"] .profile-hero-orb {
          background: radial-gradient(circle, rgba(125,211,252,0.14), rgba(125,211,252,0.05) 68%, transparent 100%) !important;
        }

        html[data-theme="dark"] .profile-hero-metric {
          border-color: rgba(147, 197, 253, 0.16) !important;
          background: rgba(8, 25, 49, 0.74) !important;
          color: #f8fafc !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.04), 0 12px 28px rgba(0,0,0,0.16) !important;
        }

        html[data-theme="dark"] .profile-hero-metric-label,
        html[data-theme="dark"] .profile-hero-metric-copy {
          color: #9fb0c6 !important;
        }

        html[data-theme="dark"] .public-hero .text-blue-600,
        html[data-theme="dark"] .public-hero .text-indigo-600 {
          color: #7dd3fc !important;
        }

        .profile-avatar-fallback {
          background: linear-gradient(145deg, #eff6ff, #eef4ff);
          border: 1px solid rgba(147, 197, 253, 0.55);
          color: #2563eb;
          box-shadow: 0 10px 24px rgba(59, 130, 246, 0.12);
        }

        html[data-theme="dark"] .profile-avatar-fallback {
          background: linear-gradient(145deg, rgba(14, 28, 52, 0.96), rgba(10, 23, 43, 0.96)) !important;
          border-color: rgba(96, 165, 250, 0.18) !important;
          color: #93c5fd !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.03), 0 10px 24px rgba(0,0,0,0.18) !important;
        }

        .profile-kpi-tile {
          border-color: var(--public-border);
          background: var(--public-surface-soft);
        }

        .profile-kpi-blue { background: linear-gradient(145deg, rgba(239,246,255,.96), rgba(236,254,255,.9)); }
        .profile-kpi-amber { background: linear-gradient(145deg, rgba(255,251,235,.96), rgba(255,247,237,.9)); }
        .profile-kpi-emerald { background: linear-gradient(145deg, rgba(236,253,245,.96), rgba(240,253,250,.9)); }

        html[data-theme="dark"] .profile-kpi-tile {
          background: linear-gradient(145deg, rgba(14,32,58,.96), rgba(8,23,43,.96)) !important;
          border-color: rgba(96,165,250,.18) !important;
        }

        html[data-theme="dark"] .profile-kpi-blue .text-blue-600 { color: #7dd3fc !important; }
        html[data-theme="dark"] .profile-kpi-amber .text-amber-600 { color: #fbbf24 !important; }
        html[data-theme="dark"] .profile-kpi-emerald .text-emerald-600 { color: #34d399 !important; }
      `}</style>
      <section className="public-hero profile-hero-surface relative overflow-hidden rounded-[30px] border">
        <div className="public-hero-backdrop pointer-events-none absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_18%_18%,rgba(56,189,248,0.18),transparent_26%),radial-gradient(circle_at_84%_24%,rgba(99,102,241,0.12),transparent_28%)]" aria-hidden="true">
          <div className="absolute -right-20 -top-28 h-72 w-72 rounded-full border border-blue-200/60 bg-white/32" />
          <div className="absolute -right-8 -top-14 h-52 w-52 rounded-full border border-blue-300/45" />
          <div className="profile-hero-orb absolute -bottom-28 left-[12%] h-56 w-80 rounded-[50%]" />
          <svg className="profile-hero-wave absolute inset-x-0 bottom-0 h-28 w-full" viewBox="0 0 1200 120" preserveAspectRatio="none">
            <path d="M0,82 C170,32 300,116 470,70 C650,20 760,92 920,54 C1030,28 1110,42 1200,18" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M0,105 C180,66 330,126 520,91 C715,54 835,110 1000,72 C1085,52 1145,58 1200,48" fill="none" stroke="currentColor" strokeWidth="1.3" />
          </svg>
          <span className="absolute left-[46%] top-6 flex h-8 w-8 items-center justify-center rounded-full border border-blue-200/75 bg-white/78 text-blue-600 shadow-sm backdrop-blur">
            <Lucide.Sparkles size={14} />
          </span>
          <span className="absolute bottom-7 right-[31%] flex h-7 w-7 items-center justify-center rounded-full border border-cyan-200/75 bg-white/78 text-cyan-600 shadow-sm backdrop-blur">
            <Lucide.MapPin size={13} />
          </span>
          <span className="absolute right-9 top-8 hidden h-7 w-7 items-center justify-center rounded-full border border-indigo-200/75 bg-white/78 text-indigo-600 shadow-sm backdrop-blur lg:flex">
            <Lucide.MessageCircleMore size={13} />
          </span>
        </div>

        <div className="relative flex flex-col gap-6 px-6 py-7 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-9 lg:py-8">
          <div className="min-w-0">
            <h1 className="truncate text-3xl font-semibold tracking-[-0.035em] text-[var(--public-title)] sm:text-4xl">
              {displayName}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--public-copy)]">
              {canManageProfile
                ? 'Quản lý thông tin cá nhân và theo dõi các phản ánh bạn đã gửi tới UrbanMind.'
                : 'Xem thông tin tài khoản và hoạt động trong phạm vi công việc của bạn.'}
            </p>
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto lg:min-w-[390px]">
            <div className="profile-hero-metric rounded-2xl border border-white/80 bg-white/70 px-4 py-4 text-slate-900 shadow-sm backdrop-blur-md">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium profile-hero-metric-label text-slate-500">Trạng thái tài khoản</span>
                <Lucide.BadgeCheck size={17} className="text-blue-600" aria-hidden="true" />
              </div>
              <strong className="mt-3 block text-lg font-semibold">
                {isVerified ? 'Đã xác minh' : 'Chưa xác minh'}
              </strong>
              {isVerified ? (
                <p className="mt-1 text-xs profile-hero-metric-copy text-slate-500">Dữ liệu từ hồ sơ tài khoản</p>
              ) : (
                <>
                  <p className="mt-1 text-xs profile-hero-metric-copy text-slate-500">
                    Xác thực số điện thoại để gửi được phản ánh.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate('/verify-phone', { state: { from: '/profile' } })}
                    className="mt-3 inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white transition hover:bg-blue-700"
                  >
                    <Lucide.ShieldCheck size={14} aria-hidden="true" />
                    Xác thực ngay
                  </button>
                </>
              )}
            </div>

            <div className="profile-hero-metric rounded-2xl border border-white/80 bg-white/70 px-4 py-4 text-slate-900 shadow-sm backdrop-blur-md">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium profile-hero-metric-label text-slate-500">Thành viên</span>
                <Lucide.CalendarDays size={17} className="text-blue-600" aria-hidden="true" />
              </div>
              <strong className="mt-3 block text-lg font-semibold">{membershipAge}</strong>
              <p className="mt-1 text-xs profile-hero-metric-copy text-slate-500">Từ {createdAtLabel}</p>
            </div>
          </div>
        </div>
      </section>
      <div className="grid gap-5 xl:grid-cols-[330px_minmax(0,1fr)] xl:items-start">
        <aside className="space-y-5">
          <section className="public-overview-panel rounded-[26px] border p-5 sm:p-6">
            <div className="flex flex-col items-center text-center">
              {showAvatarImage ? (
                <div className="h-24 w-24 overflow-hidden rounded-full border-4 border-white shadow-[0_0_0_1px_rgba(147,197,253,0.35),0_8px_20px_rgba(37,99,235,0.12)]">
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className="h-full w-full object-cover"
                    onError={() => setAvatarError(true)}
                  />
                </div>
              ) : (
                <div className="profile-avatar-fallback flex h-24 w-24 items-center justify-center rounded-full text-2xl font-bold tracking-[-0.03em]">
                  {userInitials}
                </div>
              )}

              <h2 className="mt-4 text-xl font-semibold tracking-[-0.025em] text-[var(--public-title)]">{displayName}</h2>
              <p className="mt-1 text-sm text-[var(--public-copy)]">{roleLabel}</p>
              <p className="mt-1 max-w-full truncate text-sm text-[var(--public-muted)]">
                {profile?.email || user?.email || 'Chưa có email'}
              </p>

            </div>

            <div className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-[var(--public-border)] bg-[var(--public-surface-soft)] px-4 py-3.5">
              <span className="inline-flex items-center gap-2 text-xs text-[var(--public-muted)]">
                <Lucide.CalendarDays size={14} aria-hidden="true" />
                Tham gia từ
              </span>
              <span className="text-xs font-semibold text-[var(--public-title)]">{createdAtLabel}</span>
            </div>
          </section>

          <section className="public-overview-panel rounded-[26px] border p-5 sm:p-6">
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-[0_8px_18px_rgba(37,99,235,0.2)]">
                <Lucide.Activity size={17} aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-[var(--public-title)]">Tóm tắt hoạt động</h2>
                <p className="mt-0.5 text-xs text-[var(--public-muted)]">Dữ liệu từ phản ánh của bạn</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              {[
                ['Tổng phản ánh', loadingTickets ? '—' : totalTickets, Lucide.Files, 'profile-kpi-blue', 'text-blue-600'],
                ['Đang mở', loadingTickets ? '—' : openTickets, Lucide.Clock3, 'profile-kpi-amber', 'text-amber-600'],
                ['Đã xử lý', loadingTickets ? '—' : resolvedTickets, Lucide.CircleCheckBig, 'profile-kpi-emerald', 'text-emerald-600'],
                ['Tháng này', loadingTickets ? '—' : reportedThisMonth, Lucide.CalendarDays, 'profile-kpi-blue', 'text-blue-600'],
              ].map(([label, value, Icon, tileTone, iconColor]) => (
                <div key={label} className={`profile-kpi-tile ${tileTone} min-h-[116px] rounded-2xl border p-4`}>
                  <Icon size={16} className={iconColor} aria-hidden="true" />
                  <strong className="mt-3 block text-2xl font-bold tracking-[-0.035em] text-[var(--public-title)]">{value}</strong>
                  <span className="mt-1 block text-[11px] font-medium text-[var(--public-muted)]">{label}</span>
                </div>
              ))}
            </div>
          </section>
        </aside>

        <div className="space-y-5">
          <section className="public-recent-shell overflow-hidden rounded-[26px] border">
            <header className="flex flex-col gap-4 border-b border-[var(--public-border)] bg-[var(--public-surface-soft)] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 ">
              <div>
                <h2 className="text-2xl font-semibold tracking-[-0.025em] text-[var(--public-title)]">Phản ánh mới nhất của bạn</h2>
                <p className="mt-1.5 text-sm text-[var(--public-copy)]">Theo dõi nhanh trạng thái các phản ánh vừa gửi.</p>
              </div>
              <Link
                to="/tickets"
                className="public-section-button inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 text-sm font-semibold text-blue-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-50"
              >
                Xem tất cả
                <Lucide.ArrowRight size={15} aria-hidden="true" />
              </Link>
            </header>

            <div className="p-4 sm:p-5">
              {loadingTickets ? (
                <div className="space-y-3" aria-label="Đang tải hoạt động gần đây">
                  {[0, 1, 2].map(item => (
                    <div key={item} className="h-[92px] animate-pulse rounded-2xl border border-[var(--public-border)] bg-[var(--public-surface-soft)]" />
                  ))}
                </div>
              ) : latestTickets.length === 0 ? (
                <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--public-border)] bg-[var(--public-surface-soft)] px-6 text-center">
                  <Lucide.Inbox size={24} className="text-[var(--public-muted)]" aria-hidden="true" />
                  <h3 className="mt-3 text-sm font-semibold text-[var(--public-title)]">Chưa có phản ánh gần đây</h3>
                  <p className="mt-1 text-sm text-[var(--public-copy)]">Các phản ánh mới của bạn sẽ xuất hiện tại đây.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {latestTickets.map(ticket => {
                    const isConfirmedDuplicate = Boolean(ticket?.parentTicketId || ticket?.parentFeedbackId);
                    const statusLabel = STATUS_LABELS[ticket.status] || ticket.status || 'Chờ xử lý';
                    return (
                      <Link
                        key={ticket.feedbackId || ticket.createdAt}
                        to={ticket.feedbackId ? `/tickets/${ticket.feedbackId}` : '/tickets'}
                        className="group block rounded-2xl border border-[var(--public-border)] bg-[var(--public-surface-soft)] p-4 transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-[0_12px_28px_rgba(37,99,235,0.08)] "
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate text-sm font-semibold text-[var(--public-title)]">
                                {ticket.title || ticket.categoryName || 'Phản ánh đô thị'}
                              </h3>
                              {isConfirmedDuplicate ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-1 text-[10px] font-semibold text-violet-700">
                                  <Lucide.GitMerge size={11} aria-hidden="true" />
                                  Phản ánh trùng
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--public-muted)]">
                              <span className="inline-flex min-w-0 items-center gap-1.5">
                                <Lucide.MapPin size={13} aria-hidden="true" />
                                <span className="max-w-[420px] truncate">{ticket.locationText || 'Vị trí chưa xác định'}</span>
                              </span>
                              <span className="inline-flex items-center gap-1.5">
                                <Lucide.Calendar size={13} aria-hidden="true" />
                                {formatDate(ticket.createdAt)}
                              </span>
                            </div>
                          </div>

                          <span className={`inline-flex w-fit shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                            isConfirmedDuplicate ? 'border-violet-200 bg-violet-50 text-violet-700' : statusTone(ticket.status)
                          }`}>
                            {isConfirmedDuplicate ? 'Phản ánh trùng' : statusLabel}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <section className="public-overview-panel overflow-hidden rounded-[26px] border">
            <header className="border-b border-[var(--public-border)] bg-[var(--public-surface-soft)] px-5 py-5 sm:px-6 ">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-[0_8px_18px_rgba(79,70,229,0.2)]">
                  <Lucide.Settings2 size={17} aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold tracking-[-0.02em] text-[var(--public-title)]">Thông tin cá nhân</h2>
                  <p className="mt-1 text-sm leading-6 text-[var(--public-copy)]">
                    {canManageProfile
                      ? 'Cập nhật các trường được hỗ trợ bởi hồ sơ tài khoản.'
                      : 'Thông tin tài khoản nhân sự được hiển thị từ phiên đăng nhập.'}
                  </p>
                </div>
              </div>
            </header>

            <form onSubmit={handleUpdate} className="p-5 sm:p-6">
              <div className="grid gap-5 lg:grid-cols-2">
                <div className="lg:col-span-2">
                  <label htmlFor="profile-email" className="mb-2 block text-xs font-semibold text-[var(--public-title)]">Email đăng nhập</label>
                  <div className="relative">
                    <Lucide.Mail size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--public-muted)]" aria-hidden="true" />
                    <input
                      id="profile-email"
                      type="email"
                      value={profile?.email || user?.email || ''}
                      disabled
                      className="h-12 w-full rounded-xl border border-[var(--public-border)] bg-[var(--public-surface-soft)] pl-11 pr-4 text-sm font-medium text-[var(--public-muted)] outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="profile-name" className="mb-2 block text-xs font-semibold text-[var(--public-title)]">Họ và tên</label>
                  <div className="relative">
                    <Lucide.UserRound size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-blue-500" aria-hidden="true" />
                    <input
                      id="profile-name"
                      type="text"
                      value={fullName}
                      disabled={!canManageProfile}
                      onChange={event => setFullName(event.target.value)}
                      className="h-12 w-full rounded-xl border border-[var(--public-border)] bg-[var(--public-surface-strong)] pl-11 pr-4 text-sm font-medium text-[var(--public-title)] outline-none transition placeholder:text-[var(--public-muted)] focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:bg-[var(--public-surface-soft)] disabled:text-[var(--public-muted)]"
                      placeholder="Nhập họ và tên"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="profile-phone" className="mb-2 block text-xs font-semibold text-[var(--public-title)]">Số điện thoại</label>
                  <div className="relative">
                    <Lucide.Phone size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-blue-500" aria-hidden="true" />
                    <input
                      id="profile-phone"
                      type="tel"
                      value={phone ? formatPhone(phone) : ''}
                      readOnly
                      aria-describedby="profile-phone-hint"
                      className="h-12 w-full cursor-not-allowed rounded-xl border border-[var(--public-border)] bg-[var(--public-surface-soft)] pl-11 pr-4 text-sm font-medium text-[var(--public-title)] outline-none placeholder:text-[var(--public-muted)]"
                      placeholder="Chưa có số điện thoại"
                    />
                  </div>
                  <p id="profile-phone-hint" className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--public-muted)]">
                    <Lucide.ShieldCheck size={13} aria-hidden="true" className="text-blue-500" />
                    Số điện thoại là thông tin đã xác thực nên chỉ đổi được qua bước nhập mã OTP.
                    <button
                      type="button"
                      onClick={() => navigate('/verify-phone', { state: { from: '/profile' } })}
                      className="font-semibold text-blue-600 underline-offset-2 hover:underline"
                    >
                      Đổi số điện thoại
                    </button>
                  </p>
                </div>

                <div className="lg:col-span-2">
                  <label htmlFor="profile-address" className="mb-2 block text-xs font-semibold text-[var(--public-title)]">Địa chỉ liên hệ</label>
                  <div className="relative">
                    <Lucide.MapPinned size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" aria-hidden="true" />
                    <input
                      id="profile-address"
                      type="text"
                      value={address}
                      disabled={!canManageProfile}
                      onChange={event => setAddress(event.target.value)}
                      className="h-12 w-full rounded-xl border border-[var(--public-border)] bg-[var(--public-surface-strong)] pl-11 pr-4 text-sm font-medium text-[var(--public-title)] outline-none transition placeholder:text-[var(--public-muted)] focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:bg-[var(--public-surface-soft)] disabled:text-[var(--public-muted)]"
                      placeholder="Nhập địa chỉ liên hệ"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-4 border-t border-[var(--public-border)] pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-center gap-2 text-xs leading-5 text-[var(--public-muted)]">
                  <Lucide.Info size={14} aria-hidden="true" />
                  {canManageProfile
                    ? 'Họ tên, số điện thoại và địa chỉ sẽ được đồng bộ với hồ sơ tài khoản sau khi lưu.'
                    : 'Liên hệ quản trị viên nếu thông tin tài khoản nhân sự chưa chính xác.'}
                </p>
                {canManageProfile ? (
                  <button
                    type="submit"
                    disabled={savingProfile || loadingProfile || !hasProfileChanges}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(37,99,235,0.24)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:pointer-events-none disabled:opacity-60"
                  >
                    {savingProfile ? <Lucide.LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Lucide.Save size={16} aria-hidden="true" />}
                    {savingProfile ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </button>
                ) : null}
              </div>
            </form>
          </section>
        </div>
      </div>

      {toastMessage && (
        <div className="toast toast-end z-50">
          <div className="alert border border-emerald-200 bg-emerald-600 text-white shadow-xl">
            <Lucide.CheckCircle2 size={18} aria-hidden="true" />
            <span className="text-sm font-semibold">{toastMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
};
