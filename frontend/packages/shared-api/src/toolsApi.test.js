import test from 'node:test';
import assert from 'node:assert/strict';

import { toolsApi } from './toolsApi.js';

test('toolsApi returns safe defaults for optional reference collections', async () => {
  assert.deepEqual(await toolsApi.getAreas(), []);
  assert.deepEqual(await toolsApi.getOperators(), []);
  assert.deepEqual(await toolsApi.getTickets(), []);
});

test('toolsApi throws when getAreas is asked to fail on error', async () => {
  await assert.rejects(() => toolsApi.getAreas({}, { throwOnError: true }));
});
