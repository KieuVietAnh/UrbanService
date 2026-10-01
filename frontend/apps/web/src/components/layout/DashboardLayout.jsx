// src/components/layout/DashboardLayout.jsx
import { useLayoutEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { FeedbackMessagesProvider } from '../../contexts/FeedbackMessagesContext';

import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Footer } from './Footer';
import PageTransition from '../motion/PageTransition';
import { PublicThemeStyles } from '../public/PublicLayout';
import CitizenAiCopilot from '../public/CitizenAiCopilot';
import { APP_ROLES } from '@urbanmind/shared-types';
import { normalizeRole } from '../../utils/roleMap';
import { useAuth } from '../../contexts/AuthContext';

export const DashboardLayout = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();

  const isCitizen =
    normalizeRole(user?.role) === APP_ROLES.SERVICE_USER;

  const isCommunityFeedListRoute =
    isCitizen && location.pathname === '/community/feed';

  const isCommunityFeedDetailRoute =
    isCitizen && /^\/community\/feed\/[^/]+\/?$/.test(location.pathname);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const mainScrollRef = useRef(null);

  useLayoutEffect(() => {
    const scrollContainer = mainScrollRef.current;

    if (!scrollContainer || typeof window === 'undefined') {
      return undefined;
    }

    // Trang danh sách sẽ tự khôi phục đúng card khi quay lại từ chi tiết.
    // Không reset vùng cuộn dùng chung trong trường hợp này để tránh ghi đè vị trí.
    const preserveScrollOnEnter =
      location.state?.restoreFeedbackId ||
      location.state?.restoreTicketId ||
      location.state?.restoreCoordinatorList ||
      location.state?.focusMap ||
      location.state?.focusFeedbackId ||
      location.state?.mapState?.focusMap ||
      location.state?.mapState?.focusFeedbackId ||
      location.state?.preserveScroll;

    if (preserveScrollOnEnter) {
      return undefined;
    }

    const rawHash = String(location.hash || '').replace(/^#/, '');
    let targetId = '';

    if (rawHash) {
      try {
        targetId = decodeURIComponent(rawHash);
      } catch {
        targetId = rawHash;
      }
    }

    let userInteracted = false;
    let frameId = null;
    const timerIds = [];

    const cancelPendingScrollCorrections = () => {
      if (userInteracted) return;
      userInteracted = true;

      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      timerIds.forEach((timerId) => {
        window.clearTimeout(timerId);
      });
    };

    const handleNavigationKey = (event) => {
      if (
        ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ']
          .includes(event.key)
      ) {
        cancelPendingScrollCorrections();
      }
    };

    const scrollToTop = () => {
      if (userInteracted) return;

      scrollContainer.scrollTo({
        top: 0,
        left: 0,
        behavior: 'auto',
      });
    };

    const scrollToTarget = () => {
      if (userInteracted) return;

      if (!targetId) {
        // Route navigation only needs to establish the initial top position.
        // Never pull the user back after they start interacting with the page.
        scrollToTop();
        return;
      }

      const target = document.getElementById(targetId);

      if (!target) {
        scrollToTop();
        return;
      }

      const containerRect = scrollContainer.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();

      const targetTop =
        scrollContainer.scrollTop +
        targetRect.top -
        containerRect.top -
        12;

      scrollContainer.scrollTo({
        top: Math.max(0, targetTop),
        left: 0,
        behavior: 'auto',
      });
    };

    // Reset immediately. Delayed corrections are only allowed while the user has
    // not started scrolling/clicking/typing navigation keys on the new page.
    scrollToTop();

    scrollContainer.addEventListener('wheel', cancelPendingScrollCorrections, { passive: true });
    scrollContainer.addEventListener('touchstart', cancelPendingScrollCorrections, { passive: true });
    scrollContainer.addEventListener('pointerdown', cancelPendingScrollCorrections, { passive: true });
    scrollContainer.addEventListener('keydown', handleNavigationKey);

    frameId = window.requestAnimationFrame(scrollToTarget);

    [120, 280, 520].forEach((delay) => {
      timerIds.push(window.setTimeout(scrollToTarget, delay));
    });

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      timerIds.forEach((timerId) => {
        window.clearTimeout(timerId);
      });

      scrollContainer.removeEventListener('wheel', cancelPendingScrollCorrections);
      scrollContainer.removeEventListener('touchstart', cancelPendingScrollCorrections);
      scrollContainer.removeEventListener('pointerdown', cancelPendingScrollCorrections);
      scrollContainer.removeEventListener('keydown', handleNavigationKey);
    };
  }, [
    location.hash,
    location.pathname,
    location.state?.restoreFeedbackId,
    location.state?.restoreTicketId,
    location.state?.restoreCoordinatorList,
    location.state?.focusMap,
    location.state?.focusFeedbackId,
    location.state?.mapState?.focusMap,
    location.state?.mapState?.focusFeedbackId,
    location.state?.preserveScroll,
  ]);

  const toggleSidebar = () => {
    setSidebarOpen((current) => !current);
  };

  const showFooter = isCitizen;

  const isStaffFeedbackDetailRoute =
    /^\/staff\/feedbacks\/[^/]+\/?$/.test(location.pathname);

  const isStaffAssignmentRoute =
    /^\/tickets\/assign\/[^/]+\/?$/.test(location.pathname);

  const staffDetailFeedbackId = isStaffFeedbackDetailRoute
    ? location.pathname.split('/').filter(Boolean).pop()
    : null;

  const shouldWrapFeedbackMessages =
    isStaffFeedbackDetailRoute && Boolean(staffDetailFeedbackId);

  const renderMainContent = () => (
    <main
      ref={mainScrollRef}
      data-dashboard-scroll-container
      className={`min-h-0 flex-1 overflow-y-scroll overflow-x-hidden ${
        isCommunityFeedListRoute
          ? 'community-feed-main-surface'
          : isCommunityFeedDetailRoute
            ? 'community-detail-main-surface'
            : ''
      } ${
        isCitizen
          ? 'bg-transparent'
          : isStaffAssignmentRoute
            ? 'staff-assignment-workspace bg-transparent dark:bg-slate-950'
            : 'bg-slate-50 dark:bg-slate-950'
      }`}
    >
      <div className="flex min-h-full flex-col">
        <PageTransition
          key={location.pathname}
          className={`mx-auto w-full flex-1 ${
            isCitizen
              ? 'citizen-content-shell max-w-[1440px] px-4 py-7 sm:px-6 lg:px-8 lg:py-9'
              : 'max-w-7xl space-y-6 p-5 sm:p-6'
          }`}
        >
          {children}
        </PageTransition>

        {showFooter ? <Footer /> : null}
      </div>
    </main>
  );

  return (
    <div
      className={`flex h-screen w-full flex-col overflow-hidden font-sans ${
        isCitizen
          ? `public-page citizen-dashboard-shell ${
              isCommunityFeedListRoute
                ? 'community-feed-app-shell'
                : isCommunityFeedDetailRoute
                  ? 'community-detail-app-shell'
                  : ''
            } text-[var(--public-title)]`
          : 'bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100'
      }`}
    >
      {isCitizen ? <PublicThemeStyles /> : null}
      {isCitizen ? <CitizenAiCopilot /> : null}

      <div className="flex h-screen w-full overflow-hidden">
        {/* Sidebar navigation */}
        {!isCitizen && (
          <Sidebar
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
        )}

        {/* Main container */}
        <div
          className={`flex min-w-0 w-full flex-1 flex-col overflow-hidden ${
            isCitizen
              ? 'bg-transparent'
              : isStaffAssignmentRoute
                ? 'bg-transparent dark:bg-slate-950'
                : 'bg-slate-50 dark:bg-slate-950'
          }`}
        >
          <Header onMenuToggle={toggleSidebar} />

          {/* Main scrollable workspace */}
          {shouldWrapFeedbackMessages ? (
            <FeedbackMessagesProvider feedbackId={staffDetailFeedbackId}>
              {renderMainContent()}
            </FeedbackMessagesProvider>
          ) : (
            renderMainContent()
          )}
        </div>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
        />
      )}
    </div>
  );
};