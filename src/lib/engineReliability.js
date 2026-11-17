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
 * Final constructors' championship position per `${constructorId}:${year}`, read
 * from the standings after the last round of each season that has standings.
 */
export function indexFinalStandings(standingsRows, races) {
  const lastRound = new Map()
  for (const row of standingsRows) {
    const race = races.get(Number(row.raceId))
    if (!race) continue
    const current = lastRound.get(race.year)
    if (!current || race.round > current.round) lastRound.set(race.year, race)
  }
  const finalRaceIds = new Map([...lastRound].map(([year, race]) => [race.raceId, year]))
  const standings = new Map()
  for (const row of standingsRows) {
    const year = finalRaceIds.get(Number(row.raceId))
    const position = Number(row.position)
    if (year === undefined || !Number.isFinite(position) || position <= 0) continue
    standings.set(`${Number(row.constructorId)}:${year}`, position)
  }
  return standings
}

function classify(tables, result) {
  const status = tables.statuses.get(result.statusId)?.status ?? null
  const { outcome } = classifyRaceResult(result, status)
  return {
    status,
    outcome,
    isStart: outcome !== 'dnq' && outcome !== 'dns',
    isEngineFailure: outcome === 'retired' && isEngineStatus(status),
  }
}

/**
 * One row per constructor-season inside ERAS. A start is any result whose outcome
 * is not DNQ/DNS; an engine failure is a retirement with a status in ENGINE_STATUSES.
 * avgGrid averages grid slots > 0 (0 = pit-lane or not recorded); null if none.
 * pointsLost credits each failure with the constructor's mean points per finished
 * start that season (0 when it never finished).
 */
export function buildSeasonRows(tables, finalStandings = new Map()) {
  const seasons = new Map()
  for (const result of tables.results.values()) {
    const race = tables.races.get(result.raceId)
    const era = getEra(race?.year)
    if (!era) continue
    const { outcome, isStart, isEngineFailure } = classify(tables, result)
    if (!isStart) continue

    const id = `${result.constructorId}:${race.year}`
    if (!seasons.has(id)) {
      const constructor = tables.constructors.get(result.constructorId)
      seasons.set(id, {
        id,
        constructorId: result.constructorId,
        constructorRef: constructor?.constructorRef ?? null,
        name: constructor?.name ?? `Constructor ${result.constructorId}`,
        year: race.year,
        eraId: era.id,
        starts: 0, failures: 0, wins: 0, points: 0, finished: 0, finishedPoints: 0, gridSum: 0, gridCount: 0,
      })
    }
    const season = seasons.get(id)
    const points = result.points ?? 0
    season.starts += 1
    season.points += points
    if (result.position === 1) season.wins += 1
    if (result.grid > 0) {
      season.gridSum += result.grid
      season.gridCount += 1
    }
    if (outcome === 'finished') {
      season.finished += 1
      season.finishedPoints += points
    }
    if (isEngineFailure) season.failures += 1
  }

  return [...seasons.values()].map(({ gridSum, gridCount, ...season }) => {
    const finalPosition = finalStandings.get(season.id) ?? null
    const pointsPerFinish = season.finished ? season.finishedPoints / season.finished : 0
    return {
      ...season,
      avgGrid: gridCount ? gridSum / gridCount : null,
      failureRate: season.failures / season.starts,
      pointsPerFinish,
      pointsLost: season.failures * pointsPerFinish,
      finalPosition,
      isChampion: finalPosition === 1,
    }
  }).sort((a, b) => a.year - b.year || (a.finalPosition ?? 99) - (b.finalPosition ?? 99) || a.constructorId - b.constructorId)
}

/** Era-level comparison: field-wide failure rate vs champions', and how speed and reliability track the final rank. */
export function summarizeEras(rows) {
  return ERAS.map((era) => {
    const eraRows = rows.filter((row) => row.eraId === era.id)
    const ranked = eraRows.filter((row) => row.finalPosition != null && row.avgGrid != null)
    const champions = eraRows.filter((row) => row.isChampion)
    const starts = eraRows.reduce((sum, row) => sum + row.starts, 0)
    const failures = eraRows.reduce((sum, row) => sum + row.failures, 0)
    const championStarts = champions.reduce((sum, row) => sum + row.starts, 0)
    return {
      era,
      starts,
      failures,
      fieldFailureRate: starts ? failures / starts : 0,
      championFailureRate: championStarts ? champions.reduce((sum, row) => sum + row.failures, 0) / championStarts : null,
      speedCorrelation: pearson(ranked.map((row) => [row.avgGrid, row.finalPosition])),
      reliabilityCorrelation: pearson(ranked.map((row) => [row.failureRate, row.finalPosition])),
    }
  })
}

/** Quadrant thresholds for the visible rows: median average grid, and the starts-weighted failure rate. */
export function quadrantSplits(rows) {
  const grids = rows.map((row) => row.avgGrid).filter((value) => value != null).sort((a, b) => a - b)
  if (!grids.length) return null
  const middle = Math.floor(grids.length / 2)
  const starts = rows.reduce((sum, row) => sum + row.starts, 0)
  return {
    grid: grids.length % 2 ? grids[middle] : (grids[middle - 1] + grids[middle]) / 2,
    failureRate: starts ? rows.reduce((sum, row) => sum + row.failures, 0) / starts : 0,
  }
}

export function getQuadrant(row, splits) {
  if (!splits || row.avgGrid == null) return null
  const fast = row.avgGrid <= splits.grid
  const fragile = row.failureRate > splits.failureRate
  if (fast) return fragile ? 'fastFragile' : 'fastReliable'
  return fragile ? 'slowFragile' : 'slowReliable'
}

/**
 * Race-by-race cumulative points for one constructor-season against its rival
 * (the champion, or the runner-up when the selected team is champion), plus a
 * "without engine failures" line that adds each failure's estimated points.
 * Points are race results only, so totals can differ slightly from standings.
 */
export function buildSeasonTimeline(tables, rows, constructorId, year) {
  const row = rows.find((item) => item.constructorId === constructorId && item.year === year)
  if (!row) return null
  const rival = rows.find((item) => item.year === year && item.constructorId !== constructorId
    && item.finalPosition === (row.isChampion ? 2 : 1)) ?? null

  const rounds = new Map()
  for (const race of tables.races.values()) {
    if (race.year === year) rounds.set(race.raceId, { raceId: race.raceId, round: race.round, raceName: race.name, team: 0, rival: 0, failures: [], hasResults: false })
  }
  for (const result of tables.results.values()) {
    const round = rounds.get(result.raceId)
    if (!round) continue
    round.hasResults = true
    if (result.constructorId === constructorId) {
      round.team += result.points ?? 0
      if (classify(tables, result).isEngineFailure) {
        round.failures.push({
          resultId: result.resultId,
          driver: tables.drivers.get(result.driverId)?.name ?? `Driver ${result.driverId}`,
          status: tables.statuses.get(result.statusId)?.status ?? null,
          laps: result.laps,
        })
      }
    } else if (rival && result.constructorId === rival.constructorId) {
      round.rival += result.points ?? 0
    }
  }

  let team = 0
  let rivalTotal = 0
  let whatIf = 0
  const timeline = [...rounds.values()].filter((round) => round.hasResults)
    .sort((a, b) => a.round - b.round)
    .map((round) => {
      const lost = round.failures.length * row.pointsPerFinish
      team += round.team
      rivalTotal += round.rival
      whatIf += round.team + lost
      return { raceId: round.raceId, round: round.round, raceName: round.raceName, team: round.team, rival: round.rival, failures: round.failures, lost, cumulativeTeam: team, cumulativeRival: rivalTotal, cumulativeWhatIf: whatIf }
    })

  const gap = rivalTotal - team
  return {
    row,
    rival,
    rounds: timeline,
    teamPoints: team,
    rivalPoints: rivalTotal,
    whatIfPoints: whatIf,
    gap,
    // Only meaningful when the team was not champion: would the estimated lost points close the gap?
    failuresExplainGap: rival != null && !row.isChampion && row.pointsLost > gap,
  }
}

/** A strong default example: the non-champion whose estimated engine losses most exceed its gap to the champion. */
export function pickDefaultSeason(tables, rows) {
  const candidates = rows.filter((row) => row.finalPosition === 2 && row.failures > 0)
  let best = null
  let bestMargin = -Infinity
  for (const row of candidates) {
    const timeline = buildSeasonTimeline(tables, rows, row.constructorId, row.year)
    const margin = row.pointsLost - (timeline?.gap ?? Infinity)
    if (margin > bestMargin) {
      bestMargin = margin
      best = row
    }
  }
  return best ?? rows.find((row) => row.isChampion) ?? rows[0] ?? null
}
