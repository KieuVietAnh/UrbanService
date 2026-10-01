import test from 'node:test';
import assert from 'node:assert/strict';

import {
  collectIncidentEnumValues,
  formatManagerIncidentCode,
  formatManagerIncidentCount,
  getCandidateDisplayName,
  getCandidateId,
  getManagerIncidentPriorityLabel,
  getManagerIncidentSeverityLabel,
  getManagerIncidentStatusLabel,
  hasManagerIncidentFilters,
} from './managerIncidentUtils.js';

test('maps documented Incident operational values to Vietnamese', () => {
  assert.equal(getManagerIncidentStatusLabel('SubmittedForApproval'), 'Chờ duyệt kết quả');
  assert.equal(getManagerIncidentPriorityLabel('High'), 'Cao');
  assert.equal(getManagerIncidentSeverityLabel('Critical'), 'Nghiêm trọng');
});

test('formats Incident values without fabricating missing data', () => {
  assert.equal(formatManagerIncidentCode('ab12-cd34-ef56'), 'SV-AB12CD34');
  assert.equal(formatManagerIncidentCode(''), 'Chưa có dữ liệu');
  assert.equal(formatManagerIncidentCount(3), '3');
  assert.equal(formatManagerIncidentCount(null), 'Chưa có dữ liệu');
});

test('collects only real enum values returned by the current result set', () => {
  assert.deepEqual(
    collectIncidentEnumValues([
      { status: 'Assigned' },
      { status: 'New' },
      { status: 'Assigned' },
    ], 'status', 'InProgress'),
    ['Assigned', 'InProgress', 'New'],
  );
});

test('detects active Manager filters and reads real candidate identity', () => {
  assert.equal(hasManagerIncidentFilters({ includeMerged: false }), false);
  assert.equal(hasManagerIncidentFilters({ search: ' ngập ' }), true);
  assert.equal(getCandidateId({ userId: ' staff-1 ' }), 'staff-1');
  assert.equal(getCandidateDisplayName({ staffName: 'Nguyễn Văn A' }), 'Nguyễn Văn A');
  assert.equal(getCandidateDisplayName({}), 'Staff chưa có tên hiển thị');
});
