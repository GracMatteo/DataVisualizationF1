import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyRaceResult, OUTCOME_LEGEND } from '../src/lib/raceResults.js';

const CASES = [
  ['normal finish', 1, '1', 'Finished', 'finished', 'P1'],
  ['classified retirement', 7, '7', 'Engine', 'retired', 'P7'],
  ['unclassified retirement', null, 'R', 'Engine', 'retired', 'DNF'],
  ['null position with finished status', null, null, 'Finished', 'finished', 'Finished'],
  ['null position with singular lap status', null, null, '+1 Lap', 'finished', 'Finished'],
  ['null position with plural lap status', null, null, '+12 Laps', 'finished', 'Finished'],
  ['Lap(s) notation', null, null, '+2 Lap(s)', 'finished', 'Finished'],
  ['R with lapped status is not automatically DNF', null, 'R', '+11 Laps', 'finished', 'Finished'],
  ['R with finished status is not automatically DNF', null, 'R', 'Finished', 'finished', 'Finished'],
  ['D overrides mechanical status', null, 'D', 'Engine', 'dsq', 'DSQ'],
  ['E overrides underlying cause', null, 'E', 'Underweight', 'exc', 'EXC'],
  ['F overrides injury status', null, 'F', 'Injury', 'dnq', 'DNQ'],
  ['W overrides mechanical status', null, 'W', 'Engine', 'dns', 'DNS'],
  ['N overrides lapped status', null, 'N', '+12 Laps', 'nc', 'NC'],
  ['R with withdrawal after starting', null, 'R', 'Withdrew', 'retired', 'DNF'],
  ['classified withdrawal', 6, '6', 'Withdrew', 'retired', 'P6'],
  ['status-only withdrawal', null, null, 'Withdrew', 'dns', 'DNS'],
  ['status-only DNS', null, null, 'Did not start', 'dns', 'DNS'],
  ['status-only DSQ', null, null, 'Disqualified', 'dsq', 'DSQ'],
  ['status-only exclusion', null, null, 'Excluded', 'exc', 'EXC'],
  ['status-only DNQ', null, null, 'Did not qualify', 'dnq', 'DNQ'],
  ['status-only prequalification', null, null, 'Did not prequalify', 'dnq', 'DNQ'],
  ['107 percent rule', null, null, '107% Rule', 'dnq', 'DNQ'],
  ['status-only NC', null, null, 'Not classified', 'nc', 'NC'],
  ['unknown status does not imply DNF', null, null, null, 'unknown', 'Unknown'],
  ['classified unknown status does not imply finished', 2, '2', null, 'unknown', 'P2'],
  ['positionText is not a substitute for position', null, '1', null, 'unknown', 'Unknown'],
  ['classified position survives DSQ status', 8, '8', 'Disqualified', 'dsq', 'P8'],
  ['normalized code and status whitespace/case', null, ' w ', ' engine ', 'dns', 'DNS'],
];

for (const [name, position, positionText, status, outcome, resultLabel] of CASES) {
  test(name, () => {
    const result = Object.freeze({ position, positionText, positionOrder: 1, status });
    assert.deepEqual(classifyRaceResult(result), { outcome, resultLabel });
    assert.deepEqual(classifyRaceResult(result, status), { outcome, resultLabel });
    assert.ok(Object.hasOwn(OUTCOME_LEGEND, outcome));
  });
}

test('the shared legend exposes every category and cannot be mutated', () => {
  assert.deepEqual(Object.keys(OUTCOME_LEGEND), ['finished', 'retired', 'dsq', 'dnq', 'dns', 'exc', 'nc', 'unknown']);
  assert.ok(Object.isFrozen(OUTCOME_LEGEND));
  for (const entry of Object.values(OUTCOME_LEGEND)) {
    assert.equal(typeof entry.label, 'string');
    assert.equal(typeof entry.resultLabel, 'string');
    assert.ok(Object.isFrozen(entry));
  }
});
