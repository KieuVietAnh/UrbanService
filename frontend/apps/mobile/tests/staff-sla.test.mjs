import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { axiosClient, slaApi } from '@urbanmind/shared-api';
import {
  formatSlaRemaining,
  normalizeIncidentSlaStatus,
} from '../src/features/staff/staff-sla-models.ts';

const resolver = registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === './staff-sla-models' && context.parentURL?.includes('/features/staff/')) {
    return nextResolve(specifier + '.ts', context);
  }
  return nextResolve(specifier, context);
} });
const { staffSlaApi, staffSlaKeys } = await import('../src/features/staff/staff-sla-api.ts');
resolver.deregister();

test('normalizes the backend Incident SLA without a client-side countdown', () => {
  const status = normalizeIncidentSlaStatus({
    incidentId: 'incident-1', incidentSlaId: 15, status: 'Running', serverTime: '2026-09-01T08:00:00Z',
    responseStatus: 'Met', responseDueAt: '2026-09-01T06:00:00Z', responseRemainingMinutes: 0,
    responseRemainingSeconds: 0, responseProgressPercent: 100, isResponseWarning: false, isResponseBreached: false,
    resolutionStatus: 'Warning', resolutionDueAt: '2026-09-01T10:00:00Z', resolutionRemainingMinutes: 120,
    resolutionProgressPercent: 80.4, isResolutionWarning: true, isResolutionBreached: false,
  }, 'incident-1');
  assert.equal(status.incidentId, 'incident-1');
  assert.equal(status.response.remainingSeconds, 0, 'exact seconds win over the minutes fallback');
  assert.equal(status.resolution.remainingSeconds, 7200);
  assert.equal(status.resolution.progressPercent, 80.4);
  assert.equal(status.resolution.warning, true);
  assert.equal(formatSlaRemaining(-3660, false), 'Quá hạn 1 giờ 1 phút');
  assert.equal(formatSlaRemaining(30, false), 'Còn dưới 1 phút');
  assert.throws(() => normalizeIncidentSlaStatus({ incidentId: 'another-incident', status: 'Running' }, 'incident-1'), /không thuộc sự vụ/);
  assert.throws(() => normalizeIncidentSlaStatus({}, 'incident-1'), /không hợp lệ/);
});

test('SLA API forwards React Query cancellation and preserves authenticated shared client behavior', async () => {
  const signal = new AbortController().signal;
  const get = mock.method(axiosClient, 'get', async () => ({
    incidentId: 'incident%2F1', status: 'Running', resolutionRemainingSeconds: 90,
  }));
  try {
    const result = await slaApi.getIncidentSlaStatus('incident%2F1', { signal });
    assert.equal(result.incidentId, 'incident%2F1');
    assert.deepEqual(get.mock.calls[0].arguments, ['/api/slas/incident/incident%2F1/status', { signal }]);
  } finally { get.mock.restore(); }
});

test('mobile SLA queries are scoped by Staff and Incident', async () => {
  const signal = new AbortController().signal;
  const getStatus = mock.method(slaApi, 'getIncidentSlaStatus', async () => ({
    incidentId: 'incident-1', status: 'Running', responseRemainingSeconds: 60,
  }));
  try {
    const result = await staffSlaApi.incidentStatus(' incident-1 ', signal);
    assert.equal(result.incidentId, 'incident-1');
    assert.deepEqual(getStatus.mock.calls[0].arguments, ['incident-1', { signal }]);
    assert.notDeepEqual(staffSlaKeys.incident('staff-1', 'incident-1'), staffSlaKeys.incident('staff-2', 'incident-1'));
    assert.notDeepEqual(staffSlaKeys.incident('staff-1', 'incident-1'), staffSlaKeys.incident('staff-1', 'incident-2'));
  } finally { getStatus.mock.restore(); }
});

test('only a real 404 becomes an empty SLA; other failures remain visible', async () => {
  const getStatus = mock.method(slaApi, 'getIncidentSlaStatus', async () => {
    const error = new Error('Missing');
    error.status = 404;
    throw error;
  });
  try {
    assert.equal(await staffSlaApi.incidentStatus('incident-1'), null);
    getStatus.mock.mockImplementation(async () => {
      const error = new Error('Forbidden');
      error.status = 403;
      throw error;
    });
    await assert.rejects(staffSlaApi.incidentStatus('incident-1'), /Forbidden/);
    await assert.rejects(staffSlaApi.incidentStatus('   '), /Thiếu mã sự vụ/);
  } finally { getStatus.mock.restore(); }
});
