import test from 'node:test';
import assert from 'node:assert/strict';
import managerSidebarMenu from './sidebarMenu.js';

test('does not show local-only Settings in Manager sidebar', () => {
  assert.equal(managerSidebarMenu.some((item) => item.path === '/settings'), false);
});
