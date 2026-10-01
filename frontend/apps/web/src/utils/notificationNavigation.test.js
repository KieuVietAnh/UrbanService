import assert from 'node:assert/strict';
import test from 'node:test';
import { APP_ROLES } from '@urbanmind/shared-types';
import {
  getNotificationDestinationEntity,
  resolveNotificationDestination,
} from './notificationNavigation.js';

test('SYSTEMSTAFF mở Incident bằng incidentId chuẩn trong NotificationDto', () => {
  const notification = { incidentId: 'incident-01', type: 'StatusChanged' };
  assert.equal(resolveNotificationDestination(notification, APP_ROLES.SYSTEM_STAFF), '/staff/incidents/incident-01');
  assert.equal(getNotificationDestinationEntity(notification, APP_ROLES.SYSTEM_STAFF), 'incident');
});

test('SYSTEMSTAFF mở Report khi payload có feedbackId rõ ràng', () => {
  const notification = { feedbackId: 'feedback-01', type: 'MessageReceived' };
  assert.equal(resolveNotificationDestination(notification, 'SYSTEMSTAFF'), '/staff/feedbacks/feedback-01');
});

test('NeedRework có incidentId luôn mở đúng Incident', () => {
  const notification = { incidentId: 'incident-rework', type: 'IncidentNeedRework' };
  assert.equal(resolveNotificationDestination(notification, 'SystemStaff'), '/staff/incidents/incident-rework');
});

test('deep-link tab Incident chỉ được giữ khi targetUrl chỉ rõ tab hợp lệ của cùng Incident', () => {
  assert.equal(
    resolveNotificationDestination({
      incidentId: 'incident-rework',
      targetUrl: '/staff/incidents/incident-rework?tab=resolution',
    }, APP_ROLES.SYSTEM_STAFF),
    '/staff/incidents/incident-rework?tab=resolution',
  );
  assert.equal(
    resolveNotificationDestination({
      incidentId: 'incident-rework',
      targetUrl: '/staff/incidents/another-incident?tab=resolution',
    }, APP_ROLES.SYSTEM_STAFF),
    '/staff/incidents/incident-rework',
  );
});

test('thông báo phân công dùng targetType và targetId của Incident', () => {
  const notification = { targetType: 'Incident', targetId: 'incident-assigned', type: 'IncidentAssigned' };
  assert.equal(resolveNotificationDestination(notification, 'system-staff'), '/staff/incidents/incident-assigned');
});

test('loại thông báo không hỗ trợ không được dùng targetUrl ngoài phạm vi Staff', () => {
  const notification = { type: 'UnknownNotification', targetUrl: '/manager/incidents/manager-only' };
  assert.equal(resolveNotificationDestination(notification, APP_ROLES.SYSTEM_STAFF), '/notifications');
});

test('payload thiếu định danh quay về Notification Center và không crash', () => {
  assert.equal(resolveNotificationDestination({ notificationId: 8 }, APP_ROLES.SYSTEM_STAFF), '/notifications');
  assert.equal(getNotificationDestinationEntity({}, APP_ROLES.SYSTEM_STAFF), 'fallback');
});

test('routing ServiceUser hiện có không bị thay đổi bởi routing Staff', () => {
  const notification = { feedbackId: 'feedback-02', type: 'NeedRework' };
  assert.equal(resolveNotificationDestination(notification, APP_ROLES.SERVICE_USER), '/tickets/feedback-02/rework');
});

test('SYSTEMSTAFF không mở workspace Provider Report legacy khi thiếu incidentId', () => {
  assert.equal(
    resolveNotificationDestination({ targetUrl: '/staff/provider-reports/501' }, APP_ROLES.SYSTEM_STAFF),
    '/notifications',
  );
  assert.equal(
    getNotificationDestinationEntity({ providerReportId: 501 }, APP_ROLES.SYSTEM_STAFF),
    'fallback',
  );
});

test('SYSTEMSTAFF chỉ theo targetUrl nội bộ thuộc route đã biết', () => {
  assert.equal(
    resolveNotificationDestination({ targetUrl: 'https://evil.test/staff/incidents/i-1' }, APP_ROLES.SYSTEM_STAFF),
    '/notifications',
  );
});


test('INTERACTION_MANAGER mở Incident theo incidentId thay vì route ServiceUser', () => {
  const notification = { incidentId: 'incident-manager', type: 'StatusChanged' };
  assert.equal(resolveNotificationDestination(notification, APP_ROLES.INTERACTION_MANAGER), '/manager/incidents/incident-manager');
  assert.equal(getNotificationDestinationEntity(notification, APP_ROLES.INTERACTION_MANAGER), 'incident');
});

test('INTERACTION_MANAGER mở Feedback theo route giám sát tương tác', () => {
  const notification = { feedbackId: 'feedback-manager', type: 'MessageReceived' };
  assert.equal(resolveNotificationDestination(notification, APP_ROLES.INTERACTION_MANAGER), '/manager/interactions/feedback-manager');
});

test('ADMINISTRATOR mở Incident và Feedback trong namespace quản trị', () => {
  assert.equal(
    resolveNotificationDestination({ incidentId: 'incident-admin' }, APP_ROLES.ADMINISTRATOR),
    '/management/incidents/incident-admin',
  );
  assert.equal(
    resolveNotificationDestination({ feedbackId: 'feedback-admin' }, APP_ROLES.ADMINISTRATOR),
    '/management/feedbacks/feedback-admin',
  );
});

test('INTERACTION_MANAGER chuẩn hóa targetUrl Incident namespace quản trị về namespace Manager', () => {
  assert.equal(
    resolveNotificationDestination({ targetUrl: '/management/incidents/incident-from-admin-url' }, APP_ROLES.INTERACTION_MANAGER),
    '/manager/incidents/incident-from-admin-url',
  );
});

test('ADMINISTRATOR không đi vào route approval của Manager và chuẩn hóa Incident về namespace quản trị', () => {
  const notification = { targetUrl: '/manager/approvals/incident-approval' };
  assert.equal(
    resolveNotificationDestination(notification, APP_ROLES.ADMINISTRATOR),
    '/management/incidents/incident-approval',
  );
  assert.equal(getNotificationDestinationEntity(notification, APP_ROLES.ADMINISTRATOR), 'incident');
});

test('ADMINISTRATOR chuẩn hóa targetUrl Feedback của Manager về namespace quản trị', () => {
  assert.equal(
    resolveNotificationDestination({ targetUrl: '/manager/interactions/feedback-from-manager-url' }, APP_ROLES.ADMINISTRATOR),
    '/management/feedbacks/feedback-from-manager-url',
  );
});


test('SERVICEUSER mở Incident khi notification trạng thái chỉ có incidentId', () => {
  const notification = { incidentId: 'incident-status', type: 'StatusChanged', title: 'Trạng thái sự vụ được cập nhật' };
  assert.equal(resolveNotificationDestination(notification, APP_ROLES.SERVICE_USER), '/community/feed/incident-status');
  assert.equal(getNotificationDestinationEntity(notification, APP_ROLES.SERVICE_USER), 'incident');
});

test('SERVICEUSER mở Community Incident khi notification có incidentId rõ ràng', () => {
  assert.equal(
    resolveNotificationDestination({
      incidentId: 'incident-community',
      type: 'CommunityUpdated',
      targetUrl: '/community/feed/legacy-value',
    }, APP_ROLES.SERVICE_USER),
    '/community/feed/incident-community',
  );
});

test('SERVICEUSER không biến community targetUrl legacy dùng feedbackId thành incidentId', () => {
  assert.equal(
    resolveNotificationDestination({
      feedbackId: 'feedback-legacy',
      type: 'CommentAdded',
      targetUrl: '/community/feed/feedback-legacy',
    }, APP_ROLES.SERVICE_USER),
    '/notifications',
  );
});

test('SERVICEUSER notification community chỉ có feedbackId quay về Notification Center', () => {
  assert.equal(
    resolveNotificationDestination({
      feedbackId: 'feedback-only',
      type: 'SupportAdded',
    }, APP_ROLES.SERVICE_USER),
    '/notifications',
  );
});

test('SERVICEUSER notification Community có cả feedbackId và incidentId vẫn được nhận diện là Incident', () => {
  const notification = {
    feedbackId: 'feedback-child',
    incidentId: 'incident-parent',
    type: 'CommunityUpdated',
  };
  assert.equal(getNotificationDestinationEntity(notification, APP_ROLES.SERVICE_USER), 'incident');
  assert.equal(resolveNotificationDestination(notification, APP_ROLES.SERVICE_USER), '/community/feed/incident-parent');
});
