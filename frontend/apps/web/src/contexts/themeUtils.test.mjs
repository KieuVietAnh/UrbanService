import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeThemeValue } from './themeUtils.mjs';

test('normalizeThemeValue migrates legacy corporate theme to light', () => {
  assert.equal(normalizeThemeValue('corporate'), 'light');
});

test('normalizeThemeValue preserves supported themes', () => {
  assert.equal(normalizeThemeValue('light'), 'light');
  assert.equal(normalizeThemeValue('dark'), 'dark');
});

test('normalizeThemeValue falls back to light for unsupported values', () => {
  assert.equal(normalizeThemeValue('unknown'), 'light');
  assert.equal(normalizeThemeValue(null), 'light');
});
