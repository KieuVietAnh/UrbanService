import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAuthPath, getSafeInternalPath } from './authRedirect.js';

test('getSafeInternalPath accepts local routes and rejects external redirects', () => {
  assert.equal(getSafeInternalPath('/messenger/link?token=abc'), '/messenger/link?token=abc');
  assert.equal(getSafeInternalPath('https://attacker.example'), '');
  assert.equal(getSafeInternalPath('//attacker.example/path'), '');
  assert.equal(getSafeInternalPath('/\\attacker.example/path'), '');
});

test('buildAuthPath preserves existing query parameters and encodes redirect', () => {
  assert.equal(
    buildAuthPath('/register?mode=edit', '/messenger/link?token=abc'),
    '/register?mode=edit&redirect=%2Fmessenger%2Flink%3Ftoken%3Dabc',
  );
});
