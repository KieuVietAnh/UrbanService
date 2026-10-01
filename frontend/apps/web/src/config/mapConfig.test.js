import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildExternalMapUrl,
  MAP_GEOCODING_REVERSE_URL,
  MAP_GEOCODING_SEARCH_URL,
  MAP_TILE_FALLBACK_URL,
  MAP_TILE_PROVIDERS,
  MAP_TILE_URL,
} from './mapConfig.js';

test('uses the current OpenStreetMap tile endpoint without retired subdomains', () => {
  assert.equal(MAP_TILE_URL, 'https://tile.openstreetmap.org/{z}/{x}/{y}.png');
  assert.equal(MAP_TILE_FALLBACK_URL, 'https://tile.openstreetmap.de/{z}/{x}/{y}.png');
  assert.deepEqual(MAP_TILE_PROVIDERS, [
    'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    'https://tile.openstreetmap.de/{z}/{x}/{y}.png',
  ]);
});

test('keeps geocoding endpoints configurable from one source', () => {
  assert.equal(MAP_GEOCODING_SEARCH_URL, 'https://nominatim.openstreetmap.org/search');
  assert.equal(MAP_GEOCODING_REVERSE_URL, 'https://nominatim.openstreetmap.org/reverse');
});

test('builds an official Google Maps URL from valid coordinates', () => {
  assert.equal(
    buildExternalMapUrl(10.7769, 106.7009),
    'https://www.google.com/maps/search/?api=1&query=10.7769%2C106.7009',
  );
  assert.equal(buildExternalMapUrl(null, 106.7009), '');
  assert.equal(buildExternalMapUrl(95, 106.7009), '');
});
