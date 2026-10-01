import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatStaffIncidentSlaRemaining,
  getStaffIncidentSlaMetric,
  getStaffIncidentSlaState,
  getStaffIncidentSlaStatusLabel,
  validateStaffIncidentSlaStatus,
} from './staffIncidentSla.js';

test('validates that SLA status belongs to the Incident being viewed', () => {
  const sla = { incidentId: 'incident-1', status: 'Active' };
  assert.equal(validateStaffIncidentSlaStatus(sla, 'INCIDENT-1'), sla);
  assert.equal(validateStaffIncidentSlaStatus(null, 'incident-1'), null);
  assert.throws(
    () => validateStaffIncidentSlaStatus(sla, 'incident-2'),
    /không thuộc sự vụ/,
  );
});

test('normalizes response and resolution SLA metrics from the Swagger DTO', () => {
  const sla = {
    incidentId: 'incident-1',
    responseStatus: 'Warning',
    responseRemainingSeconds: 600,
    responseProgressPercent: 82.5,
    isResponseWarning: true,
    resolutionStatus: 'Breached',
    resolutionRemainingSeconds: -120,
    resolutionProgressPercent: 125,
    isResolutionBreached: false,
  };

  assert.deepEqual(getStaffIncidentSlaMetric(sla, 'response'), {
    breached: false,
    dueAt: undefined,
    progressPercent: 82.5,
    remainingSeconds: 600,
    status: 'Warning',
    warning: true,
  });
  assert.deepEqual(getStaffIncidentSlaMetric(sla, 'resolution'), {
    breached: true,
    dueAt: undefined,
    progressPercent: 100,
    remainingSeconds: -120,
    status: 'Breached',
    warning: false,
  });
  assert.equal(getStaffIncidentSlaState(sla), 'breached');
});

test('formats remaining SLA time and known statuses in Vietnamese', () => {
  assert.equal(
    formatStaffIncidentSlaRemaining({ remainingSeconds: 3660, breached: false }),
    'Còn 1 giờ 1 phút',
  );
  assert.equal(
    formatStaffIncidentSlaRemaining({ remainingSeconds: -90, breached: true }),
    'Quá hạn 1 phút',
  );
  assert.equal(getStaffIncidentSlaStatusLabel('Need_Rework'), 'Need_Rework');
  assert.equal(getStaffIncidentSlaStatusLabel('breached'), 'Đã quá hạn');
});
