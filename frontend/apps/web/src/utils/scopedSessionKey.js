export const getScopedSessionKey = (baseKey, user) => {
  const normalizedBaseKey = String(baseKey || '').trim();
  if (!normalizedBaseKey) return '';

  const role = String(user?.role || user?.roleName || 'unknown')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');

  const identity = String(
    user?.userId ??
    user?.id ??
    user?.accountId ??
    'anonymous'
  ).trim();

  return `${normalizedBaseKey}:${role || 'unknown'}:${identity || 'anonymous'}`;
};
