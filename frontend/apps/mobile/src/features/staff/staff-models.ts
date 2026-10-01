export type DataRecord = Record<string, unknown>;
export type StaffPage<T> = { items: T[]; pageNumber: number; totalItems: number; totalPages: number; hasNextPage: boolean };
export type StaffRecord = {
  id: string; title: string; description: string; status: string; priority: string; severity: string;
  category: string; categoryId: string; areaId: string; areaName: string; location: string; reporter: string;
  createdAt: string; updatedAt: string; dueDate: string;
  assignedStaffUserId: string; assignedStaffName: string; incidentId: string; parentFeedbackId: string;
  summary: string; confidence: number | null; reportCount: number | null;
  linkId: string; linkMethod: string; linkRole: string; linkedAt: string; linkStatus: string; linkReason: string; linkedBy: string;
  attachments: { url: string; name: string }[]; reports: StaffRecord[]; raw: DataRecord;
};
export type StaffMessage = { id: string; text: string; sender: string; senderId: string; internal: boolean; createdAt: string };
export type StaffEvent = { id: string; title: string; description: string; actor: string; createdAt: string };
export type StaffNotificationId = number;
export type StaffNotification = {
  notificationId: StaffNotificationId;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  incidentId: string;
  targetType: string;
  targetId: string;
  relatedType: string;
  relatedId: string;
  targetUrl: string;
};

export const asRecord = (value: unknown): DataRecord => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as DataRecord : {};
export const asText = (value: unknown): string => typeof value === 'string' || typeof value === 'number' ? String(value) : '';
export const normalizeKey = (value: unknown) => asText(value).trim().replace(/[\s_-]/g, '').toLowerCase();
export const unwrap = (value: unknown): unknown => asRecord(value).data ?? asRecord(value).result ?? value;
export function itemsFrom(value: unknown): unknown[] {
  const source = unwrap(value);
  if (Array.isArray(source)) return source;
  const record = asRecord(source);
  const items = record.items ?? record.messages;
  return Array.isArray(items) ? items : [];
}

export function normalizePage<T>(value: unknown, map: (item: unknown) => T, requestedPage = 1): StaffPage<T> {
  const unwrapped = unwrap(value);
  const source = asRecord(unwrapped);
  if (!Array.isArray(unwrapped) && !Array.isArray(source.items)) {
    throw new Error('Máy chủ trả về danh sách không hợp lệ. Vui lòng thử lại.');
  }
  const items = itemsFrom(value).map(map);
  const positive = (value: unknown, fallback: number) => Number.isFinite(Number(value)) && Number(value) > 0 ? Math.floor(Number(value)) : fallback;
  const pageNumber = positive(source.pageNumber, requestedPage);
  const totalItems = positive(source.totalItems ?? source.totalCount, items.length);
  const pageSize = positive(source.pageSize, 20);
  const totalPages = positive(source.totalPages, Math.ceil(totalItems / pageSize));
  return { items, pageNumber, totalItems, totalPages, hasNextPage: typeof source.hasNextPage === 'boolean' ? source.hasNextPage : pageNumber < totalPages };
}

export function normalizeStaffRecord(value: unknown, incident = false): StaffRecord {
  const raw = asRecord(value);
  const analysis = asRecord(raw.analysisResult ?? raw.latestAnalysis);
  const confidenceValue = raw.confidenceScore ?? analysis.confidenceScore;
  const confidence = confidenceValue === undefined || confidenceValue === null || confidenceValue === '' ? null : Number(confidenceValue);
  const count = raw.reportCount ?? raw.feedbackCount ?? raw.totalReports;
  return {
    id: asText(incident ? raw.incidentId ?? raw.id : raw.feedbackId ?? raw.reportId ?? raw.id),
    title: asText(raw.title) || 'Chưa có tiêu đề',
    description: asText(raw.description ?? raw.content), status: asText(raw.status ?? raw.feedbackStatus), priority: asText(raw.priority), severity: asText(raw.severity),
    category: asText(raw.categoryName ?? analysis.detectedCategoryName), categoryId: asText(raw.categoryId),
    areaId: asText(raw.areaId), areaName: asText(raw.areaName), location: asText(raw.locationText ?? raw.address),
    reporter: asText(raw.reporterName ?? raw.userName), createdAt: asText(raw.createdAt), updatedAt: asText(raw.updatedAt),
    dueDate: asText(raw.dueDate),
    assignedStaffUserId: asText(raw.assignedStaffUserId), assignedStaffName: asText(raw.assignedStaffName),
    incidentId: asText(raw.incidentId), parentFeedbackId: asText(raw.parentTicketId || raw.parentFeedbackId || raw.masterFeedbackId),
    summary: asText(raw.summary ?? analysis.summary), confidence: Number.isFinite(confidence) ? confidence : null,
    reportCount: count !== null && count !== undefined && Number.isFinite(Number(count)) ? Number(count) : null,
    linkId: asText(raw.incidentReportLinkId), linkMethod: asText(raw.linkMethod), linkRole: asText(raw.linkRole),
    linkedAt: asText(raw.linkedAt), linkStatus: asText(raw.linkStatus), linkReason: asText(raw.reason), linkedBy: asText(raw.linkedByUserName),
    attachments: (Array.isArray(raw.attachments) ? raw.attachments : []).map((value) => {
      const attachment = asRecord(value);
      return { url: asText(attachment.fileUrl ?? attachment.url ?? attachment.attachmentUrl), name: asText(attachment.fileName ?? attachment.name) || 'Tệp đính kèm' };
    }).filter((attachment) => /^https?:\/\//i.test(attachment.url)),
    reports: incident && Array.isArray(raw.reports) ? raw.reports.map((report) => normalizeStaffRecord(report)) : [],
    raw,
  };
}

export function normalizeMessage(value: unknown): StaffMessage {
  const raw = asRecord(value);
  return {
    id: asText(raw.interactionMessageId ?? raw.messageId ?? raw.id), text: asText(raw.messageText ?? raw.content ?? raw.message),
    sender: asText(raw.userFullName ?? raw.senderName ?? raw.fullName ?? raw.userEmail) || 'Người dùng', senderId: asText(raw.userId ?? raw.senderUserId),
    internal: raw.isInternal === true, createdAt: asText(raw.createdAt ?? raw.sentAt),
  };
}

export function normalizeStaffNotification(value: unknown): StaffNotification | null {
  const raw = asRecord(value);
  const rawId = raw.notificationId ?? raw.id;
  const notificationId = typeof rawId === 'number' && Number.isInteger(rawId) && rawId > 0 && rawId <= 2147483647
    ? rawId : null;
  if (notificationId === null) return null;

  return {
    notificationId,
    title: asText(raw.title) || 'Thông báo hệ thống',
    message: asText(raw.message ?? raw.content),
    type: asText(raw.type),
    isRead: raw.isRead === true,
    createdAt: asText(raw.createdAt),
    incidentId: asText(raw.incidentId),
    targetType: asText(raw.targetType),
    targetId: asText(raw.targetId),
    relatedType: asText(raw.relatedType),
    relatedId: asText(raw.relatedId),
    targetUrl: asText(raw.targetUrl),
  };
}

export function normalizeEvent(value: unknown): StaffEvent {
  const raw = asRecord(value);
  let payload = asRecord(raw.payloadJson);
  if (typeof raw.payloadJson === 'string') {
    try { payload = asRecord(JSON.parse(raw.payloadJson)); } catch { /* Some older events have no JSON payload. */ }
  }
  const kind = normalizeKey(raw.eventType);
  const title = kind.includes('unlink') ? 'Gỡ liên kết phản ánh' : kind.includes('assign') ? 'Phân công sự vụ' : kind.includes('status') ? 'Cập nhật trạng thái' : kind.includes('aireview') ? 'AI phân tích phản ánh' : kind.includes('verif') ? 'Manager xác minh phản ánh' : kind.includes('link') ? 'Liên kết phản ánh' : kind.includes('merge') ? 'Gộp sự vụ' : kind.includes('create') ? 'Tạo sự vụ' : asText(raw.eventType) || 'Hoạt động sự vụ';
  return { id: asText(raw.incidentEventId ?? raw.eventId ?? raw.id), title, description: asText(payload.note ?? payload.reason ?? payload.description ?? raw.description), actor: asText(raw.actorUserName ?? raw.actorName ?? raw.performedByName), createdAt: asText(raw.createdAt ?? raw.occurredAt) };
}

const statusLabels: Record<string, string> = {
  new: 'Mới', submitted: 'Đã gửi', aireviewed: 'Chờ xác minh', verified: 'Đã xác minh', assigned: 'Đã phân công',
  inprogress: 'Đang xử lý', waitingcitizen: 'Chờ người dân', submittedforapproval: 'Chờ duyệt kết quả',
  needrework: 'Cần xử lý lại', approved: 'Đã duyệt', resolved: 'Đã giải quyết', closed: 'Đã đóng',
  rejected: 'Đã từ chối', cancelled: 'Đã hủy', merged: 'Đã gộp', duplicate: 'Trùng lặp',
};
export const statusLabel = (status: string) => statusLabels[normalizeKey(status)] || status || 'Chưa có trạng thái';
export const priorityLabel = (priority: string) => ({ low: 'Thấp', normal: 'Bình thường', medium: 'Trung bình', high: 'Cao', critical: 'Khẩn cấp', urgent: 'Khẩn cấp' })[normalizeKey(priority)] || priority || 'Chưa xác định';
export const severityLabel = (severity: string) => ({ low: 'Thấp', medium: 'Trung bình', high: 'Cao', critical: 'Nghiêm trọng' })[normalizeKey(severity)] || severity || 'Chưa xác định';
export const linkMethodLabel = (value: string) => ({ aimanagerconfirmed: 'AI đề xuất, Manager xác nhận', aisuggested: 'AI đề xuất', manual: 'Liên kết thủ công', initialcreated: 'Report khởi tạo sự vụ' })[normalizeKey(value)] || value || 'Chưa có dữ liệu';
export const linkRoleLabel = (value: string) => ({ primary: 'Report chính', initial: 'Report khởi tạo', related: 'Report liên quan', supporting: 'Report bổ sung', duplicate: 'Report trùng lặp' })[normalizeKey(value)] || value || 'Chưa có dữ liệu';
export const recordCode = (id: string, incident = false) => `${incident ? 'SV' : 'UM'}-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
export const formatDate = (value: string) => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Chưa có dữ liệu';
export const formatConfidence = (value: number | null) => value === null ? 'Chưa có dữ liệu' : `${Math.round(Math.min(100, Math.max(0, value <= 1 ? value * 100 : value)))}%`;

export function staffNotificationTarget(item: {
  incidentId?: unknown; targetId?: unknown; targetType?: unknown;
  relatedId?: unknown; relatedType?: unknown; targetUrl?: unknown;
}): string | null {
  const routeFor = (typeValue: unknown, idValue: unknown) => {
    const id = asText(idValue).trim();
    const type = normalizeKey(typeValue);
    if (id && type === 'incident') return `/(staff)/staff/incidents/${encodeURIComponent(id)}`;
    if (id && ['feedback', 'report'].includes(type)) return `/(staff)/staff/feedbacks/${encodeURIComponent(id)}`;
    return null;
  };

  const productionTarget = routeFor(item.targetType, item.targetId);
  if (productionTarget) return productionTarget;
  const incidentId = asText(item.incidentId).trim();
  if (incidentId) return `/(staff)/staff/incidents/${encodeURIComponent(incidentId)}`;
  const legacyTarget = routeFor(item.relatedType, item.relatedId);
  if (legacyTarget) return legacyTarget;
  // Only known internal destinations: never follow arbitrary server-provided URLs.
  const match = /^\/staff\/(feedbacks|incidents)\/([\w-]+)\/?$/.exec(asText(item.targetUrl));
  return match ? `/(staff)/staff/${match[1]}/${match[2]}` : null;
}
