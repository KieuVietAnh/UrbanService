import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

import { managementFeedbackApi } from '@urbanmind/shared-api';
import {
  createAdminFeedbackDeleteGuard,
  deleteAdminFeedbackAndReconcile,
} from './adminFeedbackDeletion.js';
import {
  invalidateAdminFeedbackDetail,
  loadAdminFeedbackDetail,
  peekAdminFeedbackDetail,
} from './cache/adminFeedbackDetailCache.js';

test('deleteAdminFeedbackAndReconcile mutates list and cache only after DELETE succeeds', async () => {
  const getFeedbackById = mock.method(managementFeedbackApi, 'getFeedbackById', async (feedbackId) => ({
    feedbackId,
    title: 'Cached detail',
  }));
  const deleteFeedback = mock.method(managementFeedbackApi, 'deleteFeedback', async (feedbackId) => {
    if (feedbackId === 'failed-feedback') {
      throw new Error('Delete failed');
    }
  });
  const feedbacks = [
    { feedbackId: 'deleted-feedback', status: 'Submitted' },
    { feedbackId: 'failed-feedback', status: 'Closed' },
  ];
  const summary = { total: 2, pending: 1, inProgress: 0, completed: 1 };

  try {
    await loadAdminFeedbackDetail('deleted-feedback');
    await loadAdminFeedbackDetail('failed-feedback');

    const success = await deleteAdminFeedbackAndReconcile({
      feedbackId: 'deleted-feedback',
      feedbacks,
      summary,
    });

    assert.deepEqual(success.feedbacks, [
      { feedbackId: 'failed-feedback', status: 'Closed' },
    ]);
    assert.deepEqual(success.summary, {
      total: 1,
      pending: 0,
      inProgress: 0,
      completed: 1,
    });
    assert.equal(peekAdminFeedbackDetail('deleted-feedback'), null);

    await assert.rejects(
      () => deleteAdminFeedbackAndReconcile({
        feedbackId: 'failed-feedback',
        feedbacks,
        summary,
      }),
      /Delete failed/
    );
    assert.equal(peekAdminFeedbackDetail('failed-feedback')?.title, 'Cached detail');
    assert.deepEqual(feedbacks, [
      { feedbackId: 'deleted-feedback', status: 'Submitted' },
      { feedbackId: 'failed-feedback', status: 'Closed' },
    ]);
    assert.deepEqual(summary, { total: 2, pending: 1, inProgress: 0, completed: 1 });
  } finally {
    getFeedbackById.mock.restore();
    deleteFeedback.mock.restore();
    invalidateAdminFeedbackDetail('deleted-feedback');
    invalidateAdminFeedbackDetail('failed-feedback');
  }
});

test('createAdminFeedbackDeleteGuard allows one request at a time and unlocks for retry', async () => {
  const pendingRequest = Promise.withResolvers();
  const guard = createAdminFeedbackDeleteGuard();
  let requestCount = 0;

  const firstRun = guard.run(async () => {
    requestCount += 1;
    await pendingRequest.promise;
  });
  const duplicateRun = guard.run(async () => {
    requestCount += 1;
  });

  assert.equal(guard.isRunning(), true);
  assert.equal(await duplicateRun, false);
  assert.equal(requestCount, 1);

  pendingRequest.resolve();
  assert.equal(await firstRun, true);
  assert.equal(guard.isRunning(), false);

  assert.equal(await guard.run(async () => {
    requestCount += 1;
  }), true);
  assert.equal(requestCount, 2);
});
