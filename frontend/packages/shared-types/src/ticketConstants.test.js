import test from 'node:test';
import assert from 'node:assert/strict';
import { getStatusLabel, TICKET_STATUS_STEPS } from './ticketConstants.js';
import { managementTypes } from './managementTypes.js';

test('formats shared ticket statuses for UI', () => {
  assert.equal(getStatusLabel(managementTypes.feedbackStatus.SUBMITTED), 'Đã gửi');
  assert.equal(getStatusLabel(managementTypes.feedbackStatus.IN_PROGRESS), 'Đang xử lý');
  assert.equal(getStatusLabel(managementTypes.feedbackStatus.REJECTED), 'Bị từ chối');
  assert.equal(getStatusLabel(managementTypes.feedbackStatus.CANCELLED), 'Đã hủy');
  assert.equal(getStatusLabel('UnknownStatus', 'Không xác định'), 'Không xác định');
});

test('normalizes status values from API payloads for UI labels', () => {
  assert.equal(getStatusLabel('submitted'), 'Đã gửi');
  assert.equal(getStatusLabel('in_progress'), 'Đang xử lý');
  assert.equal(getStatusLabel('IN_PROGRESS'), 'Đang xử lý');
  assert.equal(getStatusLabel('resolved'), 'Đã xử lý');
});

test('exposes the standard ticket status steps', () => {
  assert.equal(TICKET_STATUS_STEPS[0].sub, managementTypes.feedbackStatus.SUBMITTED);
  assert.equal(TICKET_STATUS_STEPS[TICKET_STATUS_STEPS.length - 1].sub, managementTypes.feedbackStatus.CLOSED);
});
