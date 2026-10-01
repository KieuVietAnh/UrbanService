import test from 'node:test';
import assert from 'node:assert/strict';

import sidebarMenu from './sidebarMenu.js';
import systemStaffSidebarMenu from '../system-staff/sidebarMenu.js';

test('exposes the Manager report verification queue in navigation', () => {
  const reviewItem = sidebarMenu.find((item) => item.path === '/manager/reports/review');

  assert.deepEqual(reviewItem, {
    name: 'Xác nhận phản ánh',
    path: '/manager/reports/review',
    icon: 'ClipboardCheck',
  });
});

test('exposes the Manager Incident Match queue in navigation', () => {
  const matchItem = sidebarMenu.find((item) => item.path === '/manager/incident-matches');

  assert.deepEqual(matchItem, {
    name: 'Đề xuất cùng sự vụ',
    path: '/manager/incident-matches',
    icon: 'GitCompareArrows',
  });
});

test('exposes Manager Incident management in navigation', () => {
  const incidentItem = sidebarMenu.find((item) => item.path === '/manager/incidents');

  assert.deepEqual(incidentItem, {
    name: 'Quản lý sự vụ',
    path: '/manager/incidents',
    icon: 'BriefcaseBusiness',
  });
});

test('does not keep Incident Match ownership in Staff navigation', () => {
  assert.equal(
    systemStaffSidebarMenu.some((item) => item.path === '/staff/duplicates'),
    false,
  );
});
