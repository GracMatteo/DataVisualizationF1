import { csv } from 'd3'
import { buildModel } from './model.js'

const NUMERIC = /^-?\d+(\.\d+)?$/

// `\N` marks a missing value in the source dataset: keep it as null, never substitute.
export function parseRow(row) {
  const out = {}
  for (const key in row) {
    const v = row[key]
    out[key] = v === '\\N' || v === '' ? null : NUMERIC.test(v) ? +v : v
  }
  return out
}

// CSVs live in public/data/ (served as static files).
const dataUrl = (path) => `${import.meta.env.BASE_URL}data/${path}`
const table = (name) => csv(dataUrl(`${name}.csv`), parseRow)

export async function loadCore() {
  const [circuits, races, results, drivers, constructors, status, driverStandings, constructorStandings, qualifying, sprints, lapSummary] =
    await Promise.all([
      table('circuits'),
      table('races'),
      table('results'),
      table('drivers'),
      table('constructors'),
      table('status'),
      table('driver_standings'),
      table('constructor_standings'),
      table('qualifying'),
      table('sprint_results'),
      table('lap_summary').catch(() => []),
    ])
  return buildModel({
    circuits, races, results, drivers, constructors, status,
    driverStandings, constructorStandings, qualifying, sprints, lapSummary,
  })
}

const lapCache = new Map()
export function loadRaceLaps(raceId) {
  if (!lapCache.has(raceId)) {
    lapCache.set(raceId, table(`laps/${raceId}`).catch(() => []))
  }
  return lapCache.get(raceId)
}

let pitPromise = null
export function loadPitStops() {
  if (!pitPromise) {
    pitPromise = table('pit_stops').then((rows) => {
      const byRace = new Map()
      for (const r of rows) {
        if (!byRace.has(r.raceId)) byRace.set(r.raceId, [])
        byRace.get(r.raceId).push(r)
      }
      return byRace
    }).catch(() => new Map())
  }
  return pitPromise
}
