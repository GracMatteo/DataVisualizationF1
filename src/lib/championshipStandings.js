import { csv } from 'd3'

export const PLACE_CATEGORIES = Object.freeze({
  champion: { label: 'Champion', color: 'var(--place-gold)' },
  second: { label: '2nd', color: 'var(--place-silver)' },
  third: { label: '3rd', color: 'var(--place-bronze)' },
  other: { label: '4th or lower', color: 'var(--place-other)' },
  excluded: { label: 'Excluded / not ranked', color: 'var(--place-none)' },
})

let standingsPromise

const numberOrNull = (value) => {
  const text = value == null ? '' : String(value).trim()
  if (text === '' || text === '\\N') return null
  const number = Number(text)
  return Number.isFinite(number) ? number : null
}

/**
 * Final championship standing per driver and season: the standings row at the
 * highest round of that year in which the driver appears. Rows whose race is
 * unknown are skipped. positionText 'D' (excluded) and '-' (not ranked) keep
 * their text; their position is not treated as a place. A standing taken
 * before the season's last scheduled round (from races.csv) is marked provisional.
 * Returns Map<driverId, Map<year, standing>>.
 */
export function buildFinalStandings(rows, races) {
  const finals = new Map()
  const lastRound = new Map()
  for (const race of races.values()) {
    if (race.year != null && race.round != null) lastRound.set(race.year, Math.max(lastRound.get(race.year) ?? 0, race.round))
  }
  for (const row of rows ?? []) {
    const raceId = numberOrNull(row.raceId)
    const driverId = numberOrNull(row.driverId)
    const race = races.get(raceId)
    if (driverId === null || !race || race.year == null) continue
    const positionText = row.positionText == null ? null : String(row.positionText).trim()
    const ranked = positionText !== 'D' && positionText !== '-'
    const standing = {
      driverId,
      year: race.year,
      round: race.round ?? 0,
      raceId,
      position: ranked ? numberOrNull(row.position) : null,
      positionText,
      points: numberOrNull(row.points),
      wins: numberOrNull(row.wins),
    }
    if (!finals.has(driverId)) finals.set(driverId, new Map())
    const seasons = finals.get(driverId)
    const previous = seasons.get(race.year)
    if (!previous || standing.round > previous.round) seasons.set(race.year, standing)
  }
  for (const seasons of finals.values()) {
    for (const standing of seasons.values()) standing.provisional = standing.round < (lastRound.get(standing.year) ?? 0)
  }
  return finals
}

export function getPlaceCategory(standing) {
  if (standing?.position == null) return 'excluded'
  if (standing.position === 1) return 'champion'
  if (standing.position === 2) return 'second'
  if (standing.position === 3) return 'third'
  return 'other'
}

export function getPlaceLabel(standing) {
  if (standing?.positionText === 'D') return 'Excluded'
  if (standing?.position == null) return 'Not ranked'
  if (standing.position === 1) return 'Champion'
  const suffix = [11, 12, 13].includes(standing.position % 100) ? 'th'
    : ({ 1: 'st', 2: 'nd', 3: 'rd' })[standing.position % 10] ?? 'th'
  return `${standing.position}${suffix}`
}

/**
 * Most recent career first: latest championship season, then latest first season
 * (the newer driver), then name. Uses the whole career, so the order does not
 * change with the year filter. Drivers without standings go last.
 */
function compareCareers(a, b) {
  return b.career.last - a.career.last || b.career.first - a.career.first || a.lane.name.localeCompare(b.lane.name)
}

/**
 * One lane per known driver, most recent career on top, with their final standing for
 * every season inside the inclusive year bounds, plus the constructors they
 * raced for that year (from results, in first-appearance order).
 */
export function buildChampionshipLanes(driverIds, tables, finals, { fromYear, toYear } = {}) {
  const lanes = []
  const seen = new Set()
  for (const driverId of driverIds ?? []) {
    const driver = tables.drivers.get(driverId)
    if (!driver || seen.has(driverId)) continue
    seen.add(driverId)
    // Constructors per season, in order of their first round, with how many races each.
    const teamsByYear = new Map()
    for (const result of tables.resultsByDriver.get(driverId) ?? []) {
      const race = tables.races.get(result.raceId)
      const constructor = tables.constructors.get(result.constructorId)
      if (race?.year == null || !constructor) continue
      if (!teamsByYear.has(race.year)) teamsByYear.set(race.year, new Map())
      const teams = teamsByYear.get(race.year)
      if (!teams.has(constructor.constructorId)) {
        teams.set(constructor.constructorId, {
          constructorRef: constructor.constructorRef, name: constructor.name, races: new Set(), firstRound: race.round ?? Infinity,
        })
      }
      const team = teams.get(constructor.constructorId)
      team.races.add(race.raceId)
      team.firstRound = Math.min(team.firstRound, race.round ?? Infinity)
    }
    const sharesFor = (year) => [...(teamsByYear.get(year)?.values() ?? [])]
      .sort((a, b) => a.firstRound - b.firstRound || a.name.localeCompare(b.name))
      .map(({ constructorRef, name, races }) => ({ constructorRef, name, races: races.size }))
    const seasons = [...(finals.get(driverId)?.values() ?? [])]
      .filter((standing) => (fromYear == null || standing.year >= fromYear) && (toYear == null || standing.year <= toYear))
      .sort((a, b) => a.year - b.year)
      .map((standing) => {
        const teamShares = sharesFor(standing.year)
        return { ...standing, category: getPlaceCategory(standing), teams: teamShares.map((team) => team.name), teamShares }
      })
    const years = [...(finals.get(driverId)?.keys() ?? [])]
    const career = years.length ? { first: Math.min(...years), last: Math.max(...years) } : { first: -Infinity, last: -Infinity }
    lanes.push({ lane: { driverId, name: driver.name, driver, seasons }, career })
  }
  return lanes.sort(compareCareers).map((item) => item.lane)
}

/** Load driver_standings.csv once; a failed load can be retried. */
export function loadDriverStandings() {
  if (!standingsPromise) {
    const base = import.meta.env?.BASE_URL || '/'
    standingsPromise = csv(`${base.endsWith('/') ? base : `${base}/`}data/driver_standings.csv`)
      .catch((error) => {
        standingsPromise = undefined
        throw error
      })
  }
  return standingsPromise
}

/**
 * Background bands for one lane, in year units: each season's slot
 * [year - 0.5, year + 0.5] is split between its constructors by race count, in
 * order of first round. Touching pieces of the same constructor merge, so a
 * multi-season stint is one band. Seasons without a known team leave a gap.
 */
export function buildTeamBands(seasons) {
  const bands = []
  for (const season of seasons) {
    const total = season.teamShares.reduce((sum, team) => sum + team.races, 0)
    let cursor = season.year - 0.5
    for (const team of season.teamShares) {
      const to = cursor + team.races / total
      const previous = bands.at(-1)
      if (previous && previous.constructorRef === team.constructorRef && Math.abs(previous.to - cursor) < 1e-9) previous.to = to
      else bands.push({ constructorRef: team.constructorRef, name: team.name, from: cursor, to })
      cursor = to
    }
  }
  return bands
}
