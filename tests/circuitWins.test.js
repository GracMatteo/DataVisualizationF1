import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { csvParse } from 'd3'
import { indexF1Data } from '../src/lib/loadF1Data.js'
import { indexCircuits } from '../src/lib/loadCircuits.js'
import {
  buildRaceWinners, circuitFocusFor, circuitLeaderboard, circuitSpans, decadeRows, filterRaces, seasonTimeline, summarizeCircuits, winnerMarks, winsFor,
} from '../src/lib/circuitWins.js'
import { MARKER_RADIUS, buildCircuitMarkers, createMarkerRadius, winShares } from '../src/lib/circuitMarkers.js'
import { getTeamColor } from '../src/lib/teamColors.js'

const N = '\\N'
const race = (raceId, year, round, circuitId) => ({ raceId: String(raceId), year: String(year), round: String(round), circuitId: String(circuitId), name: `GP ${raceId}`, date: `${year}-01-0${round}` })
let nextResult = 1
const result = (raceId, constructorId, position, positionOrder = position ?? 20) => ({
  resultId: String(nextResult++), raceId: String(raceId), driverId: '1', constructorId: String(constructorId),
  position: position === null ? N : String(position), positionText: position === null ? 'R' : String(position),
  positionOrder: String(positionOrder), points: '0', statusId: '1',
})

// Circuit 1 (France): A wins 2000 and 2002, B wins 2001 -> A leads.
// Circuit 2 (Italy): A wins 2000, B wins 2001 -> tie; A reached the total first, so it is listed first.
// Circuit 3 (Italy): only race has no classified P1 (positionOrder 1 alone must not count).
// Circuit 4 (Spain): shared drive, A and B both credited with P1 in the same race; two A rows count once.
function fixture() {
  const races = [race(1, 2000, 1, 1), race(2, 2001, 1, 1), race(3, 2002, 1, 1), race(4, 2000, 2, 2), race(5, 2001, 2, 2), race(6, 2003, 1, 3), race(7, 2003, 2, 4), race(8, 2050, 1, 1)]
  const results = [
    result(1, 10, 1), result(1, 20, 2), result(2, 20, 1), result(3, 10, 1),
    result(4, 10, 1), result(5, 20, 1),
    result(6, 10, null, 1),
    result(7, 10, 1), result(7, 10, 1), result(7, 20, 1),
  ]
  const tables = indexF1Data({
    races, results,
    drivers: [{ driverId: '1', driverRef: 'd', forename: 'D', surname: 'One' }],
    constructors: [{ constructorId: '10', constructorRef: 'ferrari', name: 'Alpha' }, { constructorId: '20', constructorRef: 'mclaren', name: 'Beta' }],
    status: [{ statusId: '1', status: 'Finished' }],
  })
  const circuits = indexCircuits([
    { circuitId: '1', circuitRef: 'c1', name: 'One', location: 'Paris', country: 'France', lat: '48.8', lng: '2.3' },
    { circuitId: '2', circuitRef: 'c2', name: 'Two', location: 'Monza', country: 'Italy', lat: '45.6', lng: '9.2' },
    { circuitId: '3', circuitRef: 'c3', name: 'Three', location: N, country: 'Italy', lat: N, lng: N },
    { circuitId: '4', circuitRef: 'c4', name: 'Four', location: 'Jerez', country: 'Spain', lat: '36.7', lng: '-6.0' },
    { circuitId: 'x', name: 'Invalid' },
  ])
  return { tables, circuits, raceWinners: buildRaceWinners(tables) }
}

test('circuits are indexed by numeric ID with missing values kept as null', () => {
  const { circuits } = fixture()
  assert.deepEqual([...circuits.keys()], [1, 2, 3, 4])
  assert.equal(circuits.get(3).lat, null)
  assert.equal(circuits.get(3).location, null)
  assert.equal(circuits.get(1).lng, 2.3)
})

test('race winners use classified position 1, ignore unraced schedule entries and sort chronologically', () => {
  const { raceWinners } = fixture()
  assert.deepEqual(raceWinners.map((r) => r.raceId), [1, 4, 2, 5, 3, 6, 7])
  assert.deepEqual(raceWinners.find((r) => r.raceId === 6).constructorIds, [], 'positionOrder 1 without position is not a win')
  assert.deepEqual(raceWinners.find((r) => r.raceId === 7).constructorIds, [10, 20], 'shared drive credits each constructor once')
  assert.ok(!raceWinners.some((r) => r.raceId === 8), 'a race without results is not a Grand Prix held')
})

test('race winners keep the distinct winning driver and constructor pairs', () => {
  const { raceWinners } = fixture()
  assert.deepEqual(raceWinners.find((r) => r.raceId === 1).winners, [{ driverId: 1, constructorId: 10 }])
  assert.deepEqual(raceWinners.find((r) => r.raceId === 6).winners, [], 'no classified P1, no winning driver')
  assert.deepEqual(raceWinners.find((r) => r.raceId === 7).winners, [{ driverId: 1, constructorId: 10 }, { driverId: 1, constructorId: 20 }])
})

test('winner marks deduplicate driver and constructor seasons for navigation', () => {
  const { raceWinners } = fixture()
  const marks = winnerMarks(raceWinners.filter((r) => [1, 4, 6, 7].includes(r.raceId)))
  assert.deepEqual(marks.drivers, [{ driverId: 1, year: 2000 }, { driverId: 1, year: 2003 }])
  assert.deepEqual(marks.constructors, [{ constructorId: 10, year: 2000 }, { constructorId: 10, year: 2003 }, { constructorId: 20, year: 2003 }])
  assert.deepEqual(winnerMarks([]), { drivers: [], constructors: [] })
})

test('season and country filters are inclusive and reject reversed ranges', () => {
  const { raceWinners, circuits } = fixture()
  assert.deepEqual(filterRaces(raceWinners, circuits, { fromYear: 2001, toYear: 2002 }).map((r) => r.raceId), [2, 5, 3])
  assert.deepEqual(filterRaces(raceWinners, circuits, { country: 'Italy' }).map((r) => r.raceId), [4, 5, 6])
  assert.deepEqual(filterRaces(raceWinners, circuits, { fromYear: 2003, toYear: 2000 }), [])
  assert.equal(filterRaces(raceWinners, circuits).length, raceWinners.length)
})

test('circuit and country selections from another view restrict the races', () => {
  const { raceWinners, circuits } = fixture()
  assert.deepEqual(filterRaces(raceWinners, circuits, { circuitIds: [2, 4] }).map((r) => r.raceId), [4, 5, 7])
  assert.deepEqual(filterRaces(raceWinners, circuits, { countries: ['France', 'Spain'] }).map((r) => r.raceId), [1, 2, 3, 7])
  assert.deepEqual(filterRaces(raceWinners, circuits, { countries: ['Italy'], circuitIds: [3], fromYear: 2003 }).map((r) => r.raceId), [6])
  assert.deepEqual(filterRaces(raceWinners, circuits, { circuitIds: [] }), [])
})

test('a list of race entries becomes a Circuits focus by circuit or by country', () => {
  const entries = [
    { circuitId: 1, country: 'France', year: 2001 },
    { circuitId: 2, country: 'Italy', year: 1998 },
    { circuitId: 2, country: 'Italy', year: 2004 },
    { circuitId: null, country: null, year: 1950 },
  ]
  assert.deepEqual(circuitFocusFor(entries, 'circuit'), { circuitIds: [1, 2], fromYear: 1998, toYear: 2004 })
  assert.deepEqual(circuitFocusFor(entries, 'country'), { countries: ['France', 'Italy'], fromYear: 1998, toYear: 2004 })
  assert.deepEqual(circuitFocusFor(entries.slice(1, 3), 'circuit'), { circuitId: 2, fromYear: 1998, toYear: 2004 })
  assert.deepEqual(circuitFocusFor(entries.slice(1, 2), 'country'), { country: 'Italy', fromYear: 1998, toYear: 1998 })
  assert.equal(circuitFocusFor(entries.slice(3), 'circuit'), null)
})

test('circuit summaries rank constructors and expose outright leaders and ties', () => {
  const { raceWinners } = fixture()
  const summaries = summarizeCircuits(raceWinners)
  const one = summaries.get(1)
  assert.equal(one.raceCount, 3)
  assert.deepEqual([one.firstYear, one.lastYear], [2000, 2002])
  assert.deepEqual(one.standings, [{ constructorId: 10, wins: 2 }, { constructorId: 20, wins: 1 }])
  assert.equal(one.leaderId, 10)
  assert.deepEqual(one.tiedLeaderIds, [])

  const two = summaries.get(2)
  assert.equal(two.leaderId, null)
  assert.deepEqual(two.tiedLeaderIds, [10, 20])
  assert.deepEqual(two.standings.map((s) => s.constructorId), [10, 20], 'tie ordered by who reached the total first')

  const three = summaries.get(3)
  assert.equal(three.raceCount, 1)
  assert.deepEqual(three.standings, [])
  assert.equal(three.leaderId, null)
  assert.deepEqual(three.tiedLeaderIds, [])

  assert.equal(winsFor(one, 20), 1)
  assert.equal(winsFor(one, 99), 0)
  assert.equal(winsFor(undefined, 10), 0)
})

test('filtering changes the leader of a circuit', () => {
  const { raceWinners, circuits } = fixture()
  const summaries = summarizeCircuits(filterRaces(raceWinners, circuits, { fromYear: 2001, toYear: 2001 }))
  assert.equal(summaries.get(1).leaderId, 20)
  assert.equal(summaries.has(4), false)
})

test('the leaderboard counts outright and shared circuit leads', () => {
  const { raceWinners } = fixture()
  const board = circuitLeaderboard(summarizeCircuits(raceWinners))
  assert.deepEqual(board, [
    { constructorId: 10, led: 1, shared: 2, wins: 4 },
    { constructorId: 20, led: 0, shared: 2, wins: 3 },
  ])
  assert.deepEqual(circuitLeaderboard(new Map()), [])
})

test('archive spans ignore filters', () => {
  const { raceWinners } = fixture()
  assert.deepEqual(circuitSpans(raceWinners).get(1), { firstYear: 2000, lastYear: 2002, races: 3 })
})

test('marker radius uses a clamped square-root scale with an empty-domain fallback', () => {
  const radius = createMarkerRadius(16)
  assert.equal(radius(0), MARKER_RADIUS.min)
  assert.equal(radius(16), MARKER_RADIUS.max)
  assert.equal(radius(4), MARKER_RADIUS.min + (MARKER_RADIUS.max - MARKER_RADIUS.min) * 0.5)
  assert.equal(radius(100), MARKER_RADIUS.max)
  assert.equal(createMarkerRadius(0)(0), MARKER_RADIUS.min)
})

test('default markers are colored by the outright leader and sized by Grands Prix', () => {
  const { tables, circuits, raceWinners } = fixture()
  const spans = circuitSpans(raceWinners)
  const markers = buildCircuitMarkers({ circuits, spans, summaries: summarizeCircuits(raceWinners), archiveSummaries: summarizeCircuits(raceWinners), constructors: tables.constructors })
  const byId = new Map(markers.map((m) => [m.id, m]))
  assert.equal(byId.has(3), false, 'circuits without coordinates are not placed')
  assert.equal(byId.get(1).kind, 'leader')
  assert.equal(byId.get(1).color, getTeamColor('ferrari'))
  assert.equal(byId.get(1).r, MARKER_RADIUS.max, 'the busiest circuit gets the largest radius')
  assert.equal(byId.get(2).kind, 'neutral')
  assert.equal(byId.get(2).color, null)
  assert.ok(byId.get(2).lines.some((line) => line.startsWith('Shared lead')))
})

test('highlight markers size by that constructor’s wins and mark circuits without wins', () => {
  const { tables, circuits, raceWinners } = fixture()
  const spans = circuitSpans(raceWinners)
  const summaries = summarizeCircuits(filterRaces(raceWinners, circuits, { toYear: 2001 }))
  const byId = new Map(buildCircuitMarkers({ circuits, spans, summaries, archiveSummaries: summarizeCircuits(raceWinners), constructors: tables.constructors, highlightId: 20 }).map((m) => [m.id, m]))
  assert.equal(byId.get(1).kind, 'leader')
  assert.equal(byId.get(1).color, getTeamColor('mclaren'))
  assert.equal(byId.get(1).value, 1)
  assert.equal(byId.get(4).kind, 'inactive', 'out-of-range circuits stay visible but inactive')
  assert.equal(byId.get(4).interactive, false)

  const none = new Map(buildCircuitMarkers({ circuits, spans, summaries: summarizeCircuits(raceWinners), archiveSummaries: summarizeCircuits(raceWinners), constructors: tables.constructors, highlightId: 99 }).map((m) => [m.id, m]))
  assert.equal(none.get(1).kind, 'no-wins')
  assert.equal(none.get(1).r, MARKER_RADIUS.noWins)
})

test('marker sizes use the archive domain, so a single season stays small', () => {
  const { tables, circuits, raceWinners } = fixture()
  const archiveSummaries = summarizeCircuits(raceWinners)
  const oneSeason = summarizeCircuits(filterRaces(raceWinners, circuits, { fromYear: 2001, toYear: 2001 }))
  const byId = new Map(buildCircuitMarkers({ circuits, spans: circuitSpans(raceWinners), summaries: oneSeason, archiveSummaries, constructors: tables.constructors }).map((m) => [m.id, m]))
  // One race at circuit 1 against an archive maximum of three.
  assert.equal(byId.get(1).r, createMarkerRadius(3)(1))
  assert.ok(byId.get(1).r < MARKER_RADIUS.max)
})

test('win shares keep the top constructors and fold the rest into Others', () => {
  const { tables, raceWinners } = fixture()
  const one = summarizeCircuits(raceWinners).get(1)
  assert.deepEqual(winShares(one, tables.constructors, { top: 1 }).map((s) => [s.key, s.wins]), [['10', 2], ['others', 1]])
  assert.deepEqual(winShares(one, tables.constructors).map((s) => [s.key, s.wins]), [['10', 2], ['20', 1]], 'no empty Others slice')
  assert.equal(winShares(one, tables.constructors).at(-1).color, getTeamColor('mclaren'))
  assert.deepEqual(winShares(one, tables.constructors, { highlightId: 20 }).map((s) => [s.key, s.wins]), [['20', 1], ['others', 2]])
  assert.deepEqual(winShares(one, tables.constructors, { highlightId: 99 }).map((s) => s.key), ['others'])
  assert.deepEqual(winShares(summarizeCircuits(raceWinners).get(3), tables.constructors), [])
})

test('pie markers carry slices and a win-share line; circuits without winners stay dots', () => {
  const { tables, circuits, raceWinners } = fixture()
  const summaries = summarizeCircuits(raceWinners)
  const byId = new Map(buildCircuitMarkers({ circuits, spans: circuitSpans(raceWinners), summaries, archiveSummaries: summaries, constructors: tables.constructors, display: 'pie' }).map((m) => [m.id, m]))
  assert.deepEqual(byId.get(1).slices.map((s) => s.wins), [2, 1])
  assert.ok(byId.get(1).lines.includes('Win share: Alpha 67%, Beta 33%'))
  assert.equal(byId.get(2).r, createMarkerRadius(3)(2))

  const highlighted = new Map(buildCircuitMarkers({ circuits, spans: circuitSpans(raceWinners), summaries, archiveSummaries: summaries, constructors: tables.constructors, display: 'pie', highlightId: 20 }).map((m) => [m.id, m]))
  assert.equal(highlighted.get(1).r, createMarkerRadius(3)(3), 'pies size by Grands Prix even when highlighting')
  assert.deepEqual(highlighted.get(1).slices.map((s) => s.key), ['20', 'others'])
})

test('season timeline covers the whole filter range and marks unused seasons', () => {
  const { raceWinners } = fixture()
  const races = summarizeCircuits(raceWinners).get(1).races
  const timeline = seasonTimeline(races, 1998, 2003)
  assert.deepEqual(timeline.map((season) => [season.year, season.races.map((race) => race.raceId)]), [
    [1998, []], [1999, []], [2000, [1]], [2001, [2]], [2002, [3]], [2003, []],
  ])
  assert.deepEqual(seasonTimeline(races, 2003, 2000), [])
  assert.deepEqual(seasonTimeline(races, null, 2000), [])
  const twice = seasonTimeline([{ raceId: 1, year: 2020 }, { raceId: 2, year: 2020 }], 2020, 2020)
  assert.equal(twice[0].races.length, 2, 'two Grands Prix at one circuit in a season stay separate')
})

test('decade rows place each season in its year slot and leave out-of-range slots empty', () => {
  const rows = decadeRows(seasonTimeline([], 1998, 2001))
  assert.deepEqual(rows.map((row) => row.decade), [1990, 2000])
  assert.deepEqual(rows[0].slots.map((slot) => slot?.year ?? null), [null, null, null, null, null, null, null, null, 1998, 1999])
  assert.deepEqual(rows[1].slots.map((slot) => slot?.year ?? null), [2000, 2001, null, null, null, null, null, null, null, null])
  assert.deepEqual(decadeRows([]), [])
})

test('real archive: every Grand Prix with results maps to a known circuit and winners agree with the data', async () => {
  const FILES = ['results', 'races', 'drivers', 'constructors', 'status', 'circuits']
  const raw = Object.fromEntries(await Promise.all(FILES.map(async (name) => [
    name, csvParse(await readFile(new URL(`../public/data/${name}.csv`, import.meta.url), 'utf8')),
  ])))
  const tables = indexF1Data(raw)
  const circuits = indexCircuits(raw.circuits)
  const raceWinners = buildRaceWinners(tables)

  assert.ok(raceWinners.length > 1000)
  assert.ok(raceWinners.every((r) => circuits.has(r.circuitId)), 'every race joins a circuit')
  assert.ok(raceWinners.every((r) => r.constructorIds.length <= 2))
  const summaries = summarizeCircuits(raceWinners)
  const totalWins = [...summaries.values()].reduce((sum, s) => sum + s.standings.reduce((a, b) => a + b.wins, 0), 0)
  assert.equal(totalWins, raceWinners.reduce((sum, r) => sum + r.constructorIds.length, 0))

  const monza = [...circuits.values()].find((c) => c.circuitRef === 'monza')
  const ferrari = [...tables.constructors.values()].find((c) => c.constructorRef === 'ferrari')
  assert.equal(summaries.get(monza.circuitId).leaderId, ferrari.constructorId, 'Ferrari leads Monza')

  const markers = buildCircuitMarkers({ circuits, spans: circuitSpans(raceWinners), summaries, archiveSummaries: summaries, constructors: tables.constructors })
  assert.equal(markers.length, summaries.size, 'every circuit with a Grand Prix has coordinates')
})
