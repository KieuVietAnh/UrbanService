const TICKET_PREVIEW_CACHE_KEY = 'urbanmind-service-user-ticket-preview-images-v5';

const getTicketId = (ticket) => String(
  ticket?.feedbackId ||
  ticket?.feedbackID ||
  ticket?.id ||
  ticket?.feedback?.feedbackId ||
  ticket?.feedback?.id ||
  ''
);

export const resolveTicketAttachmentUrl = (attachment) => {
  if (!attachment) return '';
  if (typeof attachment === 'string') return attachment.trim();

  const directUrl = (
    attachment?.url ||
    attachment?.path ||
    attachment?.fileUrl ||
    attachment?.link ||
    attachment?.attributes?.url ||
    attachment?.attributes?.path ||
    ''
  );

  if (directUrl) return String(directUrl).trim();

  const attachmentId = (
    attachment?.id ||
    attachment?.attachmentId ||
    attachment?.fileId ||
    attachment?.uuid
  );

  return attachmentId ? `/api/attachments/${attachmentId}` : '';
};

const isImageAttachment = (attachment, resolvedUrl) => {
  const fileType = String(
    attachment?.fileType ||
    attachment?.mimeType ||
    attachment?.contentType ||
    attachment?.type ||
    ''
  ).toLowerCase();

  if (fileType.startsWith('image/')) return true;
  if (fileType.startsWith('video/')) return false;

  return /\.(png|jpe?g|webp|gif|avif|bmp|svg)(?:\?|#|$)/i.test(resolvedUrl);
};

export const getFirstTicketImageUrl = (ticket) => {
  const attachments = Array.isArray(ticket?.attachments)
    ? ticket.attachments
    : [];

  if (attachments.length === 0) return '';

  for (const attachment of attachments) {
    const resolvedUrl = resolveTicketAttachmentUrl(attachment);
    if (resolvedUrl && isImageAttachment(attachment, resolvedUrl)) {
      return resolvedUrl;
    }
  }

  const fallbackAttachment = attachments.find((attachment) => {
    const fileType = String(
      attachment?.fileType ||
      attachment?.mimeType ||
      attachment?.contentType ||
      attachment?.type ||
      ''
    ).toLowerCase();

    return !fileType.startsWith('video/');
  });

  return resolveTicketAttachmentUrl(fallbackAttachment);
};

export const readTicketPreviewCache = () => {
  if (typeof window === 'undefined') return {};

  try {
    const rawValue = window.sessionStorage.getItem(TICKET_PREVIEW_CACHE_KEY);
    if (!rawValue) return {};

    const parsedValue = JSON.parse(rawValue);
    return parsedValue && typeof parsedValue === 'object' && !Array.isArray(parsedValue)
      ? parsedValue
      : {};
  } catch {
    return {};
  }
};

const persistTicketPreviewCache = (cache) => {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(
      TICKET_PREVIEW_CACHE_KEY,
      JSON.stringify(cache || {})
    );
  } catch {
    // Storage can be unavailable in private mode.
  }
};

export const getCachedTicketPreviewUrl = (cache, ticket) => {
  const feedbackId = getTicketId(ticket);
  if (!feedbackId) return '';

  const cachedValue = cache?.[feedbackId];
  return typeof cachedValue === 'string' ? cachedValue : '';
};

export const hasSettledTicketPreview = (cache, ticket) => {
  const feedbackId = getTicketId(ticket);
  if (!feedbackId) return true;

  return Object.prototype.hasOwnProperty.call(cache || {}, feedbackId);
};

export const cacheTicketPreview = (ticket, explicitUrl) => {
  const feedbackId = getTicketId(ticket);
  if (!feedbackId) return null;

  const url = explicitUrl !== undefined
    ? String(explicitUrl || '')
    : getFirstTicketImageUrl(ticket);

  const currentCache = readTicketPreviewCache();
  const nextCache = {
    ...currentCache,
    [feedbackId]: url || null,
  };

  persistTicketPreviewCache(nextCache);
  return nextCache;
};

export const writeTicketPreviewCache = (cache) => {
  persistTicketPreviewCache(cache);
};
