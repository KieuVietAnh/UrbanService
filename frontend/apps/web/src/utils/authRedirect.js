export const getSafeInternalPath = candidate => {
  if (!candidate) return '';

  if (typeof candidate === 'object') {
    const pathname = candidate.pathname || '';
    const search = candidate.search || '';
    const hash = candidate.hash || '';
    return getSafeInternalPath(`${pathname}${search}${hash}`);
  }

  const normalized = String(candidate).trim();
  const hasControlCharacter = Array.from(normalized).some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint <= 31 || codePoint === 127;
  });
  if (
    !normalized.startsWith('/') ||
    normalized.startsWith('//') ||
    normalized.includes('\\') ||
    hasControlCharacter
  ) return '';
  return normalized;
};

export const buildAuthPath = (basePath, redirect, additionalParams = {}) => {
  const [pathname, rawQuery = ''] = String(basePath || '/').split('?');
  const searchParams = new URLSearchParams(rawQuery);

  Object.entries(additionalParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim()) {
      searchParams.set(key, String(value));
    }
  });

  const safeRedirect = getSafeInternalPath(redirect);
  if (safeRedirect) searchParams.set('redirect', safeRedirect);

  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
};
