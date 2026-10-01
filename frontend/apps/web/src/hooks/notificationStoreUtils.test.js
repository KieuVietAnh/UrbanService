import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRemainingNotificationPages, mergeNotificationPage, readNotificationTotal } from './notificationStoreUtils.js';

test('reads server totalItems instead of loaded item count', () => {
  assert.equal(readNotificationTotal({ items: [1, 2], totalItems: 57 }), 57);
  assert.equal(readNotificationTotal({ items: [1, 2] }), 2);
});

test('appends notification pages without duplicating notificationId', () => {
  const merged = mergeNotificationPage(
    [{ notificationId: 1 }, { notificationId: 2 }],
    [{ notificationId: 2 }, { notificationId: 3 }],
  );
  assert.deepEqual(merged.map((item) => item.notificationId), [1, 2, 3]);
});

test('builds remaining notification page numbers after page one', () => {
  assert.deepEqual(buildRemainingNotificationPages(1), []);
  assert.deepEqual(buildRemainingNotificationPages(4), [2, 3, 4]);
  assert.deepEqual(buildRemainingNotificationPages('3'), [2, 3]);
});
