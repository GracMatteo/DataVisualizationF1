import test from 'node:test';
import assert from 'node:assert/strict';
import { rgb } from 'd3';
import { GRID_HEAT_HIGH, GRID_HEAT_LOW, gridHeat, gridHeatText } from '../src/lib/gridHeat.js';

test('the square color runs from blue to orange on a square-root ramp', () => {
  const low = rgb(gridHeat(1, 100));
  const mid = rgb(gridHeat(25, 100));
  const high = rgb(gridHeat(100, 100));
  assert.ok(mid.r > low.r);
  assert.ok(high.r > low.r);
  assert.ok(low.b > high.b);
  assert.notEqual(gridHeat(1, 32), gridHeat(32, 32));
  assert.equal(rgb(GRID_HEAT_LOW).b > rgb(GRID_HEAT_HIGH).b, true);
});

test('text is light on the blue end and dark on the orange end', () => {
  assert.equal(gridHeatText(GRID_HEAT_LOW), '#ffffff');
  assert.equal(gridHeatText(GRID_HEAT_HIGH), '#141018');
  assert.equal(gridHeatText(gridHeat(1, 40)), '#ffffff');
});
