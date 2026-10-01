/**
 * LOCAL TEST FIXTURE ONLY. This is not an authentication service or a backend.
 *
 * Run: node apps/mobile/tests/staff-native-server.mjs
 * Then: adb reverse tcp:8100 tcp:8100
 * Build the test app with EXPO_PUBLIC_API_URL=http://127.0.0.1:8100.
 * Sign in through the normal UI: staff@example.test / fixture-password.
 * Add --otp to require the normal email-verification screen; test OTP: 123456.
 * Restart to reset all data. Nothing is persisted or forwarded to another host.
 * Run --self-test for an isolated HTTP contract check (ephemeral loopback port).
 *
 * Vietnamese records mirror staff-smoke.mjs. They are intentionally copied:
 * importing that executable would launch its Playwright browser. Keep fixture
 * changes coordinated with its owner; never import this server from app code.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const TEST_EMAIL = 'staff@example.test';
const TEST_PASSWORD = 'fixture-password';
const TEST_OTP = '123456';
const HOST = '127.0.0.1';
const MAX_BODY_BYTES = 24 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 16 * 1024 * 1024;
const createdAt = '2026-08-30T08:30:00Z';
const editableStatuses = new Set(['Assigned', 'InProgress', 'NeedRework']);
// Mirrors the existing shared web helper, not a claim about backend transitions.
const providerTransitions = {
  Reported: ['InProgress', 'Failed', 'Cancelled'],
  InProgress: ['Done', 'Failed', 'Cancelled'],
  Done: [], Failed: [], Cancelled: [],
};

class FixtureError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, message) => { throw new FixtureError(status, message); };
const now = () => new Date().toISOString();
const text = (value) => typeof value === 'string' ? value.trim() : '';
const required = (value, name) => text(value) || fail(400, `Thiếu ${name}.`);
const queryValue = (url, name) => url.searchParams.get(name) ?? url.searchParams.get(name[0].toLowerCase() + name.slice(1));
const positivePage = (value, fallback, maximum = 10000) => {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? Math.min(number, maximum) : fallback;
};
const paged = (items, url) => {
  const pageNumber = positivePage(queryValue(url, 'PageNumber'), 1);
  const pageSize = positivePage(queryValue(url, 'PageSize'), 20, 100);
  return {
    items: items.slice((pageNumber - 1) * pageSize, pageNumber * pageSize),
    totalItems: items.length, totalPages: Math.max(1, Math.ceil(items.length / pageSize)),
    pageNumber, pageSize, hasPreviousPage: pageNumber > 1, hasNextPage: pageNumber * pageSize < items.length,
  };
};

async function readBody(request) {
  if (Number(request.headers['content-length']) > MAX_BODY_BYTES) fail(413, 'Tệp kiểm thử quá lớn.');
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) fail(413, 'Tệp kiểm thử quá lớn.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function createFixtures(origin, requireOtp) {
  const staff = { userId: '7c4da649-b85f-4ec1-a22b-d4efd03a0e95', fullName: 'Nguyễn Minh Anh', email: TEST_EMAIL, role: 'SystemStaff', isVerified: !requireOtp };
  const reportOne = {
    feedbackId: 'fb410028-7b18-4c37-b1d7-168c61bf0632', title: 'Đèn đường không sáng trước hẻm 42',
    description: 'Ba đèn đường trước hẻm 42 không sáng trong hai buổi tối gần đây. Người đi bộ khó quan sát đoạn giao với đường chính.',
    status: 'Verified', categoryId: 2, categoryName: 'Chiếu sáng', areaId: 3, areaName: 'Phường Tân Phong',
    priority: 'High', locationText: 'Hẻm 42 Nguyễn Văn Linh', reporterName: 'Trần Ngọc An', createdAt,
    updatedAt: '2026-08-31T09:10:00Z', incidentId: 'ec4a1028-21a8-4d16-a335-8cb34da6aa11',
    attachments: [{ fileUrl: `${origin}/fixture/inspection-note.pdf`, fileName: 'Ghi nhận hiện trường.pdf' }],
    analysisResult: { summary: 'Phản ánh về cụm đèn đường mất sáng; nội dung phù hợp với sự vụ chiếu sáng đã được ghi nhận tại cùng khu vực.', confidenceScore: 0.94 },
  };
  const reportTwo = {
    feedbackId: 'fb620031-0d35-4f6c-8350-b3e235606d17', title: 'Cụm đèn gần điểm đón xe buýt bị tắt',
    description: 'Khu vực điểm đón xe buýt gần hẻm 42 thiếu ánh sáng sau 19 giờ. Tôi gửi thêm vị trí để đội phụ trách kiểm tra.',
    status: 'Verified', categoryId: 2, categoryName: 'Chiếu sáng', areaId: 3, areaName: 'Phường Tân Phong',
    priority: 'Medium', locationText: 'Trạm xe buýt Nguyễn Văn Linh', reporterName: 'Lê Hoàng Phúc',
    createdAt: '2026-08-30T12:15:00Z', updatedAt: '2026-08-31T09:10:00Z',
    analysisResult: { summary: 'Report bổ sung vị trí và thời điểm mất sáng trong cùng khu vực.', confidenceScore: 0.91 },
  };
  const incident = {
    incidentId: reportOne.incidentId, title: 'Mất chiếu sáng tại hẻm 42 Nguyễn Văn Linh',
    description: 'Hai phản ánh ghi nhận cụm đèn đường mất sáng quanh hẻm 42 và điểm đón xe buýt. Kiểm tra hiện trường, ghi nhận tình trạng tủ điện và phối hợp đơn vị phụ trách.',
    status: 'Assigned', assignedStaffUserId: staff.userId, assignedStaffName: staff.fullName,
    categoryId: 2, categoryName: 'Chiếu sáng', areaId: 3, areaName: 'Phường Tân Phong',
    locationText: 'Hẻm 42 Nguyễn Văn Linh', priority: 'High', severity: 'High', createdAt,
    updatedAt: '2026-09-01T02:20:00Z', dueDate: '2026-09-03T10:00:00Z', reportCount: 2,
    reports: [
      { ...reportOne, incidentReportLinkId: 'link-01', linkMethod: 'InitialCreated', linkRole: 'Primary', confidenceScore: 1, linkedAt: '2026-08-30T08:45:00Z', linkedByUserName: 'Nguyễn Hải Yến', reason: 'Report khởi tạo sự vụ chiếu sáng.' },
      { ...reportTwo, incidentReportLinkId: 'link-02', linkMethod: 'AIManagerConfirmed', linkRole: 'Supporting', confidenceScore: 0.91, linkedAt: '2026-08-31T09:10:00Z', linkedByUserName: 'Nguyễn Hải Yến', reason: 'Cùng vị trí và thời điểm mất sáng, đã được Manager xác nhận.' },
    ],
  };
  const workingIncident = { ...incident, incidentId: 'a5d71423-41c6-4d4c-a2e6-329c4a3e0a25', title: 'Thoát nước chậm tại đường số 8', status: 'InProgress', categoryId: 4, categoryName: 'Thoát nước', areaId: 7, areaName: 'Phường Bình Thuận', locationText: 'Đường số 8', priority: 'Medium', severity: 'Medium', reportCount: 0, reports: [], assignedAt: '2026-09-01T02:20:00Z', processingStartedAt: '2026-09-01T03:00:00Z' };
  const reworkIncident = { ...incident, incidentId: '2c610495-f259-414c-82c8-2e17a54c4045', title: 'Kiểm tra lại nắp hố ga đường số 5', status: 'NeedRework', categoryId: 4, categoryName: 'Thoát nước', priority: 'High', severity: 'Critical', reportCount: 0, reports: [] };
  const approvalIncident = { ...incident, incidentId: '85ad5420-ceb7-4eca-a870-174cf59a1467', title: 'Khắc phục đèn tín hiệu tại giao lộ', status: 'SubmittedForApproval', categoryId: 6, categoryName: 'Giao thông', priority: 'Medium', severity: 'Medium', reportCount: 0, reports: [] };
  const foreignIncident = { ...workingIncident, incidentId: '4848f090-5cee-4e17-a82f-099d79a8d898', title: 'Sự vụ do nhân viên khác phụ trách', assignedStaffUserId: 'another-staff', assignedStaffName: 'Lê Hải Bình' };
  const providerForbiddenIncident = { ...workingIncident, incidentId: 'provider-forbidden', title: 'Không có quyền truy cập phân công đơn vị' };
  const staleSubmittedIncident = { ...workingIncident, incidentId: '853cf141-3cdd-426e-b0c2-4be49a0d2221', title: 'Đã gửi kết quả nhưng trạng thái chưa đồng bộ' };
  const statuses = ['Assigned', 'InProgress', 'NeedRework', 'SubmittedForApproval'];
  const incidents = [incident, workingIncident, reworkIncident, approvalIncident,
    ...Array.from({ length: 21 }, (_, index) => ({
      ...workingIncident, incidentId: `${String(index + 1).padStart(8, '0')}-ceb7-4eca-a870-174cf59a1467`,
      title: ['Kiểm tra miệng thu nước', 'Sửa biển chỉ dẫn khu dân cư', 'Ghi nhận vỉa hè xuống cấp'][index % 3] + ' tại đường số ' + (index + 11),
      status: statuses[index % statuses.length], priority: index % 2 ? 'Low' : 'Medium', severity: index % 2 ? 'Low' : 'Medium', updatedAt: '2026-08-31T03:20:00Z',
    })),
  ];
  const candidates = [
    { coordinatorId: 41, providerName: 'Đội thoát nước khu Nam', coordinatorName: 'Phạm Quốc Hưng', phoneNumber: '0903555777', email: 'thoatnuoc@example.test', address: 'Khu vận hành phía Nam', isPrimary: true, priorityOrder: 1, contractId: 10, contractCode: 'TN-2026-10', contractName: 'Duy tu hệ thống thoát nước', contractStatus: 'Active' },
    { coordinatorId: 42, providerName: 'Tổ bảo trì hạ tầng Bình Thuận', coordinatorName: 'Võ Thu Hà', phoneNumber: '0904666888', email: 'baotri@example.test', address: 'Phường Bình Thuận', isPrimary: false, priorityOrder: 2, contractId: 11, contractCode: 'HT-2026-11', contractName: 'Bảo trì hạ tầng khu vực', contractStatus: 'Active' },
  ];
  const reworkOldEvidence = {
    completionDocumentId: 704, providerAssignmentId: 504, incidentId: reworkIncident.incidentId,
    coordinatorId: candidates[0].coordinatorId, providerName: candidates[0].providerName,
    fileUrl: `${origin}/fixture/evidence.png`, fileName: 'rework-old.png', fileType: 'image/png',
    description: 'Ảnh nắp hố ga trước lần xử lý lại.', uploadedByUserId: staff.userId,
    uploadedByUserName: staff.fullName, receivedAt: '2026-09-01T03:35:00Z',
  };
  const assignments = new Map([
    [approvalIncident.incidentId, { ...candidates[0], providerAssignmentId: 502, incidentId: approvalIncident.incidentId, assignedByStaffUserId: staff.userId, assignedByStaffUserName: staff.fullName, reportStatus: 'Done', reportNote: 'Đã hoàn thành kiểm tra.', assignedAt: createdAt, contactLogCount: 0, completionDocumentCount: 0 }],
    [foreignIncident.incidentId, { ...candidates[1], providerAssignmentId: 503, incidentId: foreignIncident.incidentId, assignedByStaffUserId: 'another-staff', assignedByStaffUserName: 'Lê Hải Bình', reportStatus: 'InProgress', assignedAt: createdAt, contactLogCount: 0, completionDocumentCount: 0 }],
    [reworkIncident.incidentId, { ...candidates[0], providerAssignmentId: 504, incidentId: reworkIncident.incidentId, assignedByStaffUserId: staff.userId, assignedByStaffUserName: staff.fullName, reportStatus: 'Done', reportNote: 'Manager yêu cầu bổ sung ảnh nghiệm thu.', assignedAt: createdAt, contactLogCount: 0, completionDocumentCount: 1 }],
  ]);
  const resolutions = new Map([
    [approvalIncident.incidentId, [{ resolutionId: 601, incidentId: approvalIncident.incidentId, providerAssignmentId: 502, createdByStaffUserId: staff.userId, createdByStaffUserName: staff.fullName, resolutionSummary: 'Đã kiểm tra và khắc phục cụm đèn tín hiệu.', actionTaken: 'Thay bộ điều khiển và kiểm tra chu kỳ.', resultNote: 'Đang chờ Manager duyệt.', status: 'Submitted', resolvedAt: '2026-09-01T04:00:00Z', completionDocuments: [] }]],
    [reworkIncident.incidentId, [{ resolutionId: 602, incidentId: reworkIncident.incidentId, providerAssignmentId: 504, createdByStaffUserId: staff.userId, createdByStaffUserName: staff.fullName, resolutionSummary: 'Đã kiểm tra và cố định lại nắp hố ga.', actionTaken: 'Căn chỉnh khung và bổ sung chốt cố định.', resultNote: 'Manager yêu cầu bổ sung ảnh toàn cảnh sau xử lý.', status: 'NeedRework', resolvedAt: '2026-09-01T03:40:00Z', completionDocuments: [structuredClone(reworkOldEvidence)] }]],
    [staleSubmittedIncident.incidentId, [{ resolutionId: 603, incidentId: staleSubmittedIncident.incidentId, providerAssignmentId: null, createdByStaffUserId: staff.userId, createdByStaffUserName: staff.fullName, resolutionSummary: 'Kết quả đã nhận, đang chờ đồng bộ trạng thái.', status: 'Submitted', resolvedAt: '2026-09-01T04:00:00Z', completionDocuments: [] }]],
  ]);
  const timeline = new Map([
    [incident.incidentId, [
      { incidentEventId: 'event-05', eventType: 'IncidentAssigned', actorUserName: 'Nguyễn Hải Yến', createdAt: '2026-09-01T02:20:00Z', payloadJson: JSON.stringify({ note: 'Phân công Nguyễn Minh Anh kiểm tra hiện trường.' }) },
      { incidentEventId: 'event-04', eventType: 'ReportLinked', actorUserName: 'Nguyễn Hải Yến', createdAt: '2026-08-31T09:10:00Z', payloadJson: JSON.stringify({ note: 'Manager xác nhận Report thứ hai thuộc cùng sự vụ.' }) },
      { incidentEventId: 'event-03', eventType: 'FeedbackVerified', actorUserName: 'Nguyễn Hải Yến', createdAt: '2026-08-30T09:10:00Z', payloadJson: JSON.stringify({ note: 'Đã xác minh nội dung và vị trí phản ánh.' }) },
      { incidentEventId: 'event-02', eventType: 'AIReviewed', actorUserName: 'Hệ thống', createdAt: '2026-08-30T08:40:00Z', payloadJson: JSON.stringify({ note: 'AI phân loại Chiếu sáng và gợi ý đối chiếu vị trí.' }) },
      { incidentEventId: 'event-01', eventType: 'IncidentCreated', actorUserName: 'Hệ thống', createdAt, payloadJson: JSON.stringify({ note: 'Tạo sự vụ từ Report đầu tiên.' }) },
    ]],
    [reworkIncident.incidentId, [
      { incidentEventId: 'event-rework-02', eventType: 'ResolutionNeedRework', actorUserName: 'Nguyễn Hải Yến', createdAt: '2026-09-01T04:10:00Z', payloadJson: JSON.stringify({ reason: 'Ảnh hiện trường chưa thể hiện toàn cảnh khu vực sau xử lý.' }) },
      { incidentEventId: 'event-rework-01', eventType: 'ResolutionSubmitted', actorUserName: staff.fullName, createdAt: '2026-09-01T03:40:00Z', payloadJson: JSON.stringify({ note: 'Đã gửi kết quả xử lý lần đầu.' }) },
    ]],
  ]);
  const slaStatuses = new Map([
    [incident.incidentId, {
      incidentId: incident.incidentId, incidentSlaId: 901, status: 'Active',
      responseStatus: 'Completed', resolutionStatus: 'Warning',
      serverTime: '2026-09-01T05:00:00Z', startedAt: createdAt,
      responseDueAt: '2026-08-30T10:30:00Z', resolutionDueAt: '2026-09-01T06:30:00Z',
      responseRemainingMinutes: 0, resolutionRemainingMinutes: 90,
      responseRemainingSeconds: 0, resolutionRemainingSeconds: 5400,
      responseProgressPercent: 100, resolutionProgressPercent: 87.5,
      isResponseWarning: false, isResolutionWarning: true,
      isResponseBreached: false, isResolutionBreached: false,
    }],
  ]);
  const messages = new Map([[reportOne.feedbackId, [{ interactionMessageId: 1, userFullName: 'Trần Ngọc An', userId: '9ade3db1-a8ba-437d-864c-cce78e1b4e44', messageText: 'Tối qua đoạn hẻm vẫn chưa có đèn. Nhờ anh chị kiểm tra giúp.', isInternal: false, createdAt }]], [reportTwo.feedbackId, []]]);
  const notifications = [
    { notificationId: 1, title: 'Sự vụ mới được giao', message: incident.title, createdAt: '2026-09-01T02:20:00Z', isRead: false, targetType: 'Incident', targetId: incident.incidentId, incidentId: incident.incidentId },
    { notificationId: 2, title: 'Người dân bổ sung thông tin', message: reportTwo.title, createdAt: '2026-08-31T09:10:00Z', isRead: false, targetType: 'Feedback', targetId: reportTwo.feedbackId },
    { notificationId: 3, title: 'Cập nhật hồ sơ đang xử lý', message: workingIncident.title, createdAt: '2026-08-31T03:20:00Z', isRead: true, incidentId: workingIncident.incidentId },
  ];
  return {
    staff, incidents, reports: [reportOne, reportTwo], candidates, assignments, resolutions, timeline, slaStatuses, messages, notifications,
    allIncidents: new Map([...incidents, foreignIncident, providerForbiddenIncident, staleSubmittedIncident].map((item) => [item.incidentId, item])),
    contacts: new Map(), documents: new Map([[504, [structuredClone(reworkOldEvidence)]]]), uploads: new Map(), sessions: new Map(), refreshTokens: new Map(),
    nextAssignmentId: 505, nextContactId: 801, nextDocumentId: 705, nextResolutionId: 604, nextMessageId: 2,
  };
}

// Minimal valid one-page PDF, built in memory; it contains only test text.
function inspectionPdf() {
  const stream = 'BT /F1 16 Tf 40 760 Td (LOCAL TEST FIXTURE - Inspection note) Tj ET';
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((offset) => String(offset).padStart(10, '0') + ' 00000 n ').join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}

export function createStaffNativeServer({ requireOtp = false, quiet = false } = {}) {
  let state;
  let origin;
  const issueSession = () => {
    const token = `LOCAL-TEST-ONLY-${randomUUID()}`;
    const refreshToken = `LOCAL-TEST-REFRESH-ONLY-${randomUUID()}`;
    state.sessions.set(token, state.staff.userId);
    state.refreshTokens.set(refreshToken, state.staff.userId);
    return {
      userId: state.staff.userId,
      name: state.staff.fullName,
      email: state.staff.email,
      role: state.staff.role,
      isVerified: state.staff.isVerified,
      token,
      refreshToken,
    };
  };
  const getIncident = (id) => {
    if (id === 'incident-forbidden') fail(403, 'Hồ sơ kiểm thử không thuộc quyền truy cập.');
    return state.allIncidents.get(id) || fail(404, 'Không tìm thấy sự vụ kiểm thử.');
  };
  const assertOwner = (item) => {
    if (item.assignedStaffUserId !== state.staff.userId) fail(403, 'Sự vụ không được phân công cho bạn.');
  };
  const assertEditable = (item) => {
    assertOwner(item);
    if (!editableStatuses.has(item.status)) fail(409, 'Sự vụ không còn cho phép cập nhật.');
  };
  const event = (incidentId, eventType, note) => {
    const items = state.timeline.get(incidentId) || [];
    items.unshift({ incidentEventId: randomUUID(), eventType, actorUserName: state.staff.fullName, createdAt: now(), payloadJson: JSON.stringify({ note }) });
    state.timeline.set(incidentId, items);
  };

  const server = createServer(async (request, response) => {
    const method = request.method || 'GET';
    let path = '(invalid path)';
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (body, status = 200, type = 'application/json; charset=utf-8') => {
      response.statusCode = status;
      if (status === 204 || body === undefined) { response.end(); return; }
      response.setHeader('Content-Type', type);
      response.end(Buffer.isBuffer(body) ? body : JSON.stringify(body));
    };
    try {
      let url;
      try {
        url = new URL(request.url || '/', origin);
        path = decodeURIComponent(url.pathname).replace(/\/$/, '') || '/';
      } catch { fail(400, 'Đường dẫn kiểm thử không hợp lệ.'); }
      if (method === 'OPTIONS') return send(undefined, 204);
      if (path === '/health' && method === 'GET') return send({ fixtureOnly: true, app: 'UrbanMind Staff native test', persisted: false });
      if (path === '/fixture/inspection-note.pdf' && method === 'GET') return send(inspectionPdf(), 200, 'application/pdf');
      if (path === '/fixture/evidence.png' && method === 'GET') return send(await readFile(new URL('../assets/icon.png', import.meta.url)), 200, 'image/png');
      if (path.startsWith('/fixture/uploads/') && method === 'GET') {
        const upload = state.uploads.get(path) || fail(404, 'Không tìm thấy tệp kiểm thử.');
        return send(upload.bytes, 200, upload.type);
      }
      if (!path.startsWith('/api/')) fail(404, 'Đường dẫn không nằm trong fixture API.');
      const rawBody = ['POST', 'PUT', 'PATCH'].includes(method) ? await readBody(request) : Buffer.alloc(0);
      const isMultipart = /^multipart\/form-data;/i.test(String(request.headers['content-type']));
      let body = {};
      if (rawBody.length && !isMultipart) {
        try { body = JSON.parse(rawBody.toString('utf8')); } catch { fail(400, 'JSON kiểm thử không hợp lệ.'); }
        if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'Yêu cầu cần là một JSON object.');
      }
      if (path === '/api/auth/login' && method === 'POST') {
        if (text(body.email).toLowerCase() !== TEST_EMAIL || body.password !== TEST_PASSWORD) fail(400, 'Email hoặc mật khẩu kiểm thử không chính xác.');
        return send(issueSession());
      }
      if (path === '/api/auth/refresh-token' && method === 'POST') {
        if (!state.refreshTokens.delete(body.refreshToken)) fail(401, 'Refresh token kiểm thử không hợp lệ.');
        return send(issueSession());
      }
      const token = String(request.headers.authorization || '').replace(/^Bearer /i, '');
      if (!state.sessions.has(token)) fail(401, 'Cần đăng nhập bằng tài khoản kiểm thử.');
      if (path === '/api/auth/email-verification/send-otp' && method === 'POST') return send(undefined, 204);
      if (path === '/api/auth/email-verification/verify' && method === 'POST') {
        if (String(body.otp) !== TEST_OTP) fail(400, 'Mã xác thực kiểm thử không chính xác.');
        state.staff.isVerified = true;
        return send(undefined, 204);
      }
      if (!state.staff.isVerified) fail(403, 'Hãy xác thực email trước khi sử dụng Staff.');
      if (path === '/api/areas' && method === 'GET') return send([{ areaId: 3, areaName: 'Phường Tân Phong' }, { areaId: 7, areaName: 'Phường Bình Thuận' }]);
      if (path === '/api/categories' && method === 'GET') return send([{ categoryId: 2, categoryName: 'Chiếu sáng' }, { categoryId: 4, categoryName: 'Thoát nước' }, { categoryId: 6, categoryName: 'Giao thông' }]);
      if (path === '/api/profile') fail(403, 'Swagger chỉ cấp hồ sơ tự chỉnh sửa này cho ServiceUser, không phải SystemStaff.');
      if (path === '/api/management/incidents' && method === 'GET') {
        let items = state.incidents.filter((item) => item.assignedStaffUserId === state.staff.userId);
        for (const [param, key] of [['Status', 'status'], ['Priority', 'priority'], ['Severity', 'severity'], ['AreaId', 'areaId'], ['CategoryId', 'categoryId'], ['AssignedStaffUserId', 'assignedStaffUserId']]) {
          const value = queryValue(url, param);
          if (value) items = items.filter((item) => String(item[key]) === value);
        }
        const search = text(queryValue(url, 'Search')).toLocaleLowerCase('vi');
        if (search) items = items.filter((item) => `${item.title} ${item.description}`.toLocaleLowerCase('vi').includes(search));
        return send(paged(items, url));
      }
      const incidentRoute = path.match(/^\/api\/management\/incidents\/([^/]+)(?:\/(.+))?$/);
      if (incidentRoute) {
        const item = getIncident(incidentRoute[1]);
        const action = incidentRoute[2];
        if (!action && method === 'GET') return send(item);
        if (action === 'timeline' && method === 'GET') return send(paged(state.timeline.get(item.incidentId) || [], url));
        if (action === 'status' && method === 'PATCH') {
          assertOwner(item);
          if (item.status !== 'Assigned' || body.status !== 'InProgress') {
            fail(409, 'Chỉ có thể bắt đầu xử lý sự vụ đang ở trạng thái Assigned.');
          }
          const startedAt = now();
          item.status = 'InProgress';
          item.processingStartedAt = startedAt;
          item.updatedAt = startedAt;
          event(item.incidentId, 'IncidentProcessingStarted', text(body.note) || 'Staff bắt đầu xử lý sự vụ.');
          return send(item);
        }
        if (action === 'provider-candidates' && method === 'GET') { assertOwner(item); return send(state.candidates); }
        if (action === 'provider-assignment') {
          if (item.incidentId === 'provider-forbidden') fail(403, 'Không có quyền truy cập phân công đơn vị kiểm thử.');
          const assignment = state.assignments.get(item.incidentId);
          if (method === 'GET') return assignment ? send(assignment) : send(undefined, 204);
          if (method === 'POST') {
            assertEditable(item);
            if (assignment) fail(409, 'Sự vụ đã có đơn vị phụ trách.');
            const candidate = state.candidates.find((value) => value.coordinatorId === body.coordinatorId) || fail(400, 'Đơn vị kiểm thử không hợp lệ.');
            const result = { ...candidate, providerAssignmentId: state.nextAssignmentId++, incidentId: item.incidentId, note: text(body.note), assignedByStaffUserId: state.staff.userId, assignedByStaffUserName: state.staff.fullName, reportStatus: 'Reported', reportNote: '', dueDate: item.dueDate, assignedAt: now(), updatedAt: now(), contactLogCount: 0, completionDocumentCount: 0 };
            state.assignments.set(item.incidentId, result);
            event(item.incidentId, 'ProviderAssigned', `Đã phân công ${candidate.providerName}.`);
            return send(result, 201);
          }
        }
        if (action === 'resolutions') {
          const resolutions = state.resolutions.get(item.incidentId) || [];
          if (method === 'GET') return send(resolutions);
          if (method === 'POST') {
            assertOwner(item);
            const initialSubmission = item.status === 'InProgress' && resolutions.length === 0;
            const reworkSubmission = item.status === 'NeedRework';
            if (!initialSubmission && !reworkSubmission) fail(409, 'Sự vụ không còn cho phép gửi kết quả ở trạng thái hiện tại.');
            const assignment = state.assignments.get(item.incidentId);
            if (body.providerAssignmentId != null && assignment?.providerAssignmentId !== body.providerAssignmentId) fail(400, 'Phân công đơn vị không thuộc sự vụ này.');
            const documents = assignment ? state.documents.get(assignment.providerAssignmentId) || [] : [];
            if (body.imageUrls != null && (!Array.isArray(body.imageUrls) || body.imageUrls.some((value) => !documents.some((document) => document.fileUrl === value && document.fileType.startsWith('image/'))))) fail(400, 'Ảnh kết quả phải thuộc minh chứng đã tải lên của sự vụ.');
            const result = { resolutionId: state.nextResolutionId++, incidentId: item.incidentId, providerAssignmentId: body.providerAssignmentId ?? null, createdByStaffUserId: state.staff.userId, createdByStaffUserName: state.staff.fullName, resolutionSummary: required(body.resolutionSummary, 'tóm tắt kết quả'), actionTaken: text(body.actionTaken), resultNote: text(body.resultNote), imageUrls: body.imageUrls || [], status: 'Submitted', resolvedAt: now(), completionDocuments: structuredClone(documents) };
            state.resolutions.set(item.incidentId, [result, ...resolutions]);
            item.status = 'SubmittedForApproval'; item.updatedAt = now();
            event(item.incidentId, reworkSubmission ? 'ResolutionResubmitted' : 'ResolutionSubmitted', result.resolutionSummary);
            return send(undefined);
          }
        }
        // Never mock Manager's Incident assign/verify endpoints as success.
        fail(404, 'Thao tác không thuộc luồng Staff kiểm thử.');
      }
      const providerRoute = path.match(/^\/api\/management\/provider-assignments\/(\d+)\/(contact-logs|status|completion-documents)$/);
      if (providerRoute) {
        const assignmentId = Number(providerRoute[1]);
        const assignment = [...state.assignments.values()].find((value) => value.providerAssignmentId === assignmentId) || fail(404, 'Không tìm thấy phân công đơn vị.');
        const item = getIncident(assignment.incidentId);
        const action = providerRoute[2];
        if (action === 'contact-logs') {
          const logs = state.contacts.get(assignmentId) || [];
          if (method === 'GET') return send(logs);
          if (method === 'POST') {
            assertEditable(item);
            if (body.contactedAt && !Number.isFinite(Date.parse(body.contactedAt))) fail(400, 'Thời điểm liên hệ không hợp lệ.');
            const contact = { ...assignment, contactLogId: state.nextContactId++, contactedByUserId: state.staff.userId, contactedByUserName: state.staff.fullName, contactMethod: required(body.contactMethod, 'phương thức liên hệ'), contactResult: required(body.contactResult, 'kết quả liên hệ'), contactNote: text(body.contactNote), contactedAt: body.contactedAt || now() };
            logs.unshift(contact); state.contacts.set(assignmentId, logs); assignment.contactLogCount = logs.length;
            return send(contact);
          }
        }
        if (action === 'status' && method === 'PATCH') {
          assertEditable(item);
          if (!providerTransitions[assignment.reportStatus]?.includes(body.status)) fail(409, 'Chuyển trạng thái không được hỗ trợ trong fixture này.');
          assignment.reportStatus = body.status; assignment.reportNote = text(body.note); assignment.updatedAt = now();
          event(item.incidentId, 'ProviderStatusUpdated', `Trạng thái đơn vị: ${body.status}.`);
          return send(assignment);
        }
        if (action === 'completion-documents') {
          const documents = state.documents.get(assignmentId) || [];
          if (method === 'GET') return send(documents);
          if (method === 'DELETE') {
            assertOwner(item);
            if (item.status !== 'NeedRework') fail(409, 'Chỉ được xóa toàn bộ minh chứng khi sự vụ cần xử lý lại.');
            state.documents.set(assignmentId, []);
            assignment.completionDocumentCount = 0;
            event(item.incidentId, 'CompletionDocumentsCleared', 'Đã xóa toàn bộ minh chứng cũ để xử lý lại.');
            return send(undefined);
          }
          if (method === 'POST') {
            assertEditable(item);
            if (!isMultipart) fail(400, 'Minh chứng cần multipart/form-data.');
            let form;
            try { form = await new Request(`${origin}${path}`, { method: 'POST', headers: { 'content-type': request.headers['content-type'] }, body: rawBody }).formData(); } catch { fail(400, 'Multipart kiểm thử không hợp lệ.'); }
            const files = form.getAll('Files');
            if (!files.length || files.length > 10 || files.some((file) => typeof file === 'string' || file.size <= 0 || file.size > MAX_UPLOAD_BYTES)) fail(400, 'Cần 1–10 tệp minh chứng hợp lệ, tối đa 16 MiB mỗi tệp.');
            if (files.some((file) => !['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type))) fail(400, 'Fixture chỉ nhận ảnh JPEG/PNG/WebP hoặc PDF.');
            const bufferedFiles = await Promise.all(files.map(async (file) => ({ file, bytes: Buffer.from(await file.arrayBuffer()) })));
            // A submit can arrive during multipart parsing; do not write after it.
            assertEditable(item);
            const received = [];
            for (const { file, bytes } of bufferedFiles) {
              const id = state.nextDocumentId++;
              const uploadPath = `/fixture/uploads/${id}`;
              state.uploads.set(uploadPath, { bytes, type: file.type });
              received.push({ completionDocumentId: id, providerAssignmentId: assignmentId, incidentId: item.incidentId, coordinatorId: assignment.coordinatorId, providerName: assignment.providerName, fileUrl: `${origin}${uploadPath}`, fileName: file.name, fileType: file.type, description: text(form.get('Description')), uploadedByUserId: state.staff.userId, uploadedByUserName: state.staff.fullName, receivedAt: now() });
            }
            documents.push(...received); state.documents.set(assignmentId, documents); assignment.completionDocumentCount = documents.length;
            return send(received);
          }
        }
        fail(405, 'Phương thức không được hỗ trợ.');
      }
      if (path === '/api/management/feedbacks' && method === 'GET') {
        const search = text(queryValue(url, 'Search')).toLocaleLowerCase('vi');
        const status = queryValue(url, 'Status');
        return send(paged(state.reports.filter((item) => (!status || item.status === status) && (!search || item.title.toLocaleLowerCase('vi').includes(search))), url));
      }
      const reportRoute = path.match(/^\/api\/management\/feedbacks\/([^/]+)$/);
      if (reportRoute && method === 'GET') return send(state.reports.find((item) => item.feedbackId === reportRoute[1]) || fail(404, 'Không tìm thấy Report.'));
      const slaStatusRoute = path.match(/^\/api\/slas\/incident\/([^/]+)\/status$/);
      if (slaStatusRoute && method === 'GET') return send(state.slaStatuses.get(slaStatusRoute[1]) || fail(404, 'Sự vụ chưa có dữ liệu SLA kiểm thử.'));
      const messageRoute = path.match(/^\/api\/feedbacks\/([^/]+)\/messages$/);
      if (messageRoute) {
        const messages = state.messages.get(messageRoute[1]) || fail(404, 'Không tìm thấy Report.');
        if (method === 'GET') return send(messages);
        if (method === 'POST') {
          if (typeof body.isInternal !== 'boolean') fail(400, 'Cần xác định phạm vi tin nhắn.');
          const messageText = required(body.messageText, 'nội dung tin nhắn');
          if (messageText.length > 10000) fail(400, 'Tin nhắn kiểm thử quá dài.');
          const message = { interactionMessageId: state.nextMessageId++, userFullName: state.staff.fullName, userId: state.staff.userId, messageText, isInternal: body.isInternal, createdAt: now() };
          messages.push(message);
          return send(message);
        }
      }
      if (path === '/api/notifications' && method === 'GET') {
        const readFilter = queryValue(url, 'IsRead');
        return send(paged(state.notifications.filter((item) => readFilter == null || item.isRead === (readFilter === 'true')), url));
      }
      if (path === '/api/notifications/read-all' && method === 'PATCH') { state.notifications.forEach((item) => { item.isRead = true; }); return send(undefined, 204); }
      const notificationRoute = path.match(/^\/api\/notifications\/([^/]+)\/read$/);
      if (notificationRoute && method === 'PATCH') {
        const item = state.notifications.find((value) => String(value.notificationId) === notificationRoute[1]) || fail(404, 'Không tìm thấy thông báo.');
        item.isRead = true; return send(undefined, 204);
      }
      fail(404, 'Endpoint không có trong fixture Staff.');
    } catch (error) {
      const status = error instanceof FixtureError ? error.status : 500;
      if (!quiet) console.warn(`[native-fixture] ${method} ${path} -> ${status}`);
      if (!response.headersSent) send({ message: error instanceof FixtureError ? error.message : 'Lỗi nội bộ của fixture kiểm thử.' }, status);
      else response.end();
    } finally {
      if (!quiet && response.statusCode < 400) console.log(`[native-fixture] ${method} ${path} -> ${response.statusCode}`);
    }
  });
  server.requestTimeout = 30000;
  server.headersTimeout = 10000;
  server.on('listening', () => {
    origin = `http://${HOST}:${server.address().port}`;
    state = createFixtures(origin, requireOtp);
  });
  return server;
}

async function selfTest() {
  const server = createStaffNativeServer({ requireOtp: true, quiet: true });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, HOST, resolve); });
  const origin = `http://${HOST}:${server.address().port}`;
  let token = '';
  let assertions = 0;
  const check = (actual, expected) => { assert.deepEqual(actual, expected); assertions++; };
  const request = async (path, method = 'GET', body, expected = 200) => {
    const multipart = body instanceof FormData;
    const response = await fetch(`${origin}${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body && !multipart ? { 'Content-Type': 'application/json' } : {}) }, body: body ? multipart ? body : JSON.stringify(body) : undefined });
    check(response.status, expected);
    const raw = await response.text();
    return raw ? JSON.parse(raw) : null;
  };
  try {
    await request('/api/profile', 'GET', undefined, 401);
    await request('/api/auth/login', 'POST', { email: TEST_EMAIL, password: 'wrong-test-password' }, 400);
    const login = await request('/api/auth/login', 'POST', { email: TEST_EMAIL, password: TEST_PASSWORD });
    check(login.isVerified, false); token = login.token;
    await request('/api/profile', 'GET', undefined, 403);
    await request('/api/auth/email-verification/send-otp', 'POST', undefined, 204);
    await request('/api/auth/email-verification/verify', 'POST', { otp: '000000' }, 400);
    const verified = await request('/api/auth/email-verification/verify', 'POST', { otp: TEST_OTP }, 204);
    check(verified, null);
    const refreshed = await request('/api/auth/refresh-token', 'POST', { refreshToken: login.refreshToken });
    check(refreshed.isVerified, true);
    token = refreshed.token;
    await request('/api/profile', 'GET', undefined, 403);
    await request('/api/profile', 'PUT', { fullName: 'Không được sửa', phoneNumber: '0902222333' }, 403);
    const page = await request('/api/management/incidents?PageNumber=2&PageSize=20'); check(page.items.length, 5); check(page.totalItems, 25);
    const filtered = await request('/api/management/incidents?Status=Assigned&Priority=High&Severity=High&AreaId=3&CategoryId=2&Search=' + encodeURIComponent('hẻm 42'));
    check(filtered.totalItems, 1);
    const primaryId = filtered.items[0].incidentId;
    const primary = await request(`/api/management/incidents/${primaryId}`); check(primary.reports.length, 2);
    check((await request(`/api/management/incidents/${primaryId}/timeline`)).items.length, 5);
    const started = await request(`/api/management/incidents/${primaryId}/status`, 'PATCH', { status: 'InProgress', note: 'Bắt đầu kiểm tra hiện trường.' });
    check(started.status, 'InProgress'); check(typeof started.processingStartedAt, 'string');
    check((await request(`/api/management/incidents/${primaryId}/timeline`)).items.length, 6);
    await request(`/api/management/incidents/${primaryId}/status`, 'PATCH', { status: 'InProgress' }, 409);
    await request(`/api/management/incidents/${primaryId}/status`, 'PATCH', { status: 'Done' }, 409);
    await request('/api/management/incidents/incident-forbidden', 'GET', undefined, 403);
    await request('/api/management/incidents/4848f090-5cee-4e17-a82f-099d79a8d898/status', 'PATCH', { status: 'InProgress' }, 403);
    await request('/api/management/incidents/4848f090-5cee-4e17-a82f-099d79a8d898/provider-assignment', 'POST', { coordinatorId: 41 }, 403);
    const workingId = 'a5d71423-41c6-4d4c-a2e6-329c4a3e0a25';
    const incidentPath = `/api/management/incidents/${workingId}`;
    await request(`${incidentPath}/provider-assignment`, 'GET', undefined, 204);
    check((await request(`${incidentPath}/provider-candidates`)).length, 2);
    const assignment = await request(`${incidentPath}/provider-assignment`, 'POST', { coordinatorId: 41, note: 'Ghi chú phân công kiểm thử.' }, 201);
    await request(`${incidentPath}/provider-assignment`, 'POST', { coordinatorId: 42 }, 409);
    const assignmentPath = `/api/management/provider-assignments/${assignment.providerAssignmentId}`;
    await request(`${assignmentPath}/contact-logs`, 'POST', { contactMethod: 'Phone', contactResult: 'Đã xác nhận lịch kiểm tra.', contactNote: 'Chỉ là dữ liệu kiểm thử.' });
    check((await request(`${assignmentPath}/contact-logs`)).length, 1);
    check((await request(`${assignmentPath}/status`, 'PATCH', { status: 'InProgress' })).reportStatus, 'InProgress');
    check((await request(`${incidentPath}`)).status, 'InProgress');
    await request(`${assignmentPath}/status`, 'PATCH', { status: 'Invented' }, 409);
    const image = await readFile(new URL('../assets/icon.png', import.meta.url));
    const pdf = inspectionPdf();
    const form = new FormData();
    form.append('Files', new Blob([image], { type: 'image/png' }), 'native-test.png');
    form.append('Files', new Blob([pdf], { type: 'application/pdf' }), 'bien-ban-nghiem-thu.pdf');
    form.append('Description', 'Minh chứng kiểm thử cục bộ.');
    const uploaded = await request(`${assignmentPath}/completion-documents`, 'POST', form);
    check(uploaded.length, 2); check(uploaded[0].incidentId, workingId); check(uploaded[0].description, 'Minh chứng kiểm thử cục bộ.'); check(uploaded[1].fileType, 'application/pdf');
    const servedImage = await fetch(uploaded[0].fileUrl); check(servedImage.status, 200); check(Buffer.from(await servedImage.arrayBuffer()).equals(image), true);
    const servedPdf = await fetch(uploaded[1].fileUrl); check(servedPdf.status, 200); check(Buffer.from(await servedPdf.arrayBuffer()).equals(pdf), true);
    await request(`${assignmentPath}/completion-documents`, 'DELETE', undefined, 409);
    check((await request(`${assignmentPath}/completion-documents`)).length, 2);
    await request(`${incidentPath}/resolutions`, 'POST', { providerAssignmentId: assignment.providerAssignmentId, resolutionSummary: 'Đã hoàn thành kiểm tra.', actionTaken: 'Dọn miệng thu nước.', resultNote: 'Nước thoát bình thường.', imageUrls: [uploaded[0].fileUrl] });
    check((await request(incidentPath)).status, 'SubmittedForApproval');
    check((await request(`${incidentPath}/resolutions`))[0].completionDocuments.length, 2);
    await request(`${incidentPath}/resolutions`, 'POST', { resolutionSummary: 'Gửi trùng.' }, 409);
    await request(`${assignmentPath}/contact-logs`, 'POST', { contactMethod: 'Phone', contactResult: 'Không còn được sửa.' }, 409);
    const reworkPath = '/api/management/incidents/2c610495-f259-414c-82c8-2e17a54c4045';
    const reworkAssignment = await request(`${reworkPath}/provider-assignment`);
    const reworkAssignmentPath = `/api/management/provider-assignments/${reworkAssignment.providerAssignmentId}`;
    check(reworkAssignment.providerAssignmentId, 504);
    check((await request(`${reworkAssignmentPath}/completion-documents`)).length, 1);
    const priorResolutions = await request(`${reworkPath}/resolutions`);
    check(priorResolutions.length, 1); check(priorResolutions[0].resolutionId, 602); check(priorResolutions[0].completionDocuments.length, 1);
    await request(`${reworkAssignmentPath}/completion-documents`, 'DELETE');
    check((await request(`${reworkAssignmentPath}/completion-documents`)).length, 0);
    check((await request(`${reworkPath}/resolutions`))[0].completionDocuments.length, 1);
    const replacementForm = new FormData(); replacementForm.append('Files', new Blob([image], { type: 'image/png' }), 'rework-new.png'); replacementForm.append('Description', 'Ảnh toàn cảnh mới sau xử lý lại.');
    const replacement = await request(`${reworkAssignmentPath}/completion-documents`, 'POST', replacementForm);
    check(replacement.length, 1); check(replacement[0].description, 'Ảnh toàn cảnh mới sau xử lý lại.');
    await request(`${reworkPath}/resolutions`, 'POST', { providerAssignmentId: reworkAssignment.providerAssignmentId, resolutionSummary: 'Đã bổ sung ảnh toàn cảnh theo yêu cầu.', actionTaken: 'Chụp lại hiện trường và kiểm tra chốt cố định.', resultNote: 'Sẵn sàng để Manager duyệt lại.', imageUrls: [replacement[0].fileUrl] });
    check((await request(reworkPath)).status, 'SubmittedForApproval');
    const resubmitted = await request(`${reworkPath}/resolutions`);
    check(resubmitted.length, 2); check(resubmitted[0].resolutionSummary, 'Đã bổ sung ảnh toàn cảnh theo yêu cầu.'); check(resubmitted[0].completionDocuments.length, 1); check(resubmitted[1].resolutionId, 602); check(resubmitted[1].completionDocuments.length, 1);
    await request(`${reworkAssignmentPath}/completion-documents`, 'DELETE', undefined, 409);
    await request(`${reworkPath}/resolutions`, 'POST', { resolutionSummary: 'Gửi lại trùng.' }, 409);
    const reports = await request('/api/management/feedbacks'); check(reports.totalItems, 2);
    const warningSla = await request(`/api/slas/incident/${primaryId}/status`);
    check(warningSla.incidentId, primaryId); check(warningSla.isResolutionWarning, true); check(warningSla.resolutionRemainingSeconds, 5400);
    await request('/api/slas/incident/00000000-0000-4000-8000-000000000000/status', 'GET', undefined, 404);
    const messagePath = `/api/feedbacks/${reports.items[0].feedbackId}/messages`;
    const publicMessage = await request(messagePath, 'POST', { messageText: 'Tin nhắn công khai kiểm thử.', isInternal: false });
    const internalMessage = await request(messagePath, 'POST', { messageText: 'Ghi chú nội bộ kiểm thử.', isInternal: true });
    check(publicMessage.interactionMessageId, 2); check(internalMessage.interactionMessageId, 3);
    check((await request(messagePath)).filter((item) => item.isInternal).length, 1);
    check((await request(`/api/feedbacks/${reports.items[1].feedbackId}/messages`)).length, 0);
    await request('/api/notifications/1/read', 'PATCH', undefined, 204);
    await request('/api/notifications/read-all', 'PATCH', undefined, 204);
    check((await request('/api/notifications?isRead=false')).totalItems, 0);
    console.log(`Native fixture self-test passed: ${assertions} assertions; login/OTP, token refresh, Staff profile role guard, scoped lists, Incident SLA, Incident start, provider/contact/status, multipart evidence, NeedRework clear/replace/history, resolution/rework, chat and notifications.`);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.includes('--self-test')) await selfTest();
  else {
    const port = Number(process.env.STAFF_NATIVE_PORT || 8100);
    if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) throw new Error('STAFF_NATIVE_PORT must be an integer between 1024 and 65535.');
    const requireOtp = process.argv.includes('--otp');
    const server = createStaffNativeServer({ requireOtp });
    server.on('error', (error) => { console.error(`Native fixture failed to start: ${error.code || error.message}`); process.exitCode = 1; });
    server.listen(port, HOST, () => {
      console.log(`LOCAL TEST ONLY: http://${HOST}:${port} (memory-only fixture API)`);
      console.log(`Run adb reverse tcp:${port} tcp:${port}; test-build EXPO_PUBLIC_API_URL=http://${HOST}:${port}`);
      console.log(`Normal UI login: ${TEST_EMAIL} / ${TEST_PASSWORD}`);
      console.log(requireOtp ? `Normal email-verification OTP: ${TEST_OTP}` : `Email already verified; restart with --otp to test OTP ${TEST_OTP}.`);
      console.log('Do not use real credentials. Restart this process to reset fixture data.');
    });
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { server.closeAllConnections(); server.close(); });
  }
}
