import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { csvParse } from 'd3'
import { indexF1Data } from '../src/lib/loadF1Data.js'
import {
  buildChampionshipLanes, buildFinalStandings, buildTeamBands, getPlaceCategory, getPlaceLabel,
} from '../src/lib/championshipStandings.js'

const races = new Map([
  [1, { raceId: 1, year: 2020, round: 1 }],
  [2, { raceId: 2, year: 2020, round: 2 }],
  [3, { raceId: 3, year: 2021, round: 1 }],
  [4, { raceId: 4, year: 2021, round: 2 }],
])
const row = (raceId, driverId, position, positionText = String(position), points = 0, wins = 0) => ({ raceId, driverId, position, positionText, points, wins })

test('the final standing is the row at the last round the driver appears in that year', () => {
  const finals = buildFinalStandings([row(2, 7, '1', '1', '43', '2'), row(1, 7, '3')], races)
  const season = finals.get(7).get(2020)
  assert.equal(season.position, 1)
  assert.equal(season.points, 43)
  assert.equal(season.wins, 2)
  assert.equal(season.provisional, false)
})

test('excluded and unranked rows have no place; a season cut short is provisional', () => {
  const finals = buildFinalStandings([row(2, 1, '26', 'D'), row(3, 2, '\\N', '-')], races)
  assert.equal(finals.get(1).get(2020).position, null)
  assert.equal(getPlaceLabel(finals.get(1).get(2020)), 'Excluded')
  assert.equal(getPlaceLabel(finals.get(2).get(2021)), 'Not ranked')
  assert.equal(finals.get(2).get(2021).provisional, true)
})

test('places map to medal categories and ordinal labels', () => {
  assert.deepEqual([1, 2, 3, 4, null].map((position) => getPlaceCategory({ position })),
    ['champion', 'second', 'third', 'other', 'excluded'])
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22].map((position) => getPlaceLabel({ position })),
    ['Champion', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd'])
})

const FILES = ['results', 'races', 'drivers', 'constructors', 'status', 'driver_standings']
const raw = Object.fromEntries(await Promise.all(FILES.map(async (name) => [
  name, csvParse(await readFile(new URL(`../public/data/${name}.csv`, import.meta.url), 'utf8')),
])))
const tables = indexF1Data(raw)
const finals = buildFinalStandings(raw.driver_standings, tables.races)
const driverId = (ref) => tables.availableDrivers.find((driver) => driver.driverRef === ref).driverId

test('real archive: every completed season has exactly one champion', () => {
  const champions = new Map()
  for (const seasons of finals.values()) {
    for (const season of seasons.values()) {
      if (season.position === 1 && !season.provisional) champions.set(season.year, (champions.get(season.year) ?? 0) + 1)
    }
  }
  assert.ok(champions.size >= 75)
  assert.deepEqual([...champions.values()].filter((count) => count !== 1), [])
})

test('real archive: Hamilton titles, Schumacher 1997 exclusion and year filters', () => {
  const [hamilton, schumacher] = buildChampionshipLanes([driverId('michael_schumacher'), driverId('hamilton')], tables, finals)
  assert.deepEqual(hamilton.seasons.filter((season) => season.category === 'champion').map((season) => season.year),
    [2008, 2014, 2015, 2017, 2018, 2019, 2020])
  assert.ok(hamilton.seasons.find((season) => season.year === 2008).teams.includes('McLaren'))
  const excluded = schumacher.seasons.find((season) => season.year === 1997)
  assert.equal(excluded.positionText, 'D')
  assert.equal(excluded.category, 'excluded')
  const [filtered] = buildChampionshipLanes([driverId('hamilton')], tables, finals, { fromYear: 2014, toYear: 2016 })
  assert.deepEqual(filtered.seasons.map((season) => season.year), [2014, 2015, 2016])
})

test('real archive: lanes put the most recent career on top, whatever the selection order', () => {
  const ids = ['michael_schumacher', 'hamilton', 'senna', 'max_verstappen'].map(driverId)
  const order = (lanes) => lanes.map((lane) => lane.driver.driverRef)
  assert.deepEqual(order(buildChampionshipLanes(ids, tables, finals)), ['max_verstappen', 'hamilton', 'michael_schumacher', 'senna'])
  assert.deepEqual(order(buildChampionshipLanes([...ids].reverse(), tables, finals, { fromYear: 2010, toYear: 2012 })),
    ['max_verstappen', 'hamilton', 'michael_schumacher', 'senna'])
})

test('team bands split a season by races and merge a stint across seasons', () => {
  const season = (year, teamShares) => ({ year, teamShares })
  const bands = buildTeamBands([
    season(2018, [{ constructorRef: 'toro_rosso', name: 'Toro Rosso', races: 21 }]),
    season(2019, [{ constructorRef: 'red_bull', name: 'Red Bull', races: 12 }, { constructorRef: 'toro_rosso', name: 'Toro Rosso', races: 9 }]),
    season(2020, [{ constructorRef: 'toro_rosso', name: 'Toro Rosso', races: 17 }]),
    season(2022, [{ constructorRef: 'alpine', name: 'Alpine', races: 22 }]),
  ])
  const round = (value) => Number(value.toFixed(4))
  assert.deepEqual(bands.map((band) => [band.constructorRef, round(band.from), round(band.to)]), [
    ['toro_rosso', 2017.5, 2018.5],
    ['red_bull', 2018.5, 2019.0714],
    ['toro_rosso', 2019.0714, 2020.5],
    ['alpine', 2021.5, 2022.5],
  ])
})

test('real archive: Gasly 2019 splits Red Bull then Toro Rosso by races', () => {
  const [gasly] = buildChampionshipLanes([driverId('gasly')], tables, finals, { fromYear: 2019, toYear: 2019 })
  const shares = gasly.seasons[0].teamShares
  assert.deepEqual(shares.map((team) => team.constructorRef), ['red_bull', 'toro_rosso'])
  assert.deepEqual(shares.map((team) => team.races), [12, 9])
})
