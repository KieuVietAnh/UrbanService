import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getStaffFlowScrollBehavior,
  scrollToStaffIncidentFlowTarget,
} from './staffIncidentFlowNavigation.js';

test('uses smooth scrolling by default and respects reduced motion', () => {
  assert.equal(getStaffFlowScrollBehavior({ matchMedia: () => ({ matches: false }) }), 'smooth');
  assert.equal(getStaffFlowScrollBehavior({ matchMedia: () => ({ matches: true }) }), 'auto');
});

test('scrolls the requested flow step into view', () => {
  const calls = [];
  const target = { scrollIntoView: (options) => calls.push(options) };
  const didScroll = scrollToStaffIncidentFlowTarget('next-step', {
    documentRef: { getElementById: (id) => id === 'next-step' ? target : null },
    windowRef: {
      matchMedia: () => ({ matches: false }),
      setTimeout: () => 0,
    },
  });

  assert.equal(didScroll, true);
  assert.deepEqual(calls, [{ behavior: 'smooth', block: 'start', inline: 'nearest' }]);
});

test('retries when the next step has not mounted yet', () => {
  let lookupCount = 0;
  let scrollCount = 0;
  const queuedCallbacks = [];
  const didScrollImmediately = scrollToStaffIncidentFlowTarget('late-step', {
    documentRef: {
      getElementById: () => {
        lookupCount += 1;
        return lookupCount >= 2 ? { scrollIntoView: () => { scrollCount += 1; } } : null;
      },
    },
    windowRef: {
      matchMedia: () => ({ matches: true }),
      setTimeout: (callback) => {
        queuedCallbacks.push(callback);
        return queuedCallbacks.length;
      },
    },
    retryDelays: [50],
  });

  assert.equal(didScrollImmediately, false);
  queuedCallbacks.forEach((callback) => callback());
  assert.equal(scrollCount, 1);
});
