import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchAllApprovalSummaryPages } from './approvalSummaryUtils.mjs';

test('loads every SubmittedForApproval summary page', async () => {
  const calls = [];
  const pages = {
    1: { items: [{ id: 1 }], totalItems: 1001, totalPages: 3 },
    2: { items: [{ id: 2 }], totalItems: 1001, totalPages: 3 },
    3: { items: [{ id: 3 }], totalItems: 1001, totalPages: 3 },
  };
  const result = await fetchAllApprovalSummaryPages(async (params) => {
    calls.push(params);
    return pages[params.pageNumber];
  }, { pageSize: 500 });

  assert.deepEqual(result.items.map((item) => item.id), [1, 2, 3]);
  assert.equal(result.totalItems, 1001);
  assert.deepEqual(calls.map((call) => call.pageNumber), [1, 2, 3]);
  assert.ok(calls.every((call) => call.status === 'SubmittedForApproval'));
});
