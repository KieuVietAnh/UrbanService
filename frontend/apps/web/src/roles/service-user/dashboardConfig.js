// src/roles/service-user/dashboardConfig.js
export default {
  widgets: [
    { id: 'ticket-summary', type: 'summary-cards', gridSpan: 'col-span-12' },
    { id: 'recent-activity', type: 'my-tickets-list', gridSpan: 'col-span-8 md:col-span-8' },
    { id: 'impact-score', type: 'citizen-reputation', gridSpan: 'col-span-4 md:col-span-4' }
  ]
};
