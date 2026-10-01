import test from 'node:test';
import assert from 'node:assert/strict';

import { hasStaffIncidentScopeMismatch } from './staffIncidentScope.js';

test('accepts incidents assigned to the requested Staff account', () => {
  assert.equal(hasStaffIncidentScopeMismatch([
    { incidentId: 'incident-1', assignedStaffUserId: 'staff-1' },
    { incidentId: 'incident-2', assignedStaffUserId: 'staff-1' },
  ], 'staff-1'), false);
});

test('allows a missing row assignee because the backend query remains authoritative', () => {
  assert.equal(hasStaffIncidentScopeMismatch([
    { incidentId: 'incident-1' },
  ], 'staff-1'), false);
});

test('fails closed when the backend returns an incident assigned to another Staff account', () => {
  assert.equal(hasStaffIncidentScopeMismatch([
    { incidentId: 'incident-1', assignedStaffUserId: 'staff-2' },
  ], 'staff-1'), true);
});
