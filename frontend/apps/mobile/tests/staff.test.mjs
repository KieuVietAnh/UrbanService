import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import { APP_ROLES } from '@urbanmind/shared-types';
import { axiosClient, INCIDENT_MANAGEMENT_CAPABILITIES, notificationApi as sharedNotificationApi, userApi } from '@urbanmind/shared-api';
import { canAccessMobileWorkspace, getMobileEntry, getMobileRedirect } from '../src/features/auth/mobile-access.ts';
import * as staffModels from '../src/features/staff/staff-models.ts';
import { getStaffContentLayout, getStaffLineHeight, getStaffTabLayout, getStaffTextScale, STAFF_FIXED_CHROME_MAX_FONT_SCALE } from '../src/features/staff/staff-layout.ts';
import { smokeProfile, STAFF_SMOKE_PROFILES } from './staff-smoke-profiles.mjs';

const { normalizeStaffRecord, normalizePage, normalizeMessage, normalizeStaffNotification, normalizeEvent, staffNotificationTarget, formatConfidence } = staffModels;

// Node test runner resolves the extensionless TS import used by Metro.
const resolver = registerHooks({ resolve(specifier, context, nextResolve) {
  if (['./staff-models', './staff-execution-models', './staff-execution-flow-models'].includes(specifier) && context.parentURL?.includes('/features/staff/')) {
    return nextResolve(specifier + '.ts', context);
  }
  return nextResolve(specifier, context);
} });
const { staffApi, staffKeys } = await import('../src/features/staff/staff-api.ts');
const { executionApi, executionKeys } = await import('../src/features/staff/staff-execution-api.ts');
const { buildEvidenceFormData, canEditIncidentExecution, canStartIncidentProcessing, canSubmitIncidentResolution, incidentResolutionSubmissionMode, normalizeIncidentResolution, normalizeCompletionEvidence } = await import('../src/features/staff/staff-execution-models.ts');
const { buildExecutionSteps, currentExecutionStep, firstRouteParam, parseExecutionDraft, resolveExecutionMode } = await import('../src/features/staff/staff-execution-flow-models.ts');
const { profileApi } = await import('../src/features/profile/api/profile-api.ts');
resolver.deregister();

test('mobile entry supports staff and resident, denying unsupported or missing roles', () => {
  assert.equal(getMobileEntry(null), '/(auth)/login');
  for (const role of ['SYSTEMSTAFF', 'SystemStaff', 'system-staff']) assert.equal(getMobileEntry({ role, isVerified: true }), '/(staff)/staff');
  assert.equal(getMobileEntry({ role: 'ServiceUser', isVerified: true }), '/(resident)');
  assert.equal(getMobileEntry({ role: 'SystemStaff' }), '/(auth)/verify-phone');
  assert.equal(getMobileEntry({ role: 'ServiceUser' }), '/(auth)/verify-phone');
  for (const role of ['administrator', 'interaction-manager', 'service-provider', '', 'unknown']) assert.equal(getMobileEntry({ role }), '/unsupported-role');
  assert.equal(getMobileEntry({ role: 'SystemStaff', isVerified: false }), '/(auth)/verify-phone');
});

test('deep links cannot cross resident/staff boundaries or bypass verification', () => {
  const staff = { role: APP_ROLES.SYSTEM_STAFF, isVerified: true };
  const resident = { role: APP_ROLES.SERVICE_USER, isVerified: true };
  assert.equal(getMobileRedirect(staff, ['(resident)', 'tickets']), '/(staff)/staff');
  assert.equal(getMobileRedirect(resident, ['(staff)', 'staff']), '/(resident)');
  assert.equal(getMobileRedirect(null, ['(staff)', 'staff']), '/(auth)/login');
  assert.equal(getMobileRedirect(null, ['(auth)', 'forgot-password']), null);
  assert.equal(getMobileRedirect(staff, ['(staff)', 'staff', 'feedbacks']), null);
  assert.equal(getMobileRedirect({ ...staff, isVerified: false }, ['(staff)']), '/(auth)/verify-phone');
  assert.equal(getMobileRedirect({ ...staff, isVerified: false }, ['(auth)', 'verify-phone']), null);
  assert.equal(getMobileRedirect({ ...staff, isVerified: false }, ['(auth)', 'otp']), null);
  assert.equal(canAccessMobileWorkspace(staff, APP_ROLES.SERVICE_USER), false);
  assert.equal(canAccessMobileWorkspace({ ...staff, isVerified: false }, APP_ROLES.SYSTEM_STAFF), false);
  assert.equal(canAccessMobileWorkspace({ role: APP_ROLES.SYSTEM_STAFF }, APP_ROLES.SYSTEM_STAFF), false);
  assert.equal(canAccessMobileWorkspace(staff, APP_ROLES.SYSTEM_STAFF), true);
});

test('normalizes pagination without replacing backend totals with current page length', () => {
  const page = normalizePage({ data: { items: [{ feedbackId: 'f1' }], totalItems: 41, totalPages: 3, pageNumber: 2, pageSize: 20, hasNextPage: true } }, normalizeStaffRecord);
  assert.equal(page.items[0].id, 'f1');
  assert.equal(page.totalItems, 41);
  assert.equal(page.pageNumber, 2);
  assert.equal(page.hasNextPage, true);
  assert.equal(normalizePage({ items: [], totalItems: 0, totalPages: 0 }, normalizeStaffRecord).totalItems, 0);
  assert.throws(() => normalizePage('<html>bad gateway</html>', normalizeStaffRecord), /không hợp lệ/);
});

test('staff API exposes no Manager review, assignment or approval actions', () => {
  assert.equal('feedbackActions' in staffModels, false, 'Feedback verification is a Manager responsibility, not a Staff action');
  for (const action of ['review', 'verify', 'reject', 'verifyFeedback', 'rejectFeedback', 'assignIncident', 'assignStaff', 'approveResolution', 'requestRework']) {
    assert.equal(action in staffApi, false, `Staff must not expose ${action}`);
  }
});

test('staff feature and route layouts contain no Manager actions or AI-review queue entry', () => {
  for (const relativeDirectory of ['../src/features/staff/', '../app/(staff)/']) {
    const directory = new URL(relativeDirectory, import.meta.url);
    for (const name of readdirSync(directory, { recursive: true })) {
      if (!/\.tsx?$/.test(name)) continue;
      const source = readFileSync(new URL(name.replaceAll('\\', '/'), directory), 'utf8');
      const context = `${relativeDirectory}${name}`;
      assert.equal(/(?:staffApi|managementFeedbackApi)\s*\.\s*(?:review|verifyFeedback|updateStatus|approveResolution|assignIncident)\s*\(/.test(source), false, `${context}: Staff must not call Manager mutations`);
      assert.equal(/\/api\/management\/feedbacks\/ai-reviewed/.test(source), false, `${context}: Staff must not fetch the AI review queue`);
      assert.equal(/<(?:Stack|Tabs)\.Screen\b[^>]*\bname\s*=\s*["']queue["']/.test(source), false, `${context}: Staff must not register the AI review queue`);
      assert.equal(/\bmode\s*=\s*["']queue["']/.test(source), false, `${context}: Staff must not render the AI review queue`);
    }
  }
});

test('incident records preserve reports, assignee, AI metadata and event actor', () => {
  const item = normalizeStaffRecord({ incidentId: 'i1', assignedStaffUserId: 's1', reportCount: 2, reports: [{ feedbackId: 'f1' }], analysisResult: { summary: 'AI summary', confidenceScore: 0.86 } }, true);
  assert.equal(item.id, 'i1'); assert.equal(item.reports[0].id, 'f1'); assert.equal(item.reportCount, 2);
  assert.equal(item.summary, 'AI summary'); assert.equal(formatConfidence(item.confidence), '86%');
  assert.equal(formatConfidence(null), 'Chưa có dữ liệu');
  const event = normalizeEvent({ incidentEventId: 3, eventType: 'StatusChanged', actorUserName: 'Staff', payloadJson: '{"note":"Đã tiếp nhận"}' });
  assert.equal(event.actor, 'Staff'); assert.equal(event.description, 'Đã tiếp nhận');
});

test('incident metadata keeps severity, area, priority and authoritative report total distinct', () => {
  const item = normalizeStaffRecord({
    incidentId: 'incident-1', title: 'Cây đổ chắn đường', severity: 'High', priority: 'Critical',
    areaId: 12, areaName: 'Phường 12', categoryId: 4, categoryName: 'Cây xanh',
    locationText: '18 Nguyễn Văn Trỗi', reportCount: 3, reports: [{ feedbackId: 'report-1' }],
    dueDate: '2026-09-04T08:00:00Z', assignedStaffUserId: 'staff-1', assignedStaffName: 'Nguyễn An',
  }, true);
  assert.equal(item.severity, 'High');
  assert.equal(item.priority, 'Critical');
  assert.equal(item.areaName, 'Phường 12');
  assert.equal(String(item.areaId), '12');
  assert.equal(String(item.categoryId), '4');
  assert.equal(item.category, 'Cây xanh');
  assert.equal(item.location, '18 Nguyễn Văn Trỗi');
  assert.equal(item.reportCount, 3, 'An incomplete embedded list must not replace the backend total');
  assert.equal(item.reports.length, 1);
  assert.equal(item.dueDate, '2026-09-04T08:00:00Z');
  assert.equal(item.assignedStaffUserId, 'staff-1');
  assert.equal(item.assignedStaffName, 'Nguyễn An');
});

test('embedded reports preserve backend link metadata and feedback status', () => {
  const report = normalizeStaffRecord({ incidentId: 'incident-1', reports: [{
    feedbackId: 'report-1', feedbackStatus: 'Verified', linkMethod: 'Manual', linkRole: 'Supporting',
    linkStatus: 'Confirmed', linkedAt: '2026-09-01T02:00:00Z', confidenceScore: 0,
    linkedByUserName: 'Quản lý khu vực', reason: 'Cùng vị trí với sự vụ đã xác minh',
  }] }, true).reports[0];
  assert.equal(report.id, 'report-1');
  assert.equal(report.status, 'Verified');
  assert.equal(report.linkMethod, 'Manual');
  assert.equal(report.linkRole, 'Supporting');
  assert.equal(report.linkStatus, 'Confirmed');
  assert.equal(report.linkedAt, '2026-09-01T02:00:00Z');
  assert.equal(report.linkedBy, 'Quản lý khu vực');
  assert.equal(report.linkReason, 'Cùng vị trí với sự vụ đã xác minh');
  assert.equal(report.confidence, 0, 'A returned confidence of zero is data, not missing data');
  assert.equal(formatConfidence(report.confidence), '0%');
});

test('missing incident/report data is not fabricated from an unrelated feedback', () => {
  const feedback = normalizeStaffRecord({ feedbackId: 'report-1', priority: 'High', createdAt: '2026-09-01T02:00:00Z' });
  assert.equal(feedback.incidentId, '');
  assert.equal(feedback.severity, '', 'Priority must not stand in for severity');
  assert.equal(feedback.dueDate, '', 'A deadline must not be computed from report creation time');
  assert.equal(feedback.reportCount, null);
  assert.deepEqual(feedback.reports, []);
  const incident = normalizeStaffRecord({ incidentId: 'incident-1', reports: [{ feedbackId: 'report-1' }] }, true);
  assert.equal(incident.reportCount, null, 'An unknown total is not necessarily the embedded page length');
  assert.equal(incident.reports[0].linkMethod, '');
  assert.equal(incident.reports[0].linkedAt, '');
  assert.equal(incident.reports[0].confidence, null);
});

test('internal messages stay explicitly marked and unsafe notification links are ignored', () => {
  assert.equal(normalizeMessage({ isInternal: true, messageText: 'internal' }).internal, true);
  assert.equal(normalizeMessage({ isInternal: false }).internal, false);
  assert.deepEqual(normalizeMessage({ interactionMessageId: 7, userFullName: 'Người dân', userId: 'resident-1', messageText: 'Swagger DTO' }), {
    id: '7', text: 'Swagger DTO', sender: 'Người dân', senderId: 'resident-1', internal: false, createdAt: '',
  });
  const productionNotification = normalizeStaffNotification({ notificationId: 17, title: 'Sự vụ', targetType: 'Incident', targetId: 'i/1', isRead: false });
  assert.equal(productionNotification.notificationId, 17);
  assert.equal(staffNotificationTarget(productionNotification), '/(staff)/staff/incidents/i%2F1');
  assert.equal(staffNotificationTarget({ targetType: 'Feedback', targetId: 'f1' }), '/(staff)/staff/feedbacks/f1');
  assert.equal(staffNotificationTarget({ targetType: 'Report', targetId: 'f2' }), '/(staff)/staff/feedbacks/f2');
  assert.equal(staffNotificationTarget({ incidentId: 'i2' }), '/(staff)/staff/incidents/i2');
  assert.equal(staffNotificationTarget({ relatedType: 'Incident', relatedId: 'i1' }), '/(staff)/staff/incidents/i1');
  assert.equal(staffNotificationTarget({ relatedType: 'Feedback', relatedId: 'f1' }), '/(staff)/staff/feedbacks/f1');
  assert.equal(staffNotificationTarget({ targetUrl: '/staff/feedbacks/f1' }), '/(staff)/staff/feedbacks/f1');
  for (const notificationId of [0, -1, 1.2, NaN, Infinity, 2147483648, '', '17', 'notification-1', null]) assert.equal(normalizeStaffNotification({ notificationId }), null);
  for (const targetUrl of ['https://evil.test', '/admin/users', '/staff/feedbacks/../../admin', 'javascript:alert(1)']) assert.equal(staffNotificationTarget({ targetUrl }), null);
});

test('notification read uses a positive Swagger int32 and cannot inject an endpoint path', async () => {
  const patch = mock.method(axiosClient, 'patch', async () => undefined);
  try {
    for (const notificationId of [0, -1, 1.2, NaN, Infinity, 2147483648, '17', '../admin']) {
      await assert.rejects(sharedNotificationApi.markNotificationAsRead(notificationId), /positive int32/);
    }
    assert.equal(patch.mock.callCount(), 0);
    await sharedNotificationApi.markNotificationAsRead(17);
    assert.deepEqual(patch.mock.calls[0].arguments, ['/api/notifications/17/read']);
  } finally { patch.mock.restore(); }
});

test('Staff account stays on authenticated read-only fields while the ServiceUser profile adapter honors phoneNumber', async () => {
  const accountSource = readFileSync(new URL('../src/features/staff/components/staff-account-screen.tsx', import.meta.url), 'utf8');
  assert.equal(/profileApi|\/api\/profile|getProfile|updateProfile/.test(accountSource), false);
  assert.match(accountSource, /quản trị tập trung/);
  assert.match(accountSource, /Mã tài khoản/);

  const getProfile = mock.method(userApi, 'getProfile', async () => ({ fullName: 'Cư dân', phoneNumber: '0901000000' }));
  const updateProfile = mock.method(userApi, 'updateProfile', async (payload) => ({ ...payload }));
  try {
    assert.equal((await profileApi.getProfile()).phone, '0901000000');
    const updated = await profileApi.updateProfile({ fullName: 'Cư dân mới', phone: '0902000000' });
    assert.deepEqual(updateProfile.mock.calls[0].arguments, [{ fullName: 'Cư dân mới', phoneNumber: '0902000000' }]);
    assert.equal(updated.phone, '0902000000');
  } finally { getProfile.mock.restore(); updateProfile.mock.restore(); }
});

test('phone verification exchanges a Firebase ID token for a complete backend session', () => {
  const serviceSource = readFileSync(new URL('../src/features/auth/auth.service.ts', import.meta.url), 'utf8');
  const storeSource = readFileSync(new URL('../src/features/auth/auth.store.ts', import.meta.url), 'utf8');
  const firebaseSource = readFileSync(new URL('../src/features/auth/firebase-phone.service.ts', import.meta.url), 'utf8');
  const verifyService = serviceSource.slice(serviceSource.indexOf('static async verifyPhoneOtp'), serviceSource.indexOf('static async logout'));
  assert.match(serviceSource, /authApi\.requestPhoneOtp\(normalized\)/);
  assert.match(serviceSource, /sendFirebasePhoneOtp\(approvedPhone\)/);
  assert.match(verifyService, /confirmFirebasePhoneOtp\(otp\)/);
  assert.match(verifyService, /authApi\.verifyPhone\(idToken\)/);
  assert.match(verifyService, /persistAuthenticatedSession\(response, user\)/);
  assert.match(firebaseSource, /signInWithPhoneNumber\(auth, phoneNumber\)/);
  assert.match(firebaseSource, /credential\.user\.getIdToken\(true\)/);
  assert.match(storeSource, /const requestUser = get\(\)\.user/);
  assert.match(storeSource, /verifiedUser\.id !== requestUser\.id/);
  assert.doesNotMatch(storeSource, /\{ \.\.\.activeUser, isVerified: true \}/);
});

test('authentication fails closed, uses opt-in SMS auto-send, and keeps login email-only', () => {
  const serviceSource = readFileSync(new URL('../src/features/auth/auth.service.ts', import.meta.url), 'utf8');
  const apiConfigSource = readFileSync(new URL('../src/config/api.ts', import.meta.url), 'utf8');
  const sharedClientSource = readFileSync(new URL('../../../packages/shared-api/src/axiosClient.js', import.meta.url), 'utf8');
  const loginSource = readFileSync(new URL('../app/(auth)/login.tsx', import.meta.url), 'utf8');
  const phoneSource = readFileSync(new URL('../app/(auth)/verify-phone.tsx', import.meta.url), 'utf8');

  assert.match(serviceSource, /if \(!user\.token \|\| !refreshToken\)[\s\S]*await clearAuthTokens\(\)/);
  assert.match(serviceSource, /Promise\.all\([\s\S]*setAuthToken\(user\.token\)[\s\S]*setAuthRefreshToken\(refreshToken\)/);
  assert.match(serviceSource, /userPayload\.name[\s\S]*userPayload\.fullName/);
  assert.match(apiConfigSource, /setAuthSessionRefreshedHandler[\s\S]*mergeRefreshedAuthUser[\s\S]*setUser\(refreshedUser\)/);
  assert.match(sharedClientSource, /await authSessionRefreshedHandler\?\.\(response\?\.data\)/);
  assert.equal(/Email hoặc Số điện thoại|email hoặc số điện thoại/i.test(loginSource), false);
  assert.match(loginSource, /label="Email"/);
  assert.match(phoneSource, /params\.autoSend !== '1'/);
  assert.match(phoneSource, /autoSendStarted\.current = true/);
  assert.match(phoneSource, /requestPhoneOtp\(normalized\)/);
  assert.match(phoneSource, /verifyPhoneOtp\(otp\)/);
});

test('incident query is always scoped to the signed-in staff and fails closed without ID', async () => {
  const get = mock.method(axiosClient, 'get', async () => ({ items: [], totalItems: 0 }));
  try {
    await assert.rejects(staffApi.incidents('', { pageNumber: 1 }));
    assert.equal(get.mock.callCount(), 0);
    const signal = new AbortController().signal;
    await staffApi.incidents('staff-1', { pageNumber: 2, search: 'ngập', status: 'Assigned' }, signal);
    const [url, options] = get.mock.calls[0].arguments;
    assert.equal(url, '/api/management/incidents');
    assert.equal(options.params.AssignedStaffUserId, 'staff-1');
    assert.equal(options.params.PageNumber, 2); assert.equal(options.params.IncludeMerged, false); assert.equal(options.signal, signal);
    assert.notDeepEqual(staffKeys.messages('s1', 'f1'), staffKeys.messages('s2', 'f1'));
  } finally { get.mock.restore(); }
});

test('lookup filters map numeric schema IDs and array or wrapped response names', async () => {
  const signal = new AbortController().signal;
  const areas = [{ areaId: 12, areaName: 'Phường 12' }];
  const categories = [{ categoryId: 4, categoryName: 'Cây xanh' }];
  const get = mock.method(axiosClient, 'get', async (url) => url === '/api/areas' ? areas : { data: { items: categories } });
  const expected = { areas: [{ id: '12', name: 'Phường 12' }], categories: [{ id: '4', name: 'Cây xanh' }] };
  try {
    assert.deepEqual(await staffApi.lookups(signal), expected);
    assert.deepEqual(get.mock.calls.map((call) => call.arguments), [
      ['/api/areas', { params: { includeInactive: false }, signal }],
      ['/api/categories', { params: { includeInactive: false }, signal }],
    ]);
    get.mock.mockImplementation(async (url) => url === '/api/areas' ? { data: areas } : { result: categories });
    assert.deepEqual(await staffApi.lookups(signal), expected);
    assert.notDeepEqual(staffKeys.lookups('staff-1'), staffKeys.lookups('staff-2'));
  } finally { get.mock.restore(); }
});

test('lookup failures reject instead of inventing filter options or disguising errors as empty lists', async () => {
  const get = mock.method(axiosClient, 'get', async () => []);
  try {
    assert.deepEqual(await staffApi.lookups(), { areas: [], categories: [] }, 'A valid empty collection is not an error');
    for (const malformed of ['<html>bad gateway</html>', { unexpected: [] }, { data: { message: 'Invalid response' } }]) {
      get.mock.mockImplementation(async (url) => url === '/api/areas' ? [] : malformed);
      await assert.rejects(staffApi.lookups(), /bộ lọc/);
    }
    const failure = new Error('Lookup request failed');
    get.mock.mockImplementation(async () => { throw failure; });
    await assert.rejects(staffApi.lookups(), (error) => error === failure);
  } finally { get.mock.restore(); }
});

test('report lookup uses the read-only list API and keeps server pagination', async () => {
  const get = mock.method(axiosClient, 'get', async () => ({ items: [{ feedbackId: 'f1', status: 'Verified', analysisResult: { summary: 'Test summary' } }], pageNumber: 1, pageSize: 20, totalItems: 25, totalPages: 2, hasNextPage: true }));
  try {
    const result = await staffApi.feedbacks({ pageNumber: 1, search: 'test', status: 'Verified' });
    assert.equal(get.mock.calls[0].arguments[0], '/api/management/feedbacks');
    assert.equal(result.items[0].summary, 'Test summary'); assert.equal(result.totalItems, 25); assert.equal(result.hasNextPage, true);
  } finally { get.mock.restore(); }
});

test('all supported Incident filters reach the API without weakening the current-user scope', async () => {
  const get = mock.method(axiosClient, 'get', async () => ({ items: [], totalItems: 0 }));
  try {
    await staffApi.incidents('staff-1', {
      pageNumber: 3, search: '  cây đổ  ', status: 'NeedRework', priority: 'High', severity: 'Critical',
      areaId: '12', categoryId: 4, assignedStaffUserId: 'another-staff', includeMerged: true,
    });
    assert.deepEqual(get.mock.calls[0].arguments[1].params, {
      PageNumber: 3, PageSize: 20, Search: 'cây đổ', Status: 'NeedRework', Priority: 'High', Severity: 'Critical',
      AreaId: 12, CategoryId: 4, AssignedStaffUserId: 'staff-1', IncludeMerged: false,
    });
    await staffApi.incidents('staff-1', { pageNumber: 1, priority: '', severity: '', areaId: '', categoryId: '' });
    assert.deepEqual(get.mock.calls[1].arguments[1].params, { PageNumber: 1, PageSize: 20, AssignedStaffUserId: 'staff-1', IncludeMerged: false });
  } finally { get.mock.restore(); }
});

test('Incident detail and timeline use separate real endpoints with safe path encoding', async () => {
  const signal = new AbortController().signal;
  const get = mock.method(axiosClient, 'get', async (url) => url.endsWith('/timeline')
    ? { items: [{ incidentEventId: 'e1', eventType: 'Assigned', actorUserName: 'Manager' }], pageNumber: 2, totalItems: 21, totalPages: 2 }
    : { incidentId: 'incident/1', reports: [{ feedbackId: 'f1' }, { feedbackId: 'f2' }] });
  try {
    const incident = await staffApi.incident('incident/1', signal);
    const timeline = await staffApi.timeline('incident/1', 2, signal);
    assert.deepEqual(incident.reports.map((report) => report.id), ['f1', 'f2']);
    assert.equal(get.mock.calls[0].arguments[0], '/api/management/incidents/incident%2F1');
    assert.deepEqual(get.mock.calls[1].arguments, ['/api/management/incidents/incident%2F1/timeline', { params: { pageNumber: 2, pageSize: 20 }, signal }]);
    assert.equal(timeline.pageNumber, 2); assert.equal(timeline.totalItems, 21); assert.equal(timeline.items[0].actor, 'Manager');
    const keys = [staffKeys.incidents('s1', {}), staffKeys.incident('s1', 'i1'), staffKeys.timeline('s1', 'i1', 1), staffKeys.feedback('s1', 'i1')];
    assert.equal(new Set(keys.map((key) => JSON.stringify(key))).size, keys.length);
    assert.notDeepEqual(staffKeys.timeline('s1', 'i1', 1), staffKeys.timeline('s1', 'i1', 2));
    assert.notDeepEqual(staffKeys.incident('s1', 'i1'), staffKeys.incident('s2', 'i1'));
  } finally { get.mock.restore(); }
});

test('staff messages use internal scope explicitly and preserve public/internal write mode', async () => {
  const get = mock.method(axiosClient, 'get', async () => []);
  const post = mock.method(axiosClient, 'post', async () => ({}));
  try {
    await staffApi.messages('f1');
    assert.equal(get.mock.calls[0].arguments[1].params.includeInternal, true);
    await staffApi.sendMessage('f1', '  Trả lời  ', false);
    await staffApi.sendMessage('f1', 'Nội bộ', true);
    assert.deepEqual(post.mock.calls[0].arguments[1], { messageText: 'Trả lời', isInternal: false });
    assert.deepEqual(post.mock.calls[1].arguments[1], { messageText: 'Nội bộ', isInternal: true });
    await assert.rejects(staffApi.sendMessage('f1', '  ', true));
    assert.equal(post.mock.callCount(), 2);
  } finally { get.mock.restore(); post.mock.restore(); }
});

test('Staff chat reuses the Resident keyboard composer contract without double Android offsets', () => {
  const source = readFileSync(new URL('../src/features/staff/components/staff-chat-screen.tsx', import.meta.url), 'utf8');
  assert.match(source, /KeyboardAwareComposerLayout/);
  assert.match(source, /avoidContentOverlap/);
  assert.doesNotMatch(source, /KeyboardAvoidingView|useHeaderHeight|keyboardVerticalOffset|composerMinHeight/);
  assert.match(source, /width:\s*48,\s*height:\s*48/);
  assert.match(source, /accessibilityLabel=\{internal \? 'Lưu ghi chú nội bộ' : 'Gửi phản hồi'\}/);
});

test('confirmed Incident execution capabilities support provider flow, direct status transition and resubmit', () => {
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.staffStartProcessing.available, true);
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.staffStartProcessing.scope, 'provider-assignment');
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.staffStartProcessing.fromStatus, 'Reported');
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.staffStartProcessing.toStatus, 'InProgress');
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.staffStartProcessing.endpoint, '/api/management/provider-assignments/{providerAssignmentId}/status');
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.providerAssignment.available, true);
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.providerAssignment.scope, 'incident');
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.providerAssignment.legacyRequiresFeedbackId, false);
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.providerAssignment.supportsReassignment, false);
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.resolutions.resubmitConfirmed, true);
  assert.deepEqual(INCIDENT_MANAGEMENT_CAPABILITIES.resolutions.submitStatuses, ['InProgress', 'NeedRework']);
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.completionEvidence.clearAllAvailable, true);
  assert.equal(INCIDENT_MANAGEMENT_CAPABILITIES.statusTransition.available, true);
});

const executionAssignment = { providerAssignmentId: 501, incidentId: 'incident/1', coordinatorId: 41, providerName: 'Đội thoát nước', reportStatus: 'Reported', contactLogCount: 0, completionDocumentCount: 0 };
const executionEvidence = { completionDocumentId: 701, providerAssignmentId: 501, incidentId: 'incident/1', coordinatorId: 41, fileUrl: 'https://files.example.test/evidence.png', fileType: 'image/png' };
const executionContact = { contactLogId: 801, providerAssignmentId: 501, coordinatorId: 41, contactMethod: 'Điện thoại', contactResult: 'Đã kết nối' };

test('execution guards require current ownership and separate initial submit from NeedRework resubmit', () => {
  for (const status of ['Assigned', 'InProgress', 'NeedRework', 'In Progress']) {
    assert.equal(canEditIncidentExecution({ status, assignedStaffUserId: 'STAFF-1' }, 'staff-1'), true);
  }
  for (const status of ['SubmittedForApproval', 'Resolved', 'Closed', 'Cancelled', 'Merged', 'unknown']) {
    assert.equal(canEditIncidentExecution({ status, assignedStaffUserId: 'staff-1' }, 'staff-1'), false);
  }
  for (const assignedStaffUserId of ['', 'another-staff']) {
    assert.equal(canEditIncidentExecution({ status: 'InProgress', assignedStaffUserId }, 'staff-1'), false);
    assert.equal(canStartIncidentProcessing({ status: 'Assigned', assignedStaffUserId }, 'staff-1'), false);
    assert.equal(canSubmitIncidentResolution({ status: 'InProgress', assignedStaffUserId }, 'staff-1', 0), false);
  }
  assert.equal(canEditIncidentExecution({ status: 'InProgress', assignedStaffUserId: '' }, ''), false);
  assert.equal(canStartIncidentProcessing({ status: 'Assigned', assignedStaffUserId: 'STAFF-1' }, 'staff-1'), true);
  for (const status of ['InProgress', 'NeedRework', 'SubmittedForApproval']) assert.equal(canStartIncidentProcessing({ status, assignedStaffUserId: 'staff-1' }, 'staff-1'), false);
  assert.equal(incidentResolutionSubmissionMode({ status: 'InProgress', assignedStaffUserId: 'staff-1' }, 'staff-1', 0), 'initial');
  assert.equal(canSubmitIncidentResolution({ status: 'InProgress', assignedStaffUserId: 'staff-1' }, 'staff-1', 0), true);
  assert.equal(canSubmitIncidentResolution({ status: 'InProgress', assignedStaffUserId: 'staff-1' }, 'staff-1', 1), false, 'an existing initial result blocks duplicate submission');
  assert.equal(incidentResolutionSubmissionMode({ status: 'NeedRework', assignedStaffUserId: 'staff-1' }, 'staff-1', 1), 'resubmit');
  assert.equal(canSubmitIncidentResolution({ status: 'NeedRework', assignedStaffUserId: 'staff-1' }, 'staff-1', 2), true);
  for (const count of [-1, 1.5, NaN]) assert.equal(canSubmitIncidentResolution({ status: 'NeedRework', assignedStaffUserId: 'staff-1' }, 'staff-1', count), false);
  for (const status of ['Assigned', 'SubmittedForApproval']) assert.equal(canSubmitIncidentResolution({ status, assignedStaffUserId: 'staff-1' }, 'staff-1', 0), false);
});

test('Staff start processing uses the Provider assignment transition and validates its identity', async () => {
  const patch = mock.method(axiosClient, 'patch', async () => ({ ...executionAssignment, reportStatus: 'InProgress' }));
  try {
    const result = await executionApi.startProcessing(501, { note: '  Bắt đầu kiểm tra hiện trường  ', status: 'Closed' });
    assert.equal(result.providerAssignmentId, 501);
    assert.equal(result.reportStatus, 'InProgress');
    assert.deepEqual(patch.mock.calls[0].arguments, ['/api/management/provider-assignments/501/status', { status: 'InProgress', note: 'Bắt đầu kiểm tra hiện trường' }]);
    patch.mock.mockImplementation(async () => ({ ...executionAssignment, providerAssignmentId: 999, reportStatus: 'InProgress' }));
    await assert.rejects(executionApi.startProcessing(501), /không thuộc phân công/);
  } finally { patch.mock.restore(); }
});

test('Staff direct processing uses the Incident status contract and validates its identity', async () => {
  const patch = mock.method(axiosClient, 'patch', async () => ({
    incidentId: 'incident/1', status: 'InProgress', assignedStaffUserId: 'staff-1', reports: [],
  }));
  try {
    const result = await executionApi.startIncidentDirectly('incident/1', { note: '  Staff tự xử lý  ', status: 'Closed' });
    assert.equal(result.id, 'incident/1');
    assert.equal(result.status, 'InProgress');
    assert.deepEqual(patch.mock.calls[0].arguments, ['/api/management/incidents/incident%2F1/status', { status: 'InProgress', note: 'Staff tự xử lý' }]);
    patch.mock.mockImplementation(async () => ({ incidentId: 'another-incident', status: 'InProgress', reports: [] }));
    await assert.rejects(executionApi.startIncidentDirectly('incident/1'), /không thuộc sự vụ/);
  } finally { patch.mock.restore(); }
});

test('guided execution flow resumes backend progress and preserves an explicit skipped evidence step', () => {
  assert.equal(resolveExecutionMode({ hasAssignment: true, status: 'Assigned', draftMode: 'direct' }), 'provider');
  assert.equal(resolveExecutionMode({ hasAssignment: false, status: 'Assigned' }), null);
  assert.equal(resolveExecutionMode({ hasAssignment: false, status: 'InProgress' }), 'direct');
  const provider = buildExecutionSteps({ mode: 'provider', status: 'InProgress', hasAssignment: true, contactCount: 1, evidenceCount: 0, resolutionCount: 0 });
  assert.equal(currentExecutionStep(provider), 'evidence');
  assert.deepEqual(provider.map((step) => step.state), ['done', 'done', 'current', 'upcoming']);
  const skipped = buildExecutionSteps({ mode: 'direct', status: 'InProgress', hasAssignment: false, contactCount: 0, evidenceCount: 0, resolutionCount: 0, activeStep: 'resolution', evidenceSkipped: true });
  assert.deepEqual(skipped.map((step) => step.state), ['done', 'skipped', 'current']);
  const rework = buildExecutionSteps({ mode: 'provider', status: 'NeedRework', hasAssignment: true, contactCount: 1, evidenceCount: 2, resolutionCount: 1 });
  assert.equal(currentExecutionStep(rework), 'evidence');
  const draft = parseExecutionDraft(JSON.stringify({ mode: 'direct', activeStep: 'resolution', evidenceSkipped: true, resolutionSummary: 'Đã xử lý' }));
  assert.equal(draft.mode, 'direct'); assert.equal(draft.activeStep, 'resolution'); assert.equal(draft.evidenceSkipped, true);
  assert.equal(parseExecutionDraft('{bad').mode, null);
});

test('execution bootstrap accepts Expo scalar and array route params without an endless disabled query', () => {
  assert.equal(firstRouteParam(' incident-1 '), 'incident-1');
  assert.equal(firstRouteParam([' incident-2 ', 'ignored']), 'incident-2');
  assert.equal(firstRouteParam(undefined), '');

  const source = readFileSync(new URL('../src/features/staff/components/staff-execution-flow-screen.tsx', import.meta.url), 'utf8');
  assert.match(source, /const bootstrapReady = Boolean\(id && userId\)/);
  assert.match(source, /const queryPending = bootstrapReady &&/);
  assert.match(source, /setTimeout\([\s\S]*?1800/);
  assert.match(source, /bootstrapError/);
});

test('execution read APIs use Incident/assignment routes, encode identity and accept assignment 204 only as no assignment', async () => {
  const signal = new AbortController().signal;
  const get = mock.method(axiosClient, 'get', async (url) => {
    if (url.endsWith('/provider-candidates')) return { data: [{ coordinatorId: 41, providerName: 'Đội thoát nước' }] };
    if (url.endsWith('/provider-assignment')) return '';
    if (url.endsWith('/contact-logs')) return { data: { items: [executionContact] } };
    if (url.endsWith('/completion-documents')) return [executionEvidence];
    return { data: [{ resolutionId: 601, incidentId: 'incident/1', providerAssignmentId: 501, completionDocuments: [executionEvidence] }] };
  });
  try {
    assert.equal((await executionApi.candidates(' incident/1 ', signal))[0].coordinatorId, 41);
    assert.equal(await executionApi.assignment('incident/1', signal), null);
    assert.equal((await executionApi.contacts(501, signal))[0].contactLogId, 801);
    assert.equal((await executionApi.evidence(501, signal))[0].completionDocumentId, 701);
    assert.equal((await executionApi.resolutions('incident/1', signal))[0].resolutionId, 601);
    assert.deepEqual(get.mock.calls.map((call) => call.arguments[0]), [
      '/api/management/incidents/incident%2F1/provider-candidates', '/api/management/incidents/incident%2F1/provider-assignment',
      '/api/management/provider-assignments/501/contact-logs', '/api/management/provider-assignments/501/completion-documents',
      '/api/management/incidents/incident%2F1/resolutions',
    ]);
    assert.ok(get.mock.calls.every((call) => call.arguments[1].signal === signal));
    get.mock.mockImplementation(async () => ({ data: executionAssignment }));
    assert.equal((await executionApi.assignment('incident/1')).providerAssignmentId, 501);
    get.mock.mockImplementation(async () => ({ data: { ...executionAssignment, incidentId: 'another-incident' } }));
    await assert.rejects(executionApi.assignment('incident/1'), /không thuộc sự vụ/);
    get.mock.mockImplementation(async () => '<html>gateway</html>');
    await assert.rejects(executionApi.candidates('incident/1'));
    await assert.rejects(executionApi.assignment('incident/1'));
  } finally { get.mock.restore(); }
});

test('provider assignment validates input and whitelists Incident payload without mapping Feedback', async () => {
  const post = mock.method(axiosClient, 'post', async () => ({ data: executionAssignment }));
  try {
    for (const coordinatorId of [0, -1, 1.2, NaN, true, 2147483648]) await assert.rejects(executionApi.assign('incident/1', { coordinatorId }));
    await assert.rejects(executionApi.assign(' ', { coordinatorId: 41 }));
    assert.equal(post.mock.callCount(), 0);
    await executionApi.assign('incident/1', { coordinatorId: 41, note: '  Kiểm tra hiện trường  ', feedbackId: 'must-not-leak', staffUserId: 'must-not-leak' });
    assert.deepEqual(post.mock.calls[0].arguments, ['/api/management/incidents/incident%2F1/provider-assignment', { coordinatorId: 41, note: 'Kiểm tra hiện trường' }]);
    post.mock.mockImplementation(async () => null);
    await assert.rejects(executionApi.assign('incident/1', { coordinatorId: 41 }), /không hợp lệ/);
  } finally { post.mock.restore(); }
});

test('provider contact/status writes validate text/date and cannot accept another assignment response', async () => {
  const post = mock.method(axiosClient, 'post', async () => executionContact);
  const patch = mock.method(axiosClient, 'patch', async () => executionAssignment);
  try {
    await assert.rejects(executionApi.addContact(501, { contactMethod: '', contactResult: 'ok' }));
    await assert.rejects(executionApi.addContact(501, { contactMethod: 'Phone', contactResult: ' ' }));
    await assert.rejects(executionApi.addContact(501, { contactMethod: 'Phone', contactResult: 'ok', contactedAt: 'tomorrow' }));
    await assert.rejects(executionApi.updateProviderStatus(0, { status: 'InProgress' }));
    await assert.rejects(executionApi.updateProviderStatus(501, { status: ' ' }));
    assert.equal(post.mock.callCount(), 0); assert.equal(patch.mock.callCount(), 0);
    await executionApi.addContact(501, { contactMethod: ' Phone ', contactResult: ' Connected ', contactNote: ' Note ', contactedAt: '2026-09-01T13:30:00+07:00', feedbackId: 'not-used' });
    assert.deepEqual(post.mock.calls[0].arguments, ['/api/management/provider-assignments/501/contact-logs', { contactMethod: 'Phone', contactResult: 'Connected', contactNote: 'Note', contactedAt: '2026-09-01T06:30:00.000Z' }]);
    await executionApi.updateProviderStatus(501, { status: ' InProgress ', note: ' Working ', incidentId: 'not-used' });
    assert.deepEqual(patch.mock.calls[0].arguments, ['/api/management/provider-assignments/501/status', { status: 'InProgress', note: 'Working' }]);
    post.mock.mockImplementation(async () => ({ ...executionContact, providerAssignmentId: 999 }));
    await assert.rejects(executionApi.addContact(501, { contactMethod: 'Phone', contactResult: 'Connected' }), /không thuộc phân công/);
    patch.mock.mockImplementation(async () => ({ ...executionAssignment, providerAssignmentId: 999 }));
    await assert.rejects(executionApi.updateProviderStatus(501, { status: 'InProgress' }), /không thuộc phân công/);
  } finally { post.mock.restore(); patch.mock.restore(); }
});

test('evidence upload builds platform multipart files and never fetches remote files', async () => {
  const file = new Blob(['test image'], { type: 'image/png' });
  const assets = [{ uri: 'blob:test-image', name: 'evidence.png', mimeType: 'image/png', file }];
  const form = buildEvidenceFormData(assets, '  Sau xử lý  ');
  assert.equal(form.get('Description'), 'Sau xử lý');
  assert.equal(form.getAll('Files').length, 1); assert.equal(form.get('Files').name, 'evidence.png');
  assert.equal(await form.get('Files').text(), 'test image');
  assert.throws(() => buildEvidenceFormData([]));
  assert.throws(() => buildEvidenceFormData([{ uri: 'https://untrusted.test/file.png', name: 'remote.png' }]), /chọn lại tệp/);
  assert.throws(() => buildEvidenceFormData([{ ...assets[0], name: 'bad\nname.png' }]), /Tên tệp/);
  const post = mock.method(axiosClient, 'post', async () => [executionEvidence]);
  try {
    assert.equal((await executionApi.uploadEvidence(501, assets, ' Sau xử lý '))[0].completionDocumentId, 701);
    assert.equal(post.mock.calls[0].arguments[0], '/api/management/provider-assignments/501/completion-documents');
    assert.ok(post.mock.calls[0].arguments[1] instanceof FormData);
    assert.equal(post.mock.calls[0].arguments.length, 2, 'The browser/native platform must generate the multipart Content-Type boundary');
  } finally { post.mock.restore(); }
});

test('NeedRework evidence clear uses the contract path, validates the assignment and requires explicit destructive UI confirmation', async () => {
  const remove = mock.method(axiosClient, 'delete', async () => undefined);
  try {
    for (const assignmentId of [0, -1, 1.2, NaN, true, 2147483648]) {
      await assert.rejects(executionApi.clearEvidence(assignmentId));
    }
    assert.equal(remove.mock.callCount(), 0);
    assert.equal(await executionApi.clearEvidence(501), undefined);
    assert.deepEqual(remove.mock.calls[0].arguments, ['/api/management/provider-assignments/501/completion-documents']);
  } finally { remove.mock.restore(); }

  const source = readFileSync(new URL('../src/features/staff/components/staff-execution-flow-screen.tsx', import.meta.url), 'utf8');
  assert.match(source, /currentStatus\s*===\s*['"]needrework['"]/i);
  assert.match(source, /normalizeKey\(latest\.status\)\s*!==\s*['"]needrework['"]/i);
  assert.match(source, /Xóa toàn bộ minh chứng cũ/);
  assert.match(source, /Xác nhận xóa/);
  assert.match(source, /Nội dung đang nhập vẫn được giữ/);
  assert.match(source, /DocumentPicker\.getDocumentAsync/);
  assert.match(source, /application\/pdf/);
});

test('native URI evidence is appended as a native file descriptor without assuming Blob support', () => {
  const original = globalThis.FormData;
  class NativeFormData {
    values = [];
    append(...args) { this.values.push(args); }
  }
  globalThis.FormData = NativeFormData;
  try {
    const form = buildEvidenceFormData([{ uri: 'file:///cache/inspection.jpg', name: 'inspection.jpg', mimeType: 'image/jpeg' }]);
    assert.deepEqual(form.values, [['Files', { uri: 'file:///cache/inspection.jpg', name: 'inspection.jpg', type: 'image/jpeg' }]]);
  } finally { globalThis.FormData = original; }
});

test('resolution submit uses the Incident contract, accepts empty 200 and rejects unsafe/incomplete payloads', async () => {
  const post = mock.method(axiosClient, 'post', async () => '');
  try {
    for (const payload of [{ resolutionSummary: '', actionTaken: 'fixed' }, { resolutionSummary: 'ok', actionTaken: '' }, { resolutionSummary: 'ok', actionTaken: 'fixed', providerAssignmentId: 0 }, { resolutionSummary: 'ok', actionTaken: 'fixed', imageUrls: ['javascript:alert(1)'] }, { resolutionSummary: 'ok', actionTaken: 'fixed', imageUrls: ['file:///cache/test.jpg'] }]) await assert.rejects(executionApi.submitResolution('incident/1', payload));
    assert.equal(post.mock.callCount(), 0);
    const result = await executionApi.submitResolution('incident/1', { providerAssignmentId: 501, resolutionSummary: '  Đã khắc phục  ', actionTaken: '  Vệ sinh  ', resultNote: '  Theo dõi  ', imageUrls: [executionEvidence.fileUrl], feedbackId: 'not-used', status: 'Approved' });
    assert.equal(result, undefined);
    assert.deepEqual(post.mock.calls[0].arguments, ['/api/management/incidents/incident%2F1/resolutions', { providerAssignmentId: 501, resolutionSummary: 'Đã khắc phục', actionTaken: 'Vệ sinh', resultNote: 'Theo dõi', imageUrls: [executionEvidence.fileUrl] }]);
    await executionApi.submitResolution('incident/1', { resolutionSummary: 'Không có phân công đơn vị', actionTaken: 'Tự xử lý tại hiện trường' });
    assert.deepEqual(post.mock.calls[1].arguments[1], { resolutionSummary: 'Không có phân công đơn vị', actionTaken: 'Tự xử lý tại hiện trường' });
  } finally { post.mock.restore(); }
});

test('execution history rejects cross-Incident evidence and query caches retain all ownership dimensions', async () => {
  assert.equal(normalizeCompletionEvidence({ ...executionEvidence, fileUrl: 'javascript:alert(1)' }).fileUrl, '');
  assert.throws(() => normalizeIncidentResolution({ resolutionId: 601, incidentId: 'another-incident', providerAssignmentId: 501, completionDocuments: [executionEvidence] }), /không thuộc/);
  assert.throws(() => normalizeIncidentResolution({ resolutionId: 601, incidentId: 'incident/1', providerAssignmentId: 999, completionDocuments: [executionEvidence] }), /không thuộc/);
  const get = mock.method(axiosClient, 'get', async () => [{ ...executionEvidence, providerAssignmentId: 999 }]);
  try { await assert.rejects(executionApi.evidence(501), /không thuộc phân công/); } finally { get.mock.restore(); }
  const keys = [executionKeys.candidates('s1', 'i1'), executionKeys.assignment('s1', 'i1'), executionKeys.contacts('s1', 'i1', 501), executionKeys.evidence('s1', 'i1', 501), executionKeys.resolutions('s1', 'i1')];
  assert.equal(new Set(keys.map((key) => JSON.stringify(key))).size, keys.length);
  assert.notDeepEqual(executionKeys.evidence('s1', 'i1', 501), executionKeys.evidence('s2', 'i1', 501));
  assert.notDeepEqual(executionKeys.evidence('s1', 'i1', 501), executionKeys.evidence('s1', 'i2', 501));
  assert.notDeepEqual(executionKeys.evidence('s1', 'i1', 501), executionKeys.evidence('s1', 'i1', 502));
});

const noInsets = { top: 0, right: 0, bottom: 0, left: 0 };

test('Staff content owns Android bottom insets only outside a tab bar', () => {
  for (const bottom of [0, 24, 48]) {
    const insets = { ...noInsets, top: 24, bottom };
    const detail = getStaffContentLayout({ width: 360, insets });
    const tab = getStaffContentLayout({ width: 360, insets, bottomInsetConsumed: true });
    assert.equal(detail.paddingBottom, 32 + bottom);
    assert.equal(detail.bottomInset, bottom);
    assert.equal(tab.paddingBottom, 32, 'The tab bar already consumed the system navigation inset');
    assert.equal(tab.bottomInset, 0);
    assert.equal(detail.paddingTop, 24, 'A visible native header already owns the status bar inset');
    assert.equal(detail.contentInsetAdjustmentBehavior, 'never');
  }
  assert.equal(getStaffContentLayout({ width: 360, insets: { ...noInsets, bottom: 48 }, bottomInsetConsumed: true, bottomSafeArea: 'always' }).paddingBottom, 80);
  assert.equal(getStaffContentLayout({ width: 360, insets: { ...noInsets, bottom: 48 }, bottomSafeArea: 'never' }).paddingBottom, 32);
});

test('Staff content respects Android cutouts, header ownership and tablet readable width', () => {
  const cutout = getStaffContentLayout({ width: 844, insets: { top: 24, left: 44, right: 12, bottom: 24 }, headerShown: false });
  assert.equal(cutout.paddingTop, 48);
  assert.ok(cutout.paddingLeft >= 44 + 20);
  assert.ok(cutout.paddingRight >= 12 + 20);
  assert.equal(cutout.paddingBottom, 56);
  assert.equal(cutout.paddingLeft + cutout.paddingRight + cutout.readableWidth, 844);
  for (const width of [320, 360, 390, 800, 1280]) {
    const layout = getStaffContentLayout({ width, insets: noInsets });
    assert.ok(layout.readableWidth <= 760);
    assert.equal(layout.paddingLeft, layout.paddingRight);
    assert.equal(layout.readableWidth + layout.paddingLeft + layout.paddingRight, width);
    assert.equal(layout.gutter, width < 360 ? 16 : 20);
  }
  const ios = getStaffContentLayout({ width: 390, insets: { top: 59, left: 10, right: 10, bottom: 34 }, platform: 'ios', headerShown: false });
  assert.equal(ios.paddingTop, 24);
  assert.equal(ios.paddingBottom, 32);
  assert.equal(ios.contentInsetAdjustmentBehavior, 'automatic', 'iOS automatic adjustment must not receive duplicate manual insets');
});

test('Staff tabs keep all five destinations visible through 200% text on Android widths', () => {
  for (const width of [240, 320, 360, 390, 800, 844]) {
    for (const fontScale of [1, 1.5, 2, 3]) {
      const layout = getStaffTabLayout({ width, fontScale, insets: noInsets });
      assert.equal(layout.scrollable, false);
      assert.ok(layout.itemWidth >= 48);
      assert.ok(layout.labelLines <= 2);
      assert.ok(layout.labelFontScale <= STAFF_FIXED_CHROME_MAX_FONT_SCALE);
      assert.equal(layout.itemWidth * 5, layout.rowWidth);
    }
  }
  for (const width of [1, 200, 239]) {
    const layout = getStaffTabLayout({ width, fontScale: 2, insets: noInsets });
    assert.equal(layout.scrollable, true, 'Only a viewport narrower than five accessible targets may scroll');
    assert.ok(layout.itemWidth >= 48);
    assert.ok(layout.rowWidth > layout.viewportWidth);
  }
  const cutout = getStaffTabLayout({ width: 844, fontScale: 2, insets: { top: 0, left: 44, right: 44, bottom: 24 } });
  assert.equal(cutout.viewportWidth, 756);
  assert.equal(cutout.height, cutout.controlHeight + 24);
});

test('Staff tabs delegate native horizontal distribution to React Navigation', () => {
  const source = readFileSync(new URL('../app/(staff)/staff/(tabs)/_layout.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\btabBar\s*=\s*\{/, 'A custom horizontal wrapper previously collapsed tab hitboxes on Android');
  assert.match(source, /tabBarLabel:\s*\(\{\s*color\s*\}\)\s*=>\s*<Text/);
  assert.match(source, /maxFontSizeMultiplier=\{layout\.labelFontScale\}/);
  assert.match(source, /tabBarHideOnKeyboard:\s*true/);
  assert.match(source, /minWidth:\s*48/);
});

test('Staff text line boxes follow accessibility scale while fixed chrome is capped', () => {
  assert.equal(getStaffTextScale({ fontScale: 2 }), 2);
  assert.equal(getStaffTextScale({ fontScale: 2, maxFontSizeMultiplier: STAFF_FIXED_CHROME_MAX_FONT_SCALE }), STAFF_FIXED_CHROME_MAX_FONT_SCALE);
  assert.equal(getStaffTextScale({ fontScale: 3, allowFontScaling: false }), 1);
  assert.equal(getStaffLineHeight({ fontSize: 14, fontScale: 1 }), 21);
  assert.equal(getStaffLineHeight({ fontSize: 14, fontScale: 2 }), 42);
  assert.equal(getStaffLineHeight({ fontSize: 11, fontScale: 3, ratio: 16 / 11, maxFontSizeMultiplier: STAFF_FIXED_CHROME_MAX_FONT_SCALE }), 23);
});

test('Staff layout calculations remain finite for transient zero width or malformed platform measurements', () => {
  for (const value of [0, -10, NaN, Infinity]) {
    const insets = { top: value, left: value, right: value, bottom: value };
    const content = getStaffContentLayout({ width: value, insets });
    const tabs = getStaffTabLayout({ width: value, fontScale: value, insets, count: value });
    for (const [name, number] of Object.entries({ ...content, ...tabs })) {
      if (typeof number !== 'number') continue;
      assert.ok(Number.isFinite(number), name + ' must be finite');
      assert.ok(number >= 0, name + ' must not be negative');
    }
    assert.ok(tabs.itemWidth >= 48);
  }
});

test('compatibility profiles separate available web geometry from native Android evidence', () => {
  assert.deepEqual(smokeProfile().viewport, { width: 390, height: 844 });
  assert.deepEqual(smokeProfile('tiny').viewport, { width: 320, height: 640 });
  assert.deepEqual(smokeProfile('three-button-frame').viewport, { width: 360, height: 728 });
  assert.deepEqual(smokeProfile('three-button-frame').nominalFrame, { width: 360, height: 800 });
  assert.equal(smokeProfile('large-text').textScale, 1.5);
  assert.equal(smokeProfile('large-text', { textScale: 2 }).textScale, 2);
  for (const name of Object.keys(STAFF_SMOKE_PROFILES)) assert.match(smokeProfile(name).evidence, /not a native Android/);
  assert.throws(() => smokeProfile('invented-device'));
  assert.throws(() => smokeProfile('tiny', { width: -1 }));
  assert.throws(() => smokeProfile('tiny', { textScale: Infinity }));
});
