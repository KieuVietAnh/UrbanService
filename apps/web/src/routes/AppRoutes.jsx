// src/routes/AppRoutes.jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ProtectedRoute } from '../guards/ProtectedRoute';
import { RoleGuard } from '../guards/RoleGuard';
import { DashboardLayout } from '../components/layout/DashboardLayout';

// Pages
import { LandingPage } from '../pages/LandingPage';
import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';
import { VerifyEmailPage } from '../pages/auth/VerifyEmailPage';
import { Dashboard } from '../pages/dashboard/Dashboard';
import { TicketListPage } from '../pages/tickets/TicketListPage';
import { CreateTicketPage } from '../pages/tickets/CreateTicketPage';
import { TicketDetailPage } from '../pages/tickets/TicketDetailPage';
import { CommunityFeedPage } from '../pages/community/CommunityFeedPage';
import { CommunityMapPage } from '../pages/community/CommunityMapPage';
import { ProfilePage } from '../pages/profile/ProfilePage';
import { SettingsPage } from '../pages/settings/SettingsPage';

// Staff Specific Pages
import { AIReviewDetail } from '../pages/tickets/AIReviewDetail';
import { DuplicateDetection } from '../pages/tickets/DuplicateDetection';
import { TicketAssignment } from '../pages/tickets/TicketAssignment';
import { CompletedTicketReview } from '../pages/tickets/CompletedTicketReview';

// Service Provider (Operator) Page
import { HelperWorkspacePage } from '../pages/community/HelperWorkspacePage';

// Analytics & Manager Pages
import { SLAAnalytics } from '../pages/analytics/SLAAnalytics';
import { SentimentDashboard } from '../pages/analytics/SentimentDashboard';
import { HeatmapDashboard } from '../pages/analytics/HeatmapDashboard';
import { AboutPage } from '../pages/AboutPage';
import { InteractionHistoryMonitoring } from '../pages/analytics/InteractionHistoryMonitoring';

// Administrator Configuration Pages
import { UserManagement } from '../pages/management/UserManagement';
import { RoleManagement } from '../pages/management/RoleManagement';
import { CategoryManagement } from '../pages/management/CategoryManagement';
import { SLAConfiguration } from '../pages/management/SLAConfiguration';
import { IntegrationSettings } from '../pages/management/IntegrationSettings';
import { AuditLog } from '../pages/admin/AuditLog';
import { PerformanceDashboard } from '../pages/admin/PerformanceDashboard';

export const AppRoutes = () => {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      {/* Public Pages */}
      <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/about" element={<AboutPage />} />

      {/* Protected Pages (All Auth Roles) */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <DashboardLayout>
            <Dashboard />
          </DashboardLayout>
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
          <RoleGuard allowedRoles={['service-user']}>
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
      <Route path="/community/feed" element={
          <DashboardLayout>
            <CommunityFeedPage />
          </DashboardLayout>
      } />
      <Route path="/community/map" element={
        <ProtectedRoute>
          <DashboardLayout>
            <CommunityMapPage />
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
          <DashboardLayout>
            <SettingsPage />
          </DashboardLayout>
        </ProtectedRoute>
      } />

      {/* System Staff Routes */}
      <Route path="/staff/queue" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={['system-staff']}>
            <DashboardLayout>
              <AIReviewDetail />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/staff/duplicates" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={['system-staff']}>
            <DashboardLayout>
              <DuplicateDetection />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/staff/review" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={['system-staff']}>
            <DashboardLayout>
              <CompletedTicketReview />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/tickets/assign/:id" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={['system-staff']}>
            <DashboardLayout>
              <TicketAssignment />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />

      {/* Service Provider (Operator) Routes */}
      <Route path="/provider/tasks" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={['service-provider']}>
            <DashboardLayout>
              <HelperWorkspacePage />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />

      {/* Interaction Manager Routes */}
      <Route path="/manager/interactions" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={['interaction-manager']}>
            <DashboardLayout>
              <InteractionHistoryMonitoring />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/analytics/sla" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={['interaction-manager', 'administrator']}>
            <DashboardLayout>
              <SLAAnalytics />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/analytics/sentiment" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={['interaction-manager', 'administrator']}>
            <DashboardLayout>
              <SentimentDashboard />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/analytics/heatmap" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={['interaction-manager', 'administrator']}>
            <DashboardLayout>
              <HeatmapDashboard />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />

      {/* Administrator Configuration Routes */}
      <Route path="/management/users" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={['administrator']}>
            <DashboardLayout>
              <UserManagement />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/management/roles" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={['administrator']}>
            <DashboardLayout>
              <RoleManagement />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/management/categories" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={['administrator']}>
            <DashboardLayout>
              <CategoryManagement />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/management/sla" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={['administrator']}>
            <DashboardLayout>
              <SLAConfiguration />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/management/integrations" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={['administrator']}>
            <DashboardLayout>
              <IntegrationSettings />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/admin/audit" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={['administrator']}>
            <DashboardLayout>
              <AuditLog />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />
      <Route path="/admin/performance" element={
        <ProtectedRoute>
          <RoleGuard allowedRoles={['administrator']}>
            <DashboardLayout>
              <PerformanceDashboard />
            </DashboardLayout>
          </RoleGuard>
        </ProtectedRoute>
      } />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
