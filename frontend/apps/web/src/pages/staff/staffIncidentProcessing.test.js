import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canManageIncidentExecution,
  canStartProviderAssignmentProcessing,
  getIncidentNextActionCopy,
  getIncidentProcessingSteps,
  getProviderStatusIntent,
  getProviderStatusLabel,
  isIncidentAssignedToCurrentStaff,
  isAssignedToAnotherStaff,
} from './staffIncidentProcessing.js';

test('maps real Incident statuses to operational stages without inventing percentages', () => {
  assert.deepEqual(
    getIncidentProcessingSteps('Assigned').map((step) => step.state),
    ['current', 'pending', 'pending', 'pending'],
  );
  assert.deepEqual(
    getIncidentProcessingSteps('InProgress').map((step) => step.state),
    ['complete', 'current', 'pending', 'pending'],
  );
  assert.deepEqual(
    getIncidentProcessingSteps('SubmittedForApproval').map((step) => step.state),
    ['complete', 'complete', 'current', 'pending'],
  );
  assert.deepEqual(
    getIncidentProcessingSteps('Closed').map((step) => step.state),
    ['complete', 'complete', 'complete', 'complete'],
  );
});

test('keeps NeedRework in the Staff processing stage', () => {
  assert.deepEqual(
    getIncidentProcessingSteps('NeedRework').map((step) => step.state),
    ['complete', 'current', 'pending', 'pending'],
  );
  assert.match(getIncidentNextActionCopy('NeedRework'), /Manager/);
});

test('only identifies a different assignee when both authoritative identifiers exist', () => {
  assert.equal(isAssignedToAnotherStaff(
    { assignedStaffUserId: 'staff-2' },
    { userId: 'staff-1' },
  ), true);
  assert.equal(isAssignedToAnotherStaff(
    { assignedStaffUserId: 'staff-1' },
    { userId: 'staff-1' },
  ), false);
  assert.equal(isAssignedToAnotherStaff(
    { assignedStaffUserId: 'staff-2' },
    {},
  ), false);
});

test('requires authoritative current Staff ownership for execution actions', () => {
  const currentUser = { userId: 'STAFF-1' };

  assert.equal(isIncidentAssignedToCurrentStaff(
    { assignedStaffUserId: 'staff-1' },
    currentUser,
  ), true);
  assert.equal(canStartProviderAssignmentProcessing(
    { assignedStaffUserId: 'staff-1', status: 'Assigned' },
    { providerAssignmentId: 7, reportStatus: 'Reported' },
    currentUser,
  ), true);
  assert.equal(canStartProviderAssignmentProcessing(
    { assignedStaffUserId: 'staff-1', status: 'InProgress' },
    { providerAssignmentId: 7, reportStatus: 'Reported' },
    currentUser,
  ), false);
  assert.equal(canStartProviderAssignmentProcessing(
    { assignedStaffUserId: 'staff-1', status: 'Assigned' },
    { providerAssignmentId: 7, reportStatus: 'InProgress' },
    currentUser,
  ), false);
  assert.equal(canManageIncidentExecution(
    { assignedStaffUserId: 'staff-1', status: 'NeedRework' },
    currentUser,
  ), true);
  assert.equal(canManageIncidentExecution(
    { assignedStaffUserId: 'staff-2', status: 'Assigned' },
    currentUser,
  ), false);
});

test('requires the authoritative Provider assignment relationship before Staff starts processing', () => {
  const incident = { assignedStaffUserId: 'staff-1', status: 'Assigned' };
  const user = { userId: 'staff-1' };

  assert.equal(canStartProviderAssignmentProcessing(incident, null, user), false);
  assert.equal(canStartProviderAssignmentProcessing(incident, {}, user), false);
  assert.equal(canStartProviderAssignmentProcessing(
    incident,
    { providerAssignmentId: 7, reportStatus: 'Reported' },
    user,
  ), true);
});

test('maps only returned Provider statuses to Vietnamese text and semantic intent', () => {
  assert.equal(getProviderStatusLabel('InProgress'), 'Đang thực hiện');
  assert.equal(getProviderStatusLabel('Done'), 'Hoàn thành');
  assert.equal(getProviderStatusLabel('Unexpected'), 'Chưa xác định');
  assert.equal(getProviderStatusIntent('Done'), 'success');
  assert.equal(getProviderStatusIntent('Failed'), 'danger');
});
