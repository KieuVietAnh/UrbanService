import test from 'node:test';
import assert from 'node:assert/strict';
import { getApprovalQueueStatus, getApprovalQueueTitle } from './approvalQueueUtils.js';

test('classifies awaiting approval feedback', () => {
  assert.equal(getApprovalQueueStatus({ status: 'SubmittedForApproval' }), 'awaiting');
});

test('classifies rework requests', () => {
  assert.equal(getApprovalQueueStatus({ status: 'NeedRework' }), 'rework');
});

test('builds a human readable title for queue cards', () => {
  assert.equal(getApprovalQueueTitle({ title: 'Broken drain' }), 'Broken drain');
  assert.equal(getApprovalQueueTitle({ description: 'Missing evidence' }), 'Missing evidence');
});
