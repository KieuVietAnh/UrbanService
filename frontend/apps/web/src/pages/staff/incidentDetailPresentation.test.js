import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatConfidence,
  formatReportCode,
  getIncidentLifecycleMilestones,
  getIncidentEventMetadata,
  getIncidentEventTitle,
  getReportLinkMethodLabel,
  parseIncidentEventPayload,
} from './incidentDetailPresentation.js';

test('incident milestones use the SLA resolution deadline when Incident dueDate is absent', () => {
  const milestones = getIncidentLifecycleMilestones(
    { status: 'InProgress', dueDate: null, resolvedAt: null, closedAt: null },
    { resolutionDueAt: '2026-09-20T03:00:00Z' },
  );

  assert.equal(milestones.dueAt, '2026-09-20T03:00:00Z');
  assert.equal(milestones.resolvedPlaceholder, 'Chưa giải quyết');
  assert.equal(milestones.closedPlaceholder, 'Chưa đóng');
});

test('incident milestones keep Incident dates authoritative and expose missing terminal timestamps', () => {
  const milestones = getIncidentLifecycleMilestones(
    {
      status: 'Closed',
      dueDate: '2026-09-19T03:00:00Z',
      resolvedAt: '2026-09-18T04:00:00Z',
      closedAt: null,
    },
    { resolutionDueAt: '2026-09-20T03:00:00Z' },
  );

  assert.equal(milestones.dueAt, '2026-09-19T03:00:00Z');
  assert.equal(milestones.resolvedAt, '2026-09-18T04:00:00Z');
  assert.equal(milestones.closedPlaceholder, 'Backend chưa ghi nhận thời điểm');
});

test('incident milestones treat Approved as a resolved state', () => {
  const milestones = getIncidentLifecycleMilestones(
    { status: 'Approved', dueDate: null, resolvedAt: null, closedAt: null },
    null,
  );

  assert.equal(milestones.resolvedPlaceholder, 'Backend chưa ghi nhận thời điểm');
  assert.equal(milestones.closedPlaceholder, 'Chưa đóng');
});

test('Report presentation keeps the real identifier and confidence readable', () => {
  assert.equal(formatReportCode('12345678-abcd-0000-0000-000000000000'), 'UM-12345678');
  assert.equal(formatConfidence(0.923), '92,3%');
  assert.equal(formatConfidence(84), '84%');
});

test('membership wording explains the relationship without describing a deletion', () => {
  assert.equal(getReportLinkMethodLabel('AiManagerConfirmed'), 'AI đề xuất, Manager xác nhận');
  assert.equal(getReportLinkMethodLabel('Manual'), 'Ghép thủ công');
  assert.equal(getReportLinkMethodLabel('InitialCreated'), 'Phản ánh khởi tạo sự vụ');
});

test('timeline presentation maps returned event characteristics conservatively', () => {
  assert.equal(getIncidentEventTitle('IncidentReportLinked'), 'Phản ánh được liên kết');
  assert.equal(getIncidentEventTitle('IncidentAssigned'), 'Sự vụ được phân công');
  assert.equal(getIncidentEventTitle('UnrecognizedEvent'), 'Hoạt động sự vụ');
});

test('timeline payload parser exposes only supported metadata', () => {
  const payloadJson = JSON.stringify({
    oldStatus: 'Assigned',
    newStatus: 'InProgress',
    assignedStaffName: 'Nguyễn Văn A',
    internalObject: { secret: true },
  });

  assert.deepEqual(parseIncidentEventPayload(payloadJson), JSON.parse(payloadJson));
  assert.deepEqual(getIncidentEventMetadata({ payloadJson }), [
    { label: 'Trạng thái trước', value: 'Đã phân công' },
    { label: 'Trạng thái sau', value: 'Đang xử lý' },
    { label: 'Staff phụ trách', value: 'Nguyễn Văn A' },
  ]);
});
