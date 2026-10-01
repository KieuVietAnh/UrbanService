import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { axiosClient } from './axiosClient.js';
import { messengerAccountLinkApi } from './messengerAccountLinkApi.js';

afterEach(() => {
  mock.restoreAll();
});

test('confirm trims token and posts to the Messenger link endpoint', async () => {
  const post = mock.method(axiosClient, 'post', async () => ({
    data: { linkId: 12, isActive: true },
  }));

  const result = await messengerAccountLinkApi.confirm('  one-time-token  ');

  assert.deepEqual(post.mock.calls[0].arguments, [
    '/api/user/messenger-links/confirm',
    { token: 'one-time-token' },
  ]);
  assert.deepEqual(result, { linkId: 12, isActive: true });
});

test('getLinks normalizes a non-array response to an empty list', async () => {
  mock.method(axiosClient, 'get', async () => ({ data: null }));

  const result = await messengerAccountLinkApi.getLinks();

  assert.deepEqual(result, []);
});
