import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateStaffIncidentKpis,
  calculateStaffIncidentSlaKpis,
  fetchAllAssignedStaffIncidents,
  fetchAssignedIncidentSlaStatuses,
  getStaffIncidentPriorityLabel,
  getStaffIncidentSeverityLabel,
  getStaffIncidentStatusLabel,
  sortStaffIncidentsForAttention,
} from './staffIncidentDashboard.js';

test('counts only the four active Staff workflow statuses', () => {
  const metrics = calculateStaffIncidentKpis([
    { status: 'Assigned' },
    { status: 'in_progress' },
    { status: 'NeedRework' },
    { status: 'SubmittedForApproval' },
    { status: 'Approved' },
    { status: 'Closed' },
    { status: 'Unknown' },
  ]);

  assert.deepEqual(metrics, {
    assigned: 1,
    inProgress: 1,
    needRework: 1,
    pendingApproval: 1,
    totalActive: 4,
  });
});

test('orders attention work by rework, severity, priority, then latest update', () => {
  const incidents = [
    { incidentId: 'resolved', status: 'Resolved', severity: 'Critical' },
    { incidentId: 'priority', status: 'Assigned', severity: 'High', priority: 'Critical', updatedAt: '2026-09-07T08:00:00Z' },
    { incidentId: 'severity', status: 'InProgress', severity: 'Critical', priority: 'Low', updatedAt: '2026-09-06T08:00:00Z' },
    { incidentId: 'latest', status: 'Assigned', severity: 'High', priority: 'Critical', updatedAt: '2026-09-07T10:00:00Z' },
    { incidentId: 'rework', status: 'NeedRework', severity: 'Low', priority: 'Low', updatedAt: '2026-09-01T08:00:00Z' },
  ];

  const sorted = sortStaffIncidentsForAttention(incidents);

  assert.deepEqual(sorted.map((incident) => incident.incidentId), [
    'rework',
    'severity',
    'latest',
    'priority',
  ]);
  assert.equal(incidents[0].incidentId, 'resolved');
});

test('counts Incident SLA warnings and breaches once per assigned Incident', () => {
  const metrics = calculateStaffIncidentSlaKpis({
    healthy: {
      incidentId: 'healthy',
      isResponseWarning: false,
      isResolutionWarning: false,
    },
    warning: {
      incidentId: 'warning',
      isResponseWarning: true,
      isResolutionWarning: true,
    },
    breached: {
      incidentId: 'breached',
      isResponseWarning: true,
      isResolutionBreached: true,
    },
  });

  assert.deepEqual(metrics, {
    tracked: 3,
    nearingBreach: 1,
    breached: 1,
    healthy: 1,
  });
});

test('prioritizes overdue and nearing-breach Incidents in the attention list', () => {
  const incidents = [
    { incidentId: 'normal-rework', status: 'NeedRework', severity: 'Critical' },
    { incidentId: 'warning', status: 'Assigned', severity: 'Low' },
    { incidentId: 'breached', status: 'Assigned', severity: 'Low' },
  ];

  const sorted = sortStaffIncidentsForAttention(incidents, {
    warning: { incidentId: 'warning', isResolutionWarning: true },
    breached: { incidentId: 'breached', isResponseBreached: true },
  });

  assert.deepEqual(sorted.map((incident) => incident.incidentId), [
    'breached',
    'warning',
    'normal-rework',
  ]);
});

test('maps only known workflow, priority and severity values to Vietnamese', () => {
  assert.equal(getStaffIncidentStatusLabel('SubmittedForApproval'), 'Chờ duyệt');
  assert.equal(getStaffIncidentStatusLabel('Need_Rework'), 'Cần xử lý lại');
  assert.equal(getStaffIncidentStatusLabel('Other'), 'Chưa xác định');
  assert.equal(getStaffIncidentPriorityLabel('Critical'), 'Khẩn cấp');
  assert.equal(getStaffIncidentPriorityLabel(null), 'Chưa có dữ liệu');
  assert.equal(getStaffIncidentSeverityLabel('Major'), 'Cao');
});

test('loads every assigned Incident page before returning dashboard data', async () => {
  const calls = [];
  const getIncidents = async (params, options) => {
    calls.push({ params, options });
    if (params.pageNumber === 1) {
      return {
        items: [
          { incidentId: 'incident-1', status: 'Assigned' },
          { incidentId: 'incident-2', status: 'InProgress' },
        ],
        totalItems: 3,
        totalPages: 2,
      };
    }

    return {
      items: [{ incidentId: 'incident-3', status: 'NeedRework' }],
      totalItems: 3,
      totalPages: 2,
    };
  };

  const result = await fetchAllAssignedStaffIncidents({
    getIncidents,
    assignedStaffUserId: 'staff-user-id',
  });

  assert.equal(result.totalItems, 3);
  assert.deepEqual(result.incidents.map((incident) => incident.incidentId), [
    'incident-1',
    'incident-2',
    'incident-3',
  ]);
  assert.deepEqual(calls.map(({ params }) => params.pageNumber), [1, 2]);
  calls.forEach(({ params }) => {
    assert.equal(params.assignedStaffUserId, 'staff-user-id');
    assert.equal(params.includeMerged, false);
    assert.equal(params.pageSize, 100);
  });
});

test('fails closed instead of calculating KPI from incomplete pagination', async () => {
  await assert.rejects(
    fetchAllAssignedStaffIncidents({
      assignedStaffUserId: 'staff-user-id',
      getIncidents: async () => ({
        items: [{ incidentId: 'incident-1' }],
        totalItems: 2,
        totalPages: 1,
      }),
    }),
    /INCOMPLETE_STAFF_INCIDENT_DATA/,
  );
});

test('loads SLA status only for active assigned Incidents and tolerates missing SLA records', async () => {
  const calls = [];
  const result = await fetchAssignedIncidentSlaStatuses({
    incidents: [
      { incidentId: 'assigned', status: 'Assigned' },
      { incidentId: 'missing', status: 'InProgress' },
      { incidentId: 'failed', status: 'NeedRework' },
      { incidentId: 'closed', status: 'Closed' },
    ],
    batchSize: 2,
    getIncidentSlaStatus: async (incidentId) => {
      calls.push(incidentId);
      if (incidentId === 'missing') {
        const error = new Error('Not found');
        error.response = { status: 404 };
        throw error;
      }
      if (incidentId === 'failed') throw new Error('Network error');
      return { incidentId, isResolutionWarning: true };
    },
  });

  assert.deepEqual(calls, ['assigned', 'missing', 'failed']);
  assert.deepEqual(Object.keys(result.slaByIncidentId), ['assigned']);
  assert.equal(result.requestedCount, 3);
  assert.equal(result.failedCount, 1);
});
