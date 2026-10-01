import test from 'node:test';
import assert from 'node:assert/strict';
import { getNotificationCategory } from './notificationCenterUtils.js';

test('maps common notification types and copy to stable filter categories', () => {
  assert.equal(getNotificationCategory({ type: 'NeedRework' }), 'rework');
  assert.equal(getNotificationCategory({ type: 'ResolutionApproved' }), 'resolution');
  assert.equal(getNotificationCategory({ type: 'CommunityComment' }), 'community');
  assert.equal(getNotificationCategory({ type: 'SlaViolation', title: 'Vi phạm SLA phản hồi đầu tiên' }), 'status');
  assert.equal(getNotificationCategory({ title: 'Yêu cầu bổ sung thông tin' }), 'rework');
});
