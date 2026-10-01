export const isAdminIncidentReadOnly = (role) => String(role || '').trim().toLowerCase() === 'administrator';

const INCIDENT_SYSTEM_TEXT_TRANSLATIONS = new Map([
  ['incident created from a new report', 'Sự vụ được tạo từ phản ánh mới.'],
  ['feedback created', 'Đã tạo phản ánh.'],
  ['report linked to incident', 'Phản ánh đã được liên kết vào sự vụ.'],
  ['report unlinked from incident', 'Phản ánh đã được gỡ khỏi sự vụ.'],
  ['incident created', 'Đã tạo sự vụ.'],
  ['incident updated', 'Đã cập nhật sự vụ.'],
  ['incident assigned', 'Đã phân công xử lý sự vụ.'],
  ['manager assigned staff', 'Quản lý đã phân công nhân viên.'],
  ['manager assigned staff to incident', 'Quản lý đã phân công nhân viên xử lý sự vụ.'],
  ['manager đã xác nhận phản ánh', 'Quản lý đã xác nhận phản ánh.'],
  ['staff started processing incident', 'Nhân viên bắt đầu xử lý sự vụ.'],
  ['staff bắt đầu xử lý sự vụ', 'Nhân viên bắt đầu xử lý sự vụ.'],
  ['staff đã gửi kết quả xử lý để chờ manager phê duyệt', 'Nhân viên đã gửi kết quả xử lý để chờ quản lý phê duyệt.'],
  ['incident merged by management', 'Sự vụ được gộp theo quyết định của quản lý.'],
]);

const isTechnicalIncidentText = (value) => [
  'addincidentaggregateschema',
  'migration from the legacy feedback cluster',
  'legacy feedback cluster',
  'schema migration',
  'backfill migration',
  'created by migration',
  'created by backfill',
].some((marker) => value.includes(marker));

export const localizeIncidentSystemText = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const normalized = raw.toLowerCase().replace(/[.!?]+$/g, '').trim();
  if (isTechnicalIncidentText(normalized)) return '';
  return INCIDENT_SYSTEM_TEXT_TRANSLATIONS.get(normalized) || raw;
};

export const getTimelinePresentation = (events, visibleCount) => {
  const items = Array.isArray(events) ? events : [];
  const safeVisibleCount = Math.max(0, Number(visibleCount) || 0);

  return {
    visibleEvents: items.slice(0, safeVisibleCount),
    remainingCount: Math.max(0, items.length - safeVisibleCount),
    canCollapse: safeVisibleCount > 6,
  };
};
