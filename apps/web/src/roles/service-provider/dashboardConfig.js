// src/roles/service-provider/dashboardConfig.js
export default {
  widgets: [
    { id: 'provider-summary', type: 'provider-stats', gridSpan: 'col-span-12' },
    { id: 'my-tasks', type: 'assigned-tasks-table', gridSpan: 'col-span-8 md:col-span-8' },
    { id: 'sla-countdown', type: 'sla-timers-panel', gridSpan: 'col-span-4 md:col-span-4' }
  ]
};
