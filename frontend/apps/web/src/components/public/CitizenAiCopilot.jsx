import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { ticketApi, toolsApi } from '@urbanmind/shared-api';
import { APP_ROLES } from '@urbanmind/shared-types';
import { useAuth } from '../../contexts/AuthContext';
import { FeedbackMessagesProvider } from '../../contexts/FeedbackMessagesContext';
import { useFeedbackMessages } from '../../contexts/FeedbackMessagesContextHook';
import {
  getCitizenMessageParticipantLabel,
  getCitizenMessageSide,
} from '../tickets/citizenConversationUtils.js';
import { normalizeRole } from '../../utils/roleMap';
import {
  buildCitizenFeedbackSubmission,
  parseCitizenAiFeedbackDraft,
} from './citizenAiFeedbackDraft';

const AI_DOCK_STORAGE_KEY = 'urbanmind-ai-dock-position';
const AI_FEEDBACK_DRAFT_STORAGE_PREFIX = 'urbanmind:ai-feedback-draft';
const AI_ACTIVE_CONVERSATION_STORAGE_PREFIX = 'urbanmind:ai-active-conversation';
const AI_SYNC_EVENT_STORAGE_PREFIX = 'urbanmind:ai-sync-event';
const AI_BUTTON_SIZE = 56;
const AI_MIN_TOP = 96;
const AI_CITIZEN_BOTTOM_GAP = 112;
const AI_DRAG_THRESHOLD = 6;
const AI_SYNC_INTERVAL_MS = 5000;

const DRAFT_STEPS = {
  IDLE: 'idle',
  TITLE: 'title',
  DESCRIPTION: 'description',
  CATEGORY: 'category',
  LOCATION: 'location',
  EVIDENCE: 'evidence',
  READY: 'ready',
};

const DRAFT_INTENT_REGEX = /(tạo|tao|lập|lap|gửi|gui).*(phản ánh|phan anh|feedback|ticket)|phản ánh|phan anh/i;

const getDraftQuestion = (step) => {
  if (step === DRAFT_STEPS.TITLE) {
    return 'Bạn muốn đặt tiêu đề phản ánh là gì? Ví dụ: “Đường hư hỏng trước nhà”.';
  }

  if (step === DRAFT_STEPS.DESCRIPTION) {
    return 'Bạn mô tả chi tiết sự việc giúp tôi nhé: vấn đề là gì, mức độ ảnh hưởng/khẩn cấp ra sao?';
  }

  if (step === DRAFT_STEPS.CATEGORY) {
    return 'Vấn đề này thuộc danh mục nào? Ví dụ: đường giao thông, chiếu sáng, vệ sinh môi trường hoặc cấp thoát nước.';
  }

  if (step === DRAFT_STEPS.LOCATION) {
    return 'Vị trí cụ thể ở đâu? Bạn có thể nhập địa chỉ hoặc bấm nút GPS bên dưới.';
  }

  if (step === DRAFT_STEPS.EVIDENCE) {
    return 'Bạn có ảnh minh chứng không? Nếu có hãy bấm nút “Ảnh” bên dưới để chọn ảnh, hoặc nhắn “không có” để bỏ qua.';
  }

  return 'Đã đủ thông tin cơ bản. Bạn bấm “Gửi phản ánh” để gửi thông tin trực tiếp đến hệ thống.';
};

const getAiMessageText = (payload) => (
  payload?.message ||
  payload?.messageText ||
  payload?.reply ||
  payload?.content ||
  payload?.data?.message ||
  payload?.data?.messageText ||
  payload?.data?.reply ||
  ''
);

const getAiConversationId = (payload) => (
  payload?.conversationId ||
  payload?.conversationID ||
  payload?.id ||
  payload?.data?.conversationId ||
  payload?.data?.conversationID ||
  payload?.data?.id ||
  payload?.result?.conversationId ||
  payload?.result?.conversationID ||
  payload?.result?.id ||
  payload?.conversation?.conversationId ||
  payload?.conversation?.conversationID ||
  payload?.conversation?.id ||
  payload?.data?.conversation?.conversationId ||
  payload?.data?.conversation?.conversationID ||
  payload?.data?.conversation?.id ||
  null
);

const normalizeAiMessage = (message, index = 0) => {
  const rawSender = String(
    message?.senderType ||
    message?.sender ||
    message?.role ||
    message?.messageType ||
    message?.type ||
    ''
  ).toLowerCase();
  const text = getAiMessageText(message);
  const normalizedText = String(text || '').trim().toLowerCase();
  const hidden = (
    rawSender.includes('system') ||
    rawSender.includes('safety') ||
    rawSender.includes('moderation') ||
    normalizedText === 'user safety: safe' ||
    normalizedText.startsWith('user safety:')
  );

  return {
    id: message?.messageId || message?.id || `${message?.createdAt || Date.now()}-${index}`,
    sender: rawSender.includes('user') ? 'user' : 'ai',
    text,
    createdAt: message?.createdAt,
    hidden,
  };
};

const dedupeAiConversations = (items) => {
  const byConversationId = new Map();

  (Array.isArray(items) ? items : []).forEach((conversation) => {
    const conversationId = conversation?.conversationId ?? conversation?.id;
    if (conversationId == null) return;

    const key = String(conversationId);
    const existing = byConversationId.get(key);
    if (!existing) {
      byConversationId.set(key, conversation);
      return;
    }

    const existingTime = new Date(
      existing?.lastMessageAt || existing?.updatedAt || existing?.startedAt || existing?.createdAt || 0
    ).getTime();
    const nextTime = new Date(
      conversation?.lastMessageAt || conversation?.updatedAt || conversation?.startedAt || conversation?.createdAt || 0
    ).getTime();
    const newer = nextTime >= existingTime ? conversation : existing;
    const older = newer === conversation ? existing : conversation;

    byConversationId.set(key, {
      ...older,
      ...newer,
      conversationId,
      title: newer?.title || older?.title || null,
      lastMessage: newer?.lastMessage || older?.lastMessage || null,
      lastMessageAt: newer?.lastMessageAt || older?.lastMessageAt || null,
      messageCount: Math.max(
        Number(existing?.messageCount) || 0,
        Number(conversation?.messageCount) || 0
      ),
    });
  });

  return [...byConversationId.values()];
};

const getFeedbackId = (ticket) => (
  ticket?.feedbackId ??
  ticket?.feedbackID ??
  ticket?.ticketId ??
  ticket?.id ??
  null
);

const getFeedbackTitle = (ticket) => (
  ticket?.title ||
  ticket?.feedbackTitle ||
  ticket?.subject ||
  `Phản ánh #${getFeedbackId(ticket) || ''}`
);

const getFeedbackUpdatedAt = (ticket) => (
  ticket?.updatedAt ||
  ticket?.lastUpdatedAt ||
  ticket?.modifiedAt ||
  ticket?.createdAt ||
  ticket?.submittedAt ||
  null
);

const getFeedbackStatusLabel = (status) => {
  const normalized = String(status || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const labels = {
    submitted: 'Đã gửi',
    aireviewed: 'Đang phân loại',
    verified: 'Đã xác minh',
    assigned: 'Đã phân công',
    inprogress: 'Đang xử lý',
    waitingcitizen: 'Chờ bạn bổ sung',
    submittedforapproval: 'Đang kiểm tra kết quả',
    needrework: 'Cần bổ sung',
    resolved: 'Đã xử lý',
    approved: 'Chờ đánh giá',
    closed: 'Đã đóng',
    rejected: 'Không tiếp nhận',
    cancelled: 'Đã hủy',
    duplicate: 'Trùng lặp',
  };
  return labels[normalized] || status || 'Đang cập nhật';
};

const resolveRouteFeedbackId = (pathname) => {
  const segments = String(pathname || '').split('/').filter(Boolean);
  if (segments[0] !== 'tickets' || !segments[1]) return null;
  if (['create', 'archive', 'assign'].includes(segments[1])) return null;
  return segments[1];
};


const formatSupportMessageTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  }).format(date);
};

const CitizenStaffSupportPanel = ({ currentUserId }) => {
  const {
    feedbackId,
    messages,
    messagesLoading,
    messagesError,
    messageSubmitting,
    loadMessages,
    sendMessage,
  } = useFeedbackMessages();
  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState('');
  const messageListRef = useRef(null);
  const endRef = useRef(null);

  const publicMessages = useMemo(
    () => (Array.isArray(messages) ? messages : [])
      .filter((message) => message && !message.isInternal)
      .sort((left, right) => new Date(left.createdAt || 0) - new Date(right.createdAt || 0)),
    [messages]
  );

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      const container = messageListRef.current;
      if (!container) return;

      container.scrollTo({
        top: container.scrollHeight,
        behavior: publicMessages.length > 1 ? 'smooth' : 'auto',
      });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [publicMessages.length, messageSubmitting]);

  const submitMessage = async (event) => {
    event?.preventDefault?.();
    const messageText = draft.trim();
    if (!messageText || messageSubmitting) return;

    setSendError('');
    try {
      await sendMessage({ messageText, isInternal: false });
      setDraft('');
    } catch (error) {
      setSendError(error?.message || 'Không thể gửi tin nhắn. Vui lòng thử lại.');
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-[var(--public-border)] bg-emerald-50/55 px-4 py-3 dark:bg-emerald-500/5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            <Lucide.LockKeyhole size={16} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <strong className="text-sm text-slate-900 dark:text-white">Trao đổi riêng với nhân viên</strong>
              <span className="rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:border-emerald-500/20 dark:bg-transparent dark:text-emerald-300">
                Riêng tư
              </span>
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
              Gắn với phản ánh #{String(feedbackId || '').slice(0, 8)}. Người dân khác trong cùng sự vụ không nhìn thấy cuộc trao đổi này.
            </p>
          </div>
          <button
            type="button"
            onClick={() => loadMessages({ keepMessagesOnError: true })}
            disabled={messagesLoading}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white hover:text-blue-600 disabled:opacity-50"
            aria-label="Làm mới trao đổi"
          >
            <Lucide.RefreshCw size={14} className={messagesLoading ? 'animate-spin' : ''} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div
        ref={messageListRef}
        className="min-h-0 flex-1 overflow-y-auto bg-[linear-gradient(180deg,rgba(248,250,252,.88),rgba(255,255,255,.98))] px-4 py-4 dark:bg-none dark:bg-slate-950/35"
      >
        {messagesLoading && publicMessages.length === 0 ? (
          <div className="flex min-h-[220px] items-center justify-center gap-2 text-sm text-slate-500">
            <span className="loading loading-spinner loading-sm" />
            Đang tải trao đổi...
          </div>
        ) : messagesError && publicMessages.length === 0 ? (
          <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 text-center">
            <Lucide.MessageSquareWarning size={26} className="text-rose-500" aria-hidden="true" />
            <p className="max-w-xs text-sm text-rose-600">{messagesError}</p>
            <button type="button" onClick={() => loadMessages()} className="btn btn-outline btn-sm rounded-xl">
              Thử lại
            </button>
          </div>
        ) : publicMessages.length === 0 ? (
          <div className="flex min-h-[220px] flex-col items-center justify-center text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <Lucide.MessagesSquare size={21} aria-hidden="true" />
            </span>
            <p className="mt-3 text-sm font-bold text-slate-900 dark:text-white">Chưa có trao đổi nào</p>
            <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500 dark:text-slate-400">
              Bạn có thể hỏi thêm hoặc bổ sung thông tin riêng cho bộ phận đang xử lý phản ánh này.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {publicMessages.map((message, index) => {
              const ownMessage = getCitizenMessageSide(message, currentUserId) === 'outgoing';
              const participantLabel = getCitizenMessageParticipantLabel(message, ownMessage);
              const messageKey = message?.interactionMessageId || message?.id || `${message?.createdAt || 'message'}-${index}`;

              return (
                <div key={messageKey} className={`flex ${ownMessage ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[86%] rounded-[18px] px-3.5 py-2.5 ${
                    ownMessage
                      ? 'bg-blue-600 text-white shadow-[0_8px_20px_rgba(37,99,235,.16)]'
                      : 'border border-slate-200 bg-white text-slate-800 shadow-[0_6px_18px_rgba(15,23,42,.05)] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100'
                  }`}>
                    <div className={`text-[11px] font-bold ${ownMessage ? 'text-white/85' : 'text-slate-600 dark:text-slate-300'}`}>
                      {participantLabel}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5">
                      {message?.messageText || ''}
                    </p>
                    <time className={`mt-1.5 block text-[10px] ${ownMessage ? 'text-right text-white/65' : 'text-slate-400'}`}>
                      {formatSupportMessageTime(message?.createdAt)}
                    </time>
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <form onSubmit={submitMessage} className="border-t border-[var(--public-border)] bg-white p-3 dark:bg-slate-950">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              if (sendError) setSendError('');
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent?.isComposing) {
                event.preventDefault();
                submitMessage(event);
              }
            }}
            rows={2}
            disabled={messageSubmitting}
            placeholder="Nhắn với bộ phận xử lý..."
            className="min-h-[50px] flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100 dark:border-slate-800 dark:bg-slate-900"
          />
          <button
            type="submit"
            disabled={!draft.trim() || messageSubmitting}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-[0_8px_20px_rgba(37,99,235,.18)] transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-45"
            aria-label="Gửi tin nhắn cho bộ phận xử lý"
          >
            {messageSubmitting ? <span className="loading loading-spinner loading-sm" /> : <Lucide.Send size={16} aria-hidden="true" />}
          </button>
        </div>
        <p className={`mt-1.5 text-[10px] ${sendError ? 'text-rose-600' : 'text-slate-400'}`}>
          {sendError || 'Enter để gửi · Shift + Enter để xuống dòng'}
        </p>
      </form>
    </div>
  );
};

export const CitizenAiCopilot = () => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isCitizen = normalizeRole(user?.role) === APP_ROLES.SERVICE_USER;
  const [chatOpen, setChatOpen] = useState(false);
  const routeFeedbackId = resolveRouteFeedbackId(location.pathname);
  const [activeSupportChannel, setActiveSupportChannel] = useState(() => (
    routeFeedbackId ? 'staff' : 'ai'
  ));
  const [staffTickets, setStaffTickets] = useState([]);
  const [staffTicketsLoading, setStaffTicketsLoading] = useState(false);
  const [staffTicketsError, setStaffTicketsError] = useState('');
  const [selectedStaffFeedbackId, setSelectedStaffFeedbackId] = useState(() => routeFeedbackId || '');
  const [conversations, setConversations] = useState([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [deletingConversationId, setDeletingConversationId] = useState(null);
  const [deleteConversationTarget, setDeleteConversationTarget] = useState(null);
  const [conversationActionError, setConversationActionError] = useState('');
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [aiSessionReady, setAiSessionReady] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [newConversationMode, setNewConversationMode] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    {
      sender: 'ai',
      text: 'Chào bạn! Tôi là UrbanMind Assist — trợ giúp bạn điều hướng quy trình phản ánh và giám sát vận hành đô thị. Bạn cần hỗ trợ gì hôm nay?',
    },
  ]);
  const [inputVal, setInputVal] = useState('');
  const [draftStep, setDraftStep] = useState(DRAFT_STEPS.IDLE);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftCategory, setDraftCategory] = useState('');
  const [reflection, setReflection] = useState('');
  const [locationText, setLocationText] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [selectedImages, setSelectedImages] = useState([]);
  const [pendingAiConversationKeys, setPendingAiConversationKeys] = useState([]);
  const [creatingDraft, setCreatingDraft] = useState(false);
  const [draftHydratedKey, setDraftHydratedKey] = useState(null);
  const [viewportHeight, setViewportHeight] = useState(() => (
    typeof window !== 'undefined' ? window.innerHeight : 900
  ));
  const [aiDock, setAiDock] = useState(() => {
    if (typeof window === 'undefined') return 'bottom';
    const savedDock = window.localStorage.getItem(AI_DOCK_STORAGE_KEY);
    return ['top', 'middle', 'bottom'].includes(savedDock) ? savedDock : 'bottom';
  });
  const [aiDragTop, setAiDragTop] = useState(null);
  const [aiDragging, setAiDragging] = useState(false);
  const aiDragStateRef = useRef(null);
  const suppressAiClickRef = useRef(false);
  const aiMessageListRef = useRef(null);
  const activeConversationIdRef = useRef(null);
  const pendingAiConversationKeysRef = useRef(new Set());
  const draftStorageKey = `${AI_FEEDBACK_DRAFT_STORAGE_PREFIX}:${user?.userId || 'anonymous'}`;
  const activeConversationStorageKey = `${AI_ACTIVE_CONVERSATION_STORAGE_PREFIX}:${user?.userId || 'anonymous'}`;
  const aiSyncEventStorageKey = `${AI_SYNC_EVENT_STORAGE_PREFIX}:${user?.userId || 'anonymous'}`;

  const announceAiSync = useCallback((reason = 'changed') => {
    if (typeof window === 'undefined') return;

    try {
      window.localStorage.setItem(
        aiSyncEventStorageKey,
        JSON.stringify({
          reason,
          at: Date.now(),
        })
      );
    } catch (error) {
      console.warn('Unable to announce AI conversation sync', error);
    }
  }, [aiSyncEventStorageKey]);

  useEffect(() => {
    if (routeFeedbackId) {
      setSelectedStaffFeedbackId(String(routeFeedbackId));
    }
  }, [routeFeedbackId]);

  const sortedStaffTickets = useMemo(() => (
    [...staffTickets].sort((left, right) => {
      const leftTime = new Date(getFeedbackUpdatedAt(left) || 0).getTime();
      const rightTime = new Date(getFeedbackUpdatedAt(right) || 0).getTime();
      return rightTime - leftTime;
    })
  ), [staffTickets]);

  const selectedStaffTicket = useMemo(
    () => sortedStaffTickets.find((ticket) => String(getFeedbackId(ticket)) === String(selectedStaffFeedbackId)) || null,
    [selectedStaffFeedbackId, sortedStaffTickets]
  );

  const loadStaffTickets = useCallback(async () => {
    if (!isAuthenticated || !isCitizen) return;
    setStaffTicketsLoading(true);
    setStaffTicketsError('');
    try {
      const response = await ticketApi.getAllTickets(
        { pageSize: 100 },
        { role: 'service-user' }
      );
      const nextTickets = Array.isArray(response)
        ? response.filter((ticket) => getFeedbackId(ticket))
        : [];
      setStaffTickets(nextTickets);
      setSelectedStaffFeedbackId((current) => {
        if (routeFeedbackId && nextTickets.some((ticket) => String(getFeedbackId(ticket)) === String(routeFeedbackId))) {
          return String(routeFeedbackId);
        }
        if (current && nextTickets.some((ticket) => String(getFeedbackId(ticket)) === String(current))) {
          return current;
        }
        return nextTickets.length > 0 ? String(getFeedbackId(nextTickets[0])) : '';
      });
    } catch (error) {
      console.error('Unable to load resident feedback conversations', error);
      setStaffTicketsError(error?.message || 'Không thể tải danh sách phản ánh.');
    } finally {
      setStaffTicketsLoading(false);
    }
  }, [isAuthenticated, isCitizen, routeFeedbackId]);

useEffect(() => {
  const handleResize = () => {
    setViewportHeight(window.innerHeight);
    setAiDragTop(null);
  };

  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, []);

const getAiDockTop = (dock) => {
    const maxTop = Math.max(
      AI_MIN_TOP,
      viewportHeight - AI_BUTTON_SIZE - AI_CITIZEN_BOTTOM_GAP
    );

    if (dock === 'top') return AI_MIN_TOP;
    if (dock === 'middle') return Math.round((AI_MIN_TOP + maxTop) / 2);
    return maxTop;
  };

  const clampAiTop = (top) => {
    const maxTop = Math.max(
      AI_MIN_TOP,
      viewportHeight - AI_BUTTON_SIZE - AI_CITIZEN_BOTTOM_GAP
    );
    return Math.min(maxTop, Math.max(AI_MIN_TOP, top));
  };

  const handleAiPointerDown = (event) => {
    if (window.innerWidth < 768 || chatOpen) return;

    event.currentTarget.setPointerCapture?.(event.pointerId);
    aiDragStateRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startTop: aiDragTop ?? getAiDockTop(aiDock),
      moved: false,
    };
    setAiDragging(true);
  };

  const handleAiPointerMove = (event) => {
    const dragState = aiDragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    const deltaY = event.clientY - dragState.startY;
    if (Math.abs(deltaY) >= AI_DRAG_THRESHOLD) dragState.moved = true;

    if (dragState.moved) {
      event.preventDefault();
      setAiDragTop(clampAiTop(dragState.startTop + deltaY));
    }
  };

  const finishAiDrag = (event) => {
    const dragState = aiDragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    event.currentTarget.releasePointerCapture?.(event.pointerId);

    if (dragState.moved) {
      const currentTop = clampAiTop(
        dragState.startTop + event.clientY - dragState.startY
      );
      const dockPositions = {
        top: getAiDockTop('top'),
        middle: getAiDockTop('middle'),
        bottom: getAiDockTop('bottom'),
      };
      const nearestDock = Object.entries(dockPositions).reduce(
        (nearest, [dock, dockTop]) => (
          Math.abs(dockTop - currentTop) < Math.abs(dockPositions[nearest] - currentTop)
            ? dock
            : nearest
        ),
        'bottom'
      );

      setAiDock(nearestDock);
      window.localStorage.setItem(AI_DOCK_STORAGE_KEY, nearestDock);
      suppressAiClickRef.current = true;
    }

    aiDragStateRef.current = null;
    setAiDragTop(null);
    setAiDragging(false);
  };

  const loadConversations = useCallback(async () => {
    setConversationsLoading(true);
    try {
      const nextConversations = await toolsApi.getAiConversations();
      const safeConversations = dedupeAiConversations(nextConversations);
      setConversations(safeConversations);

      if (
        activeSupportChannel === 'ai' &&
        activeConversationIdRef.current == null &&
        !newConversationMode &&
        safeConversations.length > 0
      ) {
        let persistedConversationId = null;
        try {
          persistedConversationId = window.localStorage.getItem(activeConversationStorageKey);
        } catch (error) {
          console.warn('Unable to restore active AI conversation', error);
        }

        const persistedConversation = persistedConversationId
          ? safeConversations.find((conversation) => (
            String(conversation?.conversationId ?? conversation?.id) === String(persistedConversationId)
          ))
          : null;

        const fallbackConversation = [...safeConversations]
          .filter((conversation) => conversation?.conversationId != null || conversation?.id != null)
          .sort((left, right) => {
            const leftTime = new Date(
              left?.lastMessageAt ||
              left?.updatedAt ||
              left?.startedAt ||
              left?.createdAt ||
              0
            ).getTime();
            const rightTime = new Date(
              right?.lastMessageAt ||
              right?.updatedAt ||
              right?.startedAt ||
              right?.createdAt ||
              0
            ).getTime();

            if (rightTime !== leftTime) return rightTime - leftTime;

            const leftId = Number(left?.conversationId ?? left?.id ?? 0);
            const rightId = Number(right?.conversationId ?? right?.id ?? 0);
            return rightId - leftId;
          })[0];

        const conversationToResume = persistedConversation || fallbackConversation;
        const conversationIdToResume = conversationToResume?.conversationId ?? conversationToResume?.id;

        if (conversationIdToResume != null) {
          activeConversationIdRef.current = conversationIdToResume;
          setActiveConversationId(conversationIdToResume);
          try {
            window.localStorage.setItem(
              activeConversationStorageKey,
              String(conversationIdToResume)
            );
          } catch (error) {
            console.warn('Unable to persist active AI conversation', error);
          }

          setMessagesLoading(true);
          try {
            const messages = await toolsApi.getAiConversationMessages(conversationIdToResume);
            setChatMessages(
              (Array.isArray(messages) ? messages : [])
                .map(normalizeAiMessage)
                .filter((message) => message.text && !message.hidden)
            );
          } catch (error) {
            console.warn('Unable to resume active AI conversation', error);
          } finally {
            setMessagesLoading(false);
          }
        }
      }
    } catch (error) {
      console.warn('Unable to load AI conversations', error);
      setConversations([]);
    } finally {
      setConversationsLoading(false);
      setAiSessionReady(true);
    }
  }, [
    activeConversationStorageKey,
    activeSupportChannel,
    newConversationMode,
  ]);

  useEffect(() => {
    if (!chatOpen) return;
    loadConversations();
    loadStaffTickets();
  }, [chatOpen, loadConversations, loadStaffTickets]);

  useEffect(() => {
    if (!chatOpen || activeSupportChannel !== 'ai') return undefined;

    let cancelled = false;
    let syncInFlight = false;

    const getConversationSignature = (conversation) => (
      conversation
        ? [
            String(conversation?.conversationId ?? conversation?.id ?? ''),
            conversation?.title || '',
            conversation?.lastMessage || '',
            conversation?.lastMessageAt || conversation?.updatedAt || '',
            Number(conversation?.messageCount) || 0,
          ].join('|')
        : ''
    );

    const syncAiSilently = async ({ forceMessages = false } = {}) => {
      if (cancelled || syncInFlight) return;

      syncInFlight = true;

      try {
        const nextConversations = dedupeAiConversations(
          await toolsApi.getAiConversations()
        );

        const activeId = activeConversationIdRef.current;
        let activeConversationChanged = false;

        setConversations((current) => {
          const currentSignature = JSON.stringify(
            current.map(getConversationSignature)
          );
          const nextSignature = JSON.stringify(
            nextConversations.map(getConversationSignature)
          );

          if (activeId != null) {
            const currentActive = current.find((item) => (
              String(item?.conversationId ?? item?.id) === String(activeId)
            ));
            const nextActive = nextConversations.find((item) => (
              String(item?.conversationId ?? item?.id) === String(activeId)
            ));
            activeConversationChanged = (
              getConversationSignature(currentActive) !==
              getConversationSignature(nextActive)
            );
          }

          return currentSignature === nextSignature
            ? current
            : nextConversations;
        });

        const canRefreshMessages =
          activeId != null &&
          draftStep === DRAFT_STEPS.IDLE &&
          !pendingAiConversationKeysRef.current.has(String(activeId));

        if (canRefreshMessages && (forceMessages || activeConversationChanged)) {
          const nextMessages = (
            await toolsApi.getAiConversationMessages(activeId)
          )
            .map(normalizeAiMessage)
            .filter((message) => message.text && !message.hidden);

          if (!cancelled) {
            setChatMessages((current) => {
              const currentSignature = JSON.stringify(
                current.map((message) => [
                  String(message?.id ?? ''),
                  message?.sender || '',
                  message?.text || '',
                  message?.createdAt || '',
                ])
              );
              const nextSignature = JSON.stringify(
                nextMessages.map((message) => [
                  String(message?.id ?? ''),
                  message?.sender || '',
                  message?.text || '',
                  message?.createdAt || '',
                ])
              );

              return currentSignature === nextSignature
                ? current
                : nextMessages;
            });
          }
        }
      } catch (error) {
        console.warn('Unable to silently sync AI conversations', error);
      } finally {
        syncInFlight = false;
      }
    };

    const intervalId = window.setInterval(
      () => syncAiSilently(),
      AI_SYNC_INTERVAL_MS
    );

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncAiSilently({ forceMessages: true });
      }
    };

    const handleStorageSync = (event) => {
      if (event.key !== aiSyncEventStorageKey || !event.newValue) return;
      syncAiSilently({ forceMessages: true });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('storage', handleStorageSync);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('storage', handleStorageSync);
    };
  }, [
    activeSupportChannel,
    aiSyncEventStorageKey,
    chatOpen,
    draftStep,
  ]);

  useEffect(() => {
    if (!chatOpen || activeSupportChannel !== 'ai') return undefined;

    const frameId = window.requestAnimationFrame(() => {
      const container = aiMessageListRef.current;
      if (!container) return;

      container.scrollTo({
        top: container.scrollHeight,
        behavior: chatMessages.length > 1 ? 'smooth' : 'auto',
      });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [activeSupportChannel, chatMessages.length, chatOpen, pendingAiConversationKeys]);

  useEffect(() => {
    setDraftHydratedKey(null);
    setDraftStep(DRAFT_STEPS.IDLE);
    setDraftTitle('');
    setDraftDescription('');
    setDraftCategory('');
    setReflection('');
    setLocationText('');
    setLatitude('');
    setLongitude('');
    setSelectedImages([]);

    let restoredDraft = null;
    try {
      restoredDraft = parseCitizenAiFeedbackDraft(
        window.localStorage.getItem(draftStorageKey),
        Object.values(DRAFT_STEPS)
      );
    } catch (error) {
      console.warn('Unable to restore AI feedback draft', error);
    }

    if (restoredDraft) {
      setDraftStep(restoredDraft.draftStep || DRAFT_STEPS.IDLE);
      setDraftTitle(restoredDraft.title);
      setDraftDescription(restoredDraft.description);
      setDraftCategory(restoredDraft.categoryText);
      setReflection(restoredDraft.reflection);
      setLocationText(restoredDraft.locationText);
      setLatitude(restoredDraft.latitude);
      setLongitude(restoredDraft.longitude);

      const imageReminder = restoredDraft.hadImages
        ? ` Ảnh (${restoredDraft.imageNames.join(', ') || 'đã chọn trước đó'}) cần được chọn lại.`
        : '';
      setChatMessages((current) => [
        ...current,
        { sender: 'ai', text: `Đã khôi phục bản nháp phản ánh đang làm dở.${imageReminder}` },
      ]);
    }

    setDraftHydratedKey(draftStorageKey);
  }, [draftStorageKey]);

  useEffect(() => {
    if (draftHydratedKey !== draftStorageKey) return;

    const hasDraftContent = Boolean(
      draftStep !== DRAFT_STEPS.IDLE ||
      draftTitle.trim() ||
      draftDescription.trim() ||
      draftCategory.trim() ||
      reflection.trim() ||
      locationText.trim() ||
      latitude !== '' ||
      longitude !== '' ||
      selectedImages.length > 0
    );

    if (!hasDraftContent) {
      try {
        window.localStorage.removeItem(draftStorageKey);
      } catch (error) {
        console.warn('Unable to clear AI feedback draft', error);
      }
      return;
    }

    try {
      window.localStorage.setItem(draftStorageKey, JSON.stringify({
        draftStep,
        title: draftTitle,
        description: draftDescription,
        categoryText: draftCategory,
        reflection,
        locationText,
        latitude: latitude === '' ? null : Number(latitude),
        longitude: longitude === '' ? null : Number(longitude),
        hadImages: selectedImages.length > 0,
        imageNames: selectedImages.map((file) => file.name),
        savedAt: new Date().toISOString(),
      }));
    } catch (error) {
      console.warn('Unable to save AI feedback draft', error);
    }
  }, [
    draftCategory,
    draftDescription,
    draftHydratedKey,
    draftStep,
    draftStorageKey,
    draftTitle,
    latitude,
    locationText,
    longitude,
    reflection,
    selectedImages,
  ]);

if (!isAuthenticated || !isCitizen) {
  return null;
}

const selectConversation = async (conversationId) => {
    setNewConversationMode(false);
    setAiSessionReady(false);
    activeConversationIdRef.current = conversationId;
    setActiveConversationId(conversationId);
    try {
      window.localStorage.setItem(activeConversationStorageKey, String(conversationId));
    } catch (error) {
      console.warn('Unable to persist active AI conversation', error);
    }
    setMessagesLoading(true);
    try {
      const messages = await toolsApi.getAiConversationMessages(conversationId);
      setChatMessages(messages.map(normalizeAiMessage).filter((message) => message.text && !message.hidden));
    } catch {
  setChatMessages((current) => [
    ...current,
    { sender: 'ai', text: 'Không thể tải tin nhắn của hội thoại này.' },
  ]);
} finally {
      setMessagesLoading(false);
      setAiSessionReady(true);
    }
  };

  const handleDeleteConversation = async (conversationId) => {
    if (conversationId == null || deletingConversationId != null) return;

    const conversationKey = String(conversationId);
    if (pendingAiConversationKeysRef.current.has(conversationKey)) {
      setConversationActionError('Hội thoại này đang chờ AI trả lời. Vui lòng đợi xong rồi xóa.');
      return;
    }

    const conversation = conversations.find((item) => (
      String(item?.conversationId ?? item?.id) === conversationKey
    ));
    setDeleteConversationTarget({
      conversationId,
      title: String(conversation?.title || '').trim(),
    });
  };

  const confirmDeleteConversation = async () => {
    const conversationId = deleteConversationTarget?.conversationId;
    if (conversationId == null || deletingConversationId != null) return;

    const conversationKey = String(conversationId);
    setDeletingConversationId(conversationId);
    setConversationActionError('');
    try {
      await toolsApi.deleteAiConversation(conversationId);
      setDeleteConversationTarget(null);

      const remaining = conversations.filter((item) => (
        String(item?.conversationId ?? item?.id) !== conversationKey
      ));
      setConversations(remaining);
      announceAiSync('conversation-deleted');

      const isActiveConversation = String(activeConversationIdRef.current ?? '') === conversationKey;
      if (isActiveConversation) {
        activeConversationIdRef.current = null;
        setActiveConversationId(null);
        setNewConversationMode(false);
        resetDraftFlow();
        try {
          window.localStorage.removeItem(activeConversationStorageKey);
        } catch (error) {
          console.warn('Unable to clear deleted AI conversation', error);
        }

        const nextConversation = remaining[0];
        const nextConversationId = nextConversation?.conversationId ?? nextConversation?.id;
        if (nextConversationId != null) {
          await selectConversation(nextConversationId);
        } else {
          setAiSessionReady(true);
          setChatMessages([{
            sender: 'ai',
            text: routeFeedbackId
              ? `Bạn đang chat theo ngữ cảnh phản ánh #${routeFeedbackId}. Hãy nhập câu hỏi cần AI hỗ trợ.`
              : 'Chưa có hội thoại AI nào. Bạn có thể bắt đầu bằng một câu hỏi mới.',
          }]);
        }
      }
    } catch (error) {
      setConversationActionError(error?.message || 'Không thể xóa hội thoại AI.');
    } finally {
      setDeletingConversationId(null);
    }
  };

  const resetDraftFlow = () => {
    try {
      window.localStorage.removeItem(draftStorageKey);
    } catch (error) {
      console.warn('Unable to clear AI feedback draft', error);
    }
    setDraftStep(DRAFT_STEPS.IDLE);
    setDraftTitle('');
    setDraftDescription('');
    setDraftCategory('');
    setReflection('');
    setLocationText('');
    setLatitude('');
    setLongitude('');
    setSelectedImages([]);
  };

  const startDraftFlow = () => {
    setDraftStep(DRAFT_STEPS.TITLE);
    setChatMessages((current) => [
      ...current,
      { sender: 'ai', text: getDraftQuestion(DRAFT_STEPS.TITLE) },
    ]);
  };

  const buildReflectionText = (
    title = draftTitle,
    description = draftDescription,
    locationValue = locationText
  ) => (
    [
      title.trim() ? `Tiêu đề: ${title.trim()}` : '',
      description.trim() ? `Mô tả: ${description.trim()}` : '',
      locationValue.trim() ? `Vị trí: ${locationValue.trim()}` : '',
    ].filter(Boolean).join('\n')
  );

  const getEntityId = (entity, primaryKey) => (
    entity?.[primaryKey] ?? entity?.id ?? entity?.value ?? null
  );

  const resolveFeedbackRequiredIds = async (draft) => {
    const [areasResult, categoriesResult] = await Promise.allSettled([
      toolsApi.getAreas(),
      toolsApi.getCategories(),
    ]);

    const areas = areasResult.status === 'fulfilled' && Array.isArray(areasResult.value)
      ? areasResult.value
      : [];
    const categories = categoriesResult.status === 'fulfilled' && Array.isArray(categoriesResult.value)
      ? categoriesResult.value
      : [];

    const normalize = (value) => String(value ?? '').trim().toLowerCase();
    const suggestedArea = normalize(draft?.areaId || draft?.suggestedArea || draft?.areaName || draft?.location);
    const suggestedCategory = normalize(draft?.categoryId || draft?.suggestedCategory || draft?.categoryName);

    const matchedArea = areas.find((area) => {
      const areaId = normalize(getEntityId(area, 'areaId'));
      const areaName = normalize(area?.areaName || area?.name || area?.displayName);
      return suggestedArea && (
        areaId === suggestedArea ||
        areaName === suggestedArea ||
        (areaName && (suggestedArea.includes(areaName) || areaName.includes(suggestedArea)))
      );
    });

    const matchedCategory = categories.find((category) => {
      const categoryId = normalize(getEntityId(category, 'categoryId'));
      const categoryName = normalize(category?.categoryName || category?.name || category?.displayName);
      return suggestedCategory && (
        categoryId === suggestedCategory ||
        categoryName === suggestedCategory ||
        (categoryName && (
          suggestedCategory.includes(categoryName) || categoryName.includes(suggestedCategory)
        ))
      );
    });

    return {
      areaId: getEntityId(matchedArea, 'areaId'),
      categoryId: getEntityId(matchedCategory, 'categoryId'),
    };
  };

  const startNewConversation = () => {
    setNewConversationMode(true);
    setAiSessionReady(true);
    activeConversationIdRef.current = null;
    setActiveConversationId(null);
    try {
      window.localStorage.removeItem(activeConversationStorageKey);
    } catch (error) {
      console.warn('Unable to clear active AI conversation', error);
    }
    resetDraftFlow();
    setChatMessages([
      {
        sender: 'ai',
        text: routeFeedbackId
          ? `Bạn đang chat theo ngữ cảnh phản ánh #${routeFeedbackId}. Hãy nhập câu hỏi cần AI hỗ trợ.`
          : 'Chào bạn! Nếu muốn tạo phản ánh, hãy nhắn “tạo phản ánh”, tôi sẽ hỏi từng thông tin một.',
      },
    ]);
  };

  const toggleChat = () => {
    if (!chatOpen) setAiSessionReady(false);
    setChatOpen((current) => !current);
  };

  const handleDraftStepMessage = (userMsg) => {
    if (draftStep === DRAFT_STEPS.TITLE) {
      setDraftTitle(userMsg);
      setDraftStep(DRAFT_STEPS.DESCRIPTION);
      setChatMessages((current) => [
        ...current,
        { sender: 'ai', text: getDraftQuestion(DRAFT_STEPS.DESCRIPTION) },
      ]);
      return true;
    }

    if (draftStep === DRAFT_STEPS.DESCRIPTION) {
      setDraftDescription(userMsg);
      const nextReflection = buildReflectionText(draftTitle, userMsg);
      setReflection(nextReflection);
      setDraftStep(DRAFT_STEPS.CATEGORY);
      setChatMessages((current) => [
        ...current,
        { sender: 'ai', text: getDraftQuestion(DRAFT_STEPS.CATEGORY) },
      ]);
      return true;
    }

    if (draftStep === DRAFT_STEPS.CATEGORY) {
      setDraftCategory(userMsg);
      setDraftStep(DRAFT_STEPS.LOCATION);
      setChatMessages((current) => [
        ...current,
        { sender: 'ai', text: getDraftQuestion(DRAFT_STEPS.LOCATION) },
      ]);
      return true;
    }

    if (draftStep === DRAFT_STEPS.LOCATION) {
      setLocationText(userMsg);
      setDraftStep(DRAFT_STEPS.EVIDENCE);
      setChatMessages((current) => [
        ...current,
        { sender: 'ai', text: getDraftQuestion(DRAFT_STEPS.EVIDENCE) },
      ]);
      return true;
    }

    if (draftStep === DRAFT_STEPS.EVIDENCE) {
      setDraftStep(DRAFT_STEPS.READY);
      setChatMessages((current) => [
        ...current,
        { sender: 'ai', text: getDraftQuestion(DRAFT_STEPS.READY) },
      ]);
      return true;
    }

    if (draftStep === DRAFT_STEPS.READY) {
      setChatMessages((current) => [
        ...current,
        { sender: 'ai', text: 'Thông tin đã sẵn sàng. Bạn bấm “Gửi phản ánh” để gửi trực tiếp đến hệ thống.' },
      ]);
      return true;
    }

    return false;
  };

  const handleSendMessage = async () => {
    if (!inputVal.trim() || messagesLoading) return;
    if (!aiSessionReady && !newConversationMode) return;

    const userMsg = inputVal.trim();
    const requestedConversationId = activeConversationIdRef.current;
    const requestedConversationKey = requestedConversationId == null
      ? '__new__'
      : String(requestedConversationId);
    if (pendingAiConversationKeysRef.current.has(requestedConversationKey)) return;

    setInputVal('');
    setChatMessages((current) => [...current, { sender: 'user', text: userMsg }]);

    if (draftStep !== DRAFT_STEPS.IDLE && handleDraftStepMessage(userMsg)) {
      return;
    }

    if (DRAFT_INTENT_REGEX.test(userMsg)) {
      pendingAiConversationKeysRef.current.add(requestedConversationKey);
      setPendingAiConversationKeys([...pendingAiConversationKeysRef.current]);

      try {
        const payload = {
          conversationId: requestedConversationId ?? null,
          message: userMsg,
          ...(requestedConversationId == null && routeFeedbackId ? { feedbackId: routeFeedbackId } : {}),
        };
        const response = await toolsApi.getAiChatReply(payload);
        const nextConversationId = getAiConversationId(response);

        if (nextConversationId != null) {
          setNewConversationMode(false);
          activeConversationIdRef.current = nextConversationId;
          setActiveConversationId(nextConversationId);

          try {
            window.localStorage.setItem(
              activeConversationStorageKey,
              String(nextConversationId)
            );
          } catch (error) {
            console.warn('Unable to persist active AI conversation', error);
          }
        }

        // Keep the guided feedback flow deterministic on the FE, but make
        // sure the first intent message has already created/resumed a real
        // backend conversation before entering that flow.
        startDraftFlow();
        loadConversations();
        announceAiSync('conversation-created');
      } catch (error) {
        setChatMessages((current) => [
          ...current,
          {
            sender: 'ai',
            text: error?.message
              || 'Chưa thể lưu hội thoại AI mới. Vui lòng thử lại để đảm bảo đoạn chat được giữ lại.',
          },
        ]);
      } finally {
        pendingAiConversationKeysRef.current.delete(requestedConversationKey);
        setPendingAiConversationKeys([...pendingAiConversationKeysRef.current]);
      }

      return;
    }

    pendingAiConversationKeysRef.current.add(requestedConversationKey);
    setPendingAiConversationKeys([...pendingAiConversationKeysRef.current]);

    const isRequestConversationStillActive = () => {
      const currentConversationId = activeConversationIdRef.current;
      const currentConversationKey = currentConversationId == null
        ? '__new__'
        : String(currentConversationId);
      return currentConversationKey === requestedConversationKey;
    };

    try {
      const payload = {
        conversationId: requestedConversationId ?? null,
        message: userMsg,
        ...(requestedConversationId == null && routeFeedbackId ? { feedbackId: routeFeedbackId } : {}),
      };
      const response = await toolsApi.getAiChatReply(payload);
      const replyText = getAiMessageText(response);
      const nextConversationId = getAiConversationId(response);
      const requestStillActive = isRequestConversationStillActive();

      if (nextConversationId != null) {
        if (
          requestedConversationId != null &&
          String(requestedConversationId) !== String(nextConversationId)
        ) {
          console.warn('AI chat returned a different conversationId than requested', {
            requestedConversationId,
            responseConversationId: nextConversationId,
          });
        }

        if (requestStillActive) {
          setNewConversationMode(false);
          activeConversationIdRef.current = nextConversationId;
          setActiveConversationId(nextConversationId);
          try {
            window.localStorage.setItem(activeConversationStorageKey, String(nextConversationId));
          } catch (error) {
            console.warn('Unable to persist active AI conversation', error);
          }
        }
      }

      if (requestStillActive) {
        setChatMessages((current) => [
          ...current,
          {
            sender: 'ai',
            text: replyText || 'Mình đã ghi nhận nội dung. Hãy bổ sung vị trí và ảnh nếu có, sau đó bấm “Tạo bản nháp phản ánh”.',
          },
        ]);
      }
      loadConversations();
      announceAiSync('message-sent');
    } catch (error) {
      if (isRequestConversationStillActive()) {
        setChatMessages((current) => [
          ...current,
          {
            sender: 'ai',
            text: error?.message || 'Chưa thể kết nối AI chat. Bạn vẫn có thể nhập đủ thông tin và tạo bản nháp phản ánh.',
          },
        ]);
      }
      loadConversations();
    } finally {
      pendingAiConversationKeysRef.current.delete(requestedConversationKey);
      setPendingAiConversationKeys([...pendingAiConversationKeysRef.current]);
    }
  };

  const handleUseBrowserLocation = () => {
    if (!navigator.geolocation) {
      setChatMessages((current) => [
        ...current,
        { sender: 'ai', text: 'Trình duyệt chưa hỗ trợ lấy GPS. Bạn hãy nhập vị trí dạng văn bản.' },
      ]);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLatitude = position.coords.latitude;
        const nextLongitude = position.coords.longitude;
        setLatitude(String(nextLatitude));
        setLongitude(String(nextLongitude));
        setLocationText((current) => current || `Vị trí GPS: ${nextLatitude.toFixed(6)}, ${nextLongitude.toFixed(6)}`);
        if (draftStep === DRAFT_STEPS.LOCATION) {
          setDraftStep(DRAFT_STEPS.EVIDENCE);
        }
        setChatMessages((current) => [
          ...current,
          {
            sender: 'ai',
            text: draftStep === DRAFT_STEPS.LOCATION
              ? `Đã lấy GPS: ${nextLatitude.toFixed(6)}, ${nextLongitude.toFixed(6)}. ${getDraftQuestion(DRAFT_STEPS.EVIDENCE)}`
              : `Đã lấy GPS: ${nextLatitude.toFixed(6)}, ${nextLongitude.toFixed(6)}.`,
          },
        ]);
      },
      () => {
        setChatMessages((current) => [
          ...current,
          { sender: 'ai', text: 'Không thể lấy GPS. Bạn hãy nhập vị trí dạng văn bản.' },
        ]);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleImageSelect = (event) => {
    const files = Array.from(event.target.files || []).filter((file) => file.type.startsWith('image/'));
    const nextImages = files.slice(0, 5);
    setSelectedImages(nextImages);
    if (nextImages.length > 0) {
      if (draftStep === DRAFT_STEPS.EVIDENCE) {
        setDraftStep(DRAFT_STEPS.READY);
      }
      setChatMessages((current) => [
        ...current,
        {
          sender: 'ai',
          text: draftStep === DRAFT_STEPS.EVIDENCE
            ? `Đã đính kèm ${nextImages.length} ảnh minh chứng: ${nextImages.map((file) => file.name).join(', ')}. ${getDraftQuestion(DRAFT_STEPS.READY)}`
            : `Đã đính kèm ${nextImages.length} ảnh minh chứng: ${nextImages.map((file) => file.name).join(', ')}.`,
        },
      ]);
    }
  };

  const handleCreateDraft = async () => {
    const collectedTitle = draftTitle.trim();
    const collectedDescription = draftDescription.trim() || reflection.trim() || inputVal.trim();
    const collectedLocation = locationText.trim();
    const text = buildReflectionText(collectedTitle, collectedDescription, collectedLocation).trim() || inputVal.trim();
    if (!text || creatingDraft) {
      setChatMessages((current) => [
        ...current,
        { sender: 'ai', text: 'Bạn hãy nhập nội dung phản ánh trước khi tạo bản nháp.' },
      ]);
      return;
    }

    setCreatingDraft(true);

    try {
      const finalDraft = {
        title: collectedTitle || 'Phản ánh đô thị',
        description: collectedDescription || text,
        location: collectedLocation,
        latitude: latitude === '' ? null : Number(latitude),
        longitude: longitude === '' ? null : Number(longitude),
        suggestedCategory: draftCategory,
        confirmationMessage: 'Đã lấy thông tin bạn cung cấp. Vui lòng kiểm tra và gửi phản ánh.',
      };

      const resolvedIds = await resolveFeedbackRequiredIds(finalDraft);
      const submission = buildCitizenFeedbackSubmission({
        resolvedIds,
        title: finalDraft.title,
        description: finalDraft.description,
        suggestedCategory: finalDraft.suggestedCategory,
        location: finalDraft.location,
        latitude: finalDraft.latitude,
        longitude: finalDraft.longitude,
        attachments: selectedImages,
      });

      if (submission.type === 'complete-in-form') {
        navigate('/tickets/create', {
          state: {
            aiDraft: submission.draft,
            aiDraftSource: {
              reflection: text,
              title: finalDraft.title,
              description: finalDraft.description,
              location: finalDraft.location,
              imageNames: selectedImages.map((file) => file.name),
              attachments: submission.attachments,
              storageKey: draftStorageKey,
              createAttempted: true,
            },
          },
        });
        setChatOpen(false);
        return;
      }

      const response = await ticketApi.createTicket(
        user?.userId,
        user?.fullName || user?.name,
        submission.ticketData,
        { role: user?.role || APP_ROLES.SERVICE_USER }
      );

      const createdFeedbackId = response?.data?.feedbackId || response?.data?.id || response?.feedbackId || response?.id;
      setChatMessages((current) => [
        ...current,
        {
          sender: 'ai',
          text: createdFeedbackId
            ? `Đã tạo phản ánh thành công (#${createdFeedbackId}). Bạn có thể theo dõi trong mục “Phản ánh của tôi”.`
            : 'Đã tạo phản ánh thành công. Bạn có thể theo dõi trong mục “Phản ánh của tôi”.',
        },
      ]);
      resetDraftFlow();
      loadConversations();
    } catch (error) {
      setChatMessages((current) => [
        ...current,
        {
          sender: 'ai',
          text: error?.message || 'Không thể gửi phản ánh. Dữ liệu bản nháp vẫn được giữ để bạn thử lại.',
        },
      ]);
    } finally {
      setCreatingDraft(false);
    }
  };

  const activeAiConversationKey = activeConversationId == null
    ? (newConversationMode ? '__new__' : null)
    : String(activeConversationId);
  const currentConversationWaitingForReply = Boolean(
    activeAiConversationKey && pendingAiConversationKeys.includes(activeAiConversationKey)
  );

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (suppressAiClickRef.current) {
            suppressAiClickRef.current = false;
            return;
          }
          toggleChat();
        }}
        onPointerDown={handleAiPointerDown}
        onPointerMove={handleAiPointerMove}
        onPointerUp={finishAiDrag}
        onPointerCancel={finishAiDrag}
        aria-label={chatOpen ? 'Đóng trung tâm hỗ trợ' : 'Mở trung tâm hỗ trợ'}
        title="Trung tâm hỗ trợ: AI và trao đổi riêng với nhân viên"
        className={`group fixed right-5 z-40 bottom-24 flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(145deg,#2563eb,#4f46e5)] text-white shadow-[0_16px_36px_rgba(37,99,235,.30)] transition-[transform,box-shadow] hover:scale-105 sm:right-6 md:bottom-auto md:cursor-grab md:touch-none md:active:cursor-grabbing lg:right-8 ${
          aiDragging ? 'scale-105 shadow-2xl ring-4 ring-blue-500/15' : ''
        }`}
        style={
          typeof window !== 'undefined' && window.innerWidth >= 768
            ? {
                top: `${aiDragTop ?? getAiDockTop(aiDock)}px`,
                bottom: 'auto',
                touchAction: 'none',
              }
            : undefined
        }
      >
        <Lucide.MessagesSquare size={23} aria-hidden="true" />
        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-indigo-600 text-white shadow-sm">
          <Lucide.Sparkles size={10} aria-hidden="true" />
        </span>
      </button>

      {chatOpen ? (
        <div className="fixed inset-0 z-[2198] bg-slate-950/15 backdrop-blur-[1px]" onClick={() => setChatOpen(false)} />
      ) : null}

      <div
        className={`fixed inset-y-0 right-0 z-[2200] w-[min(26rem,calc(100vw-1rem))] transform border-l border-[var(--public-border)] bg-white shadow-[-22px_0_70px_rgba(15,23,42,.16)] transition-transform duration-300 dark:bg-slate-950 ${
          chatOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex h-full min-h-0 flex-col">
          <header className="border-b border-[var(--public-border)] bg-[linear-gradient(135deg,#1d4ed8,#2563eb_55%,#4f46e5)] px-5 pb-4 pt-4 text-white">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/12 ring-1 ring-white/15">
                  <Lucide.Headphones size={19} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-bold">Trung tâm hỗ trợ</h2>
                  <p className="mt-0.5 text-[11px] leading-4 text-blue-100">
                    AI hỗ trợ sử dụng hệ thống · Nhân viên trao đổi riêng theo từng phản ánh
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Đóng trung tâm hỗ trợ"
                title="Đóng"
                onClick={toggleChat}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white/85 transition hover:bg-white/10 hover:text-white"
              >
                <Lucide.X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-1 rounded-2xl bg-black/10 p-1">
              <button
                type="button"
                onClick={() => setActiveSupportChannel('ai')}
                aria-pressed={activeSupportChannel === 'ai'}
                className={`inline-flex h-9 items-center justify-center gap-2 rounded-xl text-xs font-bold transition ${
                  activeSupportChannel === 'ai'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-blue-100 hover:bg-white/8 hover:text-white'
                }`}
              >
                <Lucide.Sparkles size={14} aria-hidden="true" />
                Trợ lý AI
              </button>
              <button
                type="button"
                onClick={() => setActiveSupportChannel('staff')}
                aria-pressed={activeSupportChannel === 'staff'}
                className={`inline-flex h-9 items-center justify-center gap-2 rounded-xl text-xs font-bold transition ${
                  activeSupportChannel === 'staff'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-blue-100 hover:bg-white/8 hover:text-white'
                }`}
              >
                <Lucide.UserRoundCheck size={14} aria-hidden="true" />
                Nhân viên
              </button>
            </div>
          </header>

          {activeSupportChannel === 'ai' ? (
            <>
              <div className="border-b border-[var(--public-border)] bg-white px-4 py-3 dark:bg-slate-950">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                    Hội thoại AI của tôi
                  </span>
                  <button
                    type="button"
                    onClick={startNewConversation}
                    className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold text-blue-600 transition hover:bg-blue-50"
                  >
                    <Lucide.Plus size={12} aria-hidden="true" />
                    Chat mới
                  </button>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1">
                  {conversationsLoading ? (
                    <span className="loading loading-dots loading-xs" />
                  ) : conversations.length > 0 ? conversations.map((conversation) => {
                    const conversationId = conversation.conversationId ?? conversation.id;
                    const isDeleting = String(deletingConversationId ?? '') === String(conversationId);
                    const isPending = pendingAiConversationKeys.includes(String(conversationId));
                    return (
                      <div
                        key={conversationId}
                        className={`group relative max-w-44 shrink-0 rounded-xl border transition ${
                          String(activeConversationId) === String(conversationId)
                            ? 'border-blue-300 bg-blue-50 text-blue-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => selectConversation(conversationId)}
                          className="block w-full rounded-xl py-2 pl-3 pr-9 text-left text-[11px]"
                        >
                          <span className="block truncate font-bold">
                            {conversation.title || `Hội thoại #${conversationId}`}
                          </span>
                          <span className="mt-0.5 block truncate text-slate-400">
                            {conversation.lastMessage
                              || (Number(conversation.messageCount) > 0
                                ? `${conversation.messageCount} tin nhắn`
                                : 'Hội thoại AI')}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDeleteConversation(conversationId);
                          }}
                          disabled={isDeleting || isPending}
                          className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 opacity-70 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-35 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                          title={isPending ? 'Đợi AI trả lời xong trước khi xóa' : 'Xóa hội thoại'}
                          aria-label={`Xóa ${conversation.title || `hội thoại ${conversationId}`}`}
                        >
                          {isDeleting
                            ? <Lucide.LoaderCircle size={13} className="animate-spin" />
                            : <Lucide.Trash2 size={13} />}
                        </button>
                      </div>
                    );
                  }) : (
                    <span className="text-[11px] text-slate-400">Chưa có hội thoại AI cũ.</span>
                  )}
                </div>
                {conversationActionError ? (
                  <p className="mt-2 text-[11px] leading-4 text-red-600 dark:text-red-300">
                    {conversationActionError}
                  </p>
                ) : null}
              </div>

              <div
                ref={aiMessageListRef}
                className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-slate-50/80 p-4 dark:bg-slate-950/45"
              >
                <div className="rounded-2xl border border-blue-100 bg-blue-50/70 px-3.5 py-3 text-xs leading-5 text-blue-700 dark:border-blue-500/15 dark:bg-blue-500/5 dark:text-blue-300">
                  <div className="flex items-center gap-2 font-bold">
                    <Lucide.Bot size={14} aria-hidden="true" />
                    Trợ lý tự động
                  </div>
                  <p className="mt-1 text-blue-600/80 dark:text-blue-300/70">
                    AI có thể hướng dẫn sử dụng, giải thích quy trình và hỗ trợ soạn phản ánh; không đại diện cho cam kết xử lý của nhân viên.
                  </p>
                </div>

                {messagesLoading ? (
                  <div className="flex justify-center py-4">
                    <span className="loading loading-spinner loading-sm" />
                  </div>
                ) : null}

                {chatMessages.map((message, index) => (
                  <div key={`${message.sender}-${index}`} className={`flex ${message.sender === 'ai' ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[86%] rounded-[18px] px-3.5 py-2.5 text-sm leading-5 ${
                      message.sender === 'ai'
                        ? 'border border-slate-200 bg-white text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200'
                        : 'bg-blue-600 text-white shadow-[0_8px_20px_rgba(37,99,235,.16)]'
                    }`}>
                      {message.text}
                    </div>
                  </div>
                ))}

                {currentConversationWaitingForReply ? (
                  <div className="flex justify-start">
                    <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                      <span className="loading loading-dots loading-xs" />
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="border-t border-[var(--public-border)] bg-white px-4 py-3 dark:bg-slate-950">
                <div className="mb-2 grid grid-cols-[1fr_auto_auto] gap-2">
                  <button
                    type="button"
                    onClick={draftStep === DRAFT_STEPS.IDLE ? startDraftFlow : handleCreateDraft}
                    disabled={creatingDraft}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-50 px-3 text-xs font-bold text-blue-700 transition hover:bg-blue-100 disabled:opacity-50 dark:bg-blue-500/10 dark:text-blue-300"
                  >
                    {creatingDraft ? <span className="loading loading-spinner loading-xs" /> : <Lucide.FilePlus2 size={13} />}
                    {draftStep === DRAFT_STEPS.IDLE ? 'Tạo phản ánh' : 'Gửi phản ánh'}
                  </button>
                  <button type="button" onClick={handleUseBrowserLocation} className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 px-2.5 text-slate-500 hover:text-blue-600" title="Lấy GPS">
                    <Lucide.MapPin size={14} />
                  </button>
                  <label className="inline-flex h-9 cursor-pointer items-center justify-center rounded-xl border border-slate-200 px-2.5 text-slate-500 hover:text-blue-600" title="Đính kèm ảnh">
                    <Lucide.ImagePlus size={14} />
                    <input type="file" accept="image/*" multiple onChange={handleImageSelect} className="hidden" />
                  </label>
                </div>

                {draftStep !== DRAFT_STEPS.IDLE || selectedImages.length > 0 || locationText ? (
                  <div className="mb-2 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-900">
                    <input
                      type="text"
                      value={locationText}
                      onChange={(event) => setLocationText(event.target.value)}
                      placeholder="Vị trí phản ánh"
                      className="w-full bg-transparent text-xs outline-none placeholder:text-slate-400"
                    />
                    {selectedImages.length > 0 ? (
                      <p className="mt-1 truncate text-[10px] text-slate-400">
                        {selectedImages.length} ảnh đã chọn
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={!aiSessionReady && !newConversationMode
                      ? 'Đang mở hội thoại gần nhất...'
                      : draftStep === DRAFT_STEPS.IDLE
                        ? 'Hỏi AI hoặc nhập “tạo phản ánh”...'
                        : 'Trả lời câu hỏi hiện tại...'}
                    aria-label="Nhắn với trợ lý AI"
                    disabled={!aiSessionReady || messagesLoading || currentConversationWaitingForReply}
                    value={inputVal}
                    onChange={(event) => setInputVal(event.target.value)}
                    onKeyDown={(event) => event.key === 'Enter' && handleSendMessage()}
                    className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100 dark:border-slate-800 dark:bg-slate-900"
                  />
                  <button
                    type="button"
                    onClick={handleSendMessage}
                    aria-label="Gửi tin nhắn cho AI"
                    title="Gửi"
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700 disabled:opacity-50"
                    disabled={currentConversationWaitingForReply || messagesLoading || !aiSessionReady || !inputVal.trim()}
                  >
                    <Lucide.SendHorizontal size={15} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="border-b border-[var(--public-border)] bg-white px-4 py-3 dark:bg-slate-950">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-600">Trao đổi riêng</p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Chọn phản ánh cần trao đổi với bộ phận xử lý.</p>
                  </div>
                  <button
                    type="button"
                    onClick={loadStaffTickets}
                    disabled={staffTicketsLoading}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-50 hover:text-blue-600 disabled:opacity-50 dark:hover:bg-slate-900"
                    aria-label="Làm mới danh sách phản ánh"
                  >
                    <Lucide.RefreshCw size={14} className={staffTicketsLoading ? 'animate-spin' : ''} aria-hidden="true" />
                  </button>
                </div>

                {staffTicketsError ? (
                  <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{staffTicketsError}</div>
                ) : null}

                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  {staffTicketsLoading && sortedStaffTickets.length === 0 ? (
                    [1, 2].map((item) => <div key={item} className="h-14 w-40 shrink-0 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-900" />)
                  ) : sortedStaffTickets.length > 0 ? sortedStaffTickets.map((ticket) => {
                    const feedbackId = getFeedbackId(ticket);
                    const selected = String(selectedStaffFeedbackId) === String(feedbackId);
                    return (
                      <button
                        key={feedbackId}
                        type="button"
                        onClick={() => setSelectedStaffFeedbackId(String(feedbackId))}
                        className={`w-44 shrink-0 rounded-xl border px-3 py-2 text-left transition ${
                          selected
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-800 shadow-sm dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
                        }`}
                      >
                        <span className="block truncate text-xs font-bold">{getFeedbackTitle(ticket)}</span>
                        <span className="mt-1 block truncate text-[10px] text-slate-400">{getFeedbackStatusLabel(ticket?.status)}</span>
                      </button>
                    );
                  }) : (
                    <button
                      type="button"
                      onClick={() => { setChatOpen(false); navigate('/tickets/create'); }}
                      className="inline-flex h-10 items-center gap-2 rounded-xl border border-dashed border-blue-200 px-3 text-xs font-semibold text-blue-700"
                    >
                      <Lucide.Plus size={13} aria-hidden="true" />
                      Chưa có phản ánh · Tạo mới
                    </button>
                  )}
                </div>
              </div>

              {selectedStaffFeedbackId ? (
                <>
                  <div className="flex items-center justify-between gap-3 border-b border-[var(--public-border)] bg-slate-50/70 px-4 py-2.5 dark:bg-slate-950/60">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-bold text-slate-800 dark:text-slate-100">
                        {selectedStaffTicket ? getFeedbackTitle(selectedStaffTicket) : `Phản ánh #${String(selectedStaffFeedbackId).slice(0, 8)}`}
                      </div>
                      <div className="mt-0.5 text-[10px] text-slate-400">
                        {selectedStaffTicket ? getFeedbackStatusLabel(selectedStaffTicket?.status) : 'Trao đổi riêng theo phản ánh'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setChatOpen(false); navigate(`/tickets/${selectedStaffFeedbackId}`); }}
                      className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold text-blue-600 transition hover:bg-blue-50"
                    >
                      Xem phản ánh
                      <Lucide.ArrowUpRight size={12} aria-hidden="true" />
                    </button>
                  </div>
                  <FeedbackMessagesProvider feedbackId={selectedStaffFeedbackId} includeInternal={false}>
                    <CitizenStaffSupportPanel currentUserId={user?.userId || user?.id} />
                  </FeedbackMessagesProvider>
                </>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center bg-slate-50/70 px-6 text-center dark:bg-slate-950/45">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                    <Lucide.MessagesSquare size={20} aria-hidden="true" />
                  </span>
                  <p className="mt-3 text-sm font-bold text-slate-900 dark:text-white">Chọn một phản ánh để trao đổi</p>
                  <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500 dark:text-slate-400">
                    Mỗi phản ánh có một cuộc trò chuyện riêng với nhân viên. Người dân khác trong cùng sự vụ không nhìn thấy nội dung này.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {deleteConversationTarget ? (
        <div
          className="fixed inset-0 z-[10080] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-[2px]"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && deletingConversationId == null) {
              setDeleteConversationTarget(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-ai-conversation-title"
            className="w-full max-w-sm rounded-[22px] border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300">
                <Lucide.Trash2 size={18} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 id="delete-ai-conversation-title" className="text-base font-bold text-slate-900 dark:text-white">Xóa hội thoại AI?</h3>
                <p className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">
                  {deleteConversationTarget.title
                    ? <>Hội thoại <span className="font-semibold text-slate-700 dark:text-slate-200">“{deleteConversationTarget.title}”</span> và toàn bộ tin nhắn bên trong sẽ bị xóa.</>
                    : 'Hội thoại này và toàn bộ tin nhắn bên trong sẽ bị xóa.'}
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConversationTarget(null)}
                disabled={deletingConversationId != null}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={confirmDeleteConversation}
                disabled={deletingConversationId != null}
                className="inline-flex h-10 min-w-24 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
              >
                {deletingConversationId != null ? <Lucide.LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : <Lucide.Trash2 size={15} aria-hidden="true" />}
                Xóa
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default CitizenAiCopilot;
