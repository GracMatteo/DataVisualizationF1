import test from 'node:test';
import assert from 'node:assert/strict';
import { indexF1Data } from '../src/lib/loadF1Data.js';
import { buildDriverTimeline, getDriverTimelineDefaults } from '../src/lib/buildDriverTimeline.js';
import { deepFreeze, makeRawData, MISSING } from './fixtures.js';

const ZERO_SUMMARY = { entries: 0, wins: 0, podiums: 0, points: 0, seasons: 0, constructors: 0 };
const DRIVER_SUMMARY = { entries: 4, wins: 1, podiums: 3, points: 20, seasons: 2, constructors: 2 };

function reverseRaw(raw) {
  return Object.fromEntries(Object.entries(raw).map(([key, rows]) => [key, [...rows].reverse()]));
}

function makeDefaultsRawData() {
  const raw = makeRawData();
  raw.drivers = [
    { driverId: '1', driverRef: 'hamilton', forename: 'Lewis', surname: 'Hamilton' },
    { driverId: '2', driverRef: 'max_verstappen', forename: 'Max', surname: 'Verstappen' },
    { driverId: '3', driverRef: 'leading', forename: 'Alex', surname: 'Leading' },
    { driverId: '4', driverRef: 'second', forename: 'Bella', surname: 'Second' },
    { driverId: '5', driverRef: 'legacy', forename: 'Old', surname: 'Participant' },
  ];
  raw.races = [
    { ...raw.races[0], raceId: '401', year: '2020', round: '1' },
    { ...raw.races[0], raceId: '402', year: '2020', round: '2' },
    { ...raw.races[0], raceId: '403', year: '2020', round: '3' },
    { ...raw.races[0], raceId: '404', year: '2019', round: '1' },
    { ...raw.races[0], raceId: '405', year: '2050', round: '1' },
  ];
  raw.results = [[3, 401], [3, 402], [3, 403], [4, 401], [4, 402], [1, 401], [2, 401], [5, 404]]
    .map(([driverId, raceId], index) => ({
      ...raw.results[0], resultId: String(3000 + index),
      driverId: String(driverId), raceId: String(raceId),
    }));
  return raw;
}

test('builds shared columns, selected driver rows, enriched results and entry-based summaries', () => {
  const tables = indexF1Data(makeRawData());
  const timeline = buildDriverTimeline([1, 2], tables);
  assert.deepEqual(Object.keys(timeline).sort(), ['entryCount', 'invalidRange', 'races', 'rows']);
  assert.equal(timeline.invalidRange, false);
  assert.equal(timeline.entryCount, 5);
  assert.deepEqual(timeline.races.map((race) => race.raceId), [105, 101, 102, 103, 104]);
  assert.deepEqual(timeline.races[1], {
    id: 'race:101', raceId: 101, name: 'First Grand Prix', raceName: 'First Grand Prix',
    year: 2000, round: 1, date: '2000-03-01',
  });
  const [row, other] = timeline.rows;
  assert.deepEqual(Object.keys(row).sort(), ['driver', 'driverId', 'id', 'name', 'results', 'resultsByRace', 'summary']);
  assert.equal(row.id, 'driver:1');
  assert.equal(row.driverId, 1);
  assert.equal(row.name, 'Amy Racer');
  assert.strictEqual(row.driver, tables.drivers.get(1));
  assert.deepEqual(row.summary, DRIVER_SUMMARY);
  assert.deepEqual(other.summary, { entries: 1, wins: 0, podiums: 0, points: 2, seasons: 1, constructors: 1 });
  assert.deepEqual(row.results.map((result) => result.resultId), [1001, 1002, 1003, 1004]);
  assert.deepEqual(row.results[0], {
    id: 'result:1001', resultId: 1001, raceId: 101, driverId: 1, driverName: 'Amy Racer',
    constructorId: 20, constructorRef: 'first_team', constructorName: 'Zeta First',
    raceName: 'First Grand Prix', year: 2000, round: 1, date: '2000-03-01',
    grid: 1, position: 1, positionOrder: 1, positionText: '1', statusId: 1,
    status: 'Finished', points: 10, outcome: 'finished', resultLabel: 'P1',
  });
  assert.ok(row.resultsByRace instanceof Map);
  assert.deepEqual([...row.resultsByRace.keys()], [101, 102, 103, 104]);
  assert.strictEqual(row.resultsByRace.get(101)[0], row.results[0]);
  assert.equal(row.resultsByRace.has(105), false);
});

test('columns are invariant under selection, selection order, name sorting and empty selection', () => {
  const tables = indexF1Data(makeRawData());
  const baseline = buildDriverTimeline([1, 2], tables).races;
  for (const driverIds of [[], [1], [2], [2, 1], [999], [null, 'invalid'], undefined]) {
    for (const sortOrder of ['selection', 'name']) {
      const timeline = buildDriverTimeline(driverIds, tables, { sortOrder });
      assert.deepEqual(timeline.races, baseline);
      assert.equal(timeline.entryCount, timeline.rows.reduce((sum, row) => sum + row.results.length, 0));
    }
  }
  for (const driverIds of [[], [999], [3], null]) {
    const timeline = buildDriverTimeline(driverIds, tables);
    assert.deepEqual(timeline.rows, []);
    assert.equal(timeline.entryCount, 0);
  }
});

test('columns use only joined results, not scheduled or orphaned races', () => {
  const raw = makeRawData();
  raw.results.push(
    { ...raw.results[0], resultId: '2001', raceId: '106', driverId: '999' },
    { ...raw.results[0], resultId: '2002', raceId: '999' },
  );
  const timeline = buildDriverTimeline([1], indexF1Data(raw));
  assert.deepEqual(timeline.races.map((race) => race.raceId), [105, 101, 102, 103, 104]);
  assert.equal(timeline.entryCount, 4);
});

test('normalizes numeric-string selections, removes duplicate/invalid IDs and preserves selection order', () => {
  const tables = indexF1Data(makeRawData());
  const ids = [' 2 ', 1, '01', '2', 999, 3, null, undefined, '', ' ', 'invalid', NaN, Infinity, true, {}, []];
  const before = structuredClone(ids);
  const timeline = buildDriverTimeline(ids, tables);
  assert.deepEqual(ids, before);
  assert.deepEqual(timeline.rows.map((row) => row.driverId), [2, 1]);
  assert.equal(timeline.entryCount, 5);
  const sorted = buildDriverTimeline(ids, tables, { sortOrder: 'name' });
  assert.deepEqual(sorted.rows.map((row) => row.driverId), [1, 2]);
  assert.deepEqual(sorted.rows, [...timeline.rows].reverse());
});

test('name sorting uses a numeric driver-ID tie-break', () => {
  const raw = makeRawData();
  for (const driver of raw.drivers) Object.assign(driver, { forename: 'Same', surname: 'Name' });
  const timeline = buildDriverTimeline([2, 1], indexF1Data(raw), { sortOrder: 'name' });
  assert.deepEqual(timeline.rows.map((row) => row.driverId), [1, 2]);
});

test('sorts by year, round, date, race ID and result ID with deterministic missing rounds', () => {
  const raw = makeRawData();
  for (const race of raw.races) {
    if (race.raceId === '105') continue;
    race.year = '2000';
    race.round = race.raceId === '101' ? '2' : '1';
    race.date = race.raceId === '101' ? '2000-01-01' : '2000-12-01';
  }
  Object.assign(raw.races.find((race) => race.raceId === '104'), { round: MISSING, date: '2000-01-01' });
  const missingRound = raw.races.find((race) => race.raceId === '104');
  raw.races.push({ ...missingRound, raceId: '107' }, { ...missingRound, raceId: '108', date: MISSING });
  const duplicate = raw.results.find((result) => result.resultId === '1002');
  raw.results.push(
    { ...duplicate, resultId: '1006' },
    { ...duplicate, resultId: '1007', raceId: '107' },
    { ...duplicate, resultId: '1008', raceId: '108' },
  );
  const timeline = buildDriverTimeline([1, 2], indexF1Data(raw));
  assert.deepEqual(timeline.races.map((race) => race.raceId), [105, 102, 103, 101, 108, 104, 107]);
  assert.deepEqual(timeline.rows[0].results.map((result) => result.resultId), [1002, 1006, 1003, 1001, 1008, 1004, 1007]);
  assert.equal(timeline.races.at(-
1).round, null);
  assert.equal(timeline.races.at(-3).date, null);
  assert.deepEqual(buildDriverTimeline([1, 2], indexF1Data(reverseRaw(raw))), timeline);
});

test('year bounds are inclusive, accept numeric strings and recompute selected summaries', () => {
  const tables = indexF1Data(makeRawData());
  const cases = [
    [{ fromYear: '2000', toYear: '2000' }, [101, 102, 103], 3],
    [{ fromYear: 2000, toYear: 2001 }, [101, 102, 103, 104], 4],
    [{ fromYear: 2001 }, [104], 1],
    [{ toYear: 2000 }, [105, 101, 102, 103], 4],
  ];
  for (const [bounds, raceIds, entryCount] of cases) {
    const timeline = buildDriverTimeline([1, 2], tables, bounds);
    assert.equal(timeline.invalidRange, false);
    assert.deepEqual(timeline.races.map((race) => race.raceId), raceIds);
    assert.equal(timeline.entryCount, entryCount);
    assert.deepEqual(buildDriverTimeline([], tables, bounds).races, timeline.races);
  }
  const timeline = buildDriverTimeline([1], tables, { fromYear: '2001', toYear: '2001' });
  assert.deepEqual(timeline.rows[0].summary, { entries: 1, wins: 0, podiums: 1, points: 4, seasons: 1, constructors: 1 });
});

test('null, undefined and blank year bounds are unbounded, not numeric zero', () => {
  const tables = indexF1Data(makeRawData());
  const baseline = buildDriverTimeline([1, 2], tables);
  for (const bounds of [{ fromYear: '', toYear: '' }, { fromYear: '  ', toYear: null }, { fromYear: null, toYear: undefined }]) {
    assert.deepEqual(buildDriverTimeline([1, 2], tables, bounds), baseline);
  }
  const zero = buildDriverTimeline([1], tables, { fromYear: 0, toYear: 0 });
  assert.equal(zero.invalidRange, false);
  assert.deepEqual(zero.races, []);
});

test('invalid and reversed year bounds retain known rows with zero summaries and no results', () => {
  const tables = indexF1Data(makeRawData());
  const invalid = [
    { fromYear: 2001, toYear: 2000 }, { fromYear: '2001', toYear: '1999' },
    ...['invalid', MISSING, NaN, Infinity, -Infinity, true, [], {}]
      .flatMap((value) => [{ fromYear: value }, { toYear: value }]),
  ];
  for (const bounds of invalid) {
    const timeline = buildDriverTimeline([2, '1', 999], tables, bounds);
    assert.equal(timeline.invalidRange, true);
    assert.equal(timeline.entryCount, 0);
    assert.deepEqual(timeline.races, []);
    assert.deepEqual(timeline.rows.map((row) => row.driverId), [2, 1]);
    for (const row of timeline.rows) {
      assert.deepEqual(row.summary, ZERO_SUMMARY);
      assert.deepEqual(row.results, []);
      assert.deepEqual(row.resultsByRace, new Map());
      assert.strictEqual(row.driver, tables.drivers.get(row.driverId));
    }
  }
  assert.deepEqual(buildDriverTimeline([], tables, { fromYear: 'invalid' }), {
    races: [], rows: [], entryCount: 0, invalidRange: true,
  });
});

test('known selected drivers remain present when no results match a valid range', () => {
  const tables = indexF1Data(makeRawData());
  for (const bounds of [{ fromYear: 2050 }, { toYear: 1900 }, { fromYear: 2001, toYear: 2001 }]) {
    const timeline = buildDriverTimeline([2, 1], tables, bounds);
    assert.equal(timeline.invalidRange, false);
    assert.deepEqual(timeline.rows.map((row) => row.driverId), [2, 1]);
    assert.deepEqual(timeline.rows[0].summary, ZERO_SUMMARY);
    assert.deepEqual(timeline.rows[0].results, []);
    assert.deepEqual(timeline.rows[0].resultsByRace, new Map());
  }
  assert.deepEqual(buildDriverTimeline([1, '2'], indexF1Data()), {
    races: [], rows: [], entryCount: 0, invalidRange: false,
  });
});

test('unknown years remain null, sort last and appear only when both year bounds are absent', () => {
  const raw = makeRawData();
  raw.races.find((race) => race.raceId === '104').year = MISSING;
  const tables = indexF1Data(raw);
  const timeline = buildDriverTimeline([1], tables);
  assert.equal(timeline.races.at(-1).raceId, 104);
  assert.equal(timeline.races.at(-1).year, null);
  assert.equal(timeline.rows[0].results.at(-1).year, null);
  assert.equal(timeline.rows[0].summary.seasons, 1);
  assert.deepEqual(buildDriverTimeline([1], tables, { fromYear: '', toYear: '' }), timeline);
  for (const bounds of [{ fromYear: 1900 }, { toYear: 2100 }, { fromYear: 1900, toYear: 2100 }]) {
    const filtered = buildDriverTimeline([1], tables, bounds);
    assert.equal(filtered.races.some((race) => race.year === null), false);
    assert.equal(filtered.entryCount, 3);
  }
});

test('absence of an entry is distinct from DNS, DSQ, DNF and a classified retirement', () => {
  const raw = makeRawData();
  Object.assign(raw.results.find((result) => result.resultId === '1001'), {
    position: MISSING, positionText: 'W', positionOrder: '1', statusId: '54', points: '0',
  });
  Object.assign(raw.results.find((result) => result.resultId === '1002'), {
    position: MISSING, positionText: 'D', positionOrder: '2', statusId: '2', points: '0',
  });
  Object.assign(raw.results.find((result) => result.resultId === '1004'), {
    position: '7', positionText: '7', statusId: '5', points: '2',
  });
  const timeline = buildDriverTimeline([1, 2], indexF1Data(raw));
  const [row, other] = timeline.rows;
  assert.deepEqual(row.results.map(({ outcome, resultLabel }) => [outcome, resultLabel]), [
    ['dns', 'DNS'], ['dsq', 'DSQ'], ['retired', 'DNF'], ['retired', 'P7'],
  ]);
  assert.equal(row.resultsByRace.has(105), false);
  assert.equal(other.resultsByRace.has(101), false);
  assert.equal(other.resultsByRace.get(101), undefined);
  assert.deepEqual(row.summary, { entries: 4, wins: 0, podiums: 0, points: 2, seasons: 2, constructors: 2 });
  assert.equal(timeline.entryCount, 5);
});

test('never substitutes positionOrder or numeric positionText for official position', () => {
  const raw = makeRawData();
  Object.assign(raw.results.find((result) => result.resultId === '1001'), { position: MISSING });
  Object.assign(raw.results.find((result) => result.resultId === '1002'), { position: MISSING, statusId: MISSING });
  const row = buildDriverTimeline([1], indexF1Data(raw)).rows[0];
  assert.equal(row.results[0].position, null);
  assert.equal(row.results[0].positionOrder, 1);
  assert.equal(row.results[0].positionText, '1');
  assert.equal(row.results[0].resultLabel, 'Finished');
  assert.equal(row.results[1].position, null);
  assert.equal(row.results[1].resultLabel, 'Unknown');
  assert.equal(row.results[1].outcome, 'unknown');
  assert.equal(row.summary.wins, 0);
  assert.equal(row.summary.podiums, 1);
});

test('preserves null values, optional join fallbacks, zero grid and fractional points', () => {
  const raw = makeRawData();
  Object.assign(raw.results.find((result) => result.resultId === '1004'), {
    constructorId: MISSING, statusId: MISSING, grid: MISSING, position: MISSING,
    positionOrder: MISSING, positionText: MISSING, points: MISSING,
  });
  Object.assign(raw.races.find((race) => race.raceId === '104'), { name: MISSING, date: MISSING, round: MISSING });
  Object.assign(raw.results.find((result) => result.resultId === '1002'), {
    constructorId: '999', statusId: '999', points: '0.5',
  });
  const timeline = buildDriverTimeline([1], indexF1Data(raw));
  const row = timeline.rows[0];
  const missing = row.results.at(-1);
  for (const field of ['constructorId', 'constructorRef', 'statusId', 'status', 'grid', 'position', 'positionOrder', 'positionText', 'points', 'round', 'date']) {
    assert.equal(missing[field], null, field);
  }
  assert.equal(missing.constructorName, 'Unknown constructor');
  assert.equal(missing.raceName, 'Race 104');
  assert.equal(missing.outcome, 'unknown');
  assert.equal(missing.resultLabel, 'Unknown');
  assert.equal(timeline.races.at(-1).name, 'Race 104');
  assert.equal(row.results[1].constructorId, 999);
  assert.equal(row.results[1].constructorName, 'Unknown constructor 999');
  assert.equal(row.results[1].constructorRef, null);
  assert.equal(row.results[1].statusId, 999);
  assert.equal(row.results[1].status, null);
  assert.equal(row.results[1].outcome, 'unknown');
  assert.equal(row.results[1].resultLabel, 'P2');
  assert.equal(row.results[2].grid, 0);
  assert.equal(row.results[2].points, 0);
  assert.deepEqual(row.summary, { entries: 4, wins: 1, podiums: 2, points: 10.5, seasons: 2, constructors: 2 });
});

test('preserves multiple historical results for one driver/GP as separate stable entries', () => {
  const raw = makeRawData();
  const original = raw.results.find((result) => result.resultId === '1001');
  raw.results.unshift({ ...original, resultId: '1006', constructorId: '10', position: '4', positionText: '4', points: '3' });
  const timeline = buildDriverTimeline(['1', 1], indexF1Data(raw));
  const row = timeline.rows[0];
  assert.equal(timeline.races.filter((race) => race.raceId === 101).length, 1);
  assert.equal(timeline.entryCount, 5);
  assert.deepEqual(row.resultsByRace.get(101).map((result) => result.id), ['result:1001', 'result:1006']);
  assert.deepEqual(row.resultsByRace.get(101).map((result) => result.constructorId), [20, 10]);
  assert.strictEqual(row.resultsByRace.get(101)[1], row.results[1]);
  assert.equal(row.resultsByRace.size, 4);
  assert.deepEqual(row.summary, { ...DRIVER_SUMMARY, entries: 5, points: 23 });
  assert.deepEqual(buildDriverTimeline(['1'], indexF1Data(reverseRaw(raw))), timeline);
});

test('keeps chronological constructor changes, including a return to an earlier constructor', () => {
  const row = buildDriverTimeline([1], indexF1Data(makeRawData())).rows[0];
  assert.deepEqual(row.results.map((result) => result.constructorId), [20, 10, 20, 10]);
  assert.deepEqual(row.results.map((result) => result.constructorRef), ['first_team', 'later_team', 'first_team', 'later_team']);
  assert.equal(row.summary.constructors, 2);
});

test('driver, race and result IDs remain stable through filtering, selection and label changes', () => {
  const raw = makeRawData();
  const tables = indexF1Data(raw);
  const original = buildDriverTimeline([1, 2], tables);
  const filtered = buildDriverTimeline([2, 1], tables, { fromYear: 2001, toYear: 2001 });
  assert.equal(filtered.rows[1].id, original.rows[0].id);
  assert.deepEqual(filtered.rows[1].results, [original.rows[0].results.at(-1)]);
  assert.deepEqual(filtered.races, [original.races.at(-1)]);
  raw.drivers.find((driver) => driver.driverId === '1').forename = 'Renamed';
  raw.races.find((race) => race.raceId === '104').name = 'Renamed Grand Prix';
  raw.constructors[0].name = 'Renamed constructor';
  const renamed = buildDriverTimeline([1, 2], indexF1Data(raw));
  assert.deepEqual(renamed.rows.map((row) => row.id), original.rows.map((row) => row.id));
  assert.deepEqual(renamed.races.map((race) => race.id), original.races.map((race) => race.id));
  assert.deepEqual(renamed.rows[0].results.map((result) => result.id), original.rows[0].results.map((result) => result.id));
  assert.equal(new Set(original.rows.flatMap((row) => row.results.map((result) => result.id))).size, original.entryCount);
});

test('building, sorting, filtering and finding defaults never mutate indexed tables or selected IDs', () => {
  const tables = indexF1Data(makeRawData());
  const before = structuredClone(tables);
  for (const table of [tables.results, tables.races, tables.drivers, tables.constructors, tables.statuses]) {
    for (const row of table.values()) deepFreeze(row);
  }
  for (const results of tables.resultsByDriver.values()) deepFreeze(results);
  deepFreeze(tables.availableDrivers);
  const selected = Object.freeze(['2', 1, '1']);
  const original = buildDriverTimeline(selected, tables);
  buildDriverTimeline(selected, tables, { fromYear: 2001, sortOrder: 'name' });
  buildDriverTimeline(selected, tables, { toYear: 'invalid' });
  getDriverTimelineDefaults(tables);
  assert.deepEqual(tables, before);
  assert.deepEqual(buildDriverTimeline(selected, tables), original);
  assert.notStrictEqual(original.rows[1].results[0], tables.results.get(1001));
});

test('defaults use the latest result year and prefer both featured participants over entry counts', () => {
  const raw = makeDefaultsRawData();
  const expected = { driverIds: [1, 2], fromYear: 2020, toYear: 2020 };
  assert.deepEqual(getDriverTimelineDefaults(indexF1Data(raw)), expected);
  assert.deepEqual(getDriverTimelineDefaults(indexF1Data(reverseRaw(raw))), expected);
  const tables = indexF1Data(raw);
  const timeline = buildDriverTimeline(expected.driverIds, tables, expected);
  assert.equal(timeline.rows.length, 2);
  assert.ok(timeline.rows.every((row) => row.summary.entries > 0));
});

test('defaults fill remaining places by latest-year entry counts, not career totals', () => {
  const raw = makeDefaultsRawData();
  raw.drivers.find((driver) => driver.driverId === '2').driverRef = 'not_featured';
  assert.deepEqual(getDriverTimelineDefaults(indexF1Data(raw)).driverIds, [1, 3]);
  raw.drivers.find((driver) => driver.driverId === '1').driverRef = 'not_featured_either';
  assert.deepEqual(getDriverTimelineDefaults(indexF1Data(raw)).driverIds, [3, 4]);
  raw.drivers.find((driver) => driver.driverId === '2').driverRef = 'max_verstappen';
  assert.deepEqual(getDriverTimelineDefaults(indexF1Data(raw)).driverIds, [2, 3]);
  for (const result of raw.results.filter((result) => result.driverId === '2')) result.raceId = '404';
  for (let index = 0; index < 10; index += 1) {
    raw.results.push({ ...raw.results.at(-1), resultId: String(4000 + index), driverId: '5', raceId: '404' });
  }
  assert.deepEqual(getDriverTimelineDefaults(indexF1Data(raw)).driverIds, [3, 4]);
});

test('defaults break equal entry counts by full name then numeric driver ID', () => {
  const raw = makeDefaultsRawData();
  raw.results = raw.results.filter((result) => result.raceId === '401');
  for (const driver of raw.drivers) {
    Object.assign(driver, { driverRef: `driver_${driver.driverId}`, forename: 'Zed', surname: 'Other' });
    if (['3', '4'].includes(driver.driverId)) Object.assign(driver, { forename: 'Alex', surname: 'Same' });
  }
  const expected = { driverIds: [3, 4], fromYear: 2020, toYear: 2020 };
  assert.deepEqual(getDriverTimelineDefaults(indexF1Data(raw)), expected);
  assert.deepEqual(getDriverTimelineDefaults(indexF1Data(reverseRaw(raw))), expected);
});

test('defaults return one participant when only one is available in the latest year', () => {
  const defaults = getDriverTimelineDefaults(indexF1Data(makeRawData()));
  assert.deepEqual(defaults, { driverIds: [1], fromYear: 2001, toYear: 2001 });
});

test('defaults return empty IDs and blank years for empty archives or exclusively unknown years', () => {
  const raw = makeRawData();
  for (const race of raw.races) race.year = MISSING;
  for (const tables of [indexF1Data(), indexF1Data({ ...makeRawData(), results: [] }), indexF1Data(raw)]) {
    assert.deepEqual(getDriverTimelineDefaults(tables), { driverIds: [], fromYear: '', toYear: '' });
  }
});
