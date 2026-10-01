import test from 'node:test';
import assert from 'node:assert/strict';
import { getBadgeIntent } from './badgeSemantics.js';

test('maps feedback statuses to shared intents', () => {
  assert.equal(getBadgeIntent('Submitted', 'status'), 'info');
  assert.equal(getBadgeIntent('InProgress', 'status'), 'warning');
  assert.equal(getBadgeIntent('Resolved', 'status'), 'success');
  assert.equal(getBadgeIntent('Rejected', 'status'), 'danger');
});

test('maps priority and severity values to shared intents', () => {
  assert.equal(getBadgeIntent('Critical', 'priority'), 'danger');
  assert.equal(getBadgeIntent('High', 'priority'), 'warning');
  assert.equal(getBadgeIntent('Medium', 'severity'), 'info');
  assert.equal(getBadgeIntent('Low', 'severity'), 'neutral');
});

test('maps action values to shared intents', () => {
  assert.equal(getBadgeIntent('delete', 'action'), 'danger');
  assert.equal(getBadgeIntent('create', 'action'), 'success');
  assert.equal(getBadgeIntent('update', 'action'), 'warning');
});
