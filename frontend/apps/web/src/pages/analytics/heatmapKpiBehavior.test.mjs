import assert from 'node:assert/strict';
import { shouldAutoScrollMapKpi } from './heatmapUtils.mjs';

for (const key of ['total', 'mapped', 'visible', 'priority']) {
  assert.equal(shouldAutoScrollMapKpi(key), true, `${key} KPI should auto-scroll to the map`);
}

assert.equal(shouldAutoScrollMapKpi('unknown'), false, 'unknown KPI must not auto-scroll');
assert.equal(shouldAutoScrollMapKpi(null), false, 'missing KPI key must not auto-scroll');

console.log('heatmap KPI auto-scroll guards: ok');
