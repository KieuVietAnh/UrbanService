import test from 'node:test';
import assert from 'node:assert/strict';

import { buildManagerDashboardStats, managerMetricValue } from './managerDashboardUtils.mjs';

test('keeps stale manager sections when a refresh endpoint fails', () => {
  const previous = {
    managerOverview: { totalIncident: 12, assigned: 3 },
    categoryDistribution: [{ categoryName: 'A', count: 4 }],
    urgentOpen: [{ incidentId: 'I-1' }],
  };

  const result = buildManagerDashboardStats(
    { apiStatus: 'Ổn định' },
    {
      overview: null,
      categoryDistribution: null,
      statusDistribution: null,
      areaDistribution: null,
      monthlyTrend: null,
      urgentOpen: null,
      slaOverview: null,
      dataIssues: ['KPI sự vụ'],
    },
    previous,
  );

  assert.deepEqual(result.managerOverview, previous.managerOverview);
  assert.deepEqual(result.categoryDistribution, previous.categoryDistribution);
  assert.deepEqual(result.urgentOpen, previous.urgentOpen);
  assert.deepEqual(result.managerDataIssues, ['KPI sự vụ']);
  assert.equal(result.managerOverviewAvailable, true);
});

test('marks manager overview unavailable instead of presenting a fake zero', () => {
  const result = buildManagerDashboardStats({}, { overview: null, dataIssues: ['KPI sự vụ'] }, {});
  assert.equal(result.managerOverviewAvailable, false);
  assert.equal(result.managerOverview, null);
  assert.equal(managerMetricValue(false, 0), '—');
  assert.equal(managerMetricValue(true, 0), 0);
});
