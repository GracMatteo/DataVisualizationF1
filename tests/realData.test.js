import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { csvParse, hierarchy } from 'd3';
import { indexF1Data } from '../src/lib/loadF1Data.js';
import { buildDriverTree } from '../src/lib/buildDriverTree.js';
import { getTeamColor } from '../src/lib/teamColors.js';
import { raceNodes } from './fixtures.js';

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

test('a real classified retirement remains P7 despite Engine status', () => {
  const result = tables.results.get(7);
  assert.equal(result.position, 7);
  const node = raceNodes(buildDriverTree(result.driverId, tables))
    .find((race) => race.resultId === result.resultId);
  assert.equal(node.position, 7);
  assert.equal(node.status, 'Engine');
  assert.equal(node.outcome, 'retired');
  assert.equal(node.resultLabel, 'P7');
});

test('Gasly 2019 has chronological Red Bull and Toro Rosso groups for his midseason switch', () => {
  const driver = tables.availableDrivers.find((entry) => entry.driverRef === 'gasly');
  assert.ok(driver);
  const tree = buildDriverTree(driver.driverId, tables, { fromYear: 2019, toYear: 2019 });
  assert.deepEqual(tree.children.map((node) => node.constructorRef), ['red_bull', 'toro_rosso']);
  assert.equal(tree.summary.seasons, 1);
  assert.equal(tree.summary.constructors, 2);
  assert.equal(tree.children[0].children[0].children[0].round, 1);
  assert.equal(tree.children[1].children[0].children[0].round, 13);
  assert.equal(hierarchy(tree).leaves().length, tree.summary.entries);
});

test('every driver tree has exactly one leaf per result and ascending rounds within each season', () => {
  for (const driver of tables.availableDrivers) {
    const tree = buildDriverTree(driver.driverId, tables);
    assert.equal(raceNodes(tree).length, tables.resultsByDriver.get(driver.driverId).length);
    for (const constructor of tree.children) {
      const years = constructor.children.map((season) => season.year);
      assert.deepEqual(years, [...years].sort((a, b) => a - b));
      for (const season of constructor.children) {
        const rounds = season.children.map((race) => race.round);
        assert.deepEqual(rounds, [...rounds].sort((a, b) => a - b));
      }
    }
  }
});
