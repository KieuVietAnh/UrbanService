import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as Lucide from 'lucide-react';
import { useFeedbackMessages } from '../../contexts/FeedbackMessagesContextHook';
import {
  getCitizenMessageParticipantLabel,
  getCitizenMessageSide,
} from './citizenConversationUtils.js';

const formatMessageTime = (value) => {
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

const isSameUser = (message, currentUserId) => (
  getCitizenMessageSide(message, currentUserId) === 'outgoing'
);



const getMessageIdentity = (message, index = 0) =>
  String(message?.interactionMessageId || message?.id || `${message?.createdAt || 'message'}-${index}`);

export default function CitizenTicketConversation({ currentUserId }) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState('');
  const [bubbleY, setBubbleY] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const endRef = useRef(null);
  const dragRef = useRef(null);
  const suppressClickRef = useRef(false);

  const {
    messages,
    messagesLoading,
    messagesError,
    messageSubmitting,
    loadMessages,
    sendMessage,
    feedbackId,
  } = useFeedbackMessages();

  const publicMessages = useMemo(() => {
    if (!Array.isArray(messages)) return [];

    return messages
      .filter((message) => message && !message.isInternal)
      .sort((left, right) => new Date(left.createdAt || 0) - new Date(right.createdAt || 0));
  }, [messages]);


  const bubbleStorageKey = useMemo(
    () => `urbanmind:ticket-chat-bubble-y:${currentUserId || 'anonymous'}`,
    [currentUserId]
  );
  const seenStorageKey = useMemo(
    () => `urbanmind:ticket-chat-last-seen:${currentUserId || 'anonymous'}:${feedbackId || 'unknown'}`,
    [currentUserId, feedbackId]
  );

  const externalMessages = useMemo(
    () => publicMessages.filter((message) => !isSameUser(message, currentUserId)),
    [currentUserId, publicMessages]
  );


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

  useEffect(() => {
    if (typeof window === 'undefined' || !feedbackId || messagesLoading) return;

    if (isOpen) {
      const latestExternal = externalMessages[externalMessages.length - 1];
      const latestIndex = externalMessages.length - 1;
      window.localStorage.setItem(
        seenStorageKey,
        latestExternal ? getMessageIdentity(latestExternal, latestIndex) : ''
      );
      setUnreadCount(0);
      return;
    }

    if (externalMessages.length === 0) {
      setUnreadCount(0);
      return;
    }

    const storedSeenKey = window.localStorage.getItem(seenStorageKey);
    if (storedSeenKey === null) {
      const latestIndex = externalMessages.length - 1;
      window.localStorage.setItem(
        seenStorageKey,
        getMessageIdentity(externalMessages[latestIndex], latestIndex)
      );
      setUnreadCount(0);
      return;
    }

    const seenIndex = externalMessages.findIndex(
      (message, index) => getMessageIdentity(message, index) === storedSeenKey
    );

    setUnreadCount(seenIndex >= 0 ? externalMessages.length - seenIndex - 1 : externalMessages.length);
  }, [externalMessages, feedbackId, isOpen, messagesLoading, seenStorageKey]);

  useEffect(() => {
    if (!isOpen) return;
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [isOpen, publicMessages.length]);

  const handleOpen = () => {
    setIsOpen(true);
    loadMessages({ keepMessagesOnError: true });
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
      console.error('Failed to send citizen ticket message', error);
      setSendError(error?.message || 'Không thể gửi tin nhắn. Vui lòng thử lại.');
    }
  };

  const drawer = isOpen ? (
    <div className="fixed inset-x-0 bottom-0 top-[72px] z-[2100]" role="dialog" aria-modal="true" aria-labelledby="ticket-conversation-title">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/35 backdrop-blur-[2px]"
        aria-label="Đóng cửa sổ trao đổi"
        onClick={() => setIsOpen(false)}
      />

      <aside className="absolute inset-y-3 right-3 flex w-[calc(100%-1.5rem)] max-w-[460px] flex-col overflow-hidden rounded-[28px] border border-[var(--public-border)] bg-base-100 shadow-[-18px_20px_70px_rgba(15,23,42,0.26)] sm:inset-y-4 sm:right-4 sm:w-full">
        <header className="flex items-start justify-between gap-4 border-b border-[var(--public-border)] bg-[linear-gradient(135deg,rgba(37,99,235,0.08),rgba(14,165,233,0.04),transparent)] px-5 py-5 sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary" aria-hidden="true">
              <Lucide.MessagesSquare size={18} />
            </span>
            <div className="min-w-0">
              <h2 id="ticket-conversation-title" className="text-base font-bold sm:text-lg">
                Trao đổi về phản ánh
              </h2>
              <p className="mt-1 text-xs leading-5 text-base-content/55 sm:text-sm">
                Hỏi thêm, bổ sung thông tin và nhận phản hồi trực tiếp từ bộ phận xử lý.
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

        <div className="flex items-center justify-between gap-3 border-b border-base-300 bg-base-100 px-4 py-2.5 sm:px-5">
          <div className="flex items-center gap-2 text-xs text-base-content/50">
            <Lucide.LockKeyhole size={13} aria-hidden="true" />
            Cuộc trò chuyện riêng tư
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

        <div className="min-h-0 flex-1 overflow-y-auto bg-[linear-gradient(180deg,rgba(148,163,184,0.09),transparent_32%)] px-4 py-5 sm:px-6">
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
                Gửi câu hỏi hoặc bổ sung thông tin liên quan đến quá trình xử lý phản ánh.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {publicMessages.map((message, index) => {
                const ownMessage = isSameUser(message, currentUserId);
                const participantLabel = getCitizenMessageParticipantLabel(message, ownMessage);
                const messageKey = message.interactionMessageId || message.id || `${message.createdAt || 'message'}-${index}`;

                return (
                  <div key={messageKey} className={`flex ${ownMessage ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[86%] rounded-[20px] border px-4 py-3 ${
                        ownMessage
                          ? 'border-blue-600 bg-blue-600 text-white shadow-[0_8px_24px_rgba(37,99,235,0.18)]'
                          : 'border-[var(--public-border)] bg-base-100 text-base-content shadow-[0_8px_22px_rgba(15,23,42,0.06)]'
                      }`}
                    >
                      <div className={`text-xs font-semibold ${ownMessage ? 'text-primary-content' : 'text-base-content/75'}`}>
                        {participantLabel}
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
                        {formatMessageTime(message.createdAt)}
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
          <label htmlFor="ticket-conversation-message" className="sr-only">
            Tin nhắn gửi bộ phận xử lý
          </label>
          <div className="flex items-end gap-2">
            <textarea
              id="ticket-conversation-message"
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
              placeholder="Nhập câu hỏi hoặc thông tin bổ sung..."
              className="textarea min-h-[54px] flex-1 resize-none rounded-2xl border border-[var(--public-border)] bg-base-100 px-4 py-3 shadow-inner focus:border-primary/40 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!draft.trim() || messageSubmitting}
              className="btn btn-primary btn-square h-12 w-12 shrink-0 rounded-2xl shadow-[0_8px_20px_rgba(37,99,235,0.2)]"
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
        Trao đổi về phản ánh
      </div>

      <button
        type="button"
        onClick={handleBubbleClick}
        onPointerDown={handleBubblePointerDown}
        onPointerMove={handleBubblePointerMove}
        onPointerUp={handleBubblePointerUp}
        onPointerCancel={handleBubblePointerUp}
        className="relative flex h-14 w-14 cursor-grab items-center justify-center rounded-2xl border border-white/30 bg-gradient-to-br from-blue-600 to-sky-500 active:cursor-grabbing text-white shadow-[0_14px_34px_rgba(37,99,235,0.32)] transition duration-150 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(37,99,235,0.38)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base-100"
        aria-label="Mở trao đổi với bộ phận xử lý"
      >
        <Lucide.MessageCircleMore size={24} strokeWidth={2} aria-hidden="true" />
        {unreadCount > 0 ? (
          <span
            className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-base-100 bg-error px-1 text-[10px] font-bold leading-none text-error-content shadow-sm"
            aria-label={`${unreadCount} tin nhắn chưa đọc`}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
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
