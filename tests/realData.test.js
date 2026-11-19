import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { csvParse } from 'd3';
import { indexF1Data } from '../src/lib/loadF1Data.js';
import { getTeamColor } from '../src/lib/teamColors.js';

const FILES = ['results', 'races', 'drivers', 'constructors', 'status'];
const raw = Object.fromEntries(await Promise.all(FILES.map(async (name) => [
  name, csvParse(await readFile(new URL(`../public/data/${name}.csv`, import.meta.url), 'utf8')),
])));
const tables = indexF1Data(raw);

test('the five served CSVs contain unique identifiers and nonempty data', () => {
  const idFields = { results: 'resultId', races: 'raceId', drivers: 'driverId', constructors: 'constructorId', status: 'statusId' };
  for (const name of FILES) {
    assert.ok(raw[name].length > 0, `${name} is nonempty`);
    const ids = raw[name].map((row) => row[idFields[name]]);
    assert.ok(ids.every((id) => Number.isFinite(Number(id))), `${name} identifiers are numeric`);
    assert.equal(new Set(ids).size, ids.length, `${name} identifiers are unique`);
  }
});

test('real result rows join cleanly and coverage begins in 1950', () => {
  assert.equal(tables.results.size, raw.results.length);
  assert.equal(tables.years[0], 1950);
  assert.ok(tables.yearRange.toYear >= 2024);
  assert.ok(tables.availableDrivers.length > 500);
  for (const [driverId, results] of tables.resultsByDriver) {
    assert.ok(results.length > 0);
    assert.ok(tables.drivers.has(driverId));
    for (const result of results) {
      assert.ok(tables.races.has(result.raceId));
      assert.ok(tables.constructors.has(result.constructorId));
      assert.ok(tables.statuses.has(result.statusId));
      assert.equal(typeof result.points, 'number');
    }
  }
  for (const constructor of tables.constructors.values()) {
    assert.match(getTeamColor(constructor.constructorRef), /^#[0-9a-f]{6}$/i);
  }
});
