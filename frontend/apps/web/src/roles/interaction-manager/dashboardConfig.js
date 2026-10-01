// src/roles/interaction-manager/dashboardConfig.js
export default {
  widgets: [
    { id: 'manager-indicators', type: 'manager-kpi-row', gridSpan: 'col-span-12' },
    { id: 'sentiment-over-time', type: 'manager-sentiment-donut', gridSpan: 'col-span-6 md:col-span-6' },
    { id: 'sla-compliance', type: 'manager-sla-compliance-chart', gridSpan: 'col-span-6 md:col-span-6' },
    { id: 'escalated-list', type: 'escalated-tickets-table', gridSpan: 'col-span-12' }
  ]
};
