import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

import { managementFeedbackApi } from '@urbanmind/shared-api';
import {
  invalidateAdminFeedbackDetail,
  loadAdminFeedbackDetail,
  peekAdminFeedbackDetail,
} from './adminFeedbackDetailCache.js';

test('invalidateAdminFeedbackDetail evicts cached data and blocks stale in-flight writes', async () => {
  const staleRequest = Promise.withResolvers();
  const freshRequest = Promise.withResolvers();
  let raceRequestCount = 0;
  const getFeedbackById = mock.method(managementFeedbackApi, 'getFeedbackById', (feedbackId) => {
    if (feedbackId === 'cached-feedback') {
      return Promise.resolve({ feedbackId, title: 'Cached' });
    }

    raceRequestCount += 1;
    return raceRequestCount === 1 ? staleRequest.promise : freshRequest.promise;
  });

  try {
    await loadAdminFeedbackDetail('cached-feedback');
    assert.equal(peekAdminFeedbackDetail('cached-feedback')?.title, 'Cached');

    invalidateAdminFeedbackDetail('cached-feedback');
    assert.equal(peekAdminFeedbackDetail('cached-feedback'), null);

    const staleLoad = loadAdminFeedbackDetail('race-feedback');
    invalidateAdminFeedbackDetail('race-feedback');
    const freshLoad = loadAdminFeedbackDetail('race-feedback');

    staleRequest.resolve({ feedbackId: 'race-feedback', title: 'Stale' });
    await staleLoad;
    assert.equal(peekAdminFeedbackDetail('race-feedback'), null);

    freshRequest.resolve({ feedbackId: 'race-feedback', title: 'Fresh' });
    await freshLoad;
    assert.equal(peekAdminFeedbackDetail('race-feedback')?.title, 'Fresh');
  } finally {
    getFeedbackById.mock.restore();
    invalidateAdminFeedbackDetail('cached-feedback');
    invalidateAdminFeedbackDetail('race-feedback');
  }
});

test('detail cache treats GUID casing as the same feedback key', async () => {
  const upperCaseId = 'A0B1C2D3-E4F5-4678-9012-ABCDEF123456';
  const lowerCaseId = upperCaseId.toLowerCase();
  const getFeedbackById = mock.method(managementFeedbackApi, 'getFeedbackById', async (feedbackId) => ({
    feedbackId,
    title: 'Case-insensitive detail',
  }));

  try {
    await loadAdminFeedbackDetail(upperCaseId);

    assert.equal(getFeedbackById.mock.calls[0].arguments[0], lowerCaseId);
    assert.equal(peekAdminFeedbackDetail(lowerCaseId)?.title, 'Case-insensitive detail');

    invalidateAdminFeedbackDetail(lowerCaseId);
    assert.equal(peekAdminFeedbackDetail(upperCaseId), null);
  } finally {
    getFeedbackById.mock.restore();
    invalidateAdminFeedbackDetail(lowerCaseId);
  }
});
