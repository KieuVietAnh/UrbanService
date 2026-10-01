import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import * as Lucide from 'lucide-react';
import { normalizeTicketsResponse } from '@urbanmind/shared-api';
import { getAttachmentUrl } from '@urbanmind/shared-utils';
import { ErrorAlert } from '../../components/alerts/ErrorAlert';
import {
  getCommunityFeed,
  getCommunityFeedPreview,
  getCommunityIncidentEngagementState,
  subscribeCommunityIncidentEngagement,
} from '../../services/api/feedApi';
import { signalrService } from '../../services/socket/signalrService';
import {
  readCommunityFeedCache,
  writeCommunityFeedCache,
} from '../../services/cache/communityFeedCache';
import CommunityFeedItem from './CommunityFeedItem';
import {
  getCommunityIncidentId,
  isCommunityEndedIncidentStatus,
  isCommunityProcessingIncidentStatus,
  isCommunityPublicIncidentStatus,
} from './communityPresentation.js';
import communityHeroImage from '../../assets/community-hero-option-a.png';

const COMMUNITY_RETURN_STORAGE_KEY = 'urbanmind-community-feed-return';
const COMMUNITY_FEED_PAGE_SIZE = 10;
const COMMUNITY_PREVIEW_CONCURRENCY = 3;
const COMMUNITY_FEED_BACKGROUND_REFRESH_MS = 30 * 1000;
const COMMUNITY_SEARCH_PAGE_SIZE = 50;
const COMMUNITY_SEARCH_DEBOUNCE_MS = 300;

const mapWithConcurrency = async (items, limit, mapper) => {
  const results = new Array(items.length);
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(Math.max(1, limit), items.length) },
      () => worker()
    )
  );

  return results;
};

const readCommunityReturnContext = () => {
  if (typeof window === 'undefined') return null;

  try {
    const rawContext = window.sessionStorage.getItem(
      COMMUNITY_RETURN_STORAGE_KEY
    );
    if (!rawContext) return null;

    const parsedContext = JSON.parse(rawContext);
    return parsedContext && typeof parsedContext === 'object'
      ? parsedContext
      : null;
  } catch (error) {
    console.warn('Không thể đọc vị trí quay lại bảng tin', error);
    return null;
  }
};

const TAB_OPTIONS = [
  { value: 'Latest', label: 'Mới nhất', icon: Lucide.Clock3 },
  { value: 'Trending', label: 'Được quan tâm', icon: Lucide.Flame },
  { value: 'Processing', label: 'Đang xử lý', icon: Lucide.LoaderCircle },
  { value: 'Ended', label: 'Đã xử lý xong', icon: Lucide.CircleCheckBig },
];

const PRIMARY_TAB_OPTIONS = TAB_OPTIONS.filter((option) => option.value !== 'Trending');

const normalizeFeedTab = (value, fallback = 'Latest') => {
  if (value === 'Resolved') return 'Ended';

  return TAB_OPTIONS.some((option) => option.value === value)
    ? value
    : fallback;
};

const getSupportCount = (item) => Number(item?.supportCount ?? item?.supports ?? 0) || 0;

const getCommentCount = (item) => Number(item?.commentCount ?? (Array.isArray(item?.comments) ? item.comments.length : 0)) || 0;

const getSubscriberCount = (item) => Number(item?.subscriberCount ?? item?.subscribersCount ?? 0) || 0;

const getCreatedTimestamp = (item) => {
  const timestamp = new Date(item?.createdAt || item?.createdDate || 0).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const getAreaName = (item) => (
  item?.areaName || item?.wardName || item?.districtName || 'Chưa xác định khu vực'
);


const coalesceIncidentFeedItems = (feedItems = []) => {
  const unique = new Map();

  feedItems.forEach((item) => {
    const incidentId = String(getCommunityIncidentId(item) || '');
    if (!incidentId) return;

    const current = unique.get(incidentId);
    if (!current) {
      unique.set(incidentId, { ...item, incidentId });
      return;
    }

    const currentUpdatedAt = new Date(current?.updatedAt || current?.createdAt || 0).getTime();
    const incomingUpdatedAt = new Date(item?.updatedAt || item?.createdAt || 0).getTime();
    unique.set(incidentId, incomingUpdatedAt >= currentUpdatedAt ? { ...current, ...item, incidentId } : current);
  });

  return [...unique.values()];
};

const filterPublicItems = (feedItems = []) => (
  feedItems.filter((item) => {
    if (item?.isPublic === false) return false;

    const visibility = String(item?.visibility || item?.scope || '').toLowerCase();
    if (visibility === 'private' || visibility === 'internal') return false;

    return isCommunityPublicIncidentStatus(item?.incidentStatus || item?.status);
  })
);

const mergeFeedMediaFromCache = (incomingItems = [], cachedItems = []) => {
  const cachedById = new Map(
    cachedItems
      .map((item) => [String(getCommunityIncidentId(item) || ''), item])
      .filter(([itemId]) => itemId)
  );

  return incomingItems.map((item) => {
    const cachedItem = cachedById.get(String(getCommunityIncidentId(item) || ''));
    if (!cachedItem) return item;

    // Incident media is now authoritative on the Incident DTO. Keep fresh API
    // fields first, while allowing the existing cache to bridge a background
    // refresh that temporarily omits an already-known cover URL.
    const incomingAttachments = Array.isArray(item?.attachments) ? item.attachments : [];
    const cachedAttachments = Array.isArray(cachedItem?.attachments) ? cachedItem.attachments : [];
    const mergedItem = {
      ...cachedItem,
      ...item,
      attachments: incomingAttachments.length > 0 ? incomingAttachments : cachedAttachments,
      coverImageThumbnailUrl: item?.coverImageThumbnailUrl || cachedItem?.coverImageThumbnailUrl || '',
      coverImageUrl: item?.coverImageUrl || cachedItem?.coverImageUrl || '',
      thumbnailUrl: item?.thumbnailUrl || cachedItem?.thumbnailUrl || '',
      imageUrl: item?.imageUrl || cachedItem?.imageUrl || '',
      mediaUrl: item?.mediaUrl || cachedItem?.mediaUrl || '',
      attachmentUrl: item?.attachmentUrl || cachedItem?.attachmentUrl || '',
    };

    return {
      ...mergedItem,
      __mediaState: getPreviewMediaUrl(mergedItem)
        ? 'ready'
        : mergedItem?.__mediaState,
    };
  });
};

const getPreviewMediaUrl = (item) => {
  const attachments = Array.isArray(item?.attachments) ? item.attachments : [];
  const candidate = (
    attachments[0] ||
    item?.coverImageThumbnailUrl ||
    item?.coverImageUrl ||
    item?.thumbnailUrl ||
    item?.imageUrl ||
    item?.image ||
    item?.mediaUrl ||
    item?.attachmentUrl
  );

  const url = getAttachmentUrl(candidate);
  const normalizedUrl = String(url || '').toLowerCase().split('?')[0];
  const looksLikeVideo = ['.mp4', '.webm', '.ogg', '.mov', '.m4v']
    .some((extension) => normalizedUrl.endsWith(extension));

  return looksLikeVideo ? '' : url;
};

const FeedSkeleton = () => (
  <div className="space-y-3" aria-hidden="true">
    {[0, 1, 2].map((item) => (
      <div
        key={item}
        className="public-loading-surface grid min-h-[196px] animate-pulse overflow-hidden rounded-[18px] border border-base-300 bg-base-100 shadow-sm lg:grid-cols-[300px_minmax(0,1fr)]"
      >
        <div className="h-52 bg-base-300/55 lg:h-[196px]" />
        <div className="flex flex-col p-5">
          <div className="h-3 w-44 rounded bg-base-300/55" />
          <div className="mt-3 h-5 w-2/3 rounded bg-base-300/70" />
          <div className="mt-3 h-3 w-full rounded bg-base-300/45" />
          <div className="mt-2 h-3 w-4/5 rounded bg-base-300/40" />
          <div className="mt-auto flex justify-between border-t border-base-300/70 pt-3">
            <div className="h-8 w-24 rounded bg-base-300/45" />
            <div className="h-8 w-24 rounded bg-base-300/40" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

export default function CommunityFeed({
  initialTab = 'Latest',
  initialQuery = '',
  resetScroll = false,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const cacheOwnerKey = (
    user?.userId || user?.id || user?.email || 'service-user'
  );
  const [restoredContext] = useState(() => {
    if (resetScroll) return null;
    const stored = readCommunityReturnContext();
    const restoredIncidentId = (
      location.state?.restoreIncidentId ||
      location.state?.restoreFeedbackId
    );
    return restoredIncidentId
      ? { ...stored, incidentId: restoredIncidentId }
      : stored;
  });
  const restoreContextRef = useRef(restoredContext);
  const [initialCache] = useState(() => (
    readCommunityFeedCache(cacheOwnerKey)
  ));
  const [items, setItems] = useState(() => (
    Array.isArray(initialCache?.items) ? initialCache.items : []
  ));
  const [loading, setLoading] = useState(() => (
    !(Array.isArray(initialCache?.items) && initialCache.items.length > 0)
  ));
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(() => (
    Math.max(
      1,
      Number(restoredContext?.page) ||
      Number(initialCache?.page) ||
      1
    )
  ));
  const [loadedServerPage, setLoadedServerPage] = useState(() => (
    Math.max(0, Number(initialCache?.loadedServerPage) || 0)
  ));
  const [totalPages, setTotalPages] = useState(() => (
    Math.max(1, Number(initialCache?.totalPages) || 1)
  ));
  const [totalItems, setTotalItems] = useState(() => (
    Math.max(0, Number(initialCache?.totalItems) || 0)
  ));
  const [tab, setTab] = useState(() => (
    normalizeFeedTab(
      restoredContext?.tab || initialCache?.tab,
      initialTab
    )
  ));
  const [query, setQuery] = useState(() => {
    if (restoredContext?.query) return restoredContext.query;
    if (resetScroll && initialQuery) return initialQuery;
    return initialCache?.query || initialQuery || '';
  });
  const [searchItems, setSearchItems] = useState([]);
  const [searching, setSearching] = useState(false);
  const searchSessionRef = useRef(0);

  const [highlightedIncidentId, setHighlightedIncidentId] = useState(
    restoredContext?.incidentId || restoredContext?.feedbackId || null
  );
  const [, setEngagementVersion] = useState(0);
  const [error, setError] = useState('');
  const isFetchingRef = useRef(false);
  const hasLoadedSnapshotRef = useRef(
    Array.isArray(initialCache?.items) && initialCache.items.length > 0
  );
  const hasInitializedFiltersRef = useRef(false);
  const isMountedRef = useRef(true);
  const loadSessionRef = useRef(0);
  const filterSectionRef = useRef(null);
  const feedListSectionRef = useRef(null);
  const [scrollRequest, setScrollRequest] = useState({
    id: 0,
    target: 'controls',
  });

  const normalizePageItems = useCallback((rawItems = []) => {
    const publicItems = coalesceIncidentFeedItems(
      filterPublicItems(normalizeTicketsResponse(rawItems))
    );

    return publicItems.map((item) => {
      const hasMedia = Boolean(getPreviewMediaUrl(item));

      if (hasMedia || Number(item?.attachmentCount || 0) <= 0) {
        return {
          ...item,
          __mediaState: hasMedia ? 'ready' : item?.__mediaState,
        };
      }

      return {
        ...item,
        __mediaState: 'loading',
      };
    });
  }, []);

  const requestFeedPage = useCallback(async (
    pageNumber,
    { force = false, search = '' } = {}
  ) => {
    const normalizedSearch = String(search || '').trim();
    const response = await getCommunityFeed(
      {
        PageNumber: pageNumber,
        PageSize: normalizedSearch
          ? COMMUNITY_SEARCH_PAGE_SIZE
          : COMMUNITY_FEED_PAGE_SIZE,
        ...(normalizedSearch ? { Search: normalizedSearch } : {}),
      },
      { force }
    );

    return {
      items: normalizePageItems(response?.items || []),
      pageNumber: Math.max(1, Number(response?.pageNumber) || pageNumber),
      totalPages: Math.max(1, Number(response?.totalPages) || 1),
      totalItems: Math.max(0, Number(response?.totalItems) || 0),
    };
  }, [normalizePageItems]);

  const hydrateFeedPreviews = useCallback(async (feedItems, sessionId) => {
    const candidates = feedItems.filter((item) => (
      item?.attachmentCount > 0 &&
      !getPreviewMediaUrl(item)
    ));

    if (candidates.length === 0) return;

    const results = await mapWithConcurrency(
      candidates,
      COMMUNITY_PREVIEW_CONCURRENCY,
      async (item) => {
        const incidentId = getCommunityIncidentId(item);
        try {
          const preview = await getCommunityFeedPreview(incidentId);
          const attachments = Array.isArray(preview?.attachments)
            ? preview.attachments
            : [];
          const fallbackMedia = (
            preview?.imageUrl ||
            preview?.image ||
            preview?.coverImageThumbnailUrl ||
            preview?.coverImageUrl ||
            preview?.thumbnailUrl ||
            preview?.mediaUrl ||
            preview?.attachmentUrl ||
            ''
          );

          return {
            incidentId,
            patch: {
              attachments,
              description: item?.description || preview?.description,
              imageUrl: item?.imageUrl || preview?.imageUrl,
              coverImageThumbnailUrl: item?.coverImageThumbnailUrl || preview?.coverImageThumbnailUrl,
              coverImageUrl: item?.coverImageUrl || preview?.coverImageUrl,
              thumbnailUrl: item?.thumbnailUrl || preview?.thumbnailUrl,
              __mediaState: attachments.length > 0 || fallbackMedia
                ? 'ready'
                : 'error',
            },
          };
        } catch (previewError) {
          console.warn(
            'Không thể tải minh chứng công khai cho bảng tin',
            incidentId,
            previewError?.message || previewError
          );

          return {
            incidentId,
            patch: {
              __mediaState: 'error',
            },
          };
        }
      }
    );

    if (
      !isMountedRef.current ||
      sessionId !== loadSessionRef.current
    ) {
      return;
    }

    const patchMap = new Map(
      results
        .filter((result) => result?.incidentId)
        .map((result) => [String(result.incidentId), result.patch])
    );

    setItems((currentItems) => currentItems.map((item) => {
      const patch = patchMap.get(String(getCommunityIncidentId(item)));
      return patch ? { ...item, ...patch } : item;
    }));
  }, []);

  useEffect(() => {
    const normalizedSearch = query.trim();
    const sessionId = searchSessionRef.current + 1;
    searchSessionRef.current = sessionId;

    if (!normalizedSearch) {
      setSearchItems([]);
      setSearching(false);
      return undefined;
    }

    setSearching(true);
    setError('');

    const timeoutId = window.setTimeout(async () => {
      try {
        const firstPage = await requestFeedPage(1, {
          search: normalizedSearch,
        });
        const pageResults = [firstPage];

        for (
          let pageNumber = 2;
          pageNumber <= firstPage.totalPages;
          pageNumber += 1
        ) {
          pageResults.push(
            await requestFeedPage(pageNumber, {
              search: normalizedSearch,
            })
          );
        }

        if (
          !isMountedRef.current ||
          sessionId !== searchSessionRef.current
        ) {
          return;
        }

        setSearchItems(
          coalesceIncidentFeedItems(
            pageResults.flatMap((result) => result.items)
          )
        );
      } catch (searchError) {
        if (sessionId !== searchSessionRef.current) return;

        console.error('CommunityFeed search error', searchError);
        setSearchItems([]);
        setError(
          searchError?.response?.data?.message ||
          searchError?.message ||
          'Không thể tìm kiếm trên toàn bộ bảng tin.'
        );
      } finally {
        if (
          isMountedRef.current &&
          sessionId === searchSessionRef.current
        ) {
          setSearching(false);
        }
      }
    }, COMMUNITY_SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [query, requestFeedPage]);

  const loadFeedSnapshot = useCallback(async ({
    background = false,
    force = false,
  } = {}) => {
    if (isFetchingRef.current) return;

    isFetchingRef.current = true;
    setError('');

    const showInitialLoading = (
      !background &&
      !hasLoadedSnapshotRef.current
    );

    if (showInitialLoading) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    const sessionId = loadSessionRef.current + 1;
    loadSessionRef.current = sessionId;

    try {
      const firstPage = await requestFeedPage(1, { force });
      const restoredPage = background
        ? 1
        : Math.max(1, Number(restoreContextRef.current?.page) || 1);
      const targetPage = Math.min(restoredPage, firstPage.totalPages);
      const pageResults = [firstPage];

      for (let pageNumber = 2; pageNumber <= targetPage; pageNumber += 1) {
        pageResults.push(await requestFeedPage(pageNumber, { force }));
      }

      if (
        !isMountedRef.current ||
        sessionId !== loadSessionRef.current
      ) {
        return;
      }

      const cachedSnapshot = readCommunityFeedCache(
        cacheOwnerKey,
        { allowStale: true }
      );
      const mergedItems = mergeFeedMediaFromCache(
        coalesceIncidentFeedItems(
          pageResults.flatMap((result) => result.items)
        ),
        cachedSnapshot?.items || []
      );
      const lastPage = pageResults[pageResults.length - 1] || firstPage;

      setItems(mergedItems);
      setLoadedServerPage(lastPage.pageNumber);
      setTotalPages(firstPage.totalPages);
      setTotalItems(firstPage.totalItems);
      setPage(targetPage);
      hasLoadedSnapshotRef.current = true;

      hydrateFeedPreviews(mergedItems, sessionId);
    } catch (loadError) {
      console.error('CommunityFeed load error', loadError);
      setError(
        loadError?.response?.data?.message ||
        loadError?.message ||
        'Không thể tải bảng tin cộng đồng.'
      );
    } finally {
      if (
        isMountedRef.current &&
        sessionId === loadSessionRef.current
      ) {
        setLoading(false);
        setRefreshing(false);
        isFetchingRef.current = false;
      }
    }
  }, [cacheOwnerKey, hydrateFeedPreviews, requestFeedPage]);

  const loadNextServerPage = useCallback(async () => {
    if (
      isFetchingRef.current ||
      loadedServerPage >= totalPages
    ) {
      return;
    }

    isFetchingRef.current = true;
    setRefreshing(true);
    setError('');

    const sessionId = loadSessionRef.current;
    const nextPageNumber = loadedServerPage + 1;

    try {
      const nextPage = await requestFeedPage(nextPageNumber);

      if (
        !isMountedRef.current ||
        sessionId !== loadSessionRef.current
      ) {
        return;
      }

      setItems((currentItems) => coalesceIncidentFeedItems([
        ...currentItems,
        ...nextPage.items,
      ]));
      setLoadedServerPage(nextPage.pageNumber);
      setTotalPages(nextPage.totalPages);
      setTotalItems(nextPage.totalItems);
      setPage((currentPage) => Math.max(
        currentPage + 1,
        nextPage.pageNumber
      ));

      hydrateFeedPreviews(nextPage.items, sessionId);
    } catch (loadError) {
      console.error('CommunityFeed next page error', loadError);
      setError(
        loadError?.response?.data?.message ||
        loadError?.message ||
        'Không thể tải thêm sự vụ.'
      );
    } finally {
      if (
        isMountedRef.current &&
        sessionId === loadSessionRef.current
      ) {
        setRefreshing(false);
        isFetchingRef.current = false;
      }
    }
  }, [
    hydrateFeedPreviews,
    loadedServerPage,
    requestFeedPage,
    totalPages,
  ]);

  useEffect(() => {
    // React StrictMode mounts, cleans up, then mounts effects again in development.
    // Reset these guards on every effect setup so the second mount can finish.
    isMountedRef.current = true;
    isFetchingRef.current = false;

    const cachedSnapshot = readCommunityFeedCache(cacheOwnerKey);
    const returningFromDetail = Boolean(
      restoreContextRef.current &&
      Array.isArray(cachedSnapshot?.items) &&
      cachedSnapshot.items.length > 0
    );

    if (cachedSnapshot?.items?.length) {
      setItems(cachedSnapshot.items);
      setPage(Math.max(1, Number(cachedSnapshot.page) || 1));
      setLoadedServerPage(
        Math.max(1, Number(cachedSnapshot.loadedServerPage) || 1)
      );
      setTotalPages(Math.max(1, Number(cachedSnapshot.totalPages) || 1));
      setTotalItems(
        Math.max(
          cachedSnapshot.items.length,
          Number(cachedSnapshot.totalItems) || 0
        )
      );
      setLoading(false);
      hasLoadedSnapshotRef.current = true;

      const shouldRefreshInBackground = (
        !returningFromDetail &&
        Date.now() - Number(cachedSnapshot.updatedAt || 0) >=
          COMMUNITY_FEED_BACKGROUND_REFRESH_MS
      );

      if (shouldRefreshInBackground) {
        loadFeedSnapshot({ background: true });
      }
    } else {
      loadFeedSnapshot();
    }

    return () => {
      isMountedRef.current = false;
      isFetchingRef.current = false;
      loadSessionRef.current += 1;
    };
  }, [cacheOwnerKey, loadFeedSnapshot]);

  useEffect(() => {
    if (!hasLoadedSnapshotRef.current || items.length === 0) return;

    writeCommunityFeedCache(cacheOwnerKey, {
      items,
      page,
      loadedServerPage,
      totalPages,
      totalItems,
      tab,
      query,
    });
  }, [
    cacheOwnerKey,
    items,
    loadedServerPage,
    page,
    query,
    tab,
    totalItems,
    totalPages,
  ]);

  useEffect(() => {
    if (!hasInitializedFiltersRef.current) {
      hasInitializedFiltersRef.current = true;
      return;
    }

    setPage(1);
  }, [query, tab]);

  const requestFeedScroll = useCallback((target = 'list') => {
    setScrollRequest((currentRequest) => ({
      id: currentRequest.id + 1,
      target,
    }));
  }, []);

  useEffect(() => {
    if (
      scrollRequest.id === 0 ||
      typeof window === 'undefined'
    ) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      const targetElement = (
        scrollRequest.target === 'controls'
          ? filterSectionRef.current
          : (
              feedListSectionRef.current ||
              filterSectionRef.current
            )
      );

      if (!targetElement) return;

      targetElement.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
        inline: 'nearest',
      });
    }, scrollRequest.target === 'list' ? 100 : 60);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [scrollRequest]);

  const handleFeedTabChange = useCallback((
    nextTab,
    target = 'controls'
  ) => {
    setTab(nextTab);
    requestFeedScroll(target);
  }, [requestFeedScroll]);

  const handleQueryFocus = useCallback(() => {
    requestFeedScroll('controls');
  }, [requestFeedScroll]);

  const handleQueryChange = useCallback((event) => {
    setQuery(event.target.value);
    requestFeedScroll('controls');
  }, [requestFeedScroll]);

  useEffect(() => {
    signalrService.start();

    const refreshIncidentFeed = () => {
      void loadFeedSnapshot({ background: true, force: true });
    };

    const refreshEvents = [
      'FeedbackStatusChanged',
      'AssignmentCreated',
      'AssignmentUpdated',
      'ResolutionSubmitted',
      'ResolutionApproved',
      'ResolutionRejected',
      'IncidentCreated',
      'IncidentUpdated',
      'IncidentStatusChanged',
      'IncidentMerged',
      'ReportLinked',
      'ReportUnlinked',
    ];

    refreshEvents.forEach((eventName) => {
      signalrService.on(eventName, refreshIncidentFeed);
    });

    return () => {
      refreshEvents.forEach((eventName) => {
        signalrService.off(eventName, refreshIncidentFeed);
      });
    };
  }, [loadFeedSnapshot]);

  useEffect(() => {
    const savedContext = restoreContextRef.current;
    if (!savedContext || loading || items.length === 0) return undefined;

    let cancelled = false;
    let retryCount = 0;
    let retryTimer;
    let clearHighlightTimer;

    const consumeReturnContext = () => {
      window.sessionStorage.removeItem(COMMUNITY_RETURN_STORAGE_KEY);
      restoreContextRef.current = null;
    };

    const restorePosition = () => {
      if (cancelled) return;

      const incidentId = String(
        savedContext.incidentId || savedContext.feedbackId || ''
      );
      const escapedIncidentId = (
        typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
          ? CSS.escape(incidentId)
          : incidentId.replace(/["\\]/g, '\\$&')
      );
      const targetRow = escapedIncidentId
        ? document.querySelector(
          `[data-community-incident-id="${escapedIncidentId}"]`
        )
        : null;
      const scrollContainer = document.querySelector(
        '[data-dashboard-scroll-container]'
      );

      if (!targetRow || !scrollContainer) {
        retryCount += 1;
        if (retryCount < 30) {
          retryTimer = window.setTimeout(restorePosition, 100);
          return;
        }

        scrollContainer?.scrollTo({
          top: Number(savedContext.scrollY) || 0,
          left: 0,
          behavior: 'auto',
        });
        consumeReturnContext();
        return;
      }

      window.requestAnimationFrame(() => {
        if (cancelled) return;

        const containerRect = scrollContainer.getBoundingClientRect();
        const rowRect = targetRow.getBoundingClientRect();
        const rowTopInContainer = (
          scrollContainer.scrollTop + rowRect.top - containerRect.top
        );
        const centeredTop = Math.max(
          0,
          rowTopInContainer - Math.max(
            24,
            (scrollContainer.clientHeight - targetRow.offsetHeight) / 2
          )
        );

        scrollContainer.scrollTo({
          top: centeredTop,
          left: 0,
          behavior: 'auto',
        });
        setHighlightedIncidentId(incidentId);
        clearHighlightTimer = window.setTimeout(() => {
          setHighlightedIncidentId(null);
        }, 2500);
        consumeReturnContext();
      });
    };

    restorePosition();

    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      if (clearHighlightTimer) window.clearTimeout(clearHighlightTimer);
    };
  }, [items, loading]);

  useEffect(() => subscribeCommunityIncidentEngagement(() => {
    setEngagementVersion((version) => version + 1);
  }), []);

  const normalizedQuery = query.trim().toLocaleLowerCase('vi-VN');
  const sourceItems = normalizedQuery ? searchItems : items;

  const applyLiveEngagement = (item) => {
    const incidentId = getCommunityIncidentId(item);
    const engagement = getCommunityIncidentEngagementState(incidentId);
    if (!engagement) return item;

    return {
      ...item,
      ...(Number.isFinite(Number(engagement.supportCount))
        ? { supportCount: Math.max(0, Number(engagement.supportCount)) }
        : {}),
      ...(Number.isFinite(Number(engagement.commentCount))
        ? { commentCount: Math.max(0, Number(engagement.commentCount)) }
        : {}),
      ...(Number.isFinite(Number(engagement.subscriberCount))
        ? { subscriberCount: Math.max(0, Number(engagement.subscriberCount)) }
        : {}),
      ...(typeof engagement.isSupportedByCurrentUser === 'boolean'
        ? { isSupportedByCurrentUser: engagement.isSupportedByCurrentUser }
        : {}),
      ...(typeof engagement.isSubscribedByCurrentUser === 'boolean'
        ? { isSubscribedByCurrentUser: engagement.isSubscribedByCurrentUser }
        : {}),
    };
  };

  const itemsWithLiveEngagement = sourceItems.map(applyLiveEngagement);

  const tabItems = tab === 'Processing'
    ? itemsWithLiveEngagement.filter((item) => (
        isCommunityProcessingIncidentStatus(item?.incidentStatus || item?.status)
      ))
    : tab === 'Ended'
      ? itemsWithLiveEngagement.filter((item) => (
          isCommunityEndedIncidentStatus(item?.incidentStatus || item?.status)
        ))
      : itemsWithLiveEngagement;

  const searchedItems = tabItems;

  const sortedItems = [...searchedItems].sort((left, right) => {
    if (tab === 'Trending') {
      const engagementDifference = (
        getSupportCount(right) + getCommentCount(right)
      ) - (
        getSupportCount(left) + getCommentCount(left)
      );
      if (engagementDifference !== 0) return engagementDifference;
    }

    return getCreatedTimestamp(right) - getCreatedTimestamp(left);
  });
  const visibleItems = sortedItems.slice(
    0,
    page * COMMUNITY_FEED_PAGE_SIZE
  );
  const hasMore = normalizedQuery
    ? visibleItems.length < sortedItems.length
    : (
        visibleItems.length < sortedItems.length ||
        loadedServerPage < totalPages
      );

  const trendingItems = items.map(applyLiveEngagement)
    .sort((left, right) => (
      getSupportCount(right) + getCommentCount(right)
    ) - (
      getSupportCount(left) + getCommentCount(left)
    ))
    .slice(0, 5);


  const handleIncidentSupportChange = useCallback((incidentId, { isSupported, count }) => {
    if (!incidentId) return;
    setItems((currentItems) => currentItems.map((item) => (
      String(getCommunityIncidentId(item)) === String(incidentId)
        ? {
            ...item,
            supportCount: Math.max(0, Number(count) || 0),
            isSupportedByCurrentUser: Boolean(isSupported),
          }
        : item
    )));
  }, []);

  const initialLoading = loading && items.length === 0;

  const persistFeedReturnContext = (incidentId) => {
    writeCommunityFeedCache(cacheOwnerKey, {
      items,
      page,
      loadedServerPage,
      totalPages,
      totalItems,
      tab,
      query,
    });

    try {
      window.sessionStorage.setItem(
        COMMUNITY_RETURN_STORAGE_KEY,
        JSON.stringify({
          tab,
          query,
          page,
          scrollY: document.querySelector('[data-dashboard-scroll-container]')?.scrollTop || 0,
          incidentId,
        })
      );
    } catch (storageError) {
      console.warn('Không thể lưu vị trí bảng tin', storageError);
    }

    navigate(
      `${location.pathname}${location.search}${location.hash}`,
      {
        replace: true,
        state: {
          ...(location.state || {}),
          restoreIncidentId: incidentId,
          preserveScrollOnEnter: true,
        },
      }
    );
  };

  const buildIncidentDetailState = () => ({ from: '/community/feed' });

  const openDetail = (item) => {
    const incidentId = getCommunityIncidentId(item);
    if (!incidentId) return;

    persistFeedReturnContext(incidentId);

    navigate(`/community/feed/${incidentId}`, {
      state: buildIncidentDetailState(item),
    });
  };


  const retryLoad = () => {
    loadFeedSnapshot({
      background: items.length > 0,
      force: true,
    });
  };

  const handleLoadMore = () => {
    if (!hasMore || refreshing) return;

    if (visibleItems.length < sortedItems.length) {
      setPage((currentPage) => currentPage + 1);
      return;
    }

    if (normalizedQuery) return;

    loadNextServerPage();
  };

  return (
    <>
      <section
        data-public-reveal
        className="relative overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_14px_38px_rgba(15,23,42,0.09)] ring-1 ring-slate-100/80 dark:border-slate-800 dark:bg-slate-950 dark:ring-slate-800/80"
      >
        <div className="grid min-h-[176px] lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
          <div className="relative z-10 flex items-center px-6 py-6 sm:px-8 lg:px-9">
            <div className="flex items-start gap-4">
              <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-blue-600 text-white shadow-[0_8px_20px_rgba(37,99,235,0.18)]">
                <Lucide.Newspaper size={20} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h1 className="text-[26px] font-bold leading-8 tracking-[-0.03em] text-[var(--public-title)] sm:text-[28px]">
                  Chuyện quanh khu phố
                </h1>
                <p className="mt-1.5 text-[13px] font-medium text-slate-600 dark:text-slate-300">
                  Cùng nhau xây dựng đô thị xanh – sạch – an toàn hơn.
                </p>
                <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-[var(--public-copy)]">
                  <Lucide.MapPin size={13} className="shrink-0 text-blue-600" aria-hidden="true" />
                  Khám phá những vấn đề đang được cộng đồng chia sẻ quanh bạn.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/community/map')}
                  className="btn btn-sm mt-3.5 h-9 rounded-xl border-0 bg-blue-600 px-4 text-white shadow-[0_8px_18px_rgba(37,99,235,0.16)] hover:bg-blue-700"
                >
                  <Lucide.Map size={14} aria-hidden="true" />
                  Xem bản đồ quanh bạn
                </button>
              </div>
            </div>
          </div>

          <div className="relative hidden min-h-[176px] overflow-hidden bg-[#f3f9ff] lg:block dark:bg-slate-900">
            <img
              src={communityHeroImage}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
            <div className="pointer-events-none absolute inset-y-0 left-0 w-14 bg-gradient-to-r from-white via-white/60 to-transparent dark:from-slate-950 dark:via-slate-950/55" />
          </div>
        </div>
      </section>

      <section
        data-public-reveal
        className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_318px]"
      >
        <div className="min-w-0 space-y-3">
          <section
            ref={filterSectionRef}
            className="sticky top-3 z-30 scroll-mt-28 rounded-[18px] border border-[var(--public-border)] bg-white/95 p-2.5 shadow-[0_10px_28px_rgba(15,23,42,0.09)] backdrop-blur-xl dark:bg-slate-950/92"
          >
            <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
              <div
                className="flex max-w-full items-center gap-1 overflow-x-auto"
                role="tablist"
                aria-label="Lọc bảng tin"
              >
                {tab === 'Trending' ? (
                  <button
                    type="button"
                    onClick={() => handleFeedTabChange('Trending')}
                    role="tab"
                    aria-selected="true"
                    className="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl bg-blue-50 px-3 text-sm font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
                  >
                    <Lucide.Flame size={15} aria-hidden="true" />
                    Được quan tâm
                  </button>
                ) : null}
                {PRIMARY_TAB_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const active = tab === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleFeedTabChange(option.value)}
                      role="tab"
                      aria-selected={active}
                      className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition ${
                        active
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300'
                          : 'text-[var(--public-copy)] hover:bg-[var(--public-surface-soft)] hover:text-[var(--public-title)]'
                      }`}
                    >
                      <Icon size={15} aria-hidden="true" />
                      {option.label}
                    </button>
                  );
                })}
              </div>

              <label className="relative block w-full lg:max-w-[330px]">
                <span className="sr-only">Tìm kiếm trong bảng tin</span>
                <Lucide.Search
                  size={16}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--public-muted)]"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={query}
                  onFocus={handleQueryFocus}
                  onChange={handleQueryChange}
                  placeholder="Tìm kiếm sự việc, khu vực, vấn đề..."
                  className="input input-bordered h-9 w-full rounded-xl border-[var(--public-border)] bg-[var(--public-surface-strong)] pl-10 text-sm text-[var(--public-title)] placeholder:text-[var(--public-muted)] focus:border-blue-400 focus:outline-none"
                />
                {refreshing || searching ? (
                  <span className="loading loading-spinner loading-xs absolute right-3.5 top-1/2 -translate-y-1/2 text-blue-600 dark:text-blue-300" aria-hidden="true" />
                ) : null}
              </label>
            </div>
          </section>

          {error ? (
            <div>
              <ErrorAlert
                title="Không thể tải bảng tin"
                message={error}
                onClose={() => setError('')}
              />
              <button
                type="button"
                onClick={retryLoad}
                className="btn btn-sm mt-3 rounded-xl"
              >
                <Lucide.RefreshCw size={14} aria-hidden="true" />
                Thử lại
              </button>
            </div>
          ) : null}

          {initialLoading ? <FeedSkeleton /> : null}

          {!initialLoading && visibleItems.length > 0 ? (
            <div
              ref={feedListSectionRef}
              className="scroll-mt-28 space-y-3"
            >
              {visibleItems.map((item, index) => (
                <CommunityFeedItem
                  key={getCommunityIncidentId(item) || index}
                  item={item}
                  priority={index < 2}
                  highlighted={
                    String(getCommunityIncidentId(item)) ===
                    String(highlightedIncidentId)
                  }
                  onOpen={openDetail}
                  onSupportChange={handleIncidentSupportChange}
                />
              ))}
            </div>
          ) : null}

          {!initialLoading && !searching && visibleItems.length === 0 && !error ? (
            <div className="rounded-[20px] border border-[var(--public-border)] bg-[var(--public-surface)] px-6 py-12 text-center shadow-sm">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                <Lucide.Newspaper size={25} aria-hidden="true" />
              </span>
              <h2 className="mt-4 text-lg font-bold">
                {query
                  ? 'Không tìm thấy cập nhật phù hợp'
                  : 'Chưa có cập nhật công khai'}
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-base-content/55">
                {query
                  ? 'Thử từ khóa khác hoặc chuyển sang một nhóm bảng tin khác.'
                  : 'Những vấn đề đã đủ điều kiện công khai sẽ xuất hiện tại đây để cộng đồng cùng theo dõi.'}
              </p>
              {query ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    requestFeedScroll('controls');
                  }}
                  className="btn btn-sm mt-5 rounded-xl"
                >
                  Xóa từ khóa
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate('/tickets/create')}
                  className="btn admin-primary-action btn-sm mt-5 rounded-xl"
                >
                  <Lucide.Plus size={15} aria-hidden="true" />
                  Gửi phản ánh
                </button>
              )}
            </div>
          ) : null}

          {(normalizedQuery ? searchItems.length > 0 : items.length > 0) && hasMore ? (
            <div className="flex justify-center py-2">
              <button
                type="button"
                onClick={handleLoadMore}
                className="btn btn-outline min-w-52 rounded-xl"
                disabled={refreshing}
              >
                {refreshing ? (
                  <span className="loading loading-spinner loading-sm" aria-hidden="true" />
                ) : (
                  <Lucide.Plus size={16} aria-hidden="true" />
                )}
                {refreshing ? 'Đang tải thêm...' : 'Xem thêm cập nhật'}
              </button>
            </div>
          ) : null}

          {!initialLoading && !hasMore && sortedItems.length > 0 ? (
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-base-content/45">
              <Lucide.CircleCheck size={16} className="text-success" aria-hidden="true" />
              Bạn đã xem hết các cập nhật phù hợp.
            </div>
          ) : null}
        </div>

        <aside className="space-y-3 xl:sticky xl:top-3 xl:self-start">
          <section className="rounded-[20px] border border-[var(--public-border)] bg-[var(--public-surface)] p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-warning/10 text-warning">
                  <Lucide.Flame size={16} aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-[var(--public-title)]">Đang được quan tâm</h2>
                  <p className="mt-0.5 text-[11px] text-[var(--public-muted)]">Những vấn đề cộng đồng chú ý</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleFeedTabChange('Trending', 'list')}
                className="shrink-0 text-[11px] font-semibold text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-300 dark:hover:text-blue-200"
              >
                Xem tất cả
              </button>
            </div>

            {trendingItems.length > 0 ? (
              <ol className="mt-3 divide-y divide-[var(--public-border-soft)]">
                {trendingItems.map((item, index) => {
                  const previewUrl = getPreviewMediaUrl(item);
                  return (
                    <li key={getCommunityIncidentId(item) || index}>
                      <button
                        type="button"
                        onClick={() => openDetail(item)}
                        className="group grid w-full grid-cols-[26px_52px_minmax(0,1fr)_14px] items-center gap-2.5 py-3 text-left"
                      >
                        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-[10px] font-bold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                          {index + 1}
                        </span>
                        {previewUrl ? (
                          <img
                            src={previewUrl}
                            alt=""
                            className="h-11 w-[52px] rounded-lg object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <span className="flex h-11 w-[52px] items-center justify-center rounded-lg bg-[var(--public-surface-soft)] text-blue-500/60 dark:text-blue-300/70">
                            <Lucide.MapPin size={16} aria-hidden="true" />
                          </span>
                        )}
                        <span className="min-w-0">
                          <span className="line-clamp-1 text-xs font-bold text-[var(--public-title)] transition group-hover:text-blue-600 dark:group-hover:text-blue-300">
                            {item?.title || 'Cập nhật đô thị'}
                          </span>
                          <span className="mt-1 flex min-w-0 items-center gap-1 text-[10px] text-[var(--public-muted)]">
                            <Lucide.MapPin size={10} className="shrink-0 text-blue-600 dark:text-blue-300" aria-hidden="true" />
                            <span className="truncate">{getAreaName(item)}</span>
                          </span>
                          <span className="mt-1 flex items-center gap-3 text-[10px] text-[var(--public-muted)]">
                            <span className="inline-flex items-center gap-1" title="Lượt đồng tình">
                              <Lucide.Heart size={10} aria-hidden="true" />
                              {getSupportCount(item)}
                            </span>
                            <span className="inline-flex items-center gap-1" title="Bình luận">
                              <Lucide.MessagesSquare size={10} aria-hidden="true" />
                              {getCommentCount(item)}
                            </span>
                            <span className="inline-flex items-center gap-1" title="Người theo dõi">
                              <Lucide.Bell size={10} aria-hidden="true" />
                              {getSubscriberCount(item)}
                            </span>
                          </span>
                        </span>
                        <Lucide.ChevronRight
                          size={14}
                          className="text-[var(--public-muted)] transition group-hover:translate-x-0.5 group-hover:text-blue-600 dark:group-hover:text-blue-300"
                          aria-hidden="true"
                        />
                      </button>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="mt-4 rounded-xl bg-[var(--public-surface-soft)] px-4 py-5 text-center text-sm text-[var(--public-muted)]">
                Chưa có dữ liệu xu hướng.
              </p>
            )}
          </section>

          <section className="overflow-hidden rounded-[20px] border border-sky-200/70 bg-[linear-gradient(145deg,#f0f9ff_0%,#eef7ff_48%,#edfdf6_100%)] p-4 shadow-[0_8px_24px_rgba(37,99,235,0.06)] dark:border-sky-400/15 dark:bg-none dark:bg-base-200">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/90 text-success shadow-sm dark:bg-base-100">
                <Lucide.HeartHandshake size={23} aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-[var(--public-title)]">Cùng nhau xây dựng khu phố tốt đẹp hơn</h2>
                <p className="mt-1 text-[11px] leading-5 text-[var(--public-muted)]">
                  Mỗi phản ánh của bạn đều góp phần thay đổi cộng đồng.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/tickets/create')}
              className="btn btn-sm mt-4 w-full rounded-xl border-0 bg-blue-600 text-white shadow-[0_8px_16px_rgba(37,99,235,0.16)] hover:bg-blue-700"
            >
              <Lucide.Plus size={15} aria-hidden="true" />
              Gửi phản ánh ngay
            </button>
          </section>
        </aside>
      </section>
    </>
  );

}
