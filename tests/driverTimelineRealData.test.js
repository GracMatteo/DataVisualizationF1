import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { csvParse } from 'd3';
import { indexF1Data } from '../src/lib/loadF1Data.js';
import { buildDriverTimeline, getDriverTimelineDefaults } from '../src/lib/buildDriverTimeline.js';
import { classifyRaceResult } from '../src/lib/raceResults.js';

const FILES = ['results', 'races', 'drivers', 'constructors', 'status'];
const raw = Object.fromEntries(await Promise.all(FILES.map(async (name) => [
  name, csvParse(await readFile(new URL(`../public/data/${name}.csv`, import.meta.url), 'utf8')),
])));
const tables = indexF1Data(raw);

function expectedSummary(results) {
  return {
    entries: results.length,
    wins: results.filter((result) => result.position === 1).length,
    podiums: results.filter((result) => result.position > 0 && result.position <= 3).length,
    points: results.reduce((total, result) => total + (result.points ?? 0), 0),
    seasons: new Set(results.map((result) => tables.races.get(result.raceId).year)).size,
    constructors: new Set(results.map((result) => result.constructorId)).size,
  };
}

function compareRaces(a, b) {
  return (a.year ?? Infinity) - (b.year ?? Infinity)
    || (a.round ?? Infinity) - (b.round ?? Infinity)
    || (a.date ?? '').localeCompare(b.date ?? '')
    || a.raceId - b.raceId;
}

test('real archive preserves every result exactly once across driver groups with identical shared columns', () => {
  const before = structuredClone(tables);
  const baseline = buildDriverTimeline([], tables);
  const columns = new Map(baseline.races.map((race, index) => [race.raceId, { race, index }]));
  const expectedRaceIds = new Set([...tables.results.values()].map((result) => result.raceId));
  assert.equal(columns.size, expectedRaceIds.size);
  assert.deepEqual(new Set(columns.keys()), expectedRaceIds);
  assert.deepEqual(baseline.races, [...baseline.races].sort(compareRaces));
  assert.equal(baseline.entryCount, 0);
  const seen = new Set();
  let entryCount = 0;
  let repeatedDriverRaces = 0;
  for (let start = 0; start < tables.availableDrivers.length; start += 32) {
    const driverIds = tables.availableDrivers.slice(start, start + 32).map((driver) => driver.driverId);
    const timeline = buildDriverTimeline(driverIds, tables);
    assert.deepEqual(timeline.races, baseline.races);
    assert.deepEqual(timeline.rows.map((row) => row.driverId), driverIds);
    assert.equal(timeline.invalidRange, false);
    assert.equal(timeline.entryCount, timeline.rows.reduce((sum, row) => sum + row.summary.entries, 0));
    entryCount += timeline.entryCount;
    for (const row of timeline.rows) {
      const source = tables.resultsByDriver.get(row.driverId);
      assert.deepEqual(row.summary, expectedSummary(source));
      assert.deepEqual(row.results.map((result) => result.resultId).sort((a, b) => a - b),
        source.map((result) => result.resultId).sort((a, b) => a - b));
      assert.deepEqual([...row.resultsByRace.values()].flat(), row.results);
      let previousColumn = -1;
      for (const [raceId, results] of row.resultsByRace) {
        const column = columns.get(raceId);
        assert.ok(column.index > previousColumn);
        previousColumn = column.index;
        assert.ok(results.length > 0);
        if (results.length > 1) repeatedDriverRaces += 1;
        assert.deepEqual(results.map((result) => result.resultId),
          results.map((result) => result.resultId).sort((a, b) => a - b));
        for (const result of results) {
          assert.equal(seen.has(result.id), false, `${result.id} appears only once`);
          seen.add(result.id);
          assert.equal(result.id, `result:${result.resultId}`);
          assert.equal(result.raceId, raceId);
          assert.equal(result.driverId, row.driverId);
          assert.equal(result.year, column.race.year);
          assert.equal(result.round, column.race.round);
          assert.equal(result.date, column.race.date);
          assert.equal(result.raceName, column.race.raceName);
          const original = tables.results.get(result.resultId);
          assert.equal(result.position, original.position);
          assert.equal(result.positionOrder, original.positionOrder);
          assert.equal(result.points, original.points);
          const status = tables.statuses.get(original.statusId)?.status ?? null;
          assert.deepEqual({ outcome: result.outcome, resultLabel: result.resultLabel },
            classifyRaceResult(original, status));
        }
      }
    }
  }
  assert.equal(entryCount, raw.results.length);
  assert.equal(seen.size, tables.results.size);
  assert.deepEqual(seen, new Set([...tables.results.keys()].map((id) => `result:${id}`)));
  assert.ok(repeatedDriverRaces > 0, 'historical multiple-entry driver/race groups were exercised');
  assert.deepEqual(tables, before);
});

test('real year filtering preserves the same columns across driver groups and counts all selected entries', () => {
  for (const year of [tables.years[0], 2019, tables.years.at(-1)]) {
    const bounds = { fromYear: String(year), toYear: year };
    const baseline = buildDriverTimeline([], tables, bounds);
    const expected = [...tables.results.values()].filter((result) => tables.races.get(result.raceId).year === year);
    assert.ok(baseline.races.length > 0);
    assert.ok(baseline.races.every((race) => race.year === year));
    assert.deepEqual(new Set(baseline.races.map((race) => race.raceId)), new Set(expected.map((result) => result.raceId)));
    const seen = new Set();
    let entries = 0;
    for (let start = 0; start < tables.availableDrivers.length; start += 64) {
      const driverIds = tables.availableDrivers.slice(start, start + 64).map((driver) => driver.driverId);
      const timeline = buildDriverTimeline(driverIds, tables, bounds);
      assert.deepEqual(timeline.races, baseline.races);
      assert.equal(timeline.rows.length, driverIds.length);
      entries += timeline.entryCount;
      for (const row of timeline.rows) {
        assert.deepEqual(row.summary, expectedSummary(tables.resultsByDriver.get(row.driverId).filter((result) => {
          const year = tables.races.get(result.raceId).year;
          return year >= bounds.fromYear && year <= bounds.toYear;
        })));
        for (const result of row.results) seen.add(result.resultId);
      }
    }
    assert.equal(entries, expected.length);
    assert.deepEqual(seen, new Set(expected.map((result) => result.resultId)));
  }
});

test('real Gasly 2019 constructor switch remains chronological on the common race axis', () => {
  const gasly = tables.availableDrivers.find((driver) => driver.driverRef === 'gasly');
  assert.ok(gasly);
  const timeline = buildDriverTimeline([gasly.driverId], tables, { fromYear: 2019, toYear: 2019 });
  const results = timeline.rows[0].results;
  assert.equal(timeline.rows[0].summary.constructors, 2);
  assert.equal(results[0].constructorRef, 'red_bull');
  assert.equal(results.find((result) => result.round === 12).constructorRef, 'red_bull');
  assert.equal(results.find((result) => result.round === 13).constructorRef, 'toro_rosso');
  assert.equal(results.at(-1).constructorRef, 'toro_rosso');
});

test('real classified retirement keeps its position while defaults select latest-year participants', () => {
  const original = tables.results.get(7);
  const row = buildDriverTimeline([original.driverId], tables).rows[0];
  const result = row.results.find((entry) => entry.resultId === original.resultId);
  assert.equal(result.position, 7);
  assert.equal(result.status, 'Engine');
  assert.equal(result.outcome, 'retired');
  assert.equal(result.resultLabel, 'P7');

  const defaults = getDriverTimelineDefaults(tables);
  assert.equal(defaults.fromYear, tables.years.at(-1));
  assert.equal(defaults.toYear, defaults.fromYear);
  assert.equal(defaults.driverIds.length, 2);
  const latest = buildDriverTimeline(defaults.driverIds, tables, defaults);
  assert.ok(latest.rows.every((entry) => entry.summary.entries > 0));
  const preferred = ['hamilton', 'max_verstappen'].map((ref) => tables.availableDrivers.find((driver) => driver.driverRef === ref))
    .filter((driver) => driver && tables.resultsByDriver.get(driver.driverId)
      .some((entry) => tables.races.get(entry.raceId).year === defaults.fromYear));
  assert.deepEqual(defaults.driverIds.slice(0, preferred.length), preferred.map((driver) => driver.driverId));
});
