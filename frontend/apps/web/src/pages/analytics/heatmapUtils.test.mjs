import assert from 'node:assert/strict';
import { getHeatmapViewportMode, normalizeMapCoordinate } from './heatmapUtils.mjs';

assert.equal(getHeatmapViewportMode('all'), 'incidents', 'all areas must fit visible incident points');
assert.equal(getHeatmapViewportMode('12'), 'area', 'a selected area must fit its own boundary or center');
assert.equal(getHeatmapViewportMode('Phường Long Trường'), 'area', 'a named area selection must use area fit');

assert.ok(Number.isNaN(normalizeMapCoordinate('')), 'blank coordinate must not become zero');
assert.ok(Number.isNaN(normalizeMapCoordinate('   ')), 'whitespace coordinate must not become zero');
assert.ok(Number.isNaN(normalizeMapCoordinate(null)), 'null coordinate must stay invalid');
assert.equal(normalizeMapCoordinate('10.8123'), 10.8123, 'numeric string coordinate should parse');
assert.equal(normalizeMapCoordinate(106.755), 106.755, 'numeric coordinate should remain numeric');

console.log('heatmap viewport guards: ok');
