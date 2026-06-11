// src/roles/administrator/dashboardConfig.js
export default {
  widgets: [
    { id: 'system-status', type: 'system-stats-panel', gridSpan: 'col-span-12' },
    { id: 'api-perf', type: 'system-api-performance', gridSpan: 'col-span-6 md:col-span-6' },
    { id: 'integration-status', type: 'system-integration-grid', gridSpan: 'col-span-6 md:col-span-6' },
    { id: 'audit-logs-brief', type: 'audit-logs-summary', gridSpan: 'col-span-12' }
  ]
};
