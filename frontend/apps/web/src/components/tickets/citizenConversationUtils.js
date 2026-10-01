const normalizeId = (value) => String(value ?? '').trim();
const normalizeRole = (value) => String(value ?? '')
  .trim()
  .replace(/[^a-z0-9]/gi, '')
  .toUpperCase();

export const getCitizenMessageSide = (message, currentUserId) => {
  const senderId = normalizeId(
    message?.userId ?? message?.senderUserId ?? message?.createdByUserId
  );
  const currentId = normalizeId(currentUserId);
  return senderId && currentId && senderId === currentId ? 'outgoing' : 'incoming';
};

export const getCitizenMessageParticipantLabel = (message, isOwn = false) => {
  if (isOwn) return 'Bạn';

  const name = String(
    message?.userFullName || message?.userName || message?.senderName || ''
  ).trim();
  const role = normalizeRole(message?.senderRole || message?.role || message?.userRole);
  const isStaff = ['SYSTEMSTAFF', 'INTERACTIONMANAGER', 'SERVICEPROVIDER', 'ADMINISTRATOR'].includes(role);

  if (name && isStaff) return `${name} · Bộ phận xử lý`;
  if (name) return name;
  return 'Bộ phận xử lý';
};
