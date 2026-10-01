// src/routes/AppRoutes.jsx
import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { APP_ROLES } from '@urbanmind/shared-types';
import { useAuth } from '../contexts/AuthContext';
import { ProtectedRoute } from '../guards/ProtectedRoute';
import { RoleGuard } from '../guards/RoleGuard';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import PublicLayout from '../components/public/PublicLayout';
import LoadingSkeleton from '../components/design-system/LoadingSkeleton';
import { getRoleEntryPath, normalizeRole } from '../utils/roleMap';
import { buildAuthPath, getSafeInternalPath } from '../utils/authRedirect';
import { getSystemStaffLegacyRouteRedirect } from '../roles/system-staff/permissions';

const LandingPage = lazy(() => import('../pages/LandingPage').then((m) => ({ default: m.LandingPage })));
const LoginPage = lazy(() => import('../pages/auth/LoginPage').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('../pages/auth/RegisterPage').then((m) => ({ default: m.RegisterPage })));
const VerifyPhonePage = lazy(() => import('../pages/auth/VerifyPhonePage').then((m) => ({ default: m.VerifyPhonePage })));
const MessengerAccountLinkPage = lazy(() => import('../pages/auth/MessengerAccountLinkPage').then((m) => ({ default: m.MessengerAccountLinkPage })));
const Dashboard = lazy(() => import('../pages/dashboard/Dashboard').then((m) => ({ default: m.Dashboard })));
const TicketListPage = lazy(() => import('../pages/tickets/TicketListPage').then((m) => ({ default: m.TicketListPage })));
const CreateTicketPage = lazy(() => import('../pages/tickets/CreateTicketPage').then((m) => ({ default: m.CreateTicketPage })));
const TicketDetailPage = lazy(() => import('../pages/tickets/TicketDetailPage').then((m) => ({ default: m.TicketDetailPage })));
const ResolutionResultPage = lazy(() => import('../pages/tickets/ResolutionResultPage').then((m) => ({ default: m.ResolutionResultPage })));
const ReworkCenterPage = lazy(() => import('../pages/tickets/ReworkCenterPage').then((m) => ({ default: m.ReworkCenterPage })));
const ClosedFeedbackArchivePage = lazy(() => import('../pages/tickets/ClosedFeedbackArchivePage').then((m) => ({ default: m.ClosedFeedbackArchivePage })));
const CommunityFeedPage = lazy(() => import('../pages/community/CommunityFeedPage').then((m) => ({ default: m.CommunityFeedPage })));
const CommunityFeedbackDetailPage = lazy(() => import('../pages/community/CommunityFeedbackDetailPage').then((m) => ({ default: m.CommunityFeedbackDetailPage })));
const CommunityMapPage = lazy(() => import('../pages/community/CommunityMapPage').then((m) => ({ default: m.CommunityMapPage })));
const NotificationCenterPage = lazy(() => import('../pages/notifications/NotificationCenterPage').then((m) => ({ default: m.NotificationCenterPage })));
const ProfilePage = lazy(() => import('../pages/profile/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const SettingsPage = lazy(() => import('../pages/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const ResidentAreaAlertsPage = lazy(() => import('../pages/alerts/ResidentAreaAlertsPage').then((m) => ({ default: m.ResidentAreaAlertsPage })));

const IncidentMatchListPage = lazy(() => import('../pages/tickets/DuplicateDetection').then((m) => ({ default: m.IncidentMatchListPage })));
const IncidentMatchDetailPage = lazy(() => import('../pages/tickets/DuplicateDetailPage').then((m) => ({ default: m.IncidentMatchDetailPage })));
const ManagementFeedbackListPage = lazy(() => import('../pages/staff/ManagementFeedbackListPage').then((m) => ({ default: m.default })));
const StaffIncidentDashboardPage = lazy(() => import('../pages/staff/StaffIncidentDashboardPage').then((m) => ({ default: m.default })));
const StaffIncidentListPage = lazy(() => import('../pages/staff/StaffIncidentListPage').then((m) => ({ default: m.default })));
const StaffIncidentDetailPage = lazy(() => import('../pages/staff/StaffIncidentDetailPage').then((m) => ({ default: m.default })));
const ManagementFeedbackDetailPage = lazy(() => import('../pages/staff/ManagementFeedbackDetailPage').then((m) => ({ default: m.ManagementFeedbackDetailPage })));
const ConversationQueuePage = lazy(() => import('../pages/staff/ConversationQueuePage').then((m) => ({ default: m.default })));
const CoordinatorDirectoryPage = lazy(() => import('../pages/staff/CoordinatorDirectoryPage').then((m) => ({ default: m.default })));
const CoordinatorDetailPage = lazy(() => import('../pages/staff/CoordinatorDetailPage').then((m) => ({ default: m.default })));
const ManagementCoordinatorDirectoryPage = lazy(() => import('../pages/management/CoordinatorDirectoryPage').then((m) => ({ default: m.default })));
const ManagementCoordinatorCreatePage = lazy(() => import('../pages/management/CoordinatorCreatePage').then((m) => ({ default: m.default })));
const ManagementCoordinatorDetailPage = lazy(() => import('../pages/management/CoordinatorDetailPage').then((m) => ({ default: m.default })));
const RequestInfoWorkspacePage = lazy(() => import('../pages/staff/RequestInfoWorkspacePage').then((m) => ({ default: m.RequestInfoWorkspacePage })));
const AssignmentHistoryPage = lazy(() => import('../pages/staff/AssignmentHistoryPage').then((m) => ({ default: m.AssignmentHistoryPage })));
const AreaAlertManagementPage = lazy(() => import('../pages/staff/AreaAlertManagementPage').then((m) => ({ default: m.default })));
const AreaAlertCreatePage = lazy(() => import('../pages/staff/AreaAlertCreatePage').then((m) => ({ default: m.default })));

const ProviderCandidateCheckerPage = lazy(() => import('../pages/staff/ProviderCandidateCheckerPage').then((m) => ({ default: m.default })));

const HelperWorkspacePage = lazy(() => import('../pages/community/HelperWorkspacePage').then((m) => ({ default: m.HelperWorkspacePage })));

const SLAAnalytics = lazy(() => import('../pages/analytics/SLAAnalytics').then((m) => ({ default: m.SLAAnalytics })));
const SentimentDashboard = lazy(() => import('../pages/analytics/SentimentDashboard').then((m) => ({ default: m.SentimentDashboard })));
const SentimentNegativeListPage = lazy(() => import('../pages/analytics/SentimentNegativeListPage').then((m) => ({ default: m.SentimentNegativeListPage })));
const HeatmapDashboard = lazy(() => import('../pages/analytics/HeatmapDashboard').then((m) => ({ default: m.HeatmapDashboard })));
const InteractionHistoryMonitoring = lazy(() => import('../pages/analytics/InteractionHistoryMonitoring').then((m) => ({ default: m.InteractionHistoryMonitoring })));
const InteractionApprovalInboxPage = lazy(() => import('../pages/manager/InteractionApprovalInboxPage').then((m) => ({ default: m.InteractionApprovalInboxPage })));
const ManagerReportReviewQueuePage = lazy(() => import('../pages/manager/ManagerReportReviewQueuePage').then((m) => ({ default: m.ManagerReportReviewQueuePage })));
const ManagerReportReviewDetailPage = lazy(() => import('../pages/manager/ManagerReportReviewDetailPage').then((m) => ({ default: m.ManagerReportReviewDetailPage })));
const ManagerIncidentListPage = lazy(() => import('../pages/manager/ManagerIncidentListPage').then((m) => ({ default: m.ManagerIncidentListPage })));
const ManagerIncidentDetailPage = lazy(() => import('../pages/manager/ManagerIncidentDetailPage').then((m) => ({ default: m.ManagerIncidentDetailPage })));

const UserManagement = lazy(() => import('../pages/management/UserManagement').then((m) => ({ default: m.UserManagement })));
const FeedbackManagement = lazy(() => import('../pages/management/FeedbackManagement').then((m) => ({ default: m.FeedbackManagement })));
const FeedbackDetailPage = lazy(() => import('../pages/management/FeedbackDetailPage').then((m) => ({ default: m.FeedbackDetailPage })));
const AdminIncidentMapPage = lazy(() => import('../pages/management/AdminIncidentMapPage').then((m) => ({ default: m.AdminIncidentMapPage })));
const CategoryManagement = lazy(() => import('../pages/management/CategoryManagement').then((m) => ({ default: m.CategoryManagement })));
const SLAConfiguration = lazy(() => import('../pages/management/SLAConfiguration').then((m) => ({ default: m.SLAConfiguration })));
const StaffResponsibilityManagement = lazy(() => import('../pages/management/StaffResponsibilityManagement').then((m) => ({ default: m.StaffResponsibilityManagement })));

const RouteFallback = ({ isAuthenticated = false }) => {
  const location = useLocation();
  const isPublicRoute = (
    location.pathname === '/' ||
    location.pathname.startsWith('/community/')
  );

  if (isPublicRoute && !isAuthenticated) {
    return (
      <PublicLayout>
        <main className="relative isolate min-h-[calc(100vh-8rem)] overflow-hidden px-4 py-10 sm:px-6 lg:px-8">
          <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
            <div className="absolute left-[8%] top-14 h-64 w-64 rounded-full bg-blue-300/20 blur-3xl dark:bg-blue-500/10" />
            <div className="absolute right-[8%] top-24 h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl dark:bg-cyan-500/10" />
          </div>
          <div className="public-loading-surface mx-auto w-full max-w-[1380px] overflow-hidden rounded-[30px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.1)] sm:p-8 dark:border-white/10 dark:bg-[#0a182d]/92">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 animate-pulse rounded-2xl bg-blue-100 dark:bg-blue-500/15" />
              <div className="space-y-2">
                <div className="h-4 w-40 animate-pulse rounded-full bg-slate-200 dark:bg-white/10" />
                <div className="h-3 w-24 animate-pulse rounded-full bg-slate-100 dark:bg-white/[0.07]" />
              </div>
            </div>
            <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
              <div className="h-[360px] animate-pulse rounded-[24px] bg-slate-100 dark:bg-white/[0.055]" />
              <div className="space-y-4">
                <div className="h-24 animate-pulse rounded-[22px] bg-slate-100 dark:bg-white/[0.055]" />
                <div className="h-24 animate-pulse rounded-[22px] bg-slate-100 dark:bg-white/[0.055]" />
                <div className="h-24 animate-pulse rounded-[22px] bg-slate-100 dark:bg-white/[0.055]" />
              </div>
            </div>
            <div className="mt-6 flex items-center justify-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-300">
              <span className="loading loading-spinner loading-sm text-blue-600" />
              Đang chuẩn bị nội dung công khai
            </div>
          </div>
        </main>
      </PublicLayout>
    );
  }

  return (
    <div className="min-h-[calc(100vh-12rem)] flex items-center justify-center p-6">
      <div className="w-full max-w-4xl space-y-6 rounded-3xl bg-white border border-slate-200 p-6 shadow-sm">
        <div className="h-6 w-1/3 rounded-full bg-slate-100 animate-pulse" />
        <LoadingSkeleton rows={5} className="space-y-3" />
      </div>
    </div>
  );
};


const LoginRoute = ({ isAuthenticated, fallbackPath }) => {
  const location = useLocation();
  const [searchParams] = useSearchParams();

  if (!isAuthenticated) return <LoginPage />;

  const redirect = (
    getSafeInternalPath(searchParams.get('redirect')) ||
    getSafeInternalPath(location.state?.from) ||
    fallbackPath
  );

  return <Navigate to={redirect} replace />;
};

const VerifyPhoneRoute = ({ isAuthenticated }) => {
  const location = useLocation();
  const [searchParams] = useSearchParams();

  if (isAuthenticated) return <VerifyPhonePage />;

  const redirect = (
    getSafeInternalPath(searchParams.get('redirect')) ||
    getSafeInternalPath(location.state?.from)
  );

  return <Navigate to={buildAuthPath('/login', redirect)} replace />;
};

const SystemStaffLegacyRouteRedirect = () => {
  const { pathname } = useLocation();
  const destination = getSystemStaffLegacyRouteRedirect(pathname) || '/dashboard';

  return <Navigate to={destination} replace />;
};

export const AppRoutes = () => {
  const { isAuthenticated, user } = useAuth();
  const currentRole = normalizeRole(user?.role);
  const roleEntryPath = getRoleEntryPath(currentRole);
  // Chưa xác thực số điện thoại vẫn vào bình thường; ràng buộc chỉ áp khi gửi
  // phản ánh, nên đăng nhập xong không đẩy họ sang trang xác thực nữa.
  const authRedirect = roleEntryPath;
  const isCitizen = currentRole === APP_ROLES.SERVICE_USER;
  const renderCommunityPage = (page) => (
    isAuthenticated ? (
      <DashboardLayout>{page}</DashboardLayout>
    ) : (
      <PublicLayout className="public-community-shell">
        <div className="public-community-content mx-auto w-full max-w-[1440px] px-4 py-7 sm:px-6 lg:px-8 lg:py-9">
          {page}
        </div>
      </PublicLayout>
    )
  );

  return (
    <Suspense fallback={<RouteFallback isAuthenticated={isAuthenticated} />}>
      <Routes>
      {/* Public Pages */}
      <Route
        path="/"
        element={
          !isAuthenticated ? (
            <LandingPage />
          ) : isCitizen ? (
            <LandingPage />
          ) : (
            <Navigate to={roleEntryPath} replace />
          )
        }
      />
      <Route
        path="/login"
        element={
          <LoginRoute
            isAuthenticated={isAuthenticated}
            fallbackPath={authRedirect}
          />
        }
      />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-phone" element={<VerifyPhoneRoute isAuthenticated={isAuthenticated} />} />
      <Route path="/messenger/link" element={<MessengerAccountLinkPage />} />

      {/* Protected Pages (All Auth Roles) */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          {isCitizen ? (
            <Navigate to="/" replace />
          ) : (
            <DashboardLayout>
              {currentRole === APP_ROLES.SYSTEM_STAFF
                ? <StaffIncidentDashboardPage />
                : <Dashboard />}
            </DashboardLayout>
          )}
        </ProtectedRoute>
      } />
      <Route path="/tickets" element={
        <ProtectedRoute>
          <DashboardLayout>
            <TicketListPage />
          </DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/tickets/create" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={[APP_ROLES.SERVICE_USER]}>
            <DashboardLayout>
              <CreateTicketPage />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/tickets/:id" element={
        <ProtectedRoute>
          <DashboardLayout>
            <TicketDetailPage />
          </DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/tickets/:feedbackId/result" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={[APP_ROLES.SERVICE_USER]}>
            <DashboardLayout>
              <ResolutionResultPage />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/tickets/:feedbackId/rework" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={[APP_ROLES.SERVICE_USER]}>
            <DashboardLayout>
              <ReworkCenterPage />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/tickets/archive" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={[APP_ROLES.SERVICE_USER]}>
            <DashboardLayout>
              <ClosedFeedbackArchivePage />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route
        path="/community/feed"
        element={renderCommunityPage(<CommunityFeedPage />)}
      />
      <Route
        path="/community/feed/:id"
        element={renderCommunityPage(<CommunityFeedbackDetailPage />)}
      />
      <Route
        path="/community/map"
        element={renderCommunityPage(<CommunityMapPage />)}
      />
      <Route path="/notifications" element={
        <ProtectedRoute>
          <DashboardLayout>
            <NotificationCenterPage />
          </DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/profile" element={
        <ProtectedRoute>
          <DashboardLayout>
            <ProfilePage />
          </DashboardLayout>
        </ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute>
          {currentRole === APP_ROLES.SYSTEM_STAFF ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <DashboardLayout>
              <SettingsPage />
            </DashboardLayout>
          )}
        </ProtectedRoute>
      } />
      <Route path="/area-alerts" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={[APP_ROLES.SERVICE_USER]}>
            <DashboardLayout>
              <ResidentAreaAlertsPage />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />

      {/* System Staff Routes */}
      <Route path="/staff/incidents" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={[APP_ROLES.SYSTEM_STAFF]}>
            <DashboardLayout>
              <StaffIncidentListPage />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/staff/incidents/:incidentId" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={[APP_ROLES.SYSTEM_STAFF]}>
            <DashboardLayout>
              <StaffIncidentDetailPage />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/staff/queue" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={[APP_ROLES.SYSTEM_STAFF]}>
            <SystemStaffLegacyRouteRedirect />
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/staff/feedbacks" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={[APP_ROLES.SYSTEM_STAFF]}>
            <DashboardLayout>
              <ManagementFeedbackListPage />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/staff/feedbacks/:feedbackId" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={[APP_ROLES.SYSTEM_STAFF]}>
            <DashboardLayout>
              <ManagementFeedbackDetailPage />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/staff/assignment-history" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={[APP_ROLES.SYSTEM_STAFF]}>
            <DashboardLayout>
              <AssignmentHistoryPage />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/staff/conversations" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={[APP_ROLES.SYSTEM_STAFF]}>
            <DashboardLayout>
              <ConversationQueuePage />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/staff/feedbacks/:feedbackId/request-info" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={[APP_ROLES.SYSTEM_STAFF]}>
            <DashboardLayout>
              <RequestInfoWorkspacePage />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/staff/feedbacks/:feedbackId/history" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={[APP_ROLES.SYSTEM_STAFF]}>
            <DashboardLayout>
              <AssignmentHistoryPage />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/staff/area-alerts" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={[APP_ROLES.SYSTEM_STAFF]}>
            <DashboardLayout>
              <AreaAlertManagementPage />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/staff/area-alerts/create" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={[APP_ROLES.SYSTEM_STAFF]}>
            <DashboardLayout>
              <AreaAlertCreatePage />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/staff/provider-reports/:providerReportId" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={[APP_ROLES.SYSTEM_STAFF]}>
            <SystemStaffLegacyRouteRedirect />
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/staff/duplicates" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={[APP_ROLES.SYSTEM_STAFF]}>
            <SystemStaffLegacyRouteRedirect />
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/staff/coordinators" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={[APP_ROLES.SYSTEM_STAFF, APP_ROLES.ADMINISTRATOR, APP_ROLES.INTERACTION_MANAGER]}>
            <DashboardLayout>
              <CoordinatorDirectoryPage />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/staff/provider-candidates-checker" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={[APP_ROLES.SYSTEM_STAFF, APP_ROLES.ADMINISTRATOR, APP_ROLES.INTERACTION_MANAGER]}>
            {currentRole === APP_ROLES.SYSTEM_STAFF ? (
              <SystemStaffLegacyRouteRedirect />
            ) : (
              <DashboardLayout>
                <ProviderCandidateCheckerPage />
              </DashboardLayout>
            )}
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/staff/coordinators/:coordinatorId" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={[APP_ROLES.SYSTEM_STAFF, APP_ROLES.ADMINISTRATOR, APP_ROLES.INTERACTION_MANAGER]}>
            <DashboardLayout>
              <CoordinatorDetailPage />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/staff/duplicates/:duplicateCandidateId" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={[APP_ROLES.SYSTEM_STAFF]}>
            <SystemStaffLegacyRouteRedirect />
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/tickets/assign/:id" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={[APP_ROLES.SYSTEM_STAFF]}>
            <SystemStaffLegacyRouteRedirect />
          </RoleGuard>
        </ProtectedRoute>
      } />

      {/* Service Provider (Operator) Routes */}
      <Route path="/provider/tasks" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={[APP_ROLES.SERVICE_PROVIDER]}>
            <DashboardLayout>
              <HelperWorkspacePage />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />

      {/* Interaction Manager Routes */}
      <Route path="/manager/review" element={<Navigate to="/manager/reports/review" replace />} />
      <Route path="/manager/duplicates" element={<Navigate to="/manager/incident-matches" replace />} />
      <Route path="/manager/incident-matches" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={[APP_ROLES.INTERACTION_MANAGER]}>
            <DashboardLayout>
              <IncidentMatchListPage />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/manager/incident-matches/:duplicateCandidateId" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={[APP_ROLES.INTERACTION_MANAGER]}>
            <DashboardLayout>
              <IncidentMatchDetailPage />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/manager/reports/review" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={[APP_ROLES.INTERACTION_MANAGER]}>
            <DashboardLayout>
              <ManagerReportReviewQueuePage />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/manager/reports/review/:feedbackId" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={[APP_ROLES.INTERACTION_MANAGER]}>
            <DashboardLayout>
              <ManagerReportReviewDetailPage />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/manager/incidents" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={[APP_ROLES.INTERACTION_MANAGER]}>
            <DashboardLayout>
              <ManagerIncidentListPage />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/manager/incidents/:incidentId" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={[APP_ROLES.INTERACTION_MANAGER]}>
            <DashboardLayout>
              <ManagerIncidentDetailPage />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/management/incidents" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={[APP_ROLES.ADMINISTRATOR]}>
            <DashboardLayout>
              <ManagerIncidentListPage />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/management/incidents/:incidentId" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={[APP_ROLES.ADMINISTRATOR]}>
            <DashboardLayout>
              <ManagerIncidentDetailPage />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/manager/interactions" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={[APP_ROLES.INTERACTION_MANAGER]}>
            <DashboardLayout>
              <InteractionHistoryMonitoring />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/manager/map" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={[APP_ROLES.INTERACTION_MANAGER]}>
            <Navigate to="/analytics/heatmap" replace />
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/manager/interactions/:feedbackId" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={[APP_ROLES.INTERACTION_MANAGER]}>
            <DashboardLayout>
              <FeedbackDetailPage />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/manager/approvals" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={[APP_ROLES.INTERACTION_MANAGER]}>
            <DashboardLayout>
              <InteractionApprovalInboxPage />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/manager/approvals/:incidentId" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={[APP_ROLES.INTERACTION_MANAGER]}>
            <DashboardLayout>
              <ManagerIncidentDetailPage />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/analytics/sla" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={[APP_ROLES.INTERACTION_MANAGER, APP_ROLES.ADMINISTRATOR]}>
            <DashboardLayout>
              <SLAAnalytics />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/analytics/sentiment" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={[APP_ROLES.INTERACTION_MANAGER, APP_ROLES.ADMINISTRATOR]}>
            <DashboardLayout>
              <SentimentDashboard />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/analytics/sentiment/negative" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={[APP_ROLES.INTERACTION_MANAGER, APP_ROLES.ADMINISTRATOR]}>
            <DashboardLayout>
              <SentimentNegativeListPage />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/analytics/heatmap" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={[APP_ROLES.INTERACTION_MANAGER, APP_ROLES.ADMINISTRATOR]}>
            <DashboardLayout>
              <HeatmapDashboard />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />

      {/* Administrator Configuration Routes */}
      <Route path="/management/users" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={[APP_ROLES.ADMINISTRATOR]}>
            <DashboardLayout>
              <UserManagement />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/management/feedbacks" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={[APP_ROLES.ADMINISTRATOR]}>
            <DashboardLayout>
              <FeedbackManagement />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/management/staff-responsibilities" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={[APP_ROLES.ADMINISTRATOR]}>
            <DashboardLayout>
              <StaffResponsibilityManagement />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/management/feedbacks/:feedbackId" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={[APP_ROLES.ADMINISTRATOR]}>
            <DashboardLayout>
              <FeedbackDetailPage />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/management/map" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={[APP_ROLES.ADMINISTRATOR]}>
            <DashboardLayout>
              <AdminIncidentMapPage mode="admin" />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/management/coordinators" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={[APP_ROLES.ADMINISTRATOR, APP_ROLES.INTERACTION_MANAGER]}>
            <DashboardLayout>
              <ManagementCoordinatorDirectoryPage />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/management/coordinators/new" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={[APP_ROLES.ADMINISTRATOR, APP_ROLES.INTERACTION_MANAGER]}>
            <DashboardLayout>
              <ManagementCoordinatorCreatePage />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/management/coordinators/:coordinatorId" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={[APP_ROLES.ADMINISTRATOR, APP_ROLES.INTERACTION_MANAGER]}>
            <DashboardLayout>
              <ManagementCoordinatorDetailPage />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/management/categories" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={[APP_ROLES.ADMINISTRATOR]}>
            <DashboardLayout>
              <CategoryManagement />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/management/sla" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={[APP_ROLES.ADMINISTRATOR]}>
            <DashboardLayout>
              <SLAConfiguration />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/management/integrations" element={<Navigate to="/dashboard" replace />} />
      <Route path="/admin/audit" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={[APP_ROLES.ADMINISTRATOR]}>
            <Navigate to="/dashboard" replace />
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/admin/performance" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={[APP_ROLES.ADMINISTRATOR]}>
            <Navigate to="/dashboard" replace />
          </RoleGuard>
        </ProtectedRoute>
      } />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </Suspense>
  );
};




