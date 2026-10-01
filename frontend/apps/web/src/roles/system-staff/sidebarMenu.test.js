import test from 'node:test';
import assert from 'node:assert/strict';

import sidebarMenu, { isSystemStaffMenuItemActive, systemStaffSidebarSections } from './sidebarMenu.js';

test('sidebar Staff chỉ hiển thị các chức năng thuộc quyền sở hữu hiện tại', () => {
  assert.deepEqual(sidebarMenu.map((item) => item.path), [
    '/dashboard',
    '/staff/incidents',
    '/staff/feedbacks',
    '/staff/conversations',
    '/staff/area-alerts',
    '/staff/coordinators',
    '/notifications',
    '/profile',
  ]);

  const removedPaths = ['/staff/queue', '/staff/duplicates', '/tickets/assign/:id', '/staff/provider-candidates-checker'];
  removedPaths.forEach((path) => assert.equal(sidebarMenu.some((item) => item.path === path), false));
});

test('sidebar Staff có đủ ba nhóm công việc, phối hợp và tài khoản', () => {
  assert.deepEqual(systemStaffSidebarSections.map((section) => section.title), ['Công việc', 'Phối hợp', 'Tài khoản']);
  assert.deepEqual(systemStaffSidebarSections[0].items.map((item) => item.label), ['Tổng quan', 'Sự vụ của tôi', 'Phản ánh']);
  assert.deepEqual(systemStaffSidebarSections[2].items.map((item) => item.label), ['Thông báo', 'Hồ sơ']);
});

test('menu Sự vụ và Phản ánh vẫn active trên route con hợp lệ', () => {
  const incidentItem = sidebarMenu.find((item) => item.path === '/staff/incidents');
  const reportItem = sidebarMenu.find((item) => item.path === '/staff/feedbacks');

  assert.equal(isSystemStaffMenuItemActive(incidentItem, '/staff/incidents/incident-1'), true);
  assert.equal(isSystemStaffMenuItemActive(reportItem, '/staff/feedbacks/report-1'), true);
  assert.equal(isSystemStaffMenuItemActive(reportItem, '/staff/provider-reports/provider-report-1'), false);
  assert.equal(isSystemStaffMenuItemActive(reportItem, '/staff/duplicates/candidate-1'), false);
});
