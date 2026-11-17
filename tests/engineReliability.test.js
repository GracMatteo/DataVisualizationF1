import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { csvParse } from 'd3';
import { indexF1Data } from '../src/lib/loadF1Data.js';
import { ERAS, buildEraRows, getEra, isEngineStatus, pearson, summarizeEras } from '../src/lib/engineReliability.js';
import { deepFreeze } from './fixtures.js';

const MISSING = '\\N';

function result(resultId, raceId, driverId, constructorId, fields = {}) {
  return {
    resultId, raceId, driverId, constructorId, number: '1', grid: '1', position: MISSING,
    positionText: 'R', positionOrder: '1', points: '0', laps: '10', statusId: '5', ...fields,
  };
}

function makeTables() {
  return indexF1Data(deepFreeze({
    drivers: [{ driverId: '1', forename: 'A', surname: 'One' }, { driverId: '2', forename: 'B', surname: 'Two' }],
    constructors: [{ constructorId: '10', constructorRef: 'ferrari', name: 'Ferrari' }, { constructorId: '20', constructorRef: 'minardi', name: 'Minardi' }],
    races: [
      { raceId: '1', year: '2001', round: '1' }, { raceId: '2', year: '2001', round: '2' },
      { raceId: '3', year: '2001', round: '3' }, { raceId: '4', year: '2014', round: '1' },
      { raceId: '5', year: '1999', round: '1' }, { raceId: '6', year: '2026', round: '1' },
    ],
    status: [
      { statusId: '1', status: 'Finished' }, { statusId: '5', status: 'Engine' }, { statusId: '3', status: 'Accident' },
      { statusId: '81', status: 'Did not qualify' }, { statusId: '131', status: 'Power Unit' },
    ],
    results: [
      result('1', '1', '1', '10', { position: '1', positionText: '1', points: '10', statusId: '1' }),
      result('2', '2', '1', '10', { position: '3', positionText: '3', points: '6', statusId: '1' }),
      result('3', '3', '1', '10'),
      // Classified engine retirement still counts as a failure.
      result('4', '3', '2', '10', { position: '6', positionText: '6', points: '1' }),
      result('5', '1', '2', '20', { statusId: '3' }),
      result('6', '2', '2', '20', { statusId: '81', positionText: 'F' }),
      result('7', '4', '1', '10', { statusId: '131' }),
      result('8', '5', '1', '10'),
      result('9', '6', '1', '10'),
    ],
  }));
}

test('engine statuses match exactly, ignoring case and whitespace', () => {
  assert.ok(isEngineStatus('Engine'));
  assert.ok(isEngineStatus(' power unit '));
  assert.ok(isEngineStatus('ERS'));
  assert.equal(isEngineStatus('Gearbox'), false);
  assert.equal(isEngineStatus('Accident'), false);
  assert.equal(isEngineStatus(null), false);
});

test('eras are contiguous and exclude years outside them', () => {
  for (let index = 1; index < ERAS.length; index += 1) assert.equal(ERAS[index].fromYear, ERAS[index - 1].toYear + 1);
  assert.equal(getEra(1999), null);
  assert.equal(getEra(2005).id, 'v10');
  assert.equal(getEra(2006).id, 'v8');
  assert.equal(getEra(2025).id, 'hybrid');
  assert.equal(getEra(2026), null);
});

test('pearson handles perfect, inverse and degenerate inputs', () => {
  assert.equal(pearson([[0, 0], [1, 1], [2, 2]]), 1);
  assert.equal(pearson([[0, 2], [1, 1], [2, 0]]), -1);
  assert.equal(pearson([[1, 0], [1, 1], [1, 2]]), null);
  assert.equal(pearson([[0, 0], [1, 1]]), null);
});

test('constructor-era rows count starts, failures, wins and estimated lost points', () => {
  const rows = buildEraRows(makeTables());
  const ferrari = rows.find((row) => row.id === 'v10:10');
  assert.deepEqual(
    { starts: ferrari.starts, failures: ferrari.failures, wins: ferrari.wins, points: ferrari.points, seasons: ferrari.seasons },
    { starts: 4, failures: 2, wins: 1, points: 17, seasons: 1 },
  );
  // Two finished starts averaged 8 points, so two engine failures cost about 16.
  assert.equal(ferrari.pointsLost, 16);
  assert.equal(ferrari.failureRate, 0.5);
  assert.equal(ferrari.lostShare, 16 / 33);

  const minardi = rows.find((row) => row.id === 'v10:20');
  assert.equal(minardi.starts, 1, 'DNQ is not a start');
  assert.equal(minardi.failures, 0, 'accidents are not engine failures');
  assert.equal(minardi.pointsLost, 0);
  assert.equal(minardi.pointsShare, 0);
  assert.equal(ferrari.pointsShare, 1);

  const hybrid = rows.find((row) => row.id === 'hybrid:10');
  assert.equal(hybrid.failures, 1);
  assert.equal(hybrid.pointsLost, 0, 'no finished start that season means no estimate');
  assert.equal(rows.length, 3, '1999 and 2026 are outside every era');
});

test('summaries filter by starts but keep era totals from every constructor', () => {
  const rows = buildEraRows(makeTables());
  const [v10] = summarizeEras(rows, { minStarts: 2 });
  assert.deepEqual(v10.rows.map((row) => row.constructorId), [10]);
  assert.equal(v10.hidden, 1);
  assert.equal(v10.starts, 5);
  assert.equal(v10.failureRate, 2 / 5);
  assert.equal(v10.correlation, null);
});

test('real data produces plausible rows in all three eras', async () => {
  const files = ['results', 'races', 'drivers', 'constructors', 'status'];
  const raw = Object.fromEntries(await Promise.all(files.map(async (name) => [
    name, csvParse(await readFile(new URL(`../public/data/${name}.csv`, import.meta.url), 'utf8')),
  ])));
  const rows = buildEraRows(indexF1Data(raw));
  const summaries = summarizeEras(rows, { minStarts: 40 });
  for (const summary of summaries) {
    assert.ok(summary.rows.length >= 8, `${summary.era.id} has enough teams`);
    assert.ok(summary.failures > 0);
    const shareSum = rows.filter((row) => row.eraId === summary.era.id).reduce((sum, row) => sum + row.pointsShare, 0);
    assert.ok(Math.abs(shareSum - 1) < 1e-9, 'points shares sum to 1 per era');
  }
  for (const row of rows) {
    assert.ok(row.failures <= row.starts);
    assert.ok(row.wins <= row.starts);
    assert.ok(row.pointsLost >= 0 && Number.isFinite(row.pointsLost));
  }
  const ids = rows.map((row) => row.id);
  assert.equal(new Set(ids).size, ids.length, 'row ids are unique');
});
