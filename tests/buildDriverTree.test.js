import test from 'node:test';
import assert from 'node:assert/strict';
import { hierarchy } from 'd3';
import { indexF1Data } from '../src/lib/loadF1Data.js';
import { buildDriverTree } from '../src/lib/buildDriverTree.js';
import { allNodes, makeRawData, MISSING, raceNodes } from './fixtures.js';

const SUMMARY = { entries: 4, wins: 1, podiums: 3, points: 20, seasons: 2, constructors: 2 };

test('joins a plain driver/constructor/season/race tree with summaries and D3-compatible leaves', () => {
  const tables = indexF1Data(makeRawData());
  const root = buildDriverTree('1', tables);
  assert.equal(root.id, 'driver:1');
  assert.equal(root.type, 'driver');
  assert.equal(root.name, 'Amy Racer');
  assert.strictEqual(root.driver, tables.drivers.get(1));
  assert.deepEqual(root.summary, SUMMARY);

  const firstTeam = root.children[0];
  assert.equal(firstTeam.type, 'constructor');
  assert.equal(firstTeam.name, 'Zeta First');
  assert.equal(firstTeam.constructorRef, 'first_team');
  assert.strictEqual(firstTeam.constructor, tables.constructors.get(20));
  assert.deepEqual(firstTeam.summary, { entries: 2, wins: 1, podiums: 1, points: 10, seasons: 1, constructors: 1 });
  const season = firstTeam.children[0];
  assert.equal(season.type, 'season');
  assert.equal(season.name, '2000');
  assert.equal(season.label, '2000');
  assert.equal(season.year, 2000);
  assert.deepEqual(season.summary, firstTeam.summary);

  const firstRace = season.children[0];
  assert.deepEqual(firstRace, {
    id: 'driver:1/constructor:20/season:2000/result:1001',
    type: 'race', name: 'First Grand Prix', raceName: 'First Grand Prix',
    resultId: 1001, raceId: 101, driverId: 1, constructorId: 20,
    constructorRef: 'first_team', year: 2000, round: 1, date: '2000-03-01',
    grid: 1, position: 1, positionOrder: 1, positionText: '1', statusId: 1,
    status: 'Finished', points: 10, outcome: 'finished', resultLabel: 'P1',
  });
  const retirement = season.children[1];
  assert.equal(retirement.status, 'Engine');
  assert.equal(retirement.position, null);
  assert.equal(retirement.positionOrder, 15);
  assert.equal(retirement.outcome, 'retired');
  assert.equal(retirement.resultLabel, 'DNF');
  assert.equal(hierarchy(root).leaves().length, 4);
  const ids = allNodes(root).map((node) => node.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('orders constructors by first race, seasons by year and races by round through midseason switches', () => {
  const raw = makeRawData();
  const root = buildDriverTree(1, indexF1Data(raw));
  // IDs and alphabetical names both put the later team first; chronology must not.
  assert.deepEqual(root.children.map((node) => node.constructorId), [20, 10]);
  assert.deepEqual(root.children[0].children.map((node) => node.year), [2000]);
  assert.deepEqual(root.children[1].children.map((node) => node.year), [2000, 2001]);
  assert.deepEqual(root.children[0].children[0].children.map((node) => node.round), [1, 3]);
  assert.deepEqual(root.children[1].children[0].children.map((node) => node.round), [2]);
  assert.deepEqual(root.children[1].children[1].children.map((node) => node.round), [1]);

  const reordered = Object.fromEntries(Object.entries(raw).map(([key, rows]) => [key, [...rows].reverse()]));
  assert.deepEqual(buildDriverTree(1, indexF1Data(reordered)), root);
});

test('year bounds are inclusive, recompute every summary and preserve surviving IDs', () => {
  const tables = indexF1Data(makeRawData());
  const root = buildDriverTree(1, tables);
  const filtered = buildDriverTree(1, tables, { fromYear: '2001', toYear: '2001' });
  assert.equal(filtered.id, root.id);
  assert.deepEqual(filtered.summary, { entries: 1, wins: 0, podiums: 1, points: 4, seasons: 1, constructors: 1 });
  assert.deepEqual(filtered.children.map((node) => node.constructorId), [10]);
  assert.deepEqual(filtered.children[0].summary, filtered.summary);
  assert.deepEqual(filtered.children[0].children[0].summary, filtered.summary);
  assert.deepEqual(raceNodes(filtered)[0], raceNodes(root).find((node) => node.raceId === 104));
  assert.equal(buildDriverTree(1, tables, { toYear: 2000 }).summary.entries, 3);
  assert.equal(buildDriverTree(1, tables, { fromYear: 2000, toYear: 2000 }).summary.entries, 3);
  assert.equal(buildDriverTree(1, tables, { fromYear: 2001 }).summary.entries, 1);
});

test('returns null for unavailable drivers, but an empty root for a range with no results', () => {
  const tables = indexF1Data(makeRawData());
  for (const id of [3, 9999, null, undefined, '', 'invalid']) {
    assert.equal(buildDriverTree(id, tables), null);
  }
  for (const options of [{ fromYear: 2050 }, { toYear: 1990 }, { fromYear: 2001, toYear: 2000 }]) {
    const root = buildDriverTree(1, tables, options);
    assert.equal(root.id, 'driver:1');
    assert.deepEqual(root.children, []);
    assert.deepEqual(root.summary, { entries: 0, wins: 0, podiums: 0, points: 0, seasons: 0, constructors: 0 });
  }
  assert.equal(buildDriverTree(1, indexF1Data()), null);
});

test('never uses positionOrder or numeric positionText as the classified position', () => {
  const raw = makeRawData();
  Object.assign(raw.results.find((row) => row.resultId === '1001'), { position: MISSING });
  Object.assign(raw.results.find((row) => row.resultId === '1002'), { position: '7', statusId: '5' });
  Object.assign(raw.results.find((row) => row.resultId === '1003'), { positionText: 'D', positionOrder: '3' });
  Object.assign(raw.results.find((row) => row.resultId === '1004'), { position: MISSING, positionText: 'N' });
  const root = buildDriverTree(1, indexF1Data(raw));
  const byResult = new Map(raceNodes(root).map((node) => [node.resultId, node]));
  assert.equal(byResult.get(1001).position, null);
  assert.equal(byResult.get(1001).resultLabel, 'Finished');
  assert.equal(byResult.get(1001).outcome, 'finished');
  assert.equal(byResult.get(1002).position, 7);
  assert.equal(byResult.get(1002).positionOrder, 2);
  assert.equal(byResult.get(1002).resultLabel, 'P7');
  assert.equal(byResult.get(1002).outcome, 'retired');
  assert.equal(byResult.get(1003).resultLabel, 'DSQ');
  assert.equal(byResult.get(1004).resultLabel, 'NC');
  assert.equal(root.summary.wins, 0);
  assert.equal(root.summary.podiums, 0);
  assert.equal(root.summary.entries, 4);
});

test('preserves null leaf values, sums missing points as zero and tolerates optional missing joins', () => {
  const raw = makeRawData();
  Object.assign(raw.results[0], { constructorId: MISSING, statusId: MISSING, grid: MISSING, points: MISSING });
  raw.results[1].constructorId = '999';
  const tables = indexF1Data(raw);
  const root = buildDriverTree(1, tables);
  const missing = raceNodes(root).find((node) => node.resultId === 1004);
  assert.equal(missing.constructorRef, null);
  assert.equal(missing.status, null);
  assert.equal(missing.statusId, null);
  assert.equal(missing.grid, null);
  assert.equal(missing.points, null);
  assert.equal(missing.outcome, 'unknown');
  assert.equal(missing.resultLabel, 'P3');
  assert.equal(root.summary.points, 16);
  assert.equal(root.children.find((node) => node.constructorId === 999).name, 'Unknown constructor 999');
  assert.equal(root.children.find((node) => node.constructorId === null).name, 'Unknown constructor');
});

test('an unknown race year stays null and is excluded when explicit year bounds apply', () => {
  const raw = makeRawData();
  raw.races.find((row) => row.raceId === '104').year = MISSING;
  const tables = indexF1Data(raw);
  const root = buildDriverTree(1, tables);
  const season = root.children.find((node) => node.constructorId === 10).children.at(-1);
  assert.equal(season.year, null);
  assert.equal(season.label, 'Unknown season');
  assert.equal(root.summary.seasons, 1);
  assert.deepEqual(tables.years, [1999, 2000]);
  assert.equal(buildDriverTree(1, tables, { fromYear: 1999 }).summary.entries, 3);
});

test('building and filtering do not mutate table Maps, result arrays or normalized rows', () => {
  const tables = indexF1Data(makeRawData());
  const before = structuredClone(tables);
  const first = buildDriverTree(1, tables);
  buildDriverTree(1, tables, { fromYear: 2001 });
  buildDriverTree(2, tables);
  assert.deepEqual(tables, before);
  assert.deepEqual(buildDriverTree(1, tables), first);
});
