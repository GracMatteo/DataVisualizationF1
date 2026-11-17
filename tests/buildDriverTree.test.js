import test from 'node:test';
import assert from 'node:assert/strict';
import { hierarchy } from 'd3';
import { indexF1Data } from '../src/lib/loadF1Data.js';
import { buildDriverTree } from '../src/lib/buildDriverTree.js';
import { getRaceGroupKey, RESULT_GROUPS } from '../src/lib/raceResultGroups.js';
import { allNodes, makeRawData, MISSING, raceNodes } from './fixtures.js';

const SUMMARY = { entries: 4, wins: 1, podiums: 3, points: 20, seasons: 2, constructors: 2 };

function makeGroupedRawData() {
  const raw = makeRawData();
  const race = raw.races.find((row) => row.raceId === '101');
  const result = raw.results.find((row) => row.resultId === '1001');
  const cases = [
    { position: MISSING, positionText: 'W', statusId: '54', points: '0' },
    { position: '7', statusId: '5', points: '2' },
    { position: '2', statusId: '2', points: '6' },
    { position: '12', points: '0' },
    { position: '11', points: '1' },
    { position: '3', points: '4' },
    { position: '2', points: '6' },
    { position: '1', points: '10' },
    { position: MISSING, positionText: 'R', statusId: '5', points: '0' },
    { position: '5', points: MISSING },
    { position: MISSING, positionText: '1', positionOrder: '1', points: '0' },
    { position: '4', points: '3' },
  ];
  raw.races = cases.map((_, index) => ({
    ...race, raceId: String(201 + index), round: String(index + 1),
    date: `2000-${String(index + 1).padStart(2, '0')}-01`,
  }));
  raw.results = cases.map((fields, index) => ({
    ...result, resultId: String(2001 + index), raceId: raw.races[index].raceId,
    positionText: fields.position, ...fields,
  })).reverse();
  return raw;
}

test('joins a plain driver/constructor/season/resultGroup/race tree with summaries and D3-compatible leaves', () => {
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

  assert.deepEqual(season.children.map((group) => group.groupKey), ['win', 'retired']);
  const winGroup = season.children[0];
  assert.deepEqual(winGroup, {
    id: `${season.id}/group:win`,
    type: 'resultGroup', name: 'P1', groupKey: 'win', year: 2000,
    constructorId: 20, constructorRef: 'first_team',
    summary: { entries: 1, wins: 1, podiums: 1, points: 10, seasons: 1, constructors: 1 },
    children: winGroup.children,
  });
  const firstRace = winGroup.children[0];
  assert.deepEqual(firstRace, {
    id: 'driver:1/constructor:20/season:2000/result:1001',
    type: 'race', name: 'First Grand Prix', raceName: 'First Grand Prix',
    resultId: 1001, raceId: 101, driverId: 1, constructorId: 20,
    constructorRef: 'first_team', year: 2000, round: 1, date: '2000-03-01',
    grid: 1, position: 1, positionOrder: 1, positionText: '1', statusId: 1,
    status: 'Finished', points: 10, outcome: 'finished', resultLabel: 'P1',
  });
  const retirement = season.children[1].children[0];
  assert.equal(retirement.status, 'Engine');
  assert.equal(retirement.position, null);
  assert.equal(retirement.positionOrder, 15);
  assert.equal(retirement.outcome, 'retired');
  assert.equal(retirement.resultLabel, 'DNF');
  assert.equal(hierarchy(root).leaves().length, 4);
  const ids = allNodes(root).map((node) => node.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('orders constructors by first race, seasons by year and races within result groups through midseason switches', () => {
  const raw = makeRawData();
  const root = buildDriverTree(1, indexF1Data(raw));
  // IDs and alphabetical names both put the later team first; chronology must not.
  assert.deepEqual(root.children.map((node) => node.constructorId), [20, 10]);
  assert.deepEqual(root.children[0].children.map((node) => node.year), [2000]);
  assert.deepEqual(root.children[1].children.map((node) => node.year), [2000, 2001]);
  assert.deepEqual(root.children[0].children[0].children.map((group) => group.children.map((race) => race.round)), [[1], [3]]);
  assert.deepEqual(root.children[1].children[0].children.map((group) => group.children.map((race) => race.round)), [[2]]);
  assert.deepEqual(root.children[1].children[1].children.map((group) => group.children.map((race) => race.round)), [[1]]);

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
  const filteredSeason = filtered.children[0].children[0];
  assert.deepEqual(filteredSeason.summary, filtered.summary);
  assert.deepEqual(filteredSeason.children.map((group) => group.groupKey), ['third']);
  assert.deepEqual(filteredSeason.children[0].summary, filtered.summary);
  const originalSeason = root.children[1].children.find((season) => season.year === 2001);
  assert.deepEqual(filteredSeason.children, originalSeason.children);
  assert.deepEqual(raceNodes(filtered)[0], raceNodes(root).find((node) => node.raceId === 104));
  const survivingIds = new Set(allNodes(root).map((node) => node.id));
  assert.ok(allNodes(filtered).every((node) => survivingIds.has(node.id)));
  const earlier = buildDriverTree(1, tables, { toYear: 2000 });
  assert.deepEqual(allNodes(earlier).filter((node) => node.type === 'resultGroup')
    .map((group) => group.groupKey), ['win', 'retired', 'second']);
  for (const node of allNodes(earlier).filter((node) => node.children)) {
    assert.equal(node.summary.entries, raceNodes(node).length);
    assert.equal(node.summary.points, raceNodes(node).reduce((total, race) => total + (race.points ?? 0), 0));
  }
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
  const missingGroup = allNodes(root).find((node) => node.type === 'resultGroup'
    && node.children.some((race) => race.resultId === 1004));
  assert.equal(missingGroup.groupKey, 'unclassified');
  assert.deepEqual(missingGroup.summary, { entries: 1, wins: 0, podiums: 1, points: 0, seasons: 1, constructors: 0 });
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
  assert.equal(season.children[0].year, null);
  assert.equal(season.children[0].summary.seasons, 0);
  assert.equal(root.summary.seasons, 1);
  assert.deepEqual(tables.years, [1999, 2000]);
  assert.equal(buildDriverTree(1, tables, { fromYear: 1999 }).summary.entries, 3);
});

test('builds only nonempty categories in fixed order, preserving every result and original branch summaries', () => {
  const raw = makeGroupedRawData();
  const tables = indexF1Data(raw);
  const before = structuredClone(tables);
  const root = buildDriverTree(1, tables);
  const constructor = root.children[0];
  const season = constructor.children[0];
  const groups = season.children;
  const summary = { entries: 12, wins: 1, podiums: 4, points: 32, seasons: 1, constructors: 1 };
  assert.deepEqual(root.summary, summary);
  assert.deepEqual(constructor.summary, summary);
  assert.deepEqual(season.summary, summary);
  assert.deepEqual(groups.map((group) => ({ key: group.groupKey, label: group.name })), RESULT_GROUPS);
  assert.deepEqual(groups.map((group) => group.children.map((race) => race.round)), [
    [8], [7], [6], [5, 12], [4, 10, 11], [2, 9], [1, 3],
  ]);
  for (const group of groups) {
    assert.equal(group.id, `${season.id}/group:${group.groupKey}`);
    assert.equal(group.type, 'resultGroup');
    assert.equal(group.year, season.year);
    assert.equal(group.constructorId, constructor.constructorId);
    assert.equal(group.constructorRef, constructor.constructorRef);
    assert.ok(group.children.length > 0);
    assert.ok(group.children.every((race) => race.type === 'race' && getRaceGroupKey(race) === group.groupKey));
    assert.deepEqual(group.summary, {
      entries: group.children.length,
      wins: group.children.filter((race) => race.position === 1).length,
      podiums: group.children.filter((race) => race.position > 0 && race.position <= 3).length,
      points: group.children.reduce((total, race) => total + (race.points ?? 0), 0),
      seasons: 1,
      constructors: 1,
    });
    for (const leaf of group.children) {
      assert.equal(leaf.id, `${season.id}/result:${leaf.resultId}`);
      assert.equal(leaf.raceId, tables.results.get(leaf.resultId).raceId);
      assert.equal(leaf.driverId, 1);
    }
  }
  const leaves = raceNodes(root);
  assert.deepEqual(leaves.map((race) => race.resultId).sort((a, b) => a - b),
    [...tables.results.keys()].sort((a, b) => a - b));
  assert.equal(new Set(leaves.map((race) => race.id)).size, raw.results.length);
  assert.equal(hierarchy(root).leaves().length, raw.results.length);
  assert.ok(hierarchy(root).leaves().every((leaf) => leaf.depth === 4));
  assert.equal(groups.find((group) => group.groupKey === 'points').children[0].position, 11);
  const missingPoints = groups.find((group) => group.groupKey === 'other').children.find((race) => race.round === 10);
  assert.equal(missingPoints.points, null);
  const retired = groups.find((group) => group.groupKey === 'retired');
  assert.equal(retired.children[0].position, 7);
  assert.equal(retired.children[0].resultLabel, 'P7');
  assert.deepEqual(retired.children.map((race) => race.outcome), ['retired', 'retired']);
  assert.deepEqual(groups.find((group) => group.groupKey === 'unclassified').children.map((race) => race.outcome), ['dns', 'dsq']);
  assert.deepEqual(tables, before);
});

test('race IDs stay unchanged when a result moves to a different category', () => {
  const raw = makeGroupedRawData();
  const first = buildDriverTree(1, indexF1Data(raw));
  const firstSeason = first.children[0].children[0];
  const winner = firstSeason.children.find((group) => group.groupKey === 'win').children[0];
  Object.assign(raw.results.find((row) => row.resultId === String(winner.resultId)), { position: '8', positionText: '8' });
  const updated = buildDriverTree(1, indexF1Data(raw));
  const updatedSeason = updated.children[0].children[0];
  assert.ok(!updatedSeason.children.some((group) => group.groupKey === 'win'));
  const scored = updatedSeason.children.find((group) => group.groupKey === 'points');
  const moved = scored.children.find((race) => race.resultId === winner.resultId);
  assert.equal(moved.id, winner.id);
  assert.equal(scored.id, firstSeason.children.find((group) => group.groupKey === 'points').id);
  assert.equal(updated.summary.entries, first.summary.entries);
  assert.equal(updated.summary.points, first.summary.points);
});

test('races within each group use round, date, race ID and result ID chronology rather than input order', () => {
  const raw = makeRawData();
  raw.results = raw.results.filter((row) => row.driverId === '1').map((row) => ({
    ...row, constructorId: '20', position: '4', positionText: '4', statusId: '1', points: '1',
  }));
  raw.results.push({ ...raw.results.find((row) => row.resultId === '1002'), resultId: '1006' });
  for (const race of raw.races) {
    race.year = '2000';
    race.round = race.raceId === '104' ? '2' : '1';
    race.date = race.raceId === '103' ? '2000-02-01' : '2000-01-01';
  }
  const tree = buildDriverTree(1, indexF1Data(raw));
  const season = tree.children[0].children[0];
  assert.deepEqual(season.children.map((group) => group.groupKey), ['points']);
  assert.deepEqual(season.children[0].children.map((race) => race.resultId), [1001, 1002, 1006, 1003, 1004]);
  const reversed = Object.fromEntries(Object.entries(raw).map(([key, rows]) => [key, [...rows].reverse()]));
  assert.deepEqual(buildDriverTree(1, indexF1Data(reversed)), tree);
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
