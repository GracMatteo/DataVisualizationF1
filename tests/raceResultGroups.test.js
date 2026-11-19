import test from 'node:test';
import assert from 'node:assert/strict';
import { getRaceGroupKey, RESULT_GROUPS } from '../src/lib/raceResultGroups.js';
import { getRaceColor, POSITION_COLORS } from '../src/lib/racePresentation.js';

const GROUPS = [
  { key: 'win', label: 'P1' },
  { key: 'second', label: 'P2' },
  { key: 'third', label: 'P3' },
  { key: 'points', label: 'Points' },
  { key: 'other', label: 'No points' },
  { key: 'retired', label: 'DNF' },
  { key: 'unclassified', label: 'Other outcomes' },
];

test('result groups expose the fixed category order, labels and race color keys', () => {
  assert.deepEqual(RESULT_GROUPS, GROUPS);
  assert.deepEqual(RESULT_GROUPS.map(({ key }) => key), Object.keys(POSITION_COLORS));
});

const CASES = [
  ['win before positive points', { outcome: 'finished', position: 1, points: 25 }, 'win'],
  ['second with missing points', { outcome: 'finished', position: 2, points: null }, 'second'],
  ['third without points', { outcome: 'finished', position: 3, points: 0 }, 'third'],
  ['nonpodium scored finish', { outcome: 'finished', position: 4, points: 3 }, 'points'],
  ['historical scoring outside the top ten', { outcome: 'finished', position: 11, points: 1 }, 'points'],
  ['fractional points', { outcome: 'finished', position: 6, points: 0.5 }, 'points'],
  ['unplaced scored finish', { outcome: 'finished', position: null, points: 1 }, 'points'],
  ['top ten without points', { outcome: 'finished', position: 4, points: 0 }, 'other'],
  ['missing points', { outcome: 'finished', position: 8, points: null }, 'other'],
  ['absent points', { outcome: 'finished', position: 8 }, 'other'],
  ['negative points', { outcome: 'finished', position: 8, points: -1 }, 'other'],
  ['no positionOrder or positionText fallback', { outcome: 'finished', position: null, positionOrder: 1, positionText: '3', points: 0 }, 'other'],
  ['classified retirement overrides a podium and points', { outcome: 'retired', position: 1, points: 25 }, 'retired'],
  ['unclassified retirement', { outcome: 'retired', position: null, points: 0 }, 'retired'],
  ['DSQ overrides a podium and points', { outcome: 'dsq', position: 2, points: 18 }, 'unclassified'],
  ['DNS is not DNF', { outcome: 'dns', position: null, points: 0 }, 'unclassified'],
  ['DNQ', { outcome: 'dnq', position: null }, 'unclassified'],
  ['excluded', { outcome: 'exc', position: 1, points: 10 }, 'unclassified'],
  ['not classified', { outcome: 'nc', position: null, points: 1 }, 'unclassified'],
  ['unknown outcome overrides a podium', { outcome: 'unknown', position: 3, points: 4 }, 'unclassified'],
  ['absent outcome does not imply finished', { position: 1, points: 25 }, 'unclassified'],
];

for (const [name, race, expected] of CASES) {
  test(name, () => {
    const before = structuredClone(race);
    assert.equal(getRaceGroupKey(Object.freeze(race)), expected);
    assert.equal(POSITION_COLORS[expected], getRaceColor(race));
    assert.deepEqual(race, before);
  });
}

test('grouping mirrors color precedence across outcomes, positions and point values', () => {
  for (const outcome of ['finished', 'retired', 'dsq', 'dns', 'dnq', 'exc', 'nc', 'unknown', null, undefined]) {
    for (const position of [1, 2, 3, 4, 11, null]) {
      for (const points of [25, 0.5, 0, -1, null]) {
        const race = { outcome, position, points, positionOrder: 1 };
        const key = getRaceGroupKey(race);
        assert.ok(RESULT_GROUPS.some((group) => group.key === key));
        assert.equal(POSITION_COLORS[key], getRaceColor(race));
      }
    }
  }
});
