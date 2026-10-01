import { useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import CommunityFeed from '../../components/community/CommunityFeed';
import PublicPageMotion from '../../components/public/PublicPageMotion';

const COMMUNITY_RETURN_STORAGE_KEY = 'urbanmind-community-feed-return';

const CommunityFeedThemeStyles = () => (
  <style>{`
    html:not([data-theme="dark"]) .community-feed-page {
      --public-surface: #ffffff;
      --public-surface-soft: #f8fafc;
      --public-surface-strong: #ffffff;
      --public-border: rgba(203, 213, 225, 0.88);
      --public-border-soft: rgba(226, 232, 240, 0.96);
      --public-copy: #52647b;
      --public-muted: #76879c;
      --public-shadow: 0 18px 44px rgba(15, 23, 42, 0.07);
    }

  `}</style>
);

export const CommunityFeedPage = () => {
  const rootRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const resetFeedScroll = Boolean(location.state?.resetFeedScroll);
  const initialQuery = typeof location.state?.initialQuery === 'string'
    ? location.state.initialQuery
    : '';

  useLayoutEffect(() => {
    if (!resetFeedScroll) return;

    try {
      window.sessionStorage.removeItem(COMMUNITY_RETURN_STORAGE_KEY);
    } catch {
      // Session storage can be unavailable in private mode.
    }

    const scrollContainer = document.querySelector(
      '[data-dashboard-scroll-container]'
    );
    scrollContainer?.scrollTo({ top: 0, left: 0, behavior: 'auto' });

    const frameId = window.requestAnimationFrame(() => {
      scrollContainer?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    });

    navigate(
      `${location.pathname}${location.search}${location.hash}`,
      { replace: true, state: null }
    );

    return () => window.cancelAnimationFrame(frameId);
  }, [
    location.hash,
    location.pathname,
    location.search,
    navigate,
    resetFeedScroll,
  ]);

  return (
    <PublicPageMotion>
      <CommunityFeedThemeStyles />
      <div
        ref={rootRef}
        data-public-reveal
        className="community-feed-page relative isolate text-[var(--public-title)]"
      >
        <CommunityFeed
          resetScroll={resetFeedScroll}
          initialQuery={initialQuery}
        />
      </div>
    </PublicPageMotion>
  );
};
