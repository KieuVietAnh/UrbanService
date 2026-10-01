import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createStaffGallery } from './staff-gallery.mjs';
import { createStaffArchive } from './staff-archive.mjs';
import { smokeProfile, COMPATIBILITY_SCREEN_PREFIXES, installSyntheticTextScale } from './staff-smoke-profiles.mjs';

// Browser-only fixture data. Every API request is intercepted: no real account or backend writes.
const origin = process.env.MOBILE_SMOKE_URL || 'http://localhost:8082';
const compact = process.argv.includes('--compact');
const profile = smokeProfile(process.env.MOBILE_SMOKE_PROFILE || (compact ? 'small' : 'baseline'), {
  width: process.env.MOBILE_SMOKE_WIDTH || undefined,
  height: process.env.MOBILE_SMOKE_HEIGHT || undefined,
  textScale: process.env.MOBILE_SMOKE_TEXT_SCALE || undefined,
});
const compatibility = profile.name !== 'baseline' && !compact;
const output = process.env.MOBILE_SMOKE_OUTPUT
  ? new URL(process.env.MOBILE_SMOKE_OUTPUT.endsWith('/') ? process.env.MOBILE_SMOKE_OUTPUT : process.env.MOBILE_SMOKE_OUTPUT + '/', import.meta.url)
  : new URL(compatibility ? '../../../docs/screenshots/mobile-staff-compatibility/' + profile.name + '/' : '../../../docs/screenshots/mobile-staff/', import.meta.url);
const screenshotsEnabled = !compact && process.env.MOBILE_SMOKE_NO_SCREENSHOTS !== '1';
const viewport = profile.viewport;
if (screenshotsEnabled) await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: 'reduce' });
await context.addInitScript(installSyntheticTextScale, profile.textScale);
const page = await context.newPage();
page.setDefaultTimeout(30000);
const errors = [];
const requests = [];
const manifest = [];
const geometryChecks = [];
const unmocked = [];
page.on('pageerror', (error) => errors.push(error.message));

const staff = { userId: '7c4da649-b85f-4ec1-a22b-d4efd03a0e95', fullName: 'Nguyễn Minh Anh', email: 'staff@example.test', role: 'SystemStaff', isVerified: true };
let loginRole = 'SystemStaff';
const createdAt = '2026-08-30T08:30:00Z';
const reportOne = {
  feedbackId: 'fb410028-7b18-4c37-b1d7-168c61bf0632', title: 'Đèn đường không sáng trước hẻm 42',
  description: 'Ba đèn đường trước hẻm 42 không sáng trong hai buổi tối gần đây. Người đi bộ khó quan sát đoạn giao với đường chính.',
  status: 'Verified', categoryId: 2, categoryName: 'Chiếu sáng', areaId: 3, areaName: 'Phường Tân Phong',
  priority: 'High', locationText: 'Hẻm 42 Nguyễn Văn Linh', reporterName: 'Trần Ngọc An',
  createdAt, updatedAt: '2026-08-31T09:10:00Z', incidentId: 'ec4a1028-21a8-4d16-a335-8cb34da6aa11',
  attachments: [{ fileUrl: origin + '/fixture/inspection-note.pdf', fileName: 'Ghi nhận hiện trường.pdf' }],
  analysisResult: { summary: 'Phản ánh về cụm đèn đường mất sáng; nội dung phù hợp với sự vụ chiếu sáng đã được ghi nhận tại cùng khu vực.', confidenceScore: 0.94 },
};
const reportTwo = {
  feedbackId: 'fb620031-0d35-4f6c-8350-b3e235606d17', title: 'Cụm đèn gần điểm đón xe buýt bị tắt',
  description: 'Khu vực điểm đón xe buýt gần hẻm 42 thiếu ánh sáng sau 19 giờ. Tôi gửi thêm vị trí để đội phụ trách kiểm tra.',
  status: 'Verified', categoryId: 2, categoryName: 'Chiếu sáng', areaId: 3, areaName: 'Phường Tân Phong',
  priority: 'Medium', locationText: 'Trạm xe buýt Nguyễn Văn Linh', reporterName: 'Lê Hoàng Phúc',
  createdAt: '2026-08-30T12:15:00Z', updatedAt: '2026-08-31T09:10:00Z',
  // Intentionally no incidentId: detail must preserve its explicit navigation context, not guess a mapping.
  analysisResult: { summary: 'Report bổ sung vị trí và thời điểm mất sáng trong cùng khu vực.', confidenceScore: 0.91 },
};
const reports = [reportOne, reportTwo];
const incident = {
  incidentId: 'ec4a1028-21a8-4d16-a335-8cb34da6aa11', title: 'Mất chiếu sáng tại hẻm 42 Nguyễn Văn Linh',
  description: 'Hai phản ánh ghi nhận cụm đèn đường mất sáng quanh hẻm 42 và điểm đón xe buýt. Kiểm tra hiện trường, ghi nhận tình trạng tủ điện và phối hợp đơn vị phụ trách.',
  status: 'Assigned', assignedStaffUserId: staff.userId, assignedStaffName: staff.fullName,
  categoryId: 2, categoryName: 'Chiếu sáng', areaId: 3, areaName: 'Phường Tân Phong',
  locationText: 'Hẻm 42 Nguyễn Văn Linh', priority: 'High', severity: 'High',
  createdAt, updatedAt: '2026-09-01T02:20:00Z', dueDate: '2026-09-03T10:00:00Z', reportCount: 2,
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
const providerCandidates = [
  { coordinatorId: 41, providerName: 'Đội thoát nước khu Nam', coordinatorName: 'Phạm Quốc Hưng', phoneNumber: '0903555777', email: 'thoatnuoc@example.test', address: 'Khu vận hành phía Nam', isPrimary: true, priorityOrder: 1, contractId: 10, contractCode: 'TN-2026-10', contractName: 'Duy tu hệ thống thoát nước', contractStatus: 'Active' },
  { coordinatorId: 42, providerName: 'Tổ bảo trì hạ tầng Bình Thuận', coordinatorName: 'Võ Thu Hà', phoneNumber: '0904666888', email: 'baotri@example.test', address: 'Phường Bình Thuận', isPrimary: false, priorityOrder: 2, contractId: 11, contractCode: 'HT-2026-11', contractName: 'Bảo trì hạ tầng khu vực', contractStatus: 'Active' },
];
const reworkOldEvidence = {
  completionDocumentId: 704, providerAssignmentId: 504, incidentId: reworkIncident.incidentId,
  coordinatorId: providerCandidates[0].coordinatorId, providerName: providerCandidates[0].providerName,
  uploadedByUserId: staff.userId, uploadedByUserName: staff.fullName,
  fileUrl: origin + '/fixture/evidence.png', fileType: 'image/png',
  description: 'Ảnh nắp hố ga trước lần xử lý lại.', receivedAt: '2026-09-01T03:55:00Z',
};
const providerAssignments = new Map([
  [approvalIncident.incidentId, { ...providerCandidates[0], providerAssignmentId: 502, incidentId: approvalIncident.incidentId, assignedByStaffUserId: staff.userId, assignedByStaffUserName: staff.fullName, reportStatus: 'Done', reportNote: 'Đã hoàn thành kiểm tra.', assignedAt: createdAt, contactLogCount: 0, completionDocumentCount: 0 }],
  [foreignIncident.incidentId, { ...providerCandidates[1], providerAssignmentId: 503, incidentId: foreignIncident.incidentId, assignedByStaffUserId: 'another-staff', assignedByStaffUserName: 'Lê Hải Bình', reportStatus: 'InProgress', assignedAt: createdAt, contactLogCount: 0, completionDocumentCount: 0 }],
  [reworkIncident.incidentId, { ...providerCandidates[0], providerAssignmentId: 504, incidentId: reworkIncident.incidentId, assignedByStaffUserId: staff.userId, assignedByStaffUserName: staff.fullName, reportStatus: 'Done', reportNote: 'Manager yêu cầu bổ sung ảnh nghiệm thu.', assignedAt: createdAt, contactLogCount: 0, completionDocumentCount: 1 }],
]);
const providerContacts = new Map();
const completionDocuments = new Map([[504, [{ ...reworkOldEvidence }]]]);
const submittedResolutions = new Map([[approvalIncident.incidentId, [{ resolutionId: 601, incidentId: approvalIncident.incidentId, providerAssignmentId: 502, createdByStaffUserId: staff.userId, createdByStaffUserName: staff.fullName, resolutionSummary: 'Đã kiểm tra và khắc phục cụm đèn tín hiệu.', actionTaken: 'Thay bộ điều khiển và kiểm tra chu kỳ.', resultNote: 'Đang chờ Manager duyệt.', status: 'Submitted', resolvedAt: '2026-09-01T04:00:00Z', completionDocuments: [] }]]]);
submittedResolutions.set(staleSubmittedIncident.incidentId, [{ resolutionId: 603, incidentId: staleSubmittedIncident.incidentId, providerAssignmentId: null, createdByStaffUserId: staff.userId, createdByStaffUserName: staff.fullName, resolutionSummary: 'Kết quả đã nhận, đang chờ đồng bộ trạng thái.', status: 'Submitted', resolvedAt: '2026-09-01T04:00:00Z', completionDocuments: [] }]);
submittedResolutions.set(reworkIncident.incidentId, [{ resolutionId: 604, incidentId: reworkIncident.incidentId, providerAssignmentId: 504, createdByStaffUserId: staff.userId, createdByStaffUserName: staff.fullName, resolutionSummary: 'Đã kiểm tra nắp hố ga và bổ sung cảnh báo tạm thời.', actionTaken: 'Đặt biển cảnh báo và ghi nhận kích thước nắp hố ga.', resultNote: 'Manager yêu cầu bổ sung ảnh sau khi thay nắp.', status: 'NeedRework', resolvedAt: '2026-09-01T04:10:00Z', completionDocuments: [{ ...reworkOldEvidence }] }]);
const incidentSlaStatuses = new Map([
  [incident.incidentId, {
    incidentId: incident.incidentId, incidentSlaId: 901, status: 'Active', serverTime: '2026-09-01T05:00:00Z', startedAt: createdAt,
    responseStatus: 'Met', responseDueAt: '2026-08-30T10:30:00Z', responseRemainingSeconds: 0, responseProgressPercent: 100, isResponseWarning: false, isResponseBreached: false,
    resolutionStatus: 'Warning', resolutionDueAt: '2026-09-01T06:30:00Z', resolutionRemainingSeconds: 5400, resolutionProgressPercent: 78, isResolutionWarning: true, isResolutionBreached: false,
  }],
]);
const executionWrites = [];
let rejectNextIncidentStart = false;
let rejectNextAssignment = false;
let rejectNextContact = false;
let rejectNextUpload = false;
let rejectNextClearEvidence = false;
let rejectNextResolution = false;
const statusCycle = ['Assigned', 'InProgress', 'NeedRework', 'SubmittedForApproval'];
const incidents = [
  incident, workingIncident, reworkIncident, approvalIncident,
  ...Array.from({ length: 21 }, (_, index) => ({
    ...workingIncident, incidentId: String(index + 1).padStart(8, '0') + '-ceb7-4eca-a870-174cf59a1467',
    title: ['Kiểm tra miệng thu nước', 'Sửa biển chỉ dẫn khu dân cư', 'Ghi nhận vỉa hè xuống cấp'][index % 3] + ' tại đường số ' + (index + 11),
    status: statusCycle[index % statusCycle.length], priority: index % 2 ? 'Low' : 'Medium',
    severity: index % 2 ? 'Low' : 'Medium', updatedAt: '2026-08-31T03:20:00Z',
  })),
];
const timeline = [
  { incidentEventId: 'event-05', eventType: 'IncidentAssigned', actorUserName: 'Nguyễn Hải Yến', createdAt: '2026-09-01T02:20:00Z', payloadJson: JSON.stringify({ note: 'Phân công Nguyễn Minh Anh kiểm tra hiện trường.' }) },
  { incidentEventId: 'event-04', eventType: 'ReportLinked', actorUserName: 'Nguyễn Hải Yến', createdAt: '2026-08-31T09:10:00Z', payloadJson: JSON.stringify({ note: 'Manager xác nhận Report thứ hai thuộc cùng sự vụ.' }) },
  { incidentEventId: 'event-03', eventType: 'FeedbackVerified', actorUserName: 'Nguyễn Hải Yến', createdAt: '2026-08-30T09:10:00Z', payloadJson: JSON.stringify({ note: 'Đã xác minh nội dung và vị trí phản ánh.' }) },
  { incidentEventId: 'event-02', eventType: 'AIReviewed', actorUserName: 'Hệ thống', createdAt: '2026-08-30T08:40:00Z', payloadJson: JSON.stringify({ note: 'AI phân loại Chiếu sáng và gợi ý đối chiếu vị trí.' }) },
  { incidentEventId: 'event-01', eventType: 'IncidentCreated', actorUserName: 'Hệ thống', createdAt, payloadJson: JSON.stringify({ note: 'Tạo sự vụ từ Report đầu tiên.' }) },
];
let messages = [{ interactionMessageId: 1, userFullName: 'Trần Ngọc An', userId: '9ade3db1-a8ba-437d-864c-cce78e1b4e44', messageText: 'Tối qua đoạn hẻm vẫn chưa có đèn. Nhờ anh chị kiểm tra giúp.', isInternal: false, createdAt }];
let notifications = [
  { notificationId: 1, title: 'Sự vụ mới được giao', message: incident.title, createdAt: '2026-09-01T02:20:00Z', isRead: false, targetType: 'Incident', targetId: incident.incidentId, incidentId: incident.incidentId },
  { notificationId: 2, title: 'Người dân bổ sung thông tin', message: reportTwo.title, createdAt: '2026-08-31T09:10:00Z', isRead: false, targetType: 'Feedback', targetId: reportTwo.feedbackId },
  { notificationId: 3, title: 'Cập nhật hồ sơ đang xử lý', message: workingIncident.title, createdAt: '2026-08-31T03:20:00Z', isRead: true, incidentId: workingIncident.incidentId },
];
let rejectNextMessage = false;
let failIncidentList = false;
let holdIncidentList = false;
const releaseListRequests = [];
const paged = (items, pageNumber = 1, pageSize = 20) => ({
  items: items.slice((pageNumber - 1) * pageSize, pageNumber * pageSize),
  totalItems: items.length, totalPages: Math.max(1, Math.ceil(items.length / pageSize)),
  pageNumber, pageSize, hasNextPage: pageNumber * pageSize < items.length,
});
const queryValue = (url, name) => url.searchParams.get(name) ?? url.searchParams.get(name[0].toLowerCase() + name.slice(1));
const sameStaff = (left, right) => String(left || '').trim().toLowerCase() === String(right || '').trim().toLowerCase();
await context.route('**/api/**', async (route) => {
  const request = route.request();
  const url = new URL(request.url());
  const path = url.pathname;
  const method = request.method();
  requests.push({ path, method, query: Object.fromEntries(url.searchParams) });
  if (method === 'OPTIONS') return route.fulfill({ status: 204 });
  const pageNumber = Number(queryValue(url, 'PageNumber')) || 1;
  const pageSize = Number(queryValue(url, 'PageSize')) || 20;
  let data;
  if (path === '/api/auth/login') data = {
    userId: staff.userId,
    name: staff.fullName,
    email: staff.email,
    role: loginRole,
    isVerified: staff.isVerified,
    token: 'fixture-token-not-a-real-credential',
    refreshToken: 'fixture-refresh-token-not-a-real-credential',
  };
  else if (path === '/api/areas') data = [{ areaId: 3, areaName: 'Phường Tân Phong' }, { areaId: 7, areaName: 'Phường Bình Thuận' }];
  else if (path === '/api/categories') data = [{ categoryId: 2, categoryName: 'Chiếu sáng' }, { categoryId: 4, categoryName: 'Thoát nước' }, { categoryId: 6, categoryName: 'Giao thông' }];
  else if (path === '/api/management/incidents') {
    if (holdIncidentList) await new Promise((resolve) => releaseListRequests.push(resolve));
    if (failIncidentList) return route.fulfill({ status: 503, json: { message: 'Không thể tải danh sách sự vụ. Vui lòng thử lại.' } });
    const filtered = incidents.filter((item) => {
      for (const [queryKey, field] of [['Status', 'status'], ['Priority', 'priority'], ['Severity', 'severity'], ['AreaId', 'areaId'], ['CategoryId', 'categoryId'], ['AssignedStaffUserId', 'assignedStaffUserId']]) {
        const value = queryValue(url, queryKey);
        if (value && String(item[field]) !== value) return false;
      }
      const search = queryValue(url, 'Search')?.toLocaleLowerCase('vi-VN');
      return !search || (item.title + ' ' + item.description).toLocaleLowerCase('vi-VN').includes(search);
    });
    data = paged(filtered, pageNumber, pageSize);
  } else if (/^\/api\/management\/incidents\/[^/]+\/status$/.test(path) && method === 'PATCH') {
    const id = path.split('/')[4];
    const payload = request.postDataJSON();
    executionWrites.push({ path, method, payload });
    const current = incidents.find((item) => item.incidentId === id);
    if (!current) return route.fulfill({ status: 404, json: { message: 'Không tìm thấy sự vụ.' } });
    if (!sameStaff(current.assignedStaffUserId, staff.userId)) return route.fulfill({ status: 403, json: { message: 'Sự vụ không còn được phân công cho bạn.' } });
    if (rejectNextIncidentStart) {
      rejectNextIncidentStart = false;
      return route.fulfill({ status: 409, json: { message: 'Sự vụ vừa được cập nhật. Kiểm tra trạng thái mới nhất.' } });
    }
    if (current.status !== 'Assigned' || payload.status !== 'InProgress') {
      return route.fulfill({ status: 409, json: { message: 'Chuyển trạng thái sự vụ không hợp lệ.' } });
    }
    assert.equal(payload.status, 'InProgress', 'Staff may only start the explicit Assigned -> InProgress transition');
    assert.equal(typeof payload.note, 'string', 'Start processing sends the Swagger note field');
    current.status = 'InProgress';
    current.processingStartedAt = '2026-09-01T05:05:00Z';
    current.updatedAt = '2026-09-01T05:05:00Z';
    if (id === incident.incidentId) timeline.unshift({ incidentEventId: 'event-06', eventType: 'IncidentProcessingStarted', actorUserName: staff.fullName, createdAt: current.processingStartedAt, payloadJson: JSON.stringify({ note: payload.note }) });
    data = current;
  } else if (/^\/api\/management\/incidents\/[^/]+\/provider-candidates$/.test(path)) {
    data = providerCandidates;
  } else if (/^\/api\/management\/incidents\/[^/]+\/provider-assignment$/.test(path)) {
    const id = path.split('/')[4];
    if (id === providerForbiddenIncident.incidentId) return route.fulfill({ status: 403, json: { message: 'Không có quyền truy cập phân công đơn vị.' } });
    if (method === 'POST') {
      const payload = request.postDataJSON();
      executionWrites.push({ path, method, payload });
      if (rejectNextAssignment) { rejectNextAssignment = false; return route.fulfill({ status: 409, json: { message: 'Thông tin phân công vừa thay đổi. Vui lòng kiểm tra và thử lại.' } }); }
      assert.equal(providerAssignments.has(id), false, 'A second provider assignment must never be created');
      const candidate = providerCandidates.find((item) => item.coordinatorId === payload.coordinatorId);
      assert.ok(candidate, 'Assignment must select a real returned candidate');
      assert.equal(payload.feedbackId, undefined, 'Incident provider assignment must not infer a Report ID');
      data = { ...candidate, providerAssignmentId: 501, incidentId: id, note: payload.note, assignedByStaffUserId: staff.userId, assignedByStaffUserName: staff.fullName, reportStatus: 'Reported', assignedAt: '2026-09-01T04:05:00Z', contactLogCount: 0, completionDocumentCount: 0 };
      providerAssignments.set(id, data);
      return route.fulfill({ status: 201, json: data });
    }
    data = providerAssignments.get(id);
    if (!data) return route.fulfill({ status: 204 });
  } else if (/^\/api\/management\/provider-assignments\/\d+\/contact-logs$/.test(path)) {
    const assignmentId = Number(path.split('/')[4]);
    const assignment = [...providerAssignments.values()].find((item) => item.providerAssignmentId === assignmentId);
    const logs = providerContacts.get(assignmentId) || [];
    if (method === 'POST') {
      const payload = request.postDataJSON();
      executionWrites.push({ path, method, payload });
      if (rejectNextContact) { rejectNextContact = false; return route.fulfill({ status: 503, json: { message: 'Không lưu được lịch sử liên hệ. Vui lòng thử lại.' } }); }
      data = { ...assignment, ...payload, contactLogId: 801 + logs.length, contactedByUserId: staff.userId, contactedByUserName: staff.fullName, contactedAt: payload.contactedAt || '2026-09-01T04:15:00Z' };
      logs.unshift(data); providerContacts.set(assignmentId, logs);
      assignment.contactLogCount = logs.length;
      return route.fulfill({ status: 200, json: data });
    }
    data = logs;
  } else if (/^\/api\/management\/provider-assignments\/\d+\/status$/.test(path)) {
    const assignmentId = Number(path.split('/')[4]);
    const assignment = [...providerAssignments.values()].find((item) => item.providerAssignmentId === assignmentId);
    const payload = request.postDataJSON();
    executionWrites.push({ path, method, payload });
    assignment.reportStatus = payload.status; assignment.reportNote = payload.note; assignment.updatedAt = '2026-09-01T04:20:00Z';
    data = assignment;
  } else if (/^\/api\/management\/provider-assignments\/\d+\/completion-documents$/.test(path)) {
    const assignmentId = Number(path.split('/')[4]);
    const assignment = [...providerAssignments.values()].find((item) => item.providerAssignmentId === assignmentId);
    const documents = completionDocuments.get(assignmentId) || [];
    if (!assignment) return route.fulfill({ status: 404, json: { message: 'Không tìm thấy phân công đơn vị.' } });
    if (method === 'DELETE') {
      executionWrites.push({ path, method });
      const current = incidents.find((item) => item.incidentId === assignment.incidentId);
      if (!current) return route.fulfill({ status: 404, json: { message: 'Không tìm thấy sự vụ.' } });
      if (!sameStaff(current.assignedStaffUserId, staff.userId)) return route.fulfill({ status: 403, json: { message: 'Sự vụ không còn được phân công cho bạn.' } });
      if (current.status !== 'NeedRework') return route.fulfill({ status: 409, json: { message: 'Chỉ được xóa minh chứng khi sự vụ cần xử lý lại.' } });
      if (rejectNextClearEvidence) { rejectNextClearEvidence = false; return route.fulfill({ status: 503, json: { message: 'Không xóa được minh chứng cũ. Vui lòng thử lại.' } }); }
      completionDocuments.set(assignmentId, []);
      assignment.completionDocumentCount = 0;
      return route.fulfill({ status: 200, body: '' });
    }
    if (method === 'POST') {
      const body = request.postDataBuffer()?.toString('utf8') || '';
      assert.match(request.headers()['content-type'], /multipart\/form-data;.*boundary=/i);
      assert.match(body, /name="Files(?:\[\])?"/);
      assert.match(body, /name="Description"/);
      executionWrites.push({ path, method, multipart: true });
      if (rejectNextUpload) { rejectNextUpload = false; return route.fulfill({ status: 503, json: { message: 'Không tải được minh chứng. Vui lòng thử lại.' } }); }
      const isPdfUpload = /filename="[^"]+\.pdf"/i.test(body) || /content-type:\s*application\/pdf/i.test(body);
      const multipartDescription = body.match(/name="Description"\r?\n\r?\n([^\r\n]*)/i)?.[1]?.trim();
      documents.push({
        completionDocumentId: 701 + documents.length,
        providerAssignmentId: assignmentId,
        incidentId: assignment.incidentId,
        coordinatorId: assignment.coordinatorId,
        providerName: assignment.providerName,
        uploadedByUserId: staff.userId,
        uploadedByUserName: staff.fullName,
        fileUrl: origin + (isPdfUpload ? '/fixture/inspection-note.pdf' : '/fixture/evidence.png'),
        fileType: isPdfUpload ? 'application/pdf' : 'image/png',
        description: multipartDescription || (assignmentId === 504 ? 'Ảnh nắp hố ga mới sau xử lý lại.' : 'Ảnh kiểm tra miệng thu nước sau vệ sinh (dữ liệu kiểm thử).'),
        receivedAt: '2026-09-01T04:30:00Z',
      });
      completionDocuments.set(assignmentId, documents); assignment.completionDocumentCount = documents.length;
      return route.fulfill({ status: 200, json: documents });
    }
    data = documents;
  } else if (/^\/api\/management\/incidents\/[^/]+\/resolutions$/.test(path)) {
    const id = path.split('/')[4];
    const resolutions = submittedResolutions.get(id) || [];
    if (method === 'POST') {
      const payload = request.postDataJSON();
      executionWrites.push({ path, method, payload });
      assert.equal(payload.feedbackId, undefined, 'Resolution must use Incident identity, not an arbitrary Report');
      if (rejectNextResolution) { rejectNextResolution = false; return route.fulfill({ status: 409, json: { message: 'Sự vụ vừa được cập nhật. Kiểm tra thông tin và gửi lại.' } }); }
      const current = incidents.find((item) => item.incidentId === id);
      if (!current) return route.fulfill({ status: 404, json: { message: 'Không tìm thấy sự vụ.' } });
      if (!sameStaff(current.assignedStaffUserId, staff.userId)) return route.fulfill({ status: 403, json: { message: 'Sự vụ không còn được phân công cho bạn.' } });
      const initialSubmission = current.status === 'InProgress' && resolutions.length === 0;
      const reworkSubmission = current.status === 'NeedRework' && resolutions.length > 0;
      if (!initialSubmission && !reworkSubmission) return route.fulfill({ status: 409, json: { message: 'Trạng thái hoặc lịch sử kết quả không cho phép gửi.' } });
      resolutions.unshift({ ...payload, resolutionId: 610 + resolutions.length, incidentId: id, createdByStaffUserId: staff.userId, createdByStaffUserName: staff.fullName, status: 'Submitted', resolvedAt: '2026-09-01T05:20:00Z', completionDocuments: (completionDocuments.get(payload.providerAssignmentId) || []).map((document) => ({ ...document })) });
      submittedResolutions.set(id, resolutions);
      current.status = 'SubmittedForApproval';
      return route.fulfill({ status: 200, body: '' });
    }
    data = resolutions;
  } else if (/^\/api\/management\/incidents\/[^/]+\/timeline$/.test(path)) {
    const id = path.split('/')[4];
    data = paged(id === incident.incidentId ? timeline : [], pageNumber, pageSize);
  } else if (/^\/api\/management\/incidents\/[^/]+$/.test(path)) {
    const id = path.split('/')[4];
    if (id === 'incident-forbidden') return route.fulfill({ status: 403, json: { message: 'Hồ sơ không thuộc phạm vi truy cập.' } });
    data = [foreignIncident, providerForbiddenIncident, staleSubmittedIncident, ...incidents].find((item) => item.incidentId === id);
    if (!data) return route.fulfill({ status: 404, json: { message: 'Không tìm thấy sự vụ.' } });
  } else if (path === '/api/management/feedbacks') {
    const search = queryValue(url, 'Search')?.toLocaleLowerCase('vi-VN');
    const status = queryValue(url, 'Status');
    data = paged(reports.filter((item) => (!search || item.title.toLocaleLowerCase('vi-VN').includes(search)) && (!status || item.status === status)), pageNumber, pageSize);
  } else if (/^\/api\/management\/feedbacks\/[^/]+$/.test(path) && method === 'GET') {
    data = reports.find((item) => item.feedbackId === path.split('/')[4]);
    if (!data) return route.fulfill({ status: 404, json: { message: 'Không tìm thấy Report.' } });
  } else if (/^\/api\/slas\/incident\/[^/]+\/status$/.test(path) && method === 'GET') {
    const incidentId = decodeURIComponent(path.split('/')[4]);
    data = incidentSlaStatuses.get(incidentId);
    if (!data) return route.fulfill({ status: 404, json: { message: 'Sự vụ chưa có SLA đang áp dụng.' } });
  } else if (/^\/api\/feedbacks\/[^/]+\/messages$/.test(path)) {
    if (method === 'POST') {
      if (rejectNextMessage) { rejectNextMessage = false; return route.fulfill({ status: 503, json: { message: 'Không gửi được ghi chú. Vui lòng thử lại.' } }); }
      const message = { ...request.postDataJSON(), interactionMessageId: messages.length + 1, userFullName: staff.fullName, userId: staff.userId, createdAt: '2026-09-01T03:30:00Z' };
      messages.push(message);
      return route.fulfill({ status: 200, json: message });
    }
    data = messages;
  } else if (path === '/api/profile') {
    return route.fulfill({ status: 403, json: { message: 'Swagger chỉ cấp hồ sơ tự chỉnh sửa này cho ServiceUser, không phải SystemStaff.' } });
  } else if (path === '/api/notifications') data = paged(notifications.filter((item) => queryValue(url, 'IsRead') !== 'false' || !item.isRead), pageNumber, pageSize);
  else if (path === '/api/notifications/read-all' && method === 'PATCH') {
    notifications = notifications.map((item) => ({ ...item, isRead: true })); return route.fulfill({ status: 204, body: '' });
  } else if (/^\/api\/notifications\/[^/]+\/read$/.test(path) && method === 'PATCH') {
    notifications = notifications.map((item) => String(item.notificationId) === path.split('/')[3] ? { ...item, isRead: true } : item); return route.fulfill({ status: 204, body: '' });
  } else {
    unmocked.push({ method, path });
    return route.fulfill({ status: 404, json: { message: 'Unmocked fixture endpoint: ' + method + ' ' + path } });
  }
  return route.fulfill({ status: 200, json: data });
});
await context.route('**/fixture/evidence.png', async (route) => route.fulfill({ status: 200, contentType: 'image/png', body: await readFile(new URL('../assets/icon.png', import.meta.url)) }));
await context.route('**/fixture/inspection-note.pdf', async (route) => route.fulfill({ status: 200, contentType: 'application/pdf', body: Buffer.from('%PDF-1.4\n% UrbanMind staff validation fixture\n%%EOF\n') }));

async function settle() {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}
async function capture(file, title, group) {
  await settle();
  if (/^(01-home-01|09-incident-overview-01|20-chat-public|29-provider-candidates-01|40-resolution-form-01|25-account-01)/.test(file)) console.log('CHECK [' + profile.name + '] ' + title);
  const geometry = await page.evaluate(() => {
    const visibleControls = [...document.querySelectorAll('button,a,input,textarea,[role="button"],[role="tab"],[role="radio"],[role="switch"]')].filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight
        && rect.right > 0 && rect.left < innerWidth && style.visibility !== 'hidden'
        && !element.closest('[aria-hidden="true"]');
    });
    const clippedControls = visibleControls.filter((element) => {
      const rect = element.getBoundingClientRect();
      if (rect.left >= -1 && rect.right <= innerWidth + 1) return false;
      // A horizontally scrollable tab/filter strip intentionally has offscreen
      // items. It must be tested by interaction, not called a page overflow.
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        if (/auto|scroll/.test(style.overflowX) && parent.scrollWidth > parent.clientWidth) return false;
      }
      return true;
    }).map((element) => ({ name: element.getAttribute('aria-label') || element.textContent?.trim().slice(0, 100) || element.tagName, width: Math.round(element.getBoundingClientRect().width) }));
    const verticallyClippedControls = visibleControls.filter((element) => {
      const rect = element.getBoundingClientRect();
      if (rect.top >= -1 && rect.bottom <= innerHeight + 1) return false;
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        if (/auto|scroll/.test(style.overflowY) && parent.scrollHeight > parent.clientHeight + 4) return false;
      }
      return true;
    }).map((element) => {
      const rect = element.getBoundingClientRect();
      return { name: element.getAttribute('aria-label') || element.textContent?.trim().slice(0, 100) || element.tagName, top: Math.round(rect.top), bottom: Math.round(rect.bottom), viewportHeight: innerHeight };
    });
    const clippedTabText = [];
    // Expo's persistent bottom navigation is an anchor tab. The detail-screen
    // div tabs live inside a vertical ScrollView and may intentionally scroll
    // partly out of view; those are not fixed navigation-label clipping.
    for (const tab of visibleControls.filter((element) => element.tagName === 'A' && element.getAttribute('role') === 'tab')) {
      const tabRect = tab.getBoundingClientRect();
      // The item may be in a horizontal scroll strip, but every rendered line
      // must remain inside its vertical hit area and visible clipping bounds.
      let top = Math.max(0, tabRect.top);
      let bottom = Math.min(innerHeight, tabRect.bottom);
      for (let parent = tab.parentElement; parent; parent = parent.parentElement) {
        if (/hidden|clip|auto|scroll/.test(getComputedStyle(parent).overflowY)) {
          const rect = parent.getBoundingClientRect();
          top = Math.max(top, rect.top); bottom = Math.min(bottom, rect.bottom);
        }
      }
      const walker = document.createTreeWalker(tab, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (!node.textContent.trim() || /icon|material|awesome|ionicons|feather|octicons|entypo|antdesign|fontisto|zocial/i.test(getComputedStyle(node.parentElement).fontFamily)) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) {
          if (rect.width <= 0 || rect.right <= 0 || rect.left >= innerWidth) continue;
          if (rect.top < top - 2 || rect.bottom > bottom + 2) {
            clippedTabText.push({ name: tab.getAttribute('aria-label') || tab.textContent.trim(), text: node.textContent.trim(), textTop: Math.round(rect.top), textBottom: Math.round(rect.bottom), visibleTop: Math.round(top), visibleBottom: Math.round(bottom) });
            break;
          }
        }
      }
    }
    return { documentWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth, visibleControls: visibleControls.length, clippedControls, verticallyClippedControls, clippedTabText };
  });
  geometryChecks.push({ screen: file, ...geometry });
  assert.ok(geometry.documentWidth <= viewport.width + 1, 'The mobile page must not overflow horizontally: ' + title);
  assert.deepEqual(geometry.clippedControls, [], 'Interactive controls must fit or belong to a scrollable strip: ' + title);
  assert.deepEqual(geometry.verticallyClippedControls, [], 'Interactive controls must fit vertically or belong to a reachable vertical scroller: ' + title);
  assert.deepEqual(geometry.clippedTabText, [], 'Every visible tab label must fit vertically without hidden lines: ' + title);
  if (!screenshotsEnabled || (compatibility && !COMPATIBILITY_SCREEN_PREFIXES.some((prefix) => file.startsWith(prefix)))) return;
  await page.screenshot({ path: fileURLToPath(new URL(file, output)), fullPage: false });
  manifest.push({ file, title, group });
}
async function visibleScroller() {
  return page.evaluate(() => {
    for (const old of document.querySelectorAll('[data-staff-smoke-scroll]')) old.removeAttribute('data-staff-smoke-scroll');
    const candidates = [...document.querySelectorAll('*')].filter((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return /auto|scroll/.test(style.overflowY) && element.clientHeight > 160
        && element.scrollHeight > element.clientHeight + 8 && rect.width > 100
        && rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth
        && style.visibility !== 'hidden' && !element.closest('[aria-hidden="true"]');
    }).sort((a, b) => b.clientHeight - a.clientHeight);
    const element = candidates[0];
    if (!element) return { max: 0, height: innerHeight };
    element.setAttribute('data-staff-smoke-scroll', 'true');
    element.scrollTop = 0;
    return { max: element.scrollHeight - element.clientHeight, height: element.clientHeight };
  });
}
async function scrollCapture(prefix, title, group, maxSegments = 4) {
  const info = await visibleScroller();
  const count = Math.min(maxSegments, Math.max(1, Math.ceil(info.max / (info.height * 0.78)) + 1));
  for (let index = 0; index < count; index += 1) {
    const position = count === 1 ? 0 : info.max * index / (count - 1);
    await page.evaluate((top) => { const target = document.querySelector('[data-staff-smoke-scroll]'); if (target) target.scrollTop = top; }, position);
    await capture(prefix + '-' + String(index + 1).padStart(2, '0') + '.png', title + (count > 1 ? ' · phần ' + (index + 1) + '/' + count : ''), group);
  }
  await page.evaluate(() => { const target = document.querySelector('[data-staff-smoke-scroll]'); if (target) target.scrollTop = 0; });
}
async function go(path) {
  await page.goto(origin + path, { waitUntil: 'domcontentloaded', timeout: 120000 });
}
async function waitIncidentList(predicate) {
  await page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === '/api/management/incidents' && response.status() === 200 && predicate(url);
  });
}
async function noManagerControls() {
  assert.equal(await page.getByRole('button', { name: /^(Xác minh phản ánh|Xác nhận xác minh|Từ chối phản ánh|Phê duyệt kết quả|Phân công nhân viên)$/ }).count(), 0);
  assert.equal(await page.getByText('Kiểm duyệt AI', { exact: true }).count(), 0);
}
async function login() {
  await page.locator('input').first().fill(staff.email);
  await page.locator('input').nth(1).fill('fixture-password');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
}

try {
  await go('/');
  await login();
  await page.getByText('Chào Anh', { exact: true }).waitFor();
  assert.match(page.url(), /staff\/home/);
  for (const label of ['mới được giao', 'đang xử lý', 'cần xử lý lại', 'chờ duyệt']) await page.getByLabel('Xem sự vụ ' + label, { exact: true }).getByText(/^\d+$/).waitFor();
  for (const status of statusCycle) assert.ok(requests.some((item) => item.path === '/api/management/incidents' && item.query.AssignedStaffUserId === staff.userId && item.query.Status === status), 'Personal metric must request ' + status);
  await noManagerControls();
  await scrollCapture('01-home', 'Tổng quan công việc cá nhân', 'Tổng quan', 3);

  for (const [status, label] of [['Assigned', 'mới được giao'], ['InProgress', 'đang xử lý'], ['NeedRework', 'cần xử lý lại'], ['SubmittedForApproval', 'chờ duyệt']]) {
    await go('/staff/home');
    await page.getByLabel('Xem sự vụ ' + label, { exact: true }).click();
    await page.waitForURL(new RegExp('status=' + status));
    await page.getByRole('button', { name: 'Bộ lọc nâng cao', exact: true }).waitFor();
    await page.getByText(/^\d+ sự vụ/).first().waitFor();
    assert.ok(requests.some((item) => item.path === '/api/management/incidents' && item.query.Status === status && item.query.AssignedStaffUserId === staff.userId));
  }
  await capture('02-incidents-waiting.png', 'Sự vụ chờ duyệt từ Dashboard', 'Sự vụ');

  await go('/staff/incidents');
  await page.getByRole('link', { name: incident.title, exact: true }).waitFor();
  await capture('03-incidents.png', 'Sự vụ của tôi', 'Sự vụ');
  const nextPage = waitIncidentList((url) => queryValue(url, 'PageNumber') === '2');
  await page.getByRole('button', { name: 'Trang sau', exact: true }).click();
  await nextPage;
  await page.getByText('Trang 2 / 2 · 25 hồ sơ', { exact: true }).waitFor();
  await scrollCapture('04-incidents-page-2', 'Phân trang sự vụ', 'Sự vụ', 2);
  await page.getByRole('button', { name: 'Trang trước', exact: true }).click();

  await page.getByRole('button', { name: 'Được giao', exact: true }).click();
  await page.getByRole('button', { name: 'Bộ lọc nâng cao', exact: true }).click();
  await page.getByLabel('Phường / Khu vực', { exact: true }).getByRole('button', { name: 'Phường Tân Phong', exact: true }).waitFor();
  await page.getByLabel('Mức ưu tiên', { exact: true }).getByRole('button', { name: 'Cao', exact: true }).click();
  await page.getByLabel('Độ nghiêm trọng', { exact: true }).getByRole('button', { name: 'Cao', exact: true }).click();
  await page.getByLabel('Phường / Khu vực', { exact: true }).getByRole('button', { name: 'Phường Tân Phong', exact: true }).click();
  await page.getByLabel('Danh mục', { exact: true }).getByRole('button', { name: 'Chiếu sáng', exact: true }).click();
  const fullFilterResponse = waitIncidentList((url) => queryValue(url, 'Search') === 'chiếu sáng' && queryValue(url, 'CategoryId') === '2' && queryValue(url, 'AreaId') === '3');
  await page.getByLabel('Tìm kiếm sự vụ', { exact: true }).fill('chiếu sáng');
  await fullFilterResponse;
  assert.ok(requests.some((item) => item.path === '/api/management/incidents' && item.query.Status === 'Assigned' && item.query.Priority === 'High' && item.query.Severity === 'High' && item.query.AreaId === '3' && item.query.CategoryId === '2' && item.query.Search === 'chiếu sáng'));
  await scrollCapture('05-incident-filters', 'Đầy đủ bộ lọc sự vụ', 'Sự vụ', 3);
  // Returning through Dashboard must clear old advanced/search filters, so its
  // status group matches the total displayed on the metric.
  await page.getByText('Tổng quan', { exact: true }).last().click();
  const dashboardReset = waitIncidentList((url) => queryValue(url, 'Status') === 'InProgress' && !queryValue(url, 'Priority') && !queryValue(url, 'Search') && !queryValue(url, 'AreaId'));
  await page.getByLabel('Xem sự vụ đang xử lý', { exact: true }).click();
  await dashboardReset;
  assert.equal(await page.getByLabel('Tìm kiếm sự vụ', { exact: true }).inputValue(), '');
  await page.getByRole('button', { name: 'Xóa bộ lọc', exact: true }).click();
  assert.equal(await page.getByLabel('Tìm kiếm sự vụ', { exact: true }).inputValue(), '');
  await page.getByRole('link', { name: incident.title, exact: true }).waitFor();

  const emptyResponse = waitIncidentList((url) => queryValue(url, 'Search') === 'không có sự vụ này');
  await page.getByLabel('Tìm kiếm sự vụ', { exact: true }).fill('không có sự vụ này');
  await emptyResponse;
  await page.getByText('Không có hồ sơ phù hợp. Hãy thử bộ lọc khác hoặc xóa bộ lọc.', { exact: true }).waitFor();
  await capture('06-incidents-empty.png', 'Không có kết quả phù hợp', 'Trạng thái');
  await page.getByRole('button', { name: 'Xóa bộ lọc', exact: true }).click();

  holdIncidentList = true;
  await go('/staff/incidents');
  await page.getByText('Đang tải dữ liệu…', { exact: true }).first().waitFor();
  await capture('07-incidents-loading.png', 'Đang tải sự vụ', 'Trạng thái');
  holdIncidentList = false;
  releaseListRequests.splice(0).forEach((resolve) => resolve());
  await page.getByRole('link', { name: incident.title, exact: true }).waitFor();

  failIncidentList = true;
  await go('/staff/incidents');
  await page.getByText('Không thể tải danh sách sự vụ. Vui lòng thử lại.', { exact: true }).waitFor();
  await capture('08-incidents-error.png', 'Lỗi tải dữ liệu và thử lại', 'Trạng thái');
  failIncidentList = false;
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await page.getByRole('link', { name: incident.title, exact: true }).waitFor();
  await page.getByRole('link', { name: incident.title, exact: true }).click();
  await page.getByRole('tab', { name: 'Tổng quan', exact: true }).waitFor();
  await noManagerControls();
  await scrollCapture('09-incident-overview', 'Chi tiết sự vụ · Tổng quan', 'Chi tiết sự vụ', 4);

  await page.getByRole('link', { name: 'Bắt đầu xử lý', exact: true }).click();
  await page.getByRole('radio', { name: 'Tự xử lý', exact: true }).click();
  await page.getByRole('button', { name: 'Xác nhận bắt đầu tự xử lý', exact: true }).waitFor();
  await scrollCapture('09-start-confirm', 'Xác nhận bắt đầu xử lý sự vụ', 'Xử lý sự vụ', 3);
  rejectNextIncidentStart = true;
  await page.getByRole('button', { name: 'Xác nhận bắt đầu tự xử lý', exact: true }).click();
  await page.getByText(/Hồ sơ vừa được cập nhật\. Hãy làm mới để xem trạng thái mới nhất\./).waitFor();
  assert.equal(incident.status, 'Assigned', 'A rejected transition must leave the Incident assigned');
  await scrollCapture('09-start-conflict', 'Bắt đầu xử lý xung đột · Có thể thử lại', 'Trạng thái xử lý', 3);
  await page.getByRole('button', { name: 'Xác nhận bắt đầu tự xử lý', exact: true }).click();
  await page.getByText('Đã bắt đầu tự xử lý. Bạn có thể xem bước minh chứng rồi tiếp tục gửi kết quả.', { exact: true }).waitFor();
  assert.equal(incident.status, 'InProgress');
  assert.equal(incident.processingStartedAt, '2026-09-01T05:05:00Z');
  assert.equal(executionWrites.filter((item) => item.path === '/api/management/incidents/' + incident.incidentId + '/status').length, 2, 'The fixture must exercise one rejected and one accepted start request');
  await scrollCapture('09-started', 'Sự vụ đã chuyển sang đang xử lý', 'Xử lý sự vụ', 3);

  await page.getByRole('link', { name: 'Chi tiết sự vụ', exact: true }).click();
  await page.getByRole('tab', { name: 'Reports (2)', exact: true }).click();
  await page.getByText('Nguồn phản ánh', { exact: true }).waitFor();
  await page.getByText('AI đề xuất, Manager xác nhận', { exact: true }).waitFor();
  await page.getByText('91%', { exact: true }).waitFor();
  await page.getByText('SLA của sự vụ', { exact: true }).waitFor();
  await page.getByText('Có chỉ tiêu sắp đến hạn', { exact: true }).waitFor();
  await page.getByText('Hoàn thành đúng hạn', { exact: true }).first().waitFor();
  assert.equal(await page.getByText('Còn dưới 1 phút', { exact: true }).count(), 0, 'Completed SLA targets must not look like a running countdown');
  await page.getByText('Còn 1 giờ 30 phút', { exact: true }).waitFor();
  assert.ok(requests.some((item) => item.path === '/api/slas/incident/' + incident.incidentId + '/status' && item.method === 'GET'));
  await scrollCapture('10-incident-reports', 'Chi tiết sự vụ · Hai Report và SLA sự vụ', 'Chi tiết sự vụ', 6);
  await page.getByRole('link', { name: 'Xem chi tiết Report', exact: true }).nth(0).click();
  await page.getByText('Chi tiết Report', { exact: true }).waitFor();
  await noManagerControls();
  await scrollCapture('11-report-primary', 'Report đầu tiên · Chỉ đọc', 'Report', 4);
  await page.getByRole('link', { name: /Xem sự vụ liên quan/ }).click();
  await page.getByRole('tab', { name: 'Reports (2)', exact: true }).waitFor();
  await page.getByRole('link', { name: 'Xem chi tiết Report', exact: true }).nth(1).click();
  await page.getByText(reportTwo.title, { exact: true }).last().waitFor();
  await page.getByText('Response chưa cung cấp sự vụ liên quan.', { exact: true }).waitFor();
  await page.getByRole('link', { name: 'Quay lại sự vụ đã mở', exact: true }).waitFor();
  await scrollCapture('12-report-context', 'Report bổ sung · Giữ đường quay lại sự vụ', 'Report', 3);
  await page.getByRole('link', { name: 'Quay lại sự vụ đã mở', exact: true }).click();
  await page.getByRole('tab', { name: 'Lịch sử', exact: true }).click();
  await page.getByText('Phân công Nguyễn Minh Anh kiểm tra hiện trường.', { exact: true }).waitFor();
  await scrollCapture('13-incident-timeline', 'Chi tiết sự vụ · Lịch sử', 'Chi tiết sự vụ', 3);

  await go('/staff/incidents/' + reworkIncident.incidentId);
  await page.getByRole('heading', { name: reworkIncident.title, exact: true }).waitFor();
  await scrollCapture('14-incident-rework', 'Sự vụ cần xử lý lại · Hiển thị giới hạn API', 'Chi tiết sự vụ', 3);
  await page.getByRole('tab', { name: 'Reports (0)', exact: true }).click();
  await page.getByText('Chưa có phản ánh liên quan.', { exact: true }).waitFor();
  await capture('15-incident-reports-empty.png', 'Sự vụ chưa có Report', 'Trạng thái');
  await page.getByRole('tab', { name: 'Lịch sử', exact: true }).click();
  await page.getByText('Chưa có hoạt động được ghi nhận.', { exact: true }).waitFor();
  await capture('16-incident-timeline-empty.png', 'Sự vụ chưa có lịch sử', 'Trạng thái');

  await go('/staff/incidents/incident-forbidden');
  await page.getByText('Bạn không có quyền thực hiện thao tác này hoặc hồ sơ không còn được phân công cho bạn.', { exact: true }).waitFor();
  await capture('17-incident-forbidden.png', 'Hồ sơ ngoài phạm vi truy cập', 'Trạng thái');

  await go('/staff/feedbacks');
  await page.getByRole('link', { name: reportOne.title, exact: true }).waitFor();
  await noManagerControls();
  await capture('18-report-lookup.png', 'Tra cứu Report', 'Report');
  await go('/staff/conversations');
  await page.getByRole('link', { name: 'Trao đổi: ' + reportOne.title, exact: true }).waitFor();
  await capture('19-conversations.png', 'Danh sách trao đổi', 'Trao đổi');
  await page.getByRole('link', { name: 'Trao đổi: ' + reportOne.title, exact: true }).click();
  await page.getByText(messages[0].messageText, { exact: true }).waitFor();
  await capture('20-chat-public.png', 'Trao đổi với người dân', 'Trao đổi');
  await page.getByLabel('Nội dung phản hồi', { exact: true }).fill('Chúng tôi đã tiếp nhận thông tin và sẽ kiểm tra cụm đèn tại hẻm 42.');
  await page.getByRole('button', { name: 'Gửi phản hồi', exact: true }).click();
  await page.getByText('Đã gửi thành công.', { exact: true }).waitFor();
  assert.equal(messages.at(-1).isInternal, false);
  await page.getByRole('switch', { name: 'Ghi chú nội bộ' }).click();
  await page.getByLabel('Nội dung ghi chú', { exact: true }).fill('Cần kiểm tra tủ điện khu vực trước khi đề xuất phương án khắc phục.');
  rejectNextMessage = true;
  await page.getByRole('button', { name: 'Lưu ghi chú nội bộ', exact: true }).click();
  await page.getByText(/Nội dung vẫn được giữ/).waitFor();
  assert.equal(await page.getByLabel('Nội dung ghi chú', { exact: true }).inputValue(), 'Cần kiểm tra tủ điện khu vực trước khi đề xuất phương án khắc phục.');
  await capture('21-chat-draft-error.png', 'Gửi ghi chú lỗi · Giữ nguyên nội dung', 'Trạng thái');
  await page.getByRole('switch', { name: 'Ghi chú nội bộ' }).click();
  assert.equal(await page.getByLabel('Nội dung phản hồi', { exact: true }).inputValue(), '', 'Internal draft must not leak into the public composer');
  await page.getByRole('switch', { name: 'Ghi chú nội bộ' }).click();
  assert.equal(await page.getByLabel('Nội dung ghi chú', { exact: true }).inputValue(), 'Cần kiểm tra tủ điện khu vực trước khi đề xuất phương án khắc phục.', 'Switching audience must preserve the internal draft');
  await page.getByRole('button', { name: 'Lưu ghi chú nội bộ', exact: true }).click();
  await page.getByText('Đã gửi thành công.', { exact: true }).waitFor();
  assert.equal(messages.at(-1).isInternal, true);
  await capture('22-chat-internal.png', 'Ghi chú nội bộ đã lưu', 'Trao đổi');

  await go('/staff/notifications');
  await page.getByRole('button', { name: 'Chưa đọc. Sự vụ mới được giao', exact: true }).waitFor();
  await scrollCapture('23-notifications', 'Thông báo công việc', 'Thông báo', 2);
  await page.getByRole('button', { name: 'Chưa đọc. Sự vụ mới được giao', exact: true }).click();
  await page.getByRole('tab', { name: 'Tổng quan', exact: true }).waitFor();
  assert.equal(notifications[0].isRead, true);
  await go('/staff/notifications');
  await page.getByRole('button', { name: 'Đánh dấu tất cả đã đọc', exact: true }).click();
  await page.getByRole('button', { name: 'Chưa đọc', exact: true }).click();
  await page.getByText('Bạn không có thông báo nào ở đây.', { exact: true }).waitFor();
  assert.ok(notifications.every((item) => item.isRead));
  await capture('24-notifications-empty.png', 'Đã đọc tất cả thông báo', 'Trạng thái');

  // Execute work against an Incident with no embedded Report: no feedback-to-
  // provider inference may be necessary for any of these actions.
  await go('/staff/incidents/' + workingIncident.incidentId + '/provider');
  await page.getByRole('radio', { name: 'Chọn đơn vị: ' + providerCandidates[0].providerName, exact: true }).waitFor();
  await scrollCapture('29-provider-candidates', 'Đơn vị phù hợp với sự vụ', 'Xử lý sự vụ', 3);
  await page.getByLabel('Tìm đơn vị xử lý', { exact: true }).fill('thoát nước');
  await page.getByRole('radio', { name: 'Chọn đơn vị: ' + providerCandidates[0].providerName, exact: true }).click();
  await page.getByLabel('Ghi chú phân công', { exact: true }).fill('Kiểm tra và vệ sinh miệng thu nước tại đường số 8.');
  await page.getByRole('button', { name: 'Phân công đơn vị', exact: true }).click();
  await page.getByRole('button', { name: 'Xác nhận phân công', exact: true }).waitFor();
  await scrollCapture('30-provider-confirm', 'Xác nhận phân công đơn vị', 'Xử lý sự vụ', 3);
  rejectNextAssignment = true;
  await page.getByRole('button', { name: 'Xác nhận phân công', exact: true }).click();
  await page.getByText(/Hồ sơ vừa được cập nhật/).waitFor();
  assert.equal(await page.getByLabel('Ghi chú phân công', { exact: true }).inputValue(), 'Kiểm tra và vệ sinh miệng thu nước tại đường số 8.');
  await scrollCapture('31-provider-conflict', 'Phân công xung đột · Giữ ghi chú', 'Trạng thái xử lý', 2);
  await page.getByRole('button', { name: 'Xác nhận phân công', exact: true }).click();
  await page.getByText('Đã phân công đơn vị xử lý.', { exact: true }).waitFor();
  assert.equal(providerAssignments.get(workingIncident.incidentId).coordinatorId, 41);
  await scrollCapture('32-provider-assigned', 'Phân công đã lưu theo Incident', 'Xử lý sự vụ', 4);

  await page.getByLabel('Phương thức liên hệ', { exact: true }).fill('Điện thoại');
  await page.getByLabel('Kết quả liên hệ', { exact: true }).fill('Đã kết nối');
  await page.getByLabel('Nội dung liên hệ', { exact: true }).fill('Đơn vị xác nhận đội kiểm tra sẽ có mặt lúc 14 giờ.');
  await page.getByLabel('Thời gian liên hệ', { exact: true }).fill('01/09/2026 13:30');
  rejectNextContact = true;
  await page.getByRole('button', { name: 'Lưu liên hệ', exact: true }).click();
  await page.getByText(/Không lưu được lịch sử liên hệ\. Vui lòng thử lại\./).waitFor();
  assert.equal(await page.getByLabel('Nội dung liên hệ', { exact: true }).inputValue(), 'Đơn vị xác nhận đội kiểm tra sẽ có mặt lúc 14 giờ.');
  await scrollCapture('33-contact-retry', 'Lỗi liên hệ · Không mất nội dung', 'Trạng thái xử lý', 3);
  await page.getByRole('button', { name: 'Lưu liên hệ', exact: true }).click();
  await page.getByText('Đã lưu lịch sử liên hệ.', { exact: true }).waitFor();
  assert.equal(providerContacts.get(501)[0].contactNote, 'Đơn vị xác nhận đội kiểm tra sẽ có mặt lúc 14 giờ.');
  await scrollCapture('34-provider-contacts', 'Lịch sử liên hệ đơn vị', 'Xử lý sự vụ', 4);
  await page.getByRole('radio', { name: 'Trạng thái: Đang thực hiện', exact: true }).click();
  await page.getByLabel('Ghi chú trạng thái', { exact: true }).fill('Đội xử lý đang kiểm tra và vệ sinh miệng thu nước.');
  await page.getByRole('button', { name: 'Cập nhật trạng thái đơn vị', exact: true }).click();
  await page.getByRole('button', { name: 'Xác nhận cập nhật trạng thái', exact: true }).click();
  await page.getByText('Đã cập nhật trạng thái đơn vị.', { exact: true }).waitFor();
  assert.equal(providerAssignments.get(workingIncident.incidentId).reportStatus, 'InProgress');
  await scrollCapture('35-provider-progress', 'Cập nhật tiến độ đơn vị', 'Xử lý sự vụ', 4);

  await go('/staff/incidents/' + workingIncident.incidentId + '/resolution');
  await page.getByRole('tab', { name: 'Minh chứng', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Chọn ảnh minh chứng', exact: true }).waitFor();
  await scrollCapture('36-evidence-empty', 'Minh chứng của phân công', 'Minh chứng & kết quả', 3);
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Chọn ảnh minh chứng', exact: true }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles(fileURLToPath(new URL('../assets/icon.png', import.meta.url)));
  await page.getByLabel('Mô tả minh chứng', { exact: true }).fill('Ảnh kiểm tra miệng thu nước sau vệ sinh (dữ liệu kiểm thử).');
  await scrollCapture('37-evidence-selected', 'Ảnh được chọn trước khi tải', 'Minh chứng & kết quả', 3);
  rejectNextUpload = true;
  await page.getByRole('button', { name: 'Tải minh chứng lên', exact: true }).click();
  await page.getByText(/Không tải được minh chứng\. Vui lòng thử lại\./).waitFor();
  assert.equal(await page.getByLabel('Mô tả minh chứng', { exact: true }).inputValue(), 'Ảnh kiểm tra miệng thu nước sau vệ sinh (dữ liệu kiểm thử).');
  await scrollCapture('38-evidence-retry', 'Tải ảnh lỗi · Giữ ảnh và mô tả', 'Trạng thái xử lý', 3);
  await page.getByRole('button', { name: 'Tải minh chứng lên', exact: true }).click();
  await page.getByText('Đã tải minh chứng lên.', { exact: true }).waitFor();
  await page.getByText('Ảnh kiểm tra miệng thu nước sau vệ sinh (dữ liệu kiểm thử).', { exact: true }).waitFor();
  assert.equal(completionDocuments.get(501).length, 1);
  await scrollCapture('39-evidence-uploaded', 'Minh chứng đã tải lên', 'Minh chứng & kết quả', 4);

  const documentChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Chọn tài liệu PDF', exact: true }).click();
  const documentChooser = await documentChooserPromise;
  await documentChooser.setFiles({
    name: 'bien-ban-nghiem-thu.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n% UrbanMind staff browser fixture\n%%EOF\n'),
  });
  await page.getByLabel('Mô tả minh chứng', { exact: true }).fill('Biên bản nghiệm thu dạng PDF sau xử lý.');
  await page.getByText('Tài liệu PDF', { exact: true }).waitFor();
  await scrollCapture('39-evidence-pdf-selected', 'Tài liệu PDF được chọn', 'Minh chứng & kết quả', 3);
  const pdfUploadResponse = page.waitForResponse((response) => response.request().method() === 'POST' && /\/api\/management\/provider-assignments\/501\/completion-documents$/.test(new URL(response.url()).pathname));
  await page.getByRole('button', { name: 'Tải minh chứng lên', exact: true }).click();
  await pdfUploadResponse;
  await page.getByText('Biên bản nghiệm thu dạng PDF sau xử lý.', { exact: true }).waitFor();
  assert.equal(completionDocuments.get(501).length, 2, 'Evidence upload supports both an image and a PDF document');
  assert.equal(completionDocuments.get(501)[1].fileType, 'application/pdf');
  await scrollCapture('39-evidence-pdf-uploaded', 'Tài liệu PDF đã tải lên', 'Minh chứng & kết quả', 4);

  await page.getByRole('tab', { name: 'Gửi kết quả', exact: true }).click();
  await page.getByLabel('Tóm tắt kết quả', { exact: true }).fill('Đã vệ sinh miệng thu nước và khôi phục thoát nước tại đường số 8.');
  await page.getByLabel('Công việc đã thực hiện', { exact: true }).fill('Thu gom rác, thông tắc và thử dòng chảy tại hai miệng thu.');
  await page.getByLabel('Ghi chú kết quả', { exact: true }).fill('Đề nghị theo dõi thêm sau đợt mưa tiếp theo.');
  await scrollCapture('40-resolution-form', 'Chuẩn bị gửi kết quả cho Manager', 'Minh chứng & kết quả', 4);
  await page.getByRole('button', { name: 'Gửi kết quả cho Manager', exact: true }).click();
  await page.getByRole('button', { name: 'Xác nhận gửi kết quả', exact: true }).waitFor();
  await scrollCapture('41-resolution-confirm', 'Xác nhận gửi kết quả', 'Minh chứng & kết quả', 3);
  rejectNextResolution = true;
  await page.getByRole('button', { name: 'Xác nhận gửi kết quả', exact: true }).click();
  await page.getByText(/Hồ sơ vừa được cập nhật/).waitFor();
  assert.equal(await page.getByLabel('Tóm tắt kết quả', { exact: true }).inputValue(), 'Đã vệ sinh miệng thu nước và khôi phục thoát nước tại đường số 8.');
  await scrollCapture('42-resolution-conflict', 'Gửi kết quả xung đột · Giữ nội dung', 'Trạng thái xử lý', 3);
  await page.getByRole('button', { name: 'Gửi kết quả cho Manager', exact: true }).click();
  await page.getByRole('button', { name: 'Xác nhận gửi kết quả', exact: true }).click();
  await page.getByRole('tab', { name: 'Đã gửi', exact: true }).click();
  await page.getByText('Đã vệ sinh miệng thu nước và khôi phục thoát nước tại đường số 8.', { exact: true }).waitFor();
  assert.equal(submittedResolutions.get(workingIncident.incidentId)[0].providerAssignmentId, 501);
  const workingResolutionWrite = executionWrites.find((item) => item.path === '/api/management/incidents/' + workingIncident.incidentId + '/resolutions' && item.payload);
  assert.equal(workingResolutionWrite.payload.imageUrls.length, 1, 'Resolution imageUrls excludes uploaded PDF documents');
  assert.match(workingResolutionWrite.payload.imageUrls[0], /\/fixture\/evidence\.png$/);
  assert.equal(workingIncident.status, 'SubmittedForApproval');
  await scrollCapture('43-resolution-history', 'Lịch sử kết quả đã gửi', 'Minh chứng & kết quả', 4);
  await page.getByRole('tab', { name: 'Gửi kết quả', exact: true }).click();
  assert.equal(await page.getByLabel('Tóm tắt kết quả', { exact: true }).count(), 0, 'Submitted Incident must not expose a submit form');
  await scrollCapture('44-resolution-waiting', 'Kết quả chờ duyệt · Chỉ đọc', 'Trạng thái xử lý', 3);

  await go('/staff/incidents/' + reworkIncident.incidentId + '/resolution');
  await page.getByRole('tab', { name: 'Đã gửi', exact: true }).click();
  await page.getByText('Đã kiểm tra nắp hố ga và bổ sung cảnh báo tạm thời.', { exact: true }).waitFor();
  await page.getByText('Ảnh nắp hố ga trước lần xử lý lại.', { exact: true }).waitFor();
  assert.equal(submittedResolutions.get(reworkIncident.incidentId).length, 1, 'NeedRework begins with one preserved prior result');
  await scrollCapture('47-rework-history-prior', 'Xử lý lại · Lịch sử và minh chứng cũ', 'Minh chứng & kết quả', 4);
  await page.getByRole('tab', { name: 'Gửi kết quả', exact: true }).click();
  await page.getByText(/Manager đã yêu cầu xử lý lại/).waitFor();
  await page.getByLabel('Tóm tắt kết quả', { exact: true }).fill('Đã thay nắp hố ga và bổ sung đầy đủ ảnh nghiệm thu.');
  await page.getByLabel('Công việc đã thực hiện', { exact: true }).fill('Thay nắp mới, kiểm tra độ chắc chắn và dọn sạch khu vực.');
  await page.getByLabel('Ghi chú kết quả', { exact: true }).fill('Đã bổ sung nội dung theo yêu cầu xử lý lại của Manager.');
  await page.getByRole('tab', { name: 'Minh chứng', exact: true }).click();
  await page.getByText('Ảnh nắp hố ga trước lần xử lý lại.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Xóa toàn bộ minh chứng cũ', exact: true }).waitFor();
  await scrollCapture('47-rework-evidence-old', 'Xử lý lại · Minh chứng cũ hiện hành', 'Minh chứng & kết quả', 4);
  const reworkChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Chọn ảnh minh chứng', exact: true }).click();
  const reworkChooser = await reworkChooserPromise;
  await reworkChooser.setFiles(fileURLToPath(new URL('../assets/icon.png', import.meta.url)));
  await page.getByLabel('Mô tả minh chứng', { exact: true }).fill('Ảnh nắp hố ga mới sau xử lý lại.');
  await page.getByRole('button', { name: 'Xóa toàn bộ minh chứng cũ', exact: true }).click();
  await page.getByRole('button', { name: 'Xác nhận xóa toàn bộ', exact: true }).waitFor();
  await scrollCapture('47-rework-evidence-clear-confirm', 'Xử lý lại · Xác nhận xóa toàn bộ minh chứng cũ', 'Minh chứng & kết quả', 4);
  rejectNextClearEvidence = true;
  await page.getByRole('button', { name: 'Xác nhận xóa toàn bộ', exact: true }).click();
  await page.getByText(/Không xóa được minh chứng cũ.*Tệp đang chọn và nội dung kết quả vẫn được giữ/).waitFor();
  assert.equal(completionDocuments.get(504).length, 1, 'A failed clear must preserve backend evidence');
  assert.equal(await page.getByLabel('Mô tả minh chứng', { exact: true }).inputValue(), 'Ảnh nắp hố ga mới sau xử lý lại.');
  await page.getByText('1 tệp đang chờ tải lên.', { exact: true }).waitFor();
  await scrollCapture('47-rework-evidence-clear-error', 'Xóa minh chứng lỗi · Giữ ảnh và biểu mẫu', 'Trạng thái xử lý', 4);
  await page.getByRole('button', { name: 'Xóa toàn bộ minh chứng cũ', exact: true }).click();
  await page.getByRole('button', { name: 'Xác nhận xóa toàn bộ', exact: true }).click();
  await page.getByText('Đã xóa toàn bộ minh chứng cũ. Tệp đang chọn và nội dung kết quả vẫn được giữ.', { exact: true }).waitFor();
  await page.getByText('Chưa có minh chứng đã tải lên.', { exact: true }).waitFor();
  assert.equal(completionDocuments.get(504).length, 0, 'A successful clear removes only current assignment evidence');
  assert.equal(submittedResolutions.get(reworkIncident.incidentId)[0].completionDocuments[0].completionDocumentId, 704, 'Historical resolution keeps its evidence snapshot');
  assert.equal(await page.getByLabel('Mô tả minh chứng', { exact: true }).inputValue(), 'Ảnh nắp hố ga mới sau xử lý lại.');
  await scrollCapture('47-rework-evidence-cleared', 'Đã xóa minh chứng cũ · Nội dung cục bộ còn nguyên', 'Minh chứng & kết quả', 4);
  await page.getByRole('button', { name: 'Tải minh chứng lên', exact: true }).click();
  await page.getByText('Đã tải minh chứng lên.', { exact: true }).waitFor();
  await page.getByText('Ảnh nắp hố ga mới sau xử lý lại.', { exact: true }).waitFor();
  assert.equal(completionDocuments.get(504).length, 1, 'Replacement evidence is stored after clear-all');
  await scrollCapture('47-rework-evidence-replacement', 'Xử lý lại · Minh chứng mới đã tải', 'Minh chứng & kết quả', 4);
  await page.getByRole('tab', { name: 'Gửi kết quả', exact: true }).click();
  assert.equal(await page.getByLabel('Tóm tắt kết quả', { exact: true }).inputValue(), 'Đã thay nắp hố ga và bổ sung đầy đủ ảnh nghiệm thu.');
  assert.equal(await page.getByLabel('Công việc đã thực hiện', { exact: true }).inputValue(), 'Thay nắp mới, kiểm tra độ chắc chắn và dọn sạch khu vực.');
  assert.equal(await page.getByLabel('Ghi chú kết quả', { exact: true }).inputValue(), 'Đã bổ sung nội dung theo yêu cầu xử lý lại của Manager.');
  await scrollCapture('47-resolution-rework-form', 'Xử lý lại · Chuẩn bị gửi kết quả mới', 'Minh chứng & kết quả', 4);
  await page.getByRole('button', { name: 'Gửi lại kết quả cho Manager', exact: true }).click();
  await page.getByRole('button', { name: 'Xác nhận gửi lại kết quả', exact: true }).waitFor();
  rejectNextResolution = true;
  await page.getByRole('button', { name: 'Xác nhận gửi lại kết quả', exact: true }).click();
  await page.getByText(/Hồ sơ vừa được cập nhật.*Nội dung vẫn được giữ/).waitFor();
  assert.equal(await page.getByLabel('Tóm tắt kết quả', { exact: true }).inputValue(), 'Đã thay nắp hố ga và bổ sung đầy đủ ảnh nghiệm thu.');
  assert.equal(submittedResolutions.get(reworkIncident.incidentId).length, 1, 'A rejected resubmit must not alter history');
  await scrollCapture('47-resolution-rework-conflict', 'Gửi lại xung đột · Giữ nguyên nội dung', 'Trạng thái xử lý', 3);
  await page.getByRole('button', { name: 'Gửi lại kết quả cho Manager', exact: true }).click();
  await page.getByRole('button', { name: 'Xác nhận gửi lại kết quả', exact: true }).click();
  await page.getByText('Đã gửi lại kết quả cho Manager duyệt.', { exact: true }).waitFor();
  await page.getByText('Đã thay nắp hố ga và bổ sung đầy đủ ảnh nghiệm thu.', { exact: true }).waitFor();
  await page.getByText('Đã kiểm tra nắp hố ga và bổ sung cảnh báo tạm thời.', { exact: true }).waitFor();
  await page.getByText('Ảnh nắp hố ga mới sau xử lý lại.', { exact: true }).waitFor();
  await page.getByText('Ảnh nắp hố ga trước lần xử lý lại.', { exact: true }).waitFor();
  assert.equal(submittedResolutions.get(reworkIncident.incidentId).length, 2, 'Resubmit must preserve the prior result and add a new result');
  assert.equal(reworkIncident.status, 'SubmittedForApproval');
  const reworkWrites = executionWrites.filter((item) => item.path === '/api/management/incidents/' + reworkIncident.incidentId + '/resolutions');
  assert.equal(reworkWrites.length, 2, 'The resubmit flow must cover a rejected retry and one accepted write');
  assert.equal(reworkWrites.at(-1).payload.resolutionSummary, 'Đã thay nắp hố ga và bổ sung đầy đủ ảnh nghiệm thu.');
  assert.equal(reworkWrites.at(-1).payload.feedbackId, undefined, 'NeedRework resubmission remains Incident-scoped');
  const clearWrites = executionWrites.filter((item) => item.path === '/api/management/provider-assignments/504/completion-documents' && item.method === 'DELETE');
  assert.equal(clearWrites.length, 2, 'NeedRework clear-all covers one rejected retry and one accepted DELETE');
  await scrollCapture('47-resolution-rework-history', 'Đã gửi lại · Giữ đủ lịch sử kết quả', 'Minh chứng & kết quả', 5);

  const beforeReadonly = executionWrites.length;
  await go('/staff/incidents/' + foreignIncident.incidentId + '/provider');
  await page.getByText(foreignIncident.title, { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Lưu liên hệ', exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Cập nhật trạng thái đơn vị', exact: true }).count(), 0);
  await scrollCapture('45-provider-foreign', 'Phân công của nhân viên khác · Chỉ đọc', 'Trạng thái xử lý', 3);
  await go('/staff/incidents/' + foreignIncident.incidentId + '/resolution');
  await page.getByRole('tab', { name: 'Minh chứng', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Chọn ảnh minh chứng', exact: true }).count(), 0);
  await page.getByRole('tab', { name: 'Gửi kết quả', exact: true }).click();
  assert.equal(await page.getByLabel('Tóm tắt kết quả', { exact: true }).count(), 0);
  await scrollCapture('46-resolution-foreign', 'Kết quả ngoài phân công · Chỉ đọc', 'Trạng thái xử lý', 3);
  await go('/staff/incidents/' + providerForbiddenIncident.incidentId + '/provider');
  await page.getByText(/Bạn không có quyền thực hiện thao tác này/).waitFor();
  await scrollCapture('48-provider-forbidden', 'API từ chối quyền truy cập phân công', 'Trạng thái xử lý', 3);
  await go('/staff/incidents/' + staleSubmittedIncident.incidentId + '/resolution');
  await page.getByRole('tab', { name: 'Đã gửi', exact: true }).click();
  await page.getByText('Kết quả đã nhận, đang chờ đồng bộ trạng thái.', { exact: true }).waitFor();
  await page.getByRole('tab', { name: 'Gửi kết quả', exact: true }).click();
  assert.equal(await page.getByLabel('Tóm tắt kết quả', { exact: true }).count(), 0, 'Existing resolution history must block a duplicate submit even if Incident remains InProgress');
  await scrollCapture('49-resolution-duplicate-guard', 'Chống gửi trùng khi trạng thái chưa đồng bộ', 'Trạng thái xử lý', 3);
  assert.equal(executionWrites.length, beforeReadonly, 'Readonly routes must not produce business mutations');

  const accountRequestStart = requests.length;
  await go('/staff/account');
  await page.getByText('Thông tin tài khoản nhân viên được quản trị tập trung.', { exact: false }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Chỉnh sửa thông tin', exact: true }).count(), 0, 'Swagger exposes no SystemStaff self-profile mutation');
  assert.equal(await page.getByLabel('Số điện thoại', { exact: true }).count(), 0, 'AuthResultDto does not expose a Staff phone number');
  assert.equal(requests.slice(accountRequestStart).some((item) => item.path === '/api/profile'), false, 'SystemStaff account must not call the ServiceUser-only profile endpoint');
  await scrollCapture('25-account', 'Tài khoản Staff · Thông tin phiên chỉ đọc', 'Tài khoản', 3);
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await page.getByRole('button', { name: 'Xác nhận đăng xuất', exact: true }).waitFor();
  await scrollCapture('28-account-logout', 'Xác nhận đăng xuất', 'Tài khoản', 2);
  await page.getByRole('button', { name: 'Xác nhận đăng xuất', exact: true }).click();
  await page.locator('input').first().waitFor();
  const signedOutStart = requests.length;
  await go('/staff/incidents/' + incident.incidentId);
  await page.locator('input').first().waitFor();
  assert.equal(requests.slice(signedOutStart).some((item) => item.path.startsWith('/api/management/')), false);

  // A Manager session cannot mount Staff routes or start Staff data requests.
  loginRole = 'InteractionManager';
  await login();
  await page.getByText('Tài khoản không hỗ trợ trên Mobile', { exact: true }).waitFor();
  const wrongRoleStart = requests.length;
  await go('/staff/incidents/' + incident.incidentId);
  await page.getByText('Tài khoản không hỗ trợ trên Mobile', { exact: true }).waitFor();
  assert.equal(requests.slice(wrongRoleStart).some((item) => item.path.startsWith('/api/management/')), false);

  assert.equal(requests.some((item) => /\/(ai-reviewed|verify|assign-staff|approve|reject)(\/|$)/i.test(item.path)), false, 'Staff must never call Manager endpoints');
  const incidentStatusRequests = requests.filter((item) => /^\/api\/management\/incidents\/[^/]+\/status$/.test(item.path));
  assert.equal(incidentStatusRequests.length, 2, 'Start processing must cover a 409 retry and a successful transition');
  assert.ok(incidentStatusRequests.every((item) => item.method === 'PATCH'), 'Incident status uses the Swagger PATCH contract only');
  assert.equal(requests.some((item) => item.path.startsWith('/api/slas/feedback/')), false, 'Removed per-Report SLA endpoints must never be called');
  assert.equal(requests.some((item) => item.path.startsWith('/api/management/feedbacks/') && !['GET', 'OPTIONS'].includes(item.method)), false, 'Incident execution must never mutate legacy Feedback workflows');
  assert.ok(requests.filter((item) => item.path === '/api/management/incidents').every((item) => item.query.AssignedStaffUserId === staff.userId), 'Every incident list request must remain scoped');
  assert.deepEqual(unmocked, [], 'All API traffic must use explicit fixtures');
  assert.deepEqual(errors, []);
  if (screenshotsEnabled) {
    await writeFile(new URL('manifest.json', output), JSON.stringify(manifest, null, 2) + '\n');
    await writeFile(new URL('verification.json', output), JSON.stringify({ generatedAt: new Date().toISOString(), fixtureBacked: true, fullFunctionalFlow: true, profile, viewport, screenshots: manifest.length, requests: requests.length, geometryChecks, passed: true, runtimeErrors: errors }, null, 2) + '\n');
    await createStaffGallery(page, output);
    // Alternate profile runs must never replace the primary all-screen ZIP.
    if (!compatibility) await createStaffArchive(output);
  }
  console.log('PASS: personal dashboard, Incident filters/pagination/detail tabs, Incident SLA, Assigned -> InProgress retry, readonly Reports/context return, chat/recovery, notifications/profile/guards; Incident provider assignment, contacts/status, multipart evidence, initial resolution plus NeedRework resubmission/history, 204/403/409/503 handling and readonly ownership/status restrictions.');
  console.log('Profile: ' + profile.name + '; viewport: ' + viewport.width + 'x' + viewport.height + '; text scale: ' + profile.textScale + '; screenshots: ' + manifest.length + '; intercepted API requests: ' + requests.length + '; geometry checks: ' + geometryChecks.length);
} catch (error) {
  console.error('PAGE:', page.url());
  console.error('UI:', (await page.locator('body').innerText()).slice(0, 7000));
  console.error('RUNTIME ERRORS:', errors);
  console.error('UNMOCKED:', unmocked);
  console.error('ACCESSIBLE TARGETS:', await page.locator('[aria-label]').evaluateAll((nodes) => nodes.map((node) => ({ tag: node.tagName, role: node.getAttribute('role'), label: node.getAttribute('aria-label') }))));
  if (screenshotsEnabled) {
    await page.screenshot({ path: fileURLToPath(new URL('failure.png', output)), fullPage: false }).catch(() => {});
    await writeFile(new URL('manifest.partial.json', output), JSON.stringify(manifest, null, 2) + '\n');
  }
  throw error;
} finally {
  holdIncidentList = false;
  releaseListRequests.splice(0).forEach((resolve) => resolve());
  await browser.close();
}
