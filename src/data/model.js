// Indices and aggregation helpers over the raw tables.
// Consistency rules (spec §10):
//  - win     = results.positionOrder === 1
//  - podium  = results.positionOrder <= 3
//  - pole    = qualifying.position === 1 (qualifying data only exists from 1994)
//  - sprint results are kept apart from Grand Prix results
//  - season points / titles come from the standings after the season's last race

const groupBy = (rows, key) => {
  const map = new Map()
  for (const r of rows) {
    const k = r[key]
    if (!map.has(k)) map.set(k, [])
    map.get(k).push(r)
  }
  return map
}

export function lapTimeToMs(t) {
  if (t == null) return null
  const parts = String(t).split(':')
  let ms = 0
  for (const p of parts) ms = ms * 60 + parseFloat(p)
  return Number.isFinite(ms) ? Math.round(ms * 1000) : null
}

export function buildModel(raw) {
  const circuitById = new Map(raw.circuits.map((c) => [c.circuitId, c]))
  const driverById = new Map()
  const nameCount = new Map()
  for (const d of raw.drivers) {
    const name = `${d.forename} ${d.surname}`
    nameCount.set(name, (nameCount.get(name) ?? 0) + 1)
  }
  for (const d of raw.drivers) {
    d.name = `${d.forename} ${d.surname}`
    d.label = nameCount.get(d.name) > 1 ? `${d.name} (${d.driverRef})` : d.name
    driverById.set(d.driverId, d)
  }
  const constructorById = new Map(raw.constructors.map((c) => [c.constructorId, c]))
  const statusById = new Map(raw.status.map((s) => [s.statusId, s.status]))

  const resultsByRace = groupBy(raw.results, 'raceId')
  const allRaces = raw.races
    .map((r) => ({ ...r, circuit: circuitById.get(r.circuitId) }))
    .sort((a, b) => a.date.localeCompare(b.date))
  const raceById = new Map(allRaces.map((r) => [r.raceId, r]))

  for (const res of raw.results) {
    const race = raceById.get(res.raceId)
    res.year = race.year
    res.circuitId = race.circuitId
    res.status = statusById.get(res.statusId) ?? null
    res.fastestLapMs = lapTimeToMs(res.fastestLapTime)
  }

  // Only races that actually took place (have results) count as Grands Prix.
  const races = allRaces.filter((r) => resultsByRace.has(r.raceId))
  for (const race of races) {
    const rs = resultsByRace.get(race.raceId)
    race.winner = rs.find((r) => r.positionOrder === 1) ?? null
  }

  const qualifyingByRace = groupBy(raw.qualifying, 'raceId')
  const poleByRace = new Map()
  for (const q of raw.qualifying) if (q.position === 1) poleByRace.set(q.raceId, q)

  const lapSummaryByRace = new Map(raw.lapSummary.map((s) => [s.raceId, s]))

  // Final standings per season: standings after the last race that has standings.
  const driverStandingsByRace = groupBy(raw.driverStandings, 'raceId')
  const constructorStandingsByRace = groupBy(raw.constructorStandings, 'raceId')
  const lastRoundScheduled = new Map()
  for (const r of allRaces) lastRoundScheduled.set(r.year, Math.max(lastRoundScheduled.get(r.year) ?? 0, r.round))
  const finalRaceByYear = new Map()
  for (const r of races) {
    if (!driverStandingsByRace.has(r.raceId)) continue
    const cur = finalRaceByYear.get(r.year)
    if (!cur || r.round > cur.round) finalRaceByYear.set(r.year, r)
  }
  const seasonComplete = (year) => finalRaceByYear.get(year)?.round === lastRoundScheduled.get(year)

  const driverSeason = new Map() // year -> Map(driverId -> standing)
  const constructorSeason = new Map()
  for (const [year, race] of finalRaceByYear) {
    driverSeason.set(year, new Map((driverStandingsByRace.get(race.raceId) ?? []).map((s) => [s.driverId, s])))
    constructorSeason.set(year, new Map((constructorStandingsByRace.get(race.raceId) ?? []).map((s) => [s.constructorId, s])))
  }

  const years = [...new Set(races.map((r) => r.year))].sort((a, b) => a - b)
  const countries = [...new Set(races.map((r) => r.circuit.country))].sort()

  return {
    circuitById, driverById, constructorById, statusById,
    allRaces, races, raceById, results: raw.results, resultsByRace,
    resultsByDriver: groupBy(raw.results, 'driverId'),
    resultsByConstructor: groupBy(raw.results, 'constructorId'),
    qualifying: raw.qualifying, qualifyingByRace, poleByRace,
    sprintByRace: groupBy(raw.sprints, 'raceId'),
    lapSummaryByRace,
    finalRaceByYear, seasonComplete, driverSeason, constructorSeason,
    years, countries,
  }
}

// Races matching the global filters. `circuit: false` ignores the circuit filter
// (the map needs every circuit of the period, not just the selected one).
export function scopeRaces(model, filters, { circuit = true } = {}) {
  const { season, countries, circuitId } = filters
  return model.races.filter(
    (r) =>
      (season == null || r.year === season) &&
      (countries.length === 0 || countries.includes(r.circuit.country)) &&
      (!circuit || circuitId == null || r.circuitId === circuitId),
  )
}

export function resultsOf(model, races) {
  const out = []
  for (const r of races) out.push(...(model.resultsByRace.get(r.raceId) ?? []))
  return out
}

export function countBy(rows, key, predicate = () => true) {
  const map = new Map()
  for (const r of rows) {
    if (!predicate(r)) continue
    const k = typeof key === 'function' ? key(r) : r[key]
    if (k == null) continue
    map.set(k, (map.get(k) ?? 0) + 1)
  }
  return map
}

export const isWin = (r) => r.positionOrder === 1
export const isPodium = (r) => r.positionOrder <= 3

export function ranked(map, n = Infinity) {
  return [...map].sort((a, b) => b[1] - a[1]).slice(0, n)
}

// Poles over a set of races (qualifying.position === 1).
export function polesOf(model, races) {
  const out = []
  for (const r of races) {
    const p = model.poleByRace.get(r.raceId)
    if (p) out.push(p)
  }
  return out
}

export const OUTCOMES = [
  { key: 'P1', label: 'Victoire' },
  { key: 'P2', label: '2e place' },
  { key: 'P3', label: '3e place' },
  { key: 'other', label: 'Autres positions' },
  { key: 'dnf', label: 'Abandon' },
  { key: 'nc', label: 'Disqualifié / non classé' },
]

export function outcomeOf(r) {
  if (r.position != null) {
    if (r.position <= 3) return `P${r.position}`
    return 'other'
  }
  return r.positionText === 'R' ? 'dnf' : 'nc'
}

export function outcomeBreakdown(results) {
  const counts = countBy(results, outcomeOf)
  return OUTCOMES.map((o) => ({ ...o, value: counts.get(o.key) ?? 0 }))
}

// Season-by-season summary for a driver or constructor.
export function seasonRows(model, results, kind) {
  const byYear = groupBy(results, 'year')
  const standingMap = kind === 'driver' ? model.driverSeason : model.constructorSeason
  const idKey = kind === 'driver' ? 'driverId' : 'constructorId'
  return [...byYear]
    .sort((a, b) => a[0] - b[0])
    .map(([year, rs]) => {
      const standing = standingMap.get(year)?.get(rs[0][idKey])
      const teams = [...new Set(rs.map((r) => (kind === 'driver' ? r.constructorId : r.driverId)))]
      return {
        year,
        races: new Set(rs.map((r) => r.raceId)).size,
        wins: rs.filter(isWin).length,
        podiums: rs.filter(isPodium).length,
        points: standing?.points ?? null,
        position: standing?.position ?? null,
        teams,
      }
    })
}

// Constructor that won the most races in a set of results (ties: earliest to reach the count).
export function dominantConstructor(results) {
  const wins = countBy(results, 'constructorId', isWin)
  const top = ranked(wins, 1)[0]
  return top ? { constructorId: top[0], wins: top[1] } : null
}
