import test from 'node:test';
import assert from 'node:assert/strict';
import { getAttachmentUrl } from './index.js';

test('getAttachmentUrl resolves common attachment field names', () => {
  assert.equal(getAttachmentUrl({ fileUrl: 'https://cdn.example.com/photo.jpg' }), 'https://cdn.example.com/photo.jpg');
  assert.equal(getAttachmentUrl({ url: 'https://cdn.example.com/photo.jpg' }), 'https://cdn.example.com/photo.jpg');
  assert.equal(getAttachmentUrl({ path: '/uploads/photo.jpg' }), '/uploads/photo.jpg');
});

test('getAttachmentUrl returns null for missing values', () => {
  assert.equal(getAttachmentUrl(null), null);
  assert.equal(getAttachmentUrl({}), null);
});
