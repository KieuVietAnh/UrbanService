import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canSubmitIncidentResolution,
  getIncidentResolutionSubmissionMode,
  sortIncidentResolutionsNewestFirst,
  validateIncidentResolutions,
} from './staffIncidentResolution.js';

const currentUser = { userId: 'staff-1' };

test('allows the current assignee to submit the first result while Incident is InProgress', () => {
  const incident = { assignedStaffUserId: 'STAFF-1', status: 'InProgress' };

  assert.equal(getIncidentResolutionSubmissionMode(incident, currentUser, 0), 'initial');
  assert.equal(canSubmitIncidentResolution(incident, currentUser, 0), true);
});

test('does not allow a second initial submission while Incident remains InProgress', () => {
  const incident = { assignedStaffUserId: 'staff-1', status: 'InProgress' };

  assert.equal(getIncidentResolutionSubmissionMode(incident, currentUser, 1), null);
  assert.equal(getIncidentResolutionSubmissionMode(incident, currentUser, 4), null);
});

test('allows the current assignee to resubmit only from NeedRework', () => {
  const incident = { assignedStaffUserId: 'staff-1', status: 'Need_Rework' };

  assert.equal(getIncidentResolutionSubmissionMode(incident, currentUser, 0), 'resubmit');
  assert.equal(getIncidentResolutionSubmissionMode(incident, currentUser, 2), 'resubmit');
});

test('fails closed when the current user is not the authoritative Incident assignee', () => {
  const incident = { assignedStaffUserId: 'staff-2', status: 'NeedRework' };

  assert.equal(getIncidentResolutionSubmissionMode(incident, currentUser, 1), null);
  assert.equal(getIncidentResolutionSubmissionMode(
    { status: 'InProgress' },
    currentUser,
    0,
  ), null);
  assert.equal(getIncidentResolutionSubmissionMode(
    { assignedStaffUserId: 'staff-1', status: 'InProgress' },
    {},
    0,
  ), null);
});

test('fails closed for invalid resolution history counts', () => {
  const incident = { assignedStaffUserId: 'staff-1', status: 'InProgress' };

  for (const invalidCount of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, '0', null]) {
    assert.equal(
      getIncidentResolutionSubmissionMode(incident, currentUser, invalidCount),
      null,
    );
  }
});

test('rejects submission from every non-submit Incident status', () => {
  for (const status of [
    'Assigned',
    'SubmittedForApproval',
    'Approved',
    'Resolved',
    'Closed',
    'Merged',
    '',
  ]) {
    assert.equal(
      getIncidentResolutionSubmissionMode(
        { assignedStaffUserId: 'staff-1', status },
        currentUser,
        0,
      ),
      null,
    );
  }
});

test('validates every resolution against the authoritative Incident identifier', () => {
  assert.equal(validateIncidentResolutions([], 'incident-1'), true);
  assert.equal(validateIncidentResolutions([
    { resolutionId: 1, incidentId: 'INCIDENT-1' },
    { resolutionId: 2, incidentId: 'incident-1' },
  ], 'incident-1'), true);

  assert.equal(validateIncidentResolutions([
    { resolutionId: 1, incidentId: 'incident-2' },
  ], 'incident-1'), false);
  assert.equal(validateIncidentResolutions([
    { resolutionId: 1 },
  ], 'incident-1'), false);
  assert.equal(validateIncidentResolutions([null], 'incident-1'), false);
  assert.equal(validateIncidentResolutions({}, 'incident-1'), false);
  assert.equal(validateIncidentResolutions([], ''), false);
});

test('sorts a copied resolution list by resolvedAt without mutating API data', () => {
  const oldest = { resolutionId: 1, resolvedAt: '2026-08-30T08:00:00Z' };
  const undated = { resolutionId: 2, resolvedAt: null };
  const newest = { resolutionId: 3, resolvedAt: '2026-09-01T08:00:00Z' };
  const resolutions = [oldest, undated, newest];

  assert.deepEqual(
    sortIncidentResolutionsNewestFirst(resolutions).map(({ resolutionId }) => resolutionId),
    [3, 1, 2],
  );
  assert.deepEqual(resolutions, [oldest, undated, newest]);
});

test('keeps equal or unavailable resolution timestamps stable and fails closed on malformed lists', () => {
  const resolutions = [
    { resolutionId: 1, resolvedAt: 'not-a-date' },
    { resolutionId: 2 },
    { resolutionId: 3, resolvedAt: 'not-a-date' },
  ];

  assert.deepEqual(sortIncidentResolutionsNewestFirst(resolutions), resolutions);
  assert.deepEqual(sortIncidentResolutionsNewestFirst(null), []);
  assert.deepEqual(sortIncidentResolutionsNewestFirst([resolutions[0], null]), []);
});
