import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { APP_ROLES } from '@urbanmind/shared-types';

import { useAuth } from '../../contexts/AuthContext';
import { FeedbackMessagesProvider } from '../../contexts/FeedbackMessagesContext';
import { useFeedbackMessages } from '../../contexts/FeedbackMessagesContextHook';
import { ticketApi } from '../../services/api/ticketApi';
import { normalizeRole } from '../../utils/roleMap';

const formatDateTime = (value) => {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
};

const isSameUser = (message, currentUserId) => {
  if (!currentUserId || !message?.userId) return false;
  return String(message.userId) === String(currentUserId);
};

const getSenderLabel = (message, ownMessage) => {
  if (ownMessage) return 'Bạn';

  return (
    message?.userFullName ||
    message?.userName ||
    message?.senderName ||
    'Bộ phận xử lý'
  );
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

const getStatusLabel = (status) => {
  const normalized = String(status || '').trim();

  switch (normalized) {
    case 'Submitted':
      return 'Đã gửi';
    case 'AIReviewed':
      return 'Đang phân loại';
    case 'Verified':
      return 'Đã xác minh';
    case 'Assigned':
      return 'Đã phân công';
    case 'InProgress':
      return 'Đang xử lý';
    case 'Resolved':
    case 'SubmittedForApproval':
      return 'Đang kiểm tra kết quả';
    case 'NeedRework':
      return 'Cần bổ sung';
    case 'Approved':
      return 'Chờ đánh giá';
    case 'Closed':
      return 'Đã đóng';
    case 'Rejected':
      return 'Không tiếp nhận';
    case 'Cancelled':
      return 'Đã hủy';
    default:
      return normalized || 'Đang cập nhật';
  }
};

function CitizenFeedbackThread({ currentUserId }) {
  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState('');
  const endRef = useRef(null);

  const {
    messages,
    messagesLoading,
    messagesError,
    messageSubmitting,
    loadMessages,
    sendMessage,
  } = useFeedbackMessages();

  const publicMessages = useMemo(() => {
    if (!Array.isArray(messages)) return [];

    return messages
      .filter((message) => message && !message.isInternal)
      .sort((left, right) => new Date(left.createdAt || 0) - new Date(right.createdAt || 0));
  }, [messages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [publicMessages.length]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    const messageText = draft.trim();
    if (!messageText || messageSubmitting) return;

    setSendError('');

    try {
      await sendMessage({
        messageText,
        isInternal: false,
      });
      setDraft('');
    } catch (error) {
      console.error('Failed to send citizen feedback message', error);
      setSendError(error?.message || 'Không thể gửi tin nhắn. Vui lòng thử lại.');
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-base-300 bg-base-100 px-4 py-2.5 sm:px-5">
        <div className="flex items-center gap-2 text-xs text-base-content/50">
          <Lucide.LockKeyhole size={13} aria-hidden="true" />
          Trao đổi riêng theo phản ánh
        </div>
        <button
          type="button"
          onClick={() => loadMessages({ keepMessagesOnError: true })}
          disabled={messagesLoading}
          className="btn btn-ghost btn-xs rounded-lg text-base-content/60"
        >
          <Lucide.RefreshCw size={13} className={messagesLoading ? 'animate-spin' : ''} aria-hidden="true" />
          Làm mới
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-base-200 px-4 py-4 sm:px-5">
        {messagesLoading && publicMessages.length === 0 ? (
          <div className="flex h-full min-h-[240px] items-center justify-center gap-2 text-sm text-base-content/55">
            <span className="loading loading-spinner loading-sm" />
            Đang tải trao đổi...
          </div>
        ) : messagesError && publicMessages.length === 0 ? (
          <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 text-center">
            <Lucide.MessageSquareWarning size={26} className="text-error" aria-hidden="true" />
            <p className="max-w-xs text-sm text-error">{messagesError}</p>
            <button type="button" onClick={() => loadMessages()} className="btn btn-outline btn-sm rounded-xl">
              Thử lại
            </button>
          </div>
        ) : publicMessages.length === 0 ? (
          <div className="flex h-full min-h-[240px] flex-col items-center justify-center text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Lucide.MessageCircle size={21} aria-hidden="true" />
            </span>
            <p className="mt-3 text-sm font-semibold">Chưa có trao đổi nào</p>
            <p className="mt-1 max-w-xs text-sm leading-6 text-base-content/55">
              Gửi câu hỏi hoặc bổ sung thông tin liên quan đến quá trình xử lý phản ánh này.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {publicMessages.map((message, index) => {
              const ownMessage = isSameUser(message, currentUserId);
              const messageKey = message.interactionMessageId || message.id || `${message.createdAt || 'message'}-${index}`;

              return (
                <div key={messageKey} className={`flex ${ownMessage ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[82%] rounded-2xl border px-3.5 py-3 shadow-sm ${
                      ownMessage
                        ? 'border-primary/20 bg-primary text-primary-content'
                        : 'border-base-300 bg-base-100 text-base-content'
                    }`}
                  >
                    <div className={`text-xs font-semibold ${ownMessage ? 'text-primary-content' : 'text-base-content/75'}`}>
                      {getSenderLabel(message, ownMessage)}
                    </div>
                    <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-6">
                      {message.messageText || ''}
                    </p>
                    <time
                      dateTime={message.createdAt || undefined}
                      className={`mt-2 block text-[11px] ${
                        ownMessage
                          ? 'text-right text-primary-content/70'
                          : 'text-left text-base-content/45'
                      }`}
                    >
                      {formatDateTime(message.createdAt)}
                    </time>
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-base-300 bg-base-100 px-4 py-3 sm:px-5 sm:py-4">
        <label htmlFor="citizen-feedback-inbox-message" className="sr-only">
          Tin nhắn gửi bộ phận xử lý
        </label>
        <div className="flex items-end gap-2">
          <textarea
            id="citizen-feedback-inbox-message"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              if (sendError) setSendError('');
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                handleSubmit(event);
              }
            }}
            rows={2}
            disabled={messageSubmitting}
            placeholder="Nhập nội dung cần trao đổi..."
            className="textarea textarea-bordered min-h-[52px] flex-1 resize-none rounded-xl bg-base-100"
          />
          <button
            type="submit"
            disabled={!draft.trim() || messageSubmitting}
            className="btn btn-primary btn-square shrink-0 rounded-xl"
            aria-label="Gửi tin nhắn"
          >
            {messageSubmitting ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              <Lucide.Send size={17} aria-hidden="true" />
            )}
          </button>
        </div>

        {sendError ? (
          <p className="mt-2 text-sm text-error" role="alert">{sendError}</p>
        ) : messagesError && publicMessages.length > 0 ? (
          <p className="mt-2 text-xs text-warning">{messagesError}</p>
        ) : (
          <p className="mt-2 text-[11px] text-base-content/45">Enter để gửi, Shift + Enter để xuống dòng.</p>
        )}
      </form>
    </div>
  );
}

export default function CitizenFeedbackInbox() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [selectedFeedbackId, setSelectedFeedbackId] = useState('');
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketsError, setTicketsError] = useState('');
  const [bubbleY, setBubbleY] = useState(null);
  const dragRef = useRef(null);
  const suppressClickRef = useRef(false);

  const isCitizen = isAuthenticated && normalizeRole(user?.role) === APP_ROLES.SERVICE_USER;
  const currentUserId = user?.userId || user?.id || '';

  const bubbleStorageKey = useMemo(
    () => `urbanmind:citizen-feedback-inbox-bubble-y:${currentUserId || 'anonymous'}`,
    [currentUserId]
  );

  const sortedTickets = useMemo(() => {
    return [...tickets].sort((left, right) => {
      const leftTime = new Date(getFeedbackUpdatedAt(left) || 0).getTime();
      const rightTime = new Date(getFeedbackUpdatedAt(right) || 0).getTime();
      return rightTime - leftTime;
    });
  }, [tickets]);

  const selectedTicket = useMemo(
    () => sortedTickets.find((ticket) => String(getFeedbackId(ticket)) === String(selectedFeedbackId)) || null,
    [selectedFeedbackId, sortedTickets]
  );

  const loadTickets = useCallback(async () => {
    if (!isCitizen) {
      setTickets([]);
      setSelectedFeedbackId('');
      return;
    }

    setTicketsLoading(true);
    setTicketsError('');

    try {
      const response = await ticketApi.getAllTickets(
        { pageSize: 100 },
        { role: 'service-user' }
      );

      const nextTickets = Array.isArray(response) ? response.filter((ticket) => getFeedbackId(ticket)) : [];
      setTickets(nextTickets);

      setSelectedFeedbackId((current) => {
        if (current && nextTickets.some((ticket) => String(getFeedbackId(ticket)) === String(current))) {
          return current;
        }

        return nextTickets.length > 0 ? String(getFeedbackId(nextTickets[0])) : '';
      });
    } catch (error) {
      console.error('Failed to load citizen feedback inbox tickets', error);
      setTicketsError(error?.message || 'Không thể tải danh sách phản ánh.');
    } finally {
      setTicketsLoading(false);
    }
  }, [isCitizen]);

  useEffect(() => {
    if (!isCitizen) return;
    loadTickets();
  }, [isCitizen, loadTickets]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const dashboardScrollContainer = document.querySelector('[data-dashboard-scroll-container]');
    const previousDashboardOverflow = dashboardScrollContainer?.style.overflowY || '';

    document.body.style.overflow = 'hidden';
    if (dashboardScrollContainer) {
      dashboardScrollContainer.style.overflowY = 'hidden';
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      if (dashboardScrollContainer) {
        dashboardScrollContainer.style.overflowY = previousDashboardOverflow;
      }
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const bubbleSize = 56;
    const topLimit = 84;
    const bottomMargin = 24;

    const clampY = (value) =>
      Math.min(
        Math.max(topLimit, value),
        Math.max(topLimit, window.innerHeight - bubbleSize - bottomMargin)
      );

    try {
      const stored = JSON.parse(window.localStorage.getItem(bubbleStorageKey) || 'null');
      if (stored && Number.isFinite(stored.y)) {
        setBubbleY(clampY(stored.y));
      } else {
        setBubbleY(clampY(window.innerHeight - bubbleSize - bottomMargin));
      }
    } catch {
      setBubbleY(clampY(window.innerHeight - bubbleSize - bottomMargin));
    }

    const handleResize = () => {
      setBubbleY((current) => {
        if (!Number.isFinite(current)) return current;
        const next = clampY(current);
        window.localStorage.setItem(bubbleStorageKey, JSON.stringify({ y: next }));
        return next;
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [bubbleStorageKey]);

  const handleOpen = () => {
    setIsOpen(true);
    loadTickets();
  };

  const handleBubblePointerDown = (event) => {
    if (!Number.isFinite(bubbleY) || event.button !== 0) return;

    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      originY: bubbleY,
      moved: false,
      latestY: bubbleY,
    };
    suppressClickRef.current = false;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handleBubblePointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const deltaY = event.clientY - drag.startY;
    if (!drag.moved && Math.abs(deltaY) < 5) return;

    drag.moved = true;
    suppressClickRef.current = true;

    const bubbleSize = 56;
    const topLimit = 84;
    const bottomMargin = 24;
    const nextY = Math.min(
      Math.max(topLimit, drag.originY + deltaY),
      Math.max(topLimit, window.innerHeight - bubbleSize - bottomMargin)
    );

    drag.latestY = nextY;
    setBubbleY(nextY);
  };

  const handleBubblePointerUp = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (drag.moved && Number.isFinite(drag.latestY) && typeof window !== 'undefined') {
      window.localStorage.setItem(bubbleStorageKey, JSON.stringify({ y: drag.latestY }));
    }

    dragRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const handleBubbleClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    handleOpen();
  };

  if (!isCitizen) return null;

  const drawer = isOpen ? (
    <div className="fixed inset-x-0 bottom-0 top-[72px] z-[2100]" role="dialog" aria-modal="true" aria-labelledby="citizen-feedback-inbox-title">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/35 backdrop-blur-[2px]"
        aria-label="Đóng hộp trao đổi phản ánh"
        onClick={() => setIsOpen(false)}
      />

      <aside className="absolute inset-y-0 right-0 flex w-full max-w-[860px] flex-col border-l border-[var(--public-border)] bg-base-100 shadow-[-24px_0_64px_rgba(15,23,42,0.24)]">
        <header className="flex items-start justify-between gap-4 border-b border-base-300 bg-base-100 px-4 py-4 sm:px-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary" aria-hidden="true">
              <Lucide.MessagesSquare size={18} />
            </span>
            <div className="min-w-0">
              <h2 id="citizen-feedback-inbox-title" className="text-base font-bold sm:text-lg">
                Trao đổi phản ánh
              </h2>
              <p className="mt-1 text-xs leading-5 text-base-content/55 sm:text-sm">
                Xem và nhắn tin với bộ phận xử lý theo từng phản ánh của bạn.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="btn btn-ghost btn-sm btn-square shrink-0 rounded-xl"
            aria-label="Đóng"
          >
            <Lucide.X size={19} aria-hidden="true" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 grid-rows-[auto_1fr] md:grid-cols-[320px_minmax(0,1fr)] md:grid-rows-1">
          <section className="min-h-0 border-b border-base-300 bg-base-100 md:border-b-0 md:border-r">
            <div className="flex items-center justify-between gap-3 border-b border-base-300 px-4 py-3">
              <div>
                <h3 className="text-sm font-bold">Phản ánh của tôi</h3>
                <p className="mt-0.5 text-xs text-base-content/50">{sortedTickets.length} phản ánh</p>
              </div>
              <button
                type="button"
                onClick={loadTickets}
                disabled={ticketsLoading}
                className="btn btn-ghost btn-sm btn-square rounded-xl"
                aria-label="Làm mới danh sách phản ánh"
              >
                <Lucide.RefreshCw size={15} className={ticketsLoading ? 'animate-spin' : ''} aria-hidden="true" />
              </button>
            </div>

            <div className="max-h-[220px] overflow-y-auto p-3 md:max-h-none md:h-full">
              {ticketsLoading && sortedTickets.length === 0 ? (
                <div className="flex min-h-[160px] items-center justify-center gap-2 text-sm text-base-content/55">
                  <span className="loading loading-spinner loading-sm" />
                  Đang tải phản ánh...
                </div>
              ) : ticketsError ? (
                <div className="rounded-2xl border border-error/20 bg-error/10 p-4 text-sm text-error">
                  <p>{ticketsError}</p>
                  <button type="button" onClick={loadTickets} className="btn btn-outline btn-xs mt-3 rounded-lg">
                    Thử lại
                  </button>
                </div>
              ) : sortedTickets.length === 0 ? (
                <div className="flex min-h-[180px] flex-col items-center justify-center rounded-2xl border border-dashed border-base-300 p-5 text-center">
                  <Lucide.Inbox size={26} className="text-base-content/35" aria-hidden="true" />
                  <p className="mt-3 text-sm font-semibold">Bạn chưa có phản ánh nào</p>
                  <p className="mt-1 text-xs leading-5 text-base-content/55">
                    Tạo phản ánh mới để trao đổi với bộ phận xử lý.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      navigate('/tickets/create');
                    }}
                    className="btn btn-primary btn-sm mt-4 rounded-xl"
                  >
                    Gửi phản ánh mới
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {sortedTickets.map((ticket) => {
                    const feedbackId = getFeedbackId(ticket);
                    const isActive = String(feedbackId) === String(selectedFeedbackId);

                    return (
                      <button
                        key={feedbackId}
                        type="button"
                        onClick={() => setSelectedFeedbackId(String(feedbackId))}
                        className={`w-full rounded-2xl border p-3 text-left transition ${
                          isActive
                            ? 'border-primary/35 bg-primary/10 shadow-sm'
                            : 'border-base-300 bg-base-100 hover:border-primary/25 hover:bg-base-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-base-content">
                              {getFeedbackTitle(ticket)}
                            </p>
                            <p className="mt-1 text-xs text-base-content/50">
                              #{feedbackId}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full border border-base-300 bg-base-100 px-2 py-1 text-[10px] font-semibold text-base-content/60">
                            {getStatusLabel(ticket?.status)}
                          </span>
                        </div>
                        {getFeedbackUpdatedAt(ticket) ? (
                          <p className="mt-2 text-[11px] text-base-content/45">
                            Cập nhật {formatDateTime(getFeedbackUpdatedAt(ticket))}
                          </p>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <section className="flex min-h-0 flex-col">
            {selectedFeedbackId ? (
              <>
                <div className="border-b border-base-300 bg-base-100 px-4 py-3 sm:px-5">
                  <p className="truncate text-sm font-bold">
                    {selectedTicket ? getFeedbackTitle(selectedTicket) : `Phản ánh #${selectedFeedbackId}`}
                  </p>
                  <p className="mt-0.5 text-xs text-base-content/50">
                    #{selectedFeedbackId}
                    {selectedTicket?.status ? ` · ${getStatusLabel(selectedTicket.status)}` : ''}
                  </p>
                </div>

                <FeedbackMessagesProvider feedbackId={selectedFeedbackId} includeInternal={false}>
                  <CitizenFeedbackThread currentUserId={currentUserId} />
                </FeedbackMessagesProvider>
              </>
            ) : (
              <div className="flex min-h-[280px] flex-1 flex-col items-center justify-center bg-base-200 px-6 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Lucide.MessagesSquare size={24} aria-hidden="true" />
                </span>
                <p className="mt-4 text-sm font-semibold">Chọn một phản ánh để xem trao đổi</p>
                <p className="mt-1 max-w-sm text-sm leading-6 text-base-content/55">
                  Tất cả cuộc trao đổi của các phản ánh bạn đã gửi sẽ nằm trong hộp chat này.
                </p>
              </div>
            )}
          </section>
        </div>
      </aside>
    </div>
  ) : null;

  const trigger = !isOpen && Number.isFinite(bubbleY) ? (
    <div
      className="group fixed z-[1800] touch-none select-none"
      style={{ right: '24px', top: `${bubbleY}px` }}
    >
      <div
        className="pointer-events-none absolute bottom-full right-0 mb-2 whitespace-nowrap rounded-lg bg-neutral px-3 py-1.5 text-xs font-medium text-neutral-content opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
        role="tooltip"
      >
        Trao đổi phản ánh
      </div>

      <button
        type="button"
        onClick={handleBubbleClick}
        onPointerDown={handleBubblePointerDown}
        onPointerMove={handleBubblePointerMove}
        onPointerUp={handleBubblePointerUp}
        onPointerCancel={handleBubblePointerUp}
        className="relative flex h-14 w-14 cursor-grab items-center justify-center rounded-full bg-primary text-primary-content shadow-[0_12px_30px_rgba(37,99,235,0.32)] transition duration-150 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(37,99,235,0.38)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base-100 active:cursor-grabbing"
        aria-label="Mở hộp trao đổi phản ánh"
      >
        <Lucide.MessageCircleMore size={24} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  ) : null;

  return (
    <>
      {typeof document !== 'undefined' && trigger ? createPortal(trigger, document.body) : null}
      {typeof document !== 'undefined' && drawer ? createPortal(drawer, document.body) : null}
    </>
  );
}