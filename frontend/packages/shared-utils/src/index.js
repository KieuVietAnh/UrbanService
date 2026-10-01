// Shared utilities
export function getAttachmentUrl(att) {
  if (!att) return null;
  if (typeof att === 'string') return att;
  if (Array.isArray(att)) return getAttachmentUrl(att[0]);

  const candidates = [
    att.fileUrl,
    att.url,
    att.path,
    att.attachmentUrl,
    att.displayUrl,
    att.mediaUrl,
    att.publicUrl,
    att.downloadUrl,
    att.imageUrl,
    att.thumbnailUrl,
    att.coverImageUrl,
    att.src,
    att.link,
    att.href,
  ];

  const raw = candidates.find((value) => typeof value === 'string' && value.trim());
  if (!raw) return null;

  if (
    raw.startsWith('http://') ||
    raw.startsWith('https://') ||
    raw.startsWith('blob:') ||
    raw.startsWith('data:')
  ) {
    return raw;
  }

  return raw.startsWith('/') ? raw : `/${raw}`;
}
