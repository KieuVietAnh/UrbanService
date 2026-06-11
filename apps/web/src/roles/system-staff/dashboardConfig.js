// src/roles/system-staff/dashboardConfig.js
export default {
  widgets: [
    { id: 'queue-overview', type: 'staff-stats', gridSpan: 'col-span-12' },
    { id: 'unassigned-tickets', type: 'unassigned-table', gridSpan: 'col-span-8 md:col-span-8' },
    { id: 'recent-history', type: 'status-timeline-history', gridSpan: 'col-span-4 md:col-span-4' }
  ]
};
