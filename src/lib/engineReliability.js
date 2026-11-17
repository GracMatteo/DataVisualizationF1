import { classifyRaceResult } from './raceResults.js'

/**
 * Three engine-regulation eras with comparable rules inside each window.
 * 2026 introduces a new power-unit formula and is still in progress, so it is
 * deliberately left out rather than mixed into the hybrid era.
 */
export const ERAS = Object.freeze([
  Object.freeze({ id: 'v10', label: 'V10', fromYear: 2000, toYear: 2005, description: '3.0 L V10, free development' }),
  Object.freeze({ id: 'v8', label: 'V8', fromYear: 2006, toYear: 2013, description: '2.4 L V8, engine freeze and mileage limits' }),
  Object.freeze({ id: 'hybrid', label: 'Turbo-hybrid', fromYear: 2014, toYear: 2025, description: '1.6 L V6 turbo + energy recovery' }),
])

/** status.csv labels that describe a failure of the engine or power unit and its fluid/cooling systems. */
export const ENGINE_STATUSES = Object.freeze([
  'Engine', 'Engine fire', 'Engine misfire', 'Power Unit', 'Turbo', 'ERS', 'Battery', 'Power loss',
  'Overheating', 'Cooling system', 'Radiator', 'Water pressure', 'Water leak', 'Water pump', 'Water pipe',
  'Oil pressure', 'Oil leak', 'Oil pump', 'Oil line', 'Oil pipe', 'Crankshaft', 'Spark plugs', 'Ignition',
  'Injection', 'Fuel pressure', 'Fuel pump', 'Fuel system',
])
const ENGINE_SET = new Set(ENGINE_STATUSES.map((status) => status.toLowerCase()))

export function isEngineStatus(status) {
  return ENGINE_SET.has(String(status ?? '').trim().toLowerCase())
}

export function getEra(year) {
  return ERAS.find((era) => year >= era.fromYear && year <= era.toYear) ?? null
}

/** Pearson correlation; null when fewer than three pairs or a constant variable. */
export function pearson(pairs) {
  if (pairs.length < 3) return null
  const n = pairs.length
  const meanX = pairs.reduce((sum, [x]) => sum + x, 0) / n
  const meanY = pairs.reduce((sum, [, y]) => sum + y, 0) / n
  let covariance = 0
  let varianceX = 0
  let varianceY = 0
  for (const [x, y] of pairs) {
    covariance += (x - meanX) * (y - meanY)
    varianceX += (x - meanX) ** 2
    varianceY += (y - meanY) ** 2
  }
  return varianceX && varianceY ? covariance / Math.sqrt(varianceX * varianceY) : null
}

/**
 * One row per constructor and era. A start is any result whose outcome is not
 * DNQ/DNS. An engine failure is a retirement whose status is in ENGINE_STATUSES.
 * Estimated points lost: each engine failure is credited with the mean points the
 * same constructor scored per finished start in that season (0 if it never finished).
 */
export function buildEraRows(tables) {
  const seasons = new Map()
  for (const result of tables.results.values()) {
    const race = tables.races.get(result.raceId)
    const era = getEra(race?.year)
    if (!era) continue
    const status = tables.statuses.get(result.statusId)?.status ?? null
    const { outcome } = classifyRaceResult(result, status)
    if (outcome === 'dnq' || outcome === 'dns') continue

    const key = `${result.constructorId}:${race.year}`
    if (!seasons.has(key)) {
      seasons.set(key, { constructorId: result.constructorId, era, starts: 0, failures: 0, wins: 0, points: 0, finished: 0, finishedPoints: 0 })
    }
    const season = seasons.get(key)
    const points = result.points ?? 0
    season.starts += 1
    season.points += points
    if (result.position === 1) season.wins += 1
    if (outcome === 'finished') {
      season.finished += 1
      season.finishedPoints += points
    }
    if (outcome === 'retired' && isEngineStatus(status)) season.failures += 1
  }

  const rows = new Map()
  for (const season of seasons.values()) {
    const key = `${season.era.id}:${season.constructorId}`
    if (!rows.has(key)) {
      const constructor = tables.constructors.get(season.constructorId)
      rows.set(key, {
        id: key,
        eraId: season.era.id,
        constructorId: season.constructorId,
        constructorRef: constructor?.constructorRef ?? null,
        name: constructor?.name ?? `Constructor ${season.constructorId}`,
        seasons: 0, starts: 0, failures: 0, wins: 0, points: 0, pointsLost: 0,
      })
    }
    const row = rows.get(key)
    row.seasons += 1
    row.starts += season.starts
    row.failures += season.failures
    row.wins += season.wins
    row.points += season.points
    row.pointsLost += season.finished ? season.failures * (season.finishedPoints / season.finished) : 0
  }

  const eraPoints = new Map()
  for (const row of rows.values()) eraPoints.set(row.eraId, (eraPoints.get(row.eraId) ?? 0) + row.points)
  return [...rows.values()].map((row) => ({
    ...row,
    failureRate: row.failures / row.starts,
    winRate: row.wins / row.starts,
    pointsShare: eraPoints.get(row.eraId) ? row.points / eraPoints.get(row.eraId) : 0,
    lostShare: row.points + row.pointsLost > 0 ? row.pointsLost / (row.points + row.pointsLost) : 0,
  })).sort((a, b) => a.eraId.localeCompare(b.eraId) || b.starts - a.starts || a.constructorId - b.constructorId)
}

/** Era panels for rows with at least minStarts starts, plus era-wide totals computed before filtering. */
export function summarizeEras(rows, { minStarts = 0, metric = 'winRate' } = {}) {
  return ERAS.map((era) => {
    const all = rows.filter((row) => row.eraId === era.id)
    const visible = all.filter((row) => row.starts >= minStarts)
    const starts = all.reduce((sum, row) => sum + row.starts, 0)
    const failures = all.reduce((sum, row) => sum + row.failures, 0)
    return {
      era,
      rows: visible,
      hidden: all.length - visible.length,
      starts,
      failures,
      failureRate: starts ? failures / starts : 0,
      correlation: pearson(visible.map((row) => [row.failureRate, row[metric]])),
    }
  })
}
