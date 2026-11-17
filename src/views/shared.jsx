import { mean } from 'd3'
import { countBy, isPodium, isWin, polesOf, ranked, resultsOf, dominantConstructor } from '../data/model.js'
import { constructorColor } from '../lib/colors.js'
import { TipRows } from '../components/ui.jsx'
import { fmtInt } from '../lib/format.js'

export const driverName = (model, id) => model.driverById.get(id)?.label ?? `#${id}`
export const constructorName = (model, id) => model.constructorById.get(id)?.name ?? `#${id}`

export function circuitStats(model, circuitId, races) {
  const cRaces = races.filter((r) => r.circuitId === circuitId)
  const results = resultsOf(model, cRaces)
  const winsByDriver = countBy(results, 'driverId', isWin)
  const winsByConstructor = countBy(results, 'constructorId', isWin)
  const poles = polesOf(model, cRaces)

  // Best lap: lap-by-lap data (1996+) first, else the per-result fastest lap (2004+).
  let bestLap = null
  let lapSum = 0
  let lapCount = 0
  for (const r of cRaces) {
    const s = model.lapSummaryByRace.get(r.raceId)
    if (!s) continue
    lapSum += s.meanLapMs * s.lapRecords
    lapCount += s.lapRecords
    if (!bestLap || s.bestLapMs < bestLap.ms) bestLap = { ms: s.bestLapMs, driverId: s.bestLapDriverId, race: r }
  }
  if (!bestLap) {
    for (const res of results) {
      if (res.fastestLapMs != null && (!bestLap || res.fastestLapMs < bestLap.ms)) {
        bestLap = { ms: res.fastestLapMs, driverId: res.driverId, race: model.raceById.get(res.raceId) }
      }
    }
  }
  const years = cRaces.map((r) => r.year)
  return {
    races: cRaces,
    results,
    winsByDriver,
    winsByConstructor,
    poles,
    bestLap,
    meanLapMs: lapCount ? lapSum / lapCount : null,
    avgLaps: mean(cRaces, (r) => r.winner?.laps),
    firstYear: years.length ? Math.min(...years) : null,
    lastYear: years.length ? Math.max(...years) : null,
    seasons: new Set(years).size,
    topDriver: ranked(winsByDriver, 1)[0] ?? null,
    topConstructor: ranked(winsByConstructor, 1)[0] ?? null,
  }
}

// Map markers for every circuit, given the races of the active period.
// highlight(circuitId, periodResults) -> number of highlighted wins (0 = dimmed), or null for no highlight mode.
export function circuitPoints(model, periodRaces, { highlight, rScale }) {
  const byCircuit = new Map()
  for (const r of periodRaces) {
    if (!byCircuit.has(r.circuitId)) byCircuit.set(r.circuitId, [])
    byCircuit.get(r.circuitId).push(r)
  }
  const allByCircuit = new Map()
  for (const r of model.races) {
    if (!allByCircuit.has(r.circuitId)) allByCircuit.set(r.circuitId, [])
    allByCircuit.get(r.circuitId).push(r)
  }
  const points = []
  for (const [circuitId, all] of allByCircuit) {
    const c = model.circuitById.get(circuitId)
    const inPeriod = byCircuit.get(circuitId) ?? []
    const results = resultsOf(model, inPeriod)
    const dom = dominantConstructor(results)
    const hl = highlight ? highlight(circuitId, results) : null
    const active = inPeriod.length > 0
    const domC = dom && model.constructorById.get(dom.constructorId)
    points.push({
      id: circuitId,
      lat: c.lat,
      lng: c.lng,
      r: active ? rScale(inPeriod.length) : 2.5,
      color: active && domC ? constructorColor(domC) : 'var(--neutral-2)',
      opacity: !active ? 0.25 : hl === 0 ? 0.18 : 0.9,
      ring: hl > 0,
      tip: (
        <TipRows
          title={c.name}
          rows={[
            { value: `${c.location}, ${c.country}`, label: '' },
            { value: fmtInt(inPeriod.length), label: 'Grands Prix (période)' },
            { value: `${Math.min(...all.map((r) => r.year))} – ${Math.max(...all.map((r) => r.year))}`, label: 'première – dernière saison' },
            ...(domC ? [{ value: domC.name, label: `domine (${dom.wins} vict.)`, color: constructorColor(domC) }] : []),
            ...(hl != null ? [{ value: hl, label: 'victoire(s) de la sélection' }] : []),
          ]}
        />
      ),
    })
  }
  return points
}

export function entityStats(model, results, races) {
  const raceIds = new Set(races.map((r) => r.raceId))
  const rs = results.filter((r) => raceIds.has(r.raceId))
  return {
    results: rs,
    starts: new Set(rs.map((r) => r.raceId)).size,
    wins: rs.filter(isWin).length,
    podiums: rs.filter(isPodium).length,
    fastestLaps: rs.filter((r) => r.rank === 1).length,
  }
}

// Points accumulated from end-of-season standings (each year counted once, era's own scale).
export function seasonPointsTotal(seasons) {
  return seasons.reduce((s, r) => s + (r.points ?? 0), 0)
}
