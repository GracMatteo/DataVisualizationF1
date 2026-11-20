/**
 * Turn indexed loadF1Data tables into one record per Grand Prix that has results:
 * { raceId, year, round, name, circuitId, constructorIds, winners }.
 *
 * A win is a result with official classified position 1 (never positionOrder).
 * constructorIds holds the distinct constructors credited with that win: usually one,
 * occasionally none (no classified P1), and two only for shared drives in different cars.
 * winners holds the distinct { driverId, constructorId } pairs credited with P1, in the
 * same cases (several drivers only for shared drives).
 * Races without a circuit or season are excluded. Output is chronological.
 */
export function buildRaceWinners({ races, results }) {
  const winnersByRace = new Map()
  const driversByRace = new Map()
  for (const result of results.values()) {
    if (!winnersByRace.has(result.raceId)) {
      winnersByRace.set(result.raceId, new Set())
      driversByRace.set(result.raceId, new Map())
    }
    if (result.position === 1 && result.constructorId !== null) {
      winnersByRace.get(result.raceId).add(result.constructorId)
      if (result.driverId !== null) {
        driversByRace.get(result.raceId).set(`${result.driverId}:${result.constructorId}`, {
          driverId: result.driverId, constructorId: result.constructorId,
        })
      }
    }
  }

  const out = []
  for (const [raceId, winners] of winnersByRace) {
    const race = races.get(raceId)
    if (!race || race.circuitId === null || race.year === null) continue
    out.push({
      raceId,
      year: race.year,
      round: race.round,
      name: race.name,
      circuitId: race.circuitId,
      constructorIds: [...winners].sort((a, b) => a - b),
      winners: [...driversByRace.get(raceId).values()]
        .sort((a, b) => a.driverId - b.driverId || a.constructorId - b.constructorId),
    })
  }
  return out.sort((a, b) => a.year - b.year || (a.round ?? 0) - (b.round ?? 0) || a.raceId - b.raceId)
}

/** First and last season of every circuit across the whole archive (ignores filters). */
export function circuitSpans(raceWinners) {
  const spans = new Map()
  for (const race of raceWinners) {
    const span = spans.get(race.circuitId)
    if (!span) spans.set(race.circuitId, { firstYear: race.year, lastYear: race.year, races: 1 })
    else {
      span.firstYear = Math.min(span.firstYear, race.year)
      span.lastYear = Math.max(span.lastYear, race.year)
      span.races += 1
    }
  }
  return spans
}

/**
 * Inclusive season range plus an optional host country. Null bounds are open.
 * circuitIds / countries (arrays, from another view's selection) further restrict the races
 * to those circuits / host countries; null means no restriction, an empty array matches nothing.
 * A reversed range (fromYear > toYear) matches nothing.
 */
export function filterRaces(raceWinners, circuits, {
  fromYear = null, toYear = null, country = null, circuitIds = null, countries = null,
} = {}) {
  if (fromYear !== null && toYear !== null && fromYear > toYear) return []
  const circuitSet = circuitIds === null ? null : new Set(circuitIds)
  const countrySet = countries === null ? null : new Set(countries)
  return raceWinners.filter((race) => {
    const host = circuits.get(race.circuitId)?.country
    return (fromYear === null || race.year >= fromYear)
      && (toYear === null || race.year <= toYear)
      && (country === null || host === country)
      && (circuitSet === null || circuitSet.has(race.circuitId))
      && (countrySet === null || countrySet.has(host))
  })
}

/**
 * Circuits-page focus for a list of race entries (rows with circuitId, country and year),
 * by 'circuit' or by 'country'. Seasons span the entries' first to last year. A single
 * circuit is selected (circuitId) and a single country uses the country filter (country);
 * several give circuitIds / countries. Returns null when no entry has the key.
 */
export function circuitFocusFor(entries, by) {
  const key = by === 'country' ? 'country' : 'circuitId'
  const kept = entries.filter((entry) => entry[key] != null)
  if (!kept.length) return null
  const values = [...new Set(kept.map((entry) => entry[key]))]
  const years = kept.map((entry) => entry.year).filter(Number.isFinite)
  const range = years.length ? { fromYear: Math.min(...years), toYear: Math.max(...years) } : { fromYear: null, toYear: null }
  if (values.length === 1) return { [key]: values[0], ...range }
  return { [by === 'country' ? 'countries' : 'circuitIds']: values, ...range }
}

/**
 * Group filtered races by circuit and rank constructors by wins at each one.
 * Returns Map(circuitId -> summary), where summary.standings is sorted by wins (desc),
 * then by the race at which the constructor first reached that total (earlier first),
 * then by constructorId. leaderId is null when the top total is shared or nobody won.
 */
export function summarizeCircuits(raceWinners) {
  const groups = new Map()
  for (const race of raceWinners) {
    if (!groups.has(race.circuitId)) groups.set(race.circuitId, [])
    groups.get(race.circuitId).push(race)
  }

  const summaries = new Map()
  for (const [circuitId, races] of groups) {
    const tally = new Map()
    races.forEach((race, index) => {
      for (const constructorId of race.constructorIds) {
        const entry = tally.get(constructorId) ?? { constructorId, wins: 0, reachedAt: 0 }
        entry.wins += 1
        entry.reachedAt = index
        tally.set(constructorId, entry)
      }
    })
    const standings = [...tally.values()]
      .sort((a, b) => b.wins - a.wins || a.reachedAt - b.reachedAt || a.constructorId - b.constructorId)
      .map(({ constructorId, wins }) => ({ constructorId, wins }))
    const topWins = standings[0]?.wins ?? 0
    const topIds = standings.filter((entry) => entry.wins === topWins).map((entry) => entry.constructorId)

    summaries.set(circuitId, {
      circuitId,
      races,
      raceCount: races.length,
      firstYear: races[0].year,
      lastYear: races.at(-1).year,
      standings,
      topWins,
      leaderId: topIds.length === 1 ? topIds[0] : null,
      tiedLeaderIds: topIds.length > 1 ? topIds : [],
    })
  }
  return summaries
}

/**
 * Constructors ranked by how many circuits they lead outright in the summaries.
 * `shared` counts circuits where they are tied for the most wins; `wins` is their
 * total win count across the summarized circuits. Constructors leading nowhere are omitted.
 */
export function circuitLeaderboard(summaries) {
  const board = new Map()
  const entry = (constructorId) => {
    if (!board.has(constructorId)) board.set(constructorId, { constructorId, led: 0, shared: 0, wins: 0 })
    return board.get(constructorId)
  }
  for (const summary of summaries.values()) {
    for (const standing of summary.standings) entry(standing.constructorId).wins += standing.wins
    if (summary.leaderId !== null) entry(summary.leaderId).led += 1
    for (const constructorId of summary.tiedLeaderIds) entry(constructorId).shared += 1
  }
  return [...board.values()]
    .filter((row) => row.led > 0 || row.shared > 0)
    .sort((a, b) => b.led - a.led || b.shared - a.shared || b.wins - a.wins || a.constructorId - b.constructorId)
}

/** Wins of one constructor at one circuit summary (0 when absent). */
export function winsFor(summary, constructorId) {
  return summary?.standings.find((entry) => entry.constructorId === constructorId)?.wins ?? 0
}

/**
 * One entry per season of the inclusive [fromYear, toYear] range, in order:
 * { year, races }, where races are the given circuit races of that season (empty when
 * the circuit was not used). A reversed or missing range returns [].
 */
export function seasonTimeline(races, fromYear, toYear) {
  if (!Number.isFinite(fromYear) || !Number.isFinite(toYear) || fromYear > toYear) return []
  const byYear = new Map()
  for (const race of races) {
    if (!byYear.has(race.year)) byYear.set(race.year, [])
    byYear.get(race.year).push(race)
  }
  const out = []
  for (let year = fromYear; year <= toYear; year += 1) out.push({ year, races: byYear.get(year) ?? [] })
  return out
}

/** Group a season timeline into decade rows of 10 slots; slots outside the range are null. */
export function decadeRows(timeline) {
  const rows = new Map()
  for (const season of timeline) {
    const decade = Math.floor(season.year / 10) * 10
    if (!rows.has(decade)) rows.set(decade, Array(10).fill(null))
    rows.get(decade)[season.year - decade] = season
  }
  return [...rows].map(([decade, slots]) => ({ decade, slots }))
}

/**
 * Navigation marks for the winners of the given races: one { driverId, year } per winning
 * driver-season and one { constructorId, year } per winning constructor-season, deduplicated
 * and in chronological order. Races without a classified winner contribute nothing.
 */
export function winnerMarks(races) {
  const drivers = new Map()
  const constructors = new Map()
  for (const race of races) {
    for (const winner of race.winners ?? []) {
      drivers.set(`${winner.driverId}:${race.year}`, { driverId: winner.driverId, year: race.year })
    }
    for (const constructorId of race.constructorIds) {
      constructors.set(`${constructorId}:${race.year}`, { constructorId, year: race.year })
    }
  }
  return { drivers: [...drivers.values()], constructors: [...constructors.values()] }
}
