import test from 'node:test';
import assert from 'node:assert/strict';

import { getHeaderBreadcrumbOverride } from './headerBreadcrumbs.js';

test('uses a concise Vietnamese breadcrumb for Manager report review queue', () => {
  assert.deepEqual(getHeaderBreadcrumbOverride('/manager/reports/review'), [
    { label: 'Duyệt phản ánh', href: null },
  ]);
});

test('does not override unrelated routes', () => {
  assert.equal(getHeaderBreadcrumbOverride('/analytics/sentiment'), null);
});

test('uses Vietnamese breadcrumb for negative sentiment drill-down', () => {
  assert.deepEqual(getHeaderBreadcrumbOverride('/analytics/sentiment/negative'), [
    { label: 'Cảm xúc người dân', href: '/analytics/sentiment' },
    { label: 'Phản ánh tiêu cực', href: null },
  ]);
});


test('uses Vietnamese breadcrumb for notifications', () => {
  assert.deepEqual(getHeaderBreadcrumbOverride('/notifications'), [
    { label: 'Thông báo', href: null },
  ]);
});
