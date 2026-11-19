import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { csvParse } from 'd3';
import { indexF1Data } from '../src/lib/loadF1Data.js';
import {
  ERAS, buildSeasonRows, buildSeasonTimeline, getEra, getQuadrant, indexFinalStandings, isEngineStatus,
  pearson, pickDefaultSeason, quadrantSplits, summarizeEras,
} from '../src/lib/engineReliability.js';
import { deepFreeze } from './fixtures.js';

const MISSING = '\\N';

function result(resultId, raceId, driverId, constructorId, fields = {}) {
  return {
    resultId, raceId, driverId, constructorId, number: '1', grid: '4', position: MISSING,
    positionText: 'R', positionOrder: '1', points: '0', laps: '10', statusId: '5', ...fields,
  };
}

const RAW = deepFreeze({
  drivers: [{ driverId: '1', forename: 'A', surname: 'One' }, { driverId: '2', forename: 'B', surname: 'Two' }, { driverId: '3', forename: 'C', surname: 'Three' }],
  constructors: [
    { constructorId: '10', constructorRef: 'mclaren', name: 'McLaren' },
    { constructorId: '20', constructorRef: 'ferrari', name: 'Ferrari' },
  ],
  races: [
    { raceId: '1', year: '2001', round: '1', name: 'First GP' }, { raceId: '2', year: '2001', round: '2', name: 'Second GP' },
    { raceId: '3', year: '2001', round: '3', name: 'Third GP' }, { raceId: '5', year: '1999', round: '1', name: 'Old GP' },
    { raceId: '6', year: '2026', round: '1', name: 'New GP' },
  ],
  status: [
    { statusId: '1', status: 'Finished' }, { statusId: '5', status: 'Engine' }, { statusId: '3', status: 'Accident' },
    { statusId: '81', status: 'Did not qualify' },
  ],
  results: [
    // McLaren 2001: fast (grid 1–2), two engine failures, one classified.
    result('1', '1', '1', '10', { grid: '1', position: '1', positionText: '1', points: '10', statusId: '1' }),
    result('2', '2', '1', '10', { grid: '2', position: '2', positionText: '2', points: '6', statusId: '1' }),
    result('3', '3', '1', '10', { grid: '1' }),
    result('4', '3', '3', '10', { grid: '0', position: '6', positionText: '6', points: '1' }),
    // Ferrari 2001: slower but finishes everything; one accident and one DNQ.
    result('5', '1', '2', '20', { grid: '3', position: '2', positionText: '2', points: '6', statusId: '1' }),
    result('6', '2', '2', '20', { grid: '3', position: '1', positionText: '1', points: '10', statusId: '1' }),
    result('7', '3', '2', '20', { grid: '5', position: '1', positionText: '1', points: '10', statusId: '1' }),
    result('8', '3', '3', '20', { grid: '6', statusId: '3' }),
    result('9', '2', '3', '20', { statusId: '81', positionText: 'F', grid: '0' }),
    result('10', '5', '1', '10'),
    result('11', '6', '1', '10'),
  ],
});
const STANDINGS = deepFreeze([
  { raceId: '2', constructorId: '10', position: '1' }, { raceId: '2', constructorId: '20', position: '2' },
  { raceId: '3', constructorId: '20', position: '1' }, { raceId: '3', constructorId: '10', position: '2' },
]);

function setup() {
  const tables = indexF1Data(RAW);
  return { tables, rows: buildSeasonRows(tables, indexFinalStandings(STANDINGS, tables.races)) };
}

test('engine statuses match exactly, ignoring case and whitespace', () => {
  assert.ok(isEngineStatus('Engine'));
  assert.ok(isEngineStatus(' power unit '));
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

test('final standings come from the last round with standings, not an earlier one', () => {
  const { tables } = setup();
  const standings = indexFinalStandings(STANDINGS, tables.races);
  assert.equal(standings.get('20:2001'), 1);
  assert.equal(standings.get('10:2001'), 2);
});

test('season rows combine speed, engine failures, wins and final rank', () => {
  const { rows } = setup();
  assert.deepEqual(rows.map((row) => row.id), ['20:2001', '10:2001'], 'champion first, 1999/2026 excluded');
  const [ferrari, mclaren] = rows;

  assert.equal(mclaren.starts, 4);
  assert.equal(mclaren.failures, 2, 'classified engine retirement counts');
  assert.equal(mclaren.wins, 1);
  assert.equal(mclaren.points, 17);
  assert.equal(mclaren.avgGrid, 4 / 3, 'grid 0 is ignored');
  assert.equal(mclaren.pointsPerFinish, 8);
  assert.equal(mclaren.pointsLost, 16);
  assert.equal(mclaren.finalPosition, 2);
  assert.equal(mclaren.isChampion, false);

  assert.equal(ferrari.starts, 4, 'DNQ is not a start');
  assert.equal(ferrari.failures, 0, 'accidents are not engine failures');
  assert.equal(ferrari.avgGrid, 17 / 4);
  assert.equal(ferrari.isChampion, true);
});

test('missing standings and missing grids stay null', () => {
  const tables = indexF1Data(RAW);
  const rows = buildSeasonRows(tables);
  assert.ok(rows.every((row) => row.finalPosition === null && row.isChampion === false));
});

test('era summaries compare champions with the whole field', () => {
  const { rows } = setup();
  const [v10, v8] = summarizeEras(rows);
  assert.equal(v10.fieldFailureRate, 2 / 8);
  assert.equal(v10.championFailureRate, 0);
  assert.equal(v10.speedCorrelation, null, 'fewer than three ranked seasons');
  assert.equal(v8.starts, 0);
  assert.equal(v8.championFailureRate, null);
});

test('quadrants split at the median grid and the starts-weighted failure rate', () => {
  const { rows } = setup();
  const splits = quadrantSplits(rows);
  assert.equal(splits.grid, (4 / 3 + 17 / 4) / 2);
  assert.equal(splits.failureRate, 2 / 8);
  assert.equal(getQuadrant(rows[1], splits), 'fastFragile');
  assert.equal(getQuadrant(rows[0], splits), 'slowReliable');
  assert.equal(quadrantSplits([]), null);
  assert.equal(getQuadrant({ avgGrid: null }, splits), null);
});

test('season timeline accumulates points and adds estimated losses at each failure', () => {
  const { tables, rows } = setup();
  const timeline = buildSeasonTimeline(tables, rows, 10, 2001);
  assert.equal(timeline.rival.constructorId, 20);
  assert.deepEqual(timeline.rounds.map((round) => round.cumulativeTeam), [10, 16, 17]);
  assert.deepEqual(timeline.rounds.map((round) => round.cumulativeRival), [6, 16, 26]);
  assert.deepEqual(timeline.rounds.map((round) => round.cumulativeWhatIf), [10, 16, 33]);
  assert.deepEqual(timeline.rounds[2].failures.map((failure) => failure.driver), ['A One', 'C Three']);
  assert.equal(timeline.gap, 9);
  assert.equal(timeline.failuresExplainGap, true);

  const champion = buildSeasonTimeline(tables, rows, 20, 2001);
  assert.equal(champion.rival.constructorId, 10, 'a champion is compared with the runner-up');
  assert.equal(champion.failuresExplainGap, false);
  assert.equal(buildSeasonTimeline(tables, rows, 99, 2001), null);
  assert.equal(pickDefaultSeason(tables, rows).id, '10:2001');
});

test('real data produces plausible seasons in all three eras', async () => {
  const files = ['results', 'races', 'drivers', 'constructors', 'status', 'constructor_standings'];
  const raw = Object.fromEntries(await Promise.all(files.map(async (name) => [
    name, csvParse(await readFile(new URL(`../public/data/${name}.csv`, import.meta.url), 'utf8')),
  ])));
  const tables = indexF1Data(raw);
  const rows = buildSeasonRows(tables, indexFinalStandings(raw.constructor_standings, tables.races));
  const years = ERAS.at(-1).toYear - ERAS[0].fromYear + 1;
  assert.equal(rows.filter((row) => row.isChampion).length, years, 'one champion per season');
  assert.equal(new Set(rows.map((row) => row.id)).size, rows.length);
  for (const row of rows) {
    assert.ok(row.failures <= row.starts && row.wins <= row.starts);
    assert.ok(row.avgGrid === null || row.avgGrid >= 1);
    assert.ok(Number.isFinite(row.pointsLost) && row.pointsLost >= 0);
  }
  for (const summary of summarizeEras(rows)) {
    assert.ok(summary.failures > 0);
    assert.ok(summary.speedCorrelation > 0.5, 'starting position tracks final rank');
  }
});
