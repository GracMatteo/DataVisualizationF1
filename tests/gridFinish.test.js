import test from 'node:test';
import assert from 'node:assert/strict';
import { indexF1Data } from '../src/lib/loadF1Data.js';
import { countryIdentity } from '../src/lib/countryLabels.js';
import { formatPercent, formatRaces, formatSignedPlaces, formatStarts } from '../src/lib/formatSigned.js';
import { binGridFinish, circuitMatchesQuery, circuitOptions, collectGridStarts, filterGridStarts, indexCircuits, median, rankGridGroups, summarizePlaceGaps, summarizePoleStats } from '../src/lib/gridFinish.js';
import { makeRawData } from './fixtures.js';

const circuits = indexCircuits([{ circuitId: '1', name: 'Example Park', location: 'Test City', country: 'Testland' }]);
const collected = collectGridStarts(indexF1Data(makeRawData()), circuits);

test('keeps classified starts with a real grid and ignores positionOrder', () => {
  assert.deepEqual(collected.entries.map((entry) => entry.resultId), [1005, 1001, 1002, 1004]);
  assert.equal(collected.entries[1].placesGained, 0);
  assert.equal(collected.entries[1].circuitName, 'Example Park');
  assert.equal(collected.entries[1].countryKey, 'other:testland');
  assert.equal(collected.entries[1].countryLabel, 'Testland');
  assert.equal(collected.excluded[0].countryKey, 'other:testland');
  assert.equal(collected.excluded.filter((entry) => entry.reason === 'no-grid').length, 1);
  assert.equal(collected.excluded.some((entry) => entry.reason === 'unclassified'), false);
});

test('a missing circuit name does not drop the start', () => {
  const tables = indexF1Data(makeRawData());
  const [entry] = collectGridStarts(tables, new Map()).entries;
  assert.equal(entry.circuitName, 'Circuit 1');
  assert.equal(entry.country, null);
  assert.equal(entry.countryKey, 'unknown');
  assert.equal(entry.countryLabel, 'Pays non enregistré');
});

test('season and circuit filters are inclusive and rebuild the grid domain', () => {
  const season = filterGridStarts(collected.entries, { fromYear: 2000, toYear: 2000 });
  assert.deepEqual(season.map((entry) => entry.resultId), [1001, 1002]);
  const model = binGridFinish(season);
  assert.equal(model.count, 2);
  assert.equal(model.maxGrid, 1);
  assert.equal(model.maxPosition, 2);
  assert.equal(model.medianGain, -0.5);
  assert.equal(model.samePlace, 1);
  assert.equal(model.cells.find((cell) => cell.key === '1:1').count, 1);
  assert.equal(filterGridStarts(collected.entries, { circuitId: 99 }).length, 0);
  assert.equal(filterGridStarts(collected.entries, { countryKey: 'other:testland' }).length, 4);
  assert.equal(filterGridStarts(collected.entries, { countryKey: 'france', circuitId: 1 }).length, 0);
});

test('USA and United States are one country, ranked by the signed median', () => {
  assert.equal(countryIdentity('USA').key, countryIdentity('United States').key);
  assert.equal(countryIdentity('USA').label, 'États-Unis');
  assert.deepEqual(countryIdentity(null), { key: 'unknown', label: 'Pays non enregistré' });
  const entries = [
    { circuitId: 44, circuitName: 'Las Vegas Street Circuit', country: 'USA', placesGained: 0, grid: 1, position: 1 },
    { circuitId: 80, circuitName: 'Las Vegas Strip Street Circuit', country: 'United States', placesGained: 0, grid: 2, position: 2 },
    { circuitId: 1, circuitName: 'Alpha', country: 'France', placesGained: 4, grid: 5, position: 1 },
    { circuitId: 1, circuitName: 'Alpha', country: 'France', placesGained: 0, grid: 1, position: 1 },
    { circuitId: 2, circuitName: 'Beta', country: 'Spain', placesGained: 1, grid: 2, position: 1, raceId: 2 },
    { circuitId: 3, circuitName: 'Gamma', country: 'Italy', placesGained: -4, grid: 1, position: 5, raceId: 3 },
    { circuitId: 3, circuitName: 'Gamma', country: 'Italy', placesGained: -4, grid: 2, position: 6, raceId: 4 },
  ];
  const countries = rankGridGroups(entries, 'country');
  assert.deepEqual(countries.map((row) => row.label), ['France', 'Espagne', 'États-Unis', 'Italie']);
  assert.equal(countries[0].circuitCount, 1);
  assert.equal(countries[0].samePlace, 1);
  assert.equal(countries[0].medianGain, 2);
  assert.equal(countries[2].id, 'united-states');
  assert.equal(countries[2].circuitCount, 2);
  assert.equal(countries[2].medianGain, 0);
  const circuits = rankGridGroups(entries, 'circuit');
  assert.deepEqual(circuits.map((row) => row.id), ['circuit:1', 'circuit:2', 'circuit:44', 'circuit:80', 'circuit:3']);
  assert.equal(circuits[0].raceCount, 1);
  assert.equal(circuits.at(-1).medianGain, -4);
  assert.equal(circuits.at(-1).raceCount, 2);
  assert.equal(countries[3].raceCount, 2);
});

test('circuit options count distinct races and put the busiest circuit first', () => {
  const entries = [
    { circuitId: 1, circuitName: 'Rare', country: 'France', raceId: 1 },
    { circuitId: 2, circuitName: 'Busy', country: 'Italy', raceId: 10 },
    { circuitId: 2, circuitName: 'Busy', country: 'Italy', raceId: 10 },
    { circuitId: 2, circuitName: 'Busy', country: 'Italy', raceId: 11 },
    { circuitId: 3, circuitName: 'Medium', country: 'Spain', raceId: 20 },
    { circuitId: 3, circuitName: 'Medium', country: 'Spain', raceId: 21 },
    { circuitId: 3, circuitName: 'Medium', country: 'Spain', raceId: 22 },
  ];
  const options = circuitOptions(entries);
  assert.deepEqual(options.map((circuit) => circuit.name), ['Medium', 'Busy', 'Rare']);
  assert.deepEqual(options.map((circuit) => circuit.raceCount), [3, 2, 1]);
  assert.equal(circuitMatchesQuery(options[2], '  rare '), true);
  assert.equal(circuitMatchesQuery({ name: 'Silverstone Circuit', countryLabel: 'Royaume-Uni', country: 'UK' }, 'royaume'), true);
  assert.equal(circuitMatchesQuery({ name: 'Silverstone Circuit', countryLabel: 'Royaume-Uni', country: 'UK' }, 'états'), false);
  assert.equal(circuitMatchesQuery(options[0], ''), true);
});

test('signed place labels use a comma and a plus sign', () => {
  assert.equal(formatSignedPlaces(null), '—');
  assert.equal(formatSignedPlaces(0), '0');
  assert.equal(formatSignedPlaces(2), '+2');
  assert.equal(formatSignedPlaces(1.24), '+1,2');
  assert.equal(formatSignedPlaces(-0.5), '-0,5');
  assert.equal(formatStarts(1), '1 départ');
  assert.equal(formatStarts(1, true), '1 départ classé');
  assert.equal(formatStarts(28, true), '28 départs classés');
  assert.equal(formatRaces(1), '1 course');
  assert.equal(formatRaces(10), '10 courses');
  assert.equal(formatPercent(1, 4), '25 %');
  assert.equal(formatPercent(1, 3), '33,3 %');
  assert.equal(formatPercent(0, 10), '0 %');
  assert.equal(formatPercent(2, 0), '—');
});

test('pole stats count grid 1, wins, and each race once', () => {
  const stats = summarizePoleStats([
    { grid: 1, position: 1, raceId: 1 },
    { grid: 1, position: 2, raceId: 1 },
    { grid: 4, position: 1, raceId: 2 },
  ]);
  assert.deepEqual(stats, {
    raceCount: 2,
    classified: 3,
    gridOne: 2,
    gridOneWins: 1,
    wins: 2,
  });
  assert.deepEqual(summarizePoleStats([]), {
    raceCount: 0,
    classified: 0,
    gridOne: 0,
    gridOneWins: 0,
    wins: 0,
  });
});

test('a chosen circuit keeps every exact gap and counts each race once', () => {
  const entries = [
    { id: 'b', placesGained: 6, grid: 8, position: 2, raceId: 1, year: 1970, round: 2, circuitName: 'Monza', driverName: 'Beta' },
    { id: 'a', placesGained: 6, grid: 10, position: 4, raceId: 1, year: 1970, round: 1, circuitName: 'Monza', driverName: 'Alpha' },
    { placesGained: 0, grid: 1, position: 1, raceId: 2 },
    { placesGained: -2, grid: 3, position: 5, raceId: 2 },
  ];
  const detail = summarizePlaceGaps(entries);
  assert.equal(detail.raceCount, 2);
  assert.equal(detail.count, 4);
  assert.equal(detail.gained, 2);
  assert.equal(detail.lost, 1);
  assert.equal(detail.samePlace, 1);
  assert.equal(detail.medianGain, 3);
  assert.deepEqual(detail.gaps.map(({ gap, count }) => ({ gap, count })), [
    { gap: 6, count: 2 },
    { gap: 0, count: 1 },
    { gap: -2, count: 1 },
  ]);
  assert.equal(detail.gaps[0].starts, undefined);
  assert.deepEqual(summarizePlaceGaps([]), {
    count: 0,
    raceCount: 0,
    medianGain: null,
    samePlace: 0,
    gained: 0,
    lost: 0,
    gaps: [],
  });
});

test('median uses the central value, or the mean of the two central values', () => {
  assert.equal(median([]), null);
  assert.equal(median([4, 1, 3]), 3);
  assert.equal(median([1, 4]), 2.5);
});
