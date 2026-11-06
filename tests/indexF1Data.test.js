import test from 'node:test';
import assert from 'node:assert/strict';
import { indexF1Data } from '../src/lib/loadF1Data.js';
import { deepFreeze, makeRawData, MISSING } from './fixtures.js';

test('indexes the five tables with numeric keys and result-bearing drivers only', () => {
  const tables = indexF1Data(makeRawData());
  for (const key of ['results', 'races', 'drivers', 'constructors', 'statuses', 'resultsByDriver']) {
    assert.ok(tables[key] instanceof Map, key);
    assert.ok([...tables[key].keys()].every((id) => typeof id === 'number'), key);
  }
  assert.equal(tables.races.get(101).year, 2000);
  assert.equal(tables.races.get(101).round, 1);
  assert.equal(tables.races.get(101).circuitId, 1);
  assert.equal(tables.drivers.get(1).name, 'Amy Racer');
  assert.equal(tables.drivers.get(1).number, 7);
  assert.equal(tables.constructors.get(20).constructorRef, 'first_team');
  assert.equal(tables.statuses.get(5).status, 'Engine');
  assert.equal(tables.results.get(1001).constructorId, 20);
  assert.equal(tables.results.get(1001).points, 10);
  assert.equal(tables.results.get(1001).fastestLapSpeed, 215.25);
  assert.equal(tables.results.get(1001).fastestLapTime, '1:20.500');
  assert.equal(tables.resultsByDriver.get(1).length, 4);
  assert.strictEqual(tables.resultsByDriver.get(1)[0], tables.results.get(1004));
  assert.deepEqual(tables.availableDrivers.map((driver) => driver.driverId), [1, 2]);
  assert.strictEqual(tables.availableDrivers[0], tables.drivers.get(1));
  assert.equal(tables.drivers.has(3), false);
  assert.equal(tables.resultsByDriver.has(3), false);
  assert.equal(tables.drivers.has('1'), false);
});

test('coverage comes from joined results, excluding scheduled races', () => {
  const tables = indexF1Data(makeRawData());
  assert.deepEqual(tables.years, [1999, 2000, 2001]);
  assert.deepEqual(tables.yearRange, { fromYear: 1999, toYear: 2001 });
  assert.ok(tables.races.has(106));
  assert.equal(tables.years.includes(2050), false);
});

test('literal missing values, empty strings and invalid numerics become null, not zero', () => {
  const raw = makeRawData();
  Object.assign(raw.results[0], {
    grid: MISSING, position: MISSING, points: MISSING, fastestLap: '',
    rank: 'not a number', fastestLapSpeed: 'Infinity', positionText: MISSING,
  });
  raw.results[1].points = '0.5';
  raw.results[2].points = '  ';
  const tables = indexF1Data(raw);
  const missing = tables.results.get(1004);
  for (const field of ['grid', 'position', 'points', 'milliseconds', 'fastestLap', 'rank', 'fastestLapSpeed', 'positionText', 'time']) {
    assert.equal(missing[field], null, field);
  }
  assert.equal(tables.results.get(1002).points, 0.5);
  assert.equal(tables.results.get(1005).points, null);
  assert.equal(tables.results.get(1003).grid, 0);
  assert.equal(tables.results.get(1003).points, 0);
  assert.equal(tables.drivers.get(2).number, null);
  assert.equal(tables.drivers.get(2).code, null);
  assert.equal(tables.races.get(101).time, null);
  assert.equal(tables.races.get(101).date, '2000-03-01');
});

test('skips invalid IDs and orphan driver/race joins, but retains missing constructor/status joins', () => {
  const raw = makeRawData();
  const template = raw.results[0];
  raw.results.push(
    { ...template, resultId: MISSING },
    { ...template, resultId: 'invalid' },
    { ...template, resultId: '2001', raceId: '9999' },
    { ...template, resultId: '2002', driverId: '9999' },
    { ...template, resultId: '2003', constructorId: '9999', statusId: '9999' },
  );
  const tables = indexF1Data(raw);
  assert.equal(tables.results.size, 6);
  assert.equal(tables.results.has(2001), false);
  assert.equal(tables.results.has(2002), false);
  assert.equal(tables.resultsByDriver.get(1).length, 5);
  assert.equal(tables.results.get(2003).constructorId, 9999);
  assert.equal(tables.results.get(2003).statusId, 9999);
  assert.equal(tables.constructors.has(9999), false);
});

test('empty input has empty indexes and null year coverage', () => {
  const tables = indexF1Data();
  for (const key of ['results', 'races', 'drivers', 'constructors', 'statuses', 'resultsByDriver']) {
    assert.equal(tables[key].size, 0, key);
  }
  assert.deepEqual(tables.availableDrivers, []);
  assert.deepEqual(tables.years, []);
  assert.equal(tables.yearRange, null);

  const noResults = indexF1Data({ ...makeRawData(), results: [] });
  assert.equal(noResults.drivers.size, 0);
  assert.deepEqual(noResults.availableDrivers, []);
  assert.equal(noResults.yearRange, null);
});

test('indexing is pure and does not mutate frozen input arrays or rows', () => {
  const raw = makeRawData();
  const before = structuredClone(raw);
  deepFreeze(raw);
  const first = indexF1Data(raw);
  const second = indexF1Data(raw);
  assert.deepEqual(raw, before);
  assert.deepEqual(first, second);
  assert.notStrictEqual(first.results.get(1001), raw.results.at(-1));
});
