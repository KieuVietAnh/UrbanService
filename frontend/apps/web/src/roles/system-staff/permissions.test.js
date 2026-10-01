import test from 'node:test';
import assert from 'node:assert/strict';

import systemStaffPermissions, {
  SYSTEM_STAFF_REPORT_ACTIONS,
  canSystemStaffPerformReportAction,
  getSystemStaffLegacyRouteRedirect,
} from './permissions.js';

test('Staff chỉ được dùng Report để tra cứu và phối hợp thông tin', () => {
  assert.equal(canSystemStaffPerformReportAction(SYSTEM_STAFF_REPORT_ACTIONS.VIEW_REPORT), true);
  assert.equal(canSystemStaffPerformReportAction(SYSTEM_STAFF_REPORT_ACTIONS.REQUEST_INFORMATION), true);
  assert.equal(canSystemStaffPerformReportAction(SYSTEM_STAFF_REPORT_ACTIONS.MESSAGE_RESIDENT), true);
});

test('Staff không thể thực hiện các quyết định thuộc Manager', () => {
  [
    SYSTEM_STAFF_REPORT_ACTIONS.VERIFY_REPORT,
    SYSTEM_STAFF_REPORT_ACTIONS.REJECT_REPORT,
    SYSTEM_STAFF_REPORT_ACTIONS.ASSIGN_STAFF,
    SYSTEM_STAFF_REPORT_ACTIONS.ASSIGN_PROVIDER_FROM_REPORT,
    SYSTEM_STAFF_REPORT_ACTIONS.UPDATE_GENERIC_STATUS,
    SYSTEM_STAFF_REPORT_ACTIONS.DECIDE_INCIDENT_MATCH,
    SYSTEM_STAFF_REPORT_ACTIONS.APPROVE_RESOLUTION,
    SYSTEM_STAFF_REPORT_ACTIONS.REQUEST_REWORK,
  ].forEach((action) => assert.equal(canSystemStaffPerformReportAction(action), false));

  assert.deepEqual(systemStaffPermissions, ['ticket:view-all', 'ticket:chat']);
});

test('route Staff legacy được chuyển đến màn hình chỉ đọc hoặc xử lý Incident', () => {
  assert.equal(getSystemStaffLegacyRouteRedirect('/staff/queue'), '/staff/feedbacks');
  assert.equal(getSystemStaffLegacyRouteRedirect('/staff/duplicates/candidate-1'), '/staff/incidents');
  assert.equal(getSystemStaffLegacyRouteRedirect('/tickets/assign/report-1'), '/staff/incidents');
  assert.equal(getSystemStaffLegacyRouteRedirect('/staff/provider-reports/42'), '/staff/incidents');
  assert.equal(getSystemStaffLegacyRouteRedirect('/staff/provider-candidates-checker'), '/staff/coordinators');
  assert.equal(getSystemStaffLegacyRouteRedirect('/staff/incidents/incident-1'), null);
});
