import { max, scaleSqrt } from 'd3'
import { winsFor } from './circuitWins.js'
import { getTeamColor } from './teamColors.js'

export const MARKER_RADIUS = Object.freeze({ min: 3, max: 12, inactive: 2, noWins: 3 })
/** Pie mode colors the top constructors of a circuit and folds the rest into "Others". */
export const PIE_TOP_CONSTRUCTORS = 3

/** Square-root radius scale: area grows with the value; domain is [0, maximum] (1 if empty). */
export function createMarkerRadius(maximum) {
  return scaleSqrt()
    .domain([0, maximum > 0 ? maximum : 1])
    .range([MARKER_RADIUS.min, MARKER_RADIUS.max])
    .clamp(true)
}

const constructorName = (constructors, id) => constructors.get(id)?.name ?? `Constructor ${id}`
const plural = (count, one, many = `${one}s`) => `${count.toLocaleString('en')} ${count === 1 ? one : many}`
const percent = (part, whole) => `${Math.round((part / whole) * 100)}%`

/**
 * Win shares for a pie: the first `top` constructors of the standings (already ordered
 * by wins, then by who reached the total first) plus one "others" slice.
 * With `highlightId`, only that constructor is split out. Values are win counts;
 * a shared win counts once for each credited constructor.
 */
export function winShares(summary, constructors, { highlightId = null, top = PIE_TOP_CONSTRUCTORS } = {}) {
  const standings = summary?.standings ?? []
  const kept = highlightId === null
    ? standings.slice(0, top)
    : standings.filter((entry) => entry.constructorId === highlightId)
  const keptIds = new Set(kept.map((entry) => entry.constructorId))
  const othersWins = standings.filter((entry) => !keptIds.has(entry.constructorId)).reduce((sum, entry) => sum + entry.wins, 0)
  const slices = kept.map((entry) => ({
    key: String(entry.constructorId),
    constructorId: entry.constructorId,
    name: constructorName(constructors, entry.constructorId),
    color: getTeamColor(constructors.get(entry.constructorId)?.constructorRef),
    wins: entry.wins,
  }))
  if (othersWins > 0) slices.push({ key: 'others', constructorId: null, name: 'Others', color: null, wins: othersWins })
  return slices
}

/**
 * Build one map marker per circuit that has ever hosted a Grand Prix with results.
 *
 * kind:
 *  - 'leader'   colored by the constructor with the most wins (or the highlighted
 *               constructor, when it won there)
 *  - 'neutral'  races in range but the top total is shared or nobody won
 *  - 'no-wins'  highlight mode: the highlighted constructor never won here in range
 *  - 'inactive' no Grand Prix in the current filters (not focusable)
 *
 * Sizes use a fixed domain taken from the whole archive (`archiveSummaries`), so a dot
 * keeps the same meaning whatever seasons are selected. Default and pie modes size by
 * Grands Prix in range; highlight dots size by the highlighted constructor's wins.
 * In pie mode (`display: 'pie'`) active markers carry `slices` from winShares.
 */
export function buildCircuitMarkers({ circuits, spans, summaries, archiveSummaries, constructors, highlightId = null, display = 'dots' }) {
  const archive = [...archiveSummaries.values()]
  const pie = display === 'pie'
  const sizeByWins = highlightId !== null && !pie
  const radius = createMarkerRadius(sizeByWins
    ? max(archive, (summary) => winsFor(summary, highlightId)) ?? 0
    : max(archive, (summary) => summary.raceCount) ?? 0)
  const highlightColor = highlightId === null ? null : getTeamColor(constructors.get(highlightId)?.constructorRef)

  const markers = []
  for (const [circuitId, span] of spans) {
    const circuit = circuits.get(circuitId)
    if (!circuit || circuit.lat === null || circuit.lng === null) continue
    const summary = summaries.get(circuitId)
    const place = [circuit.location, circuit.country].filter(Boolean).join(', ')
    const base = { id: circuitId, name: circuit.name, place, lat: circuit.lat, lng: circuit.lng, slices: null }

    if (!summary) {
      markers.push({
        ...base, kind: 'inactive', r: MARKER_RADIUS.inactive, color: null, interactive: false,
        lines: [`${span.firstYear}–${span.lastYear} · no Grand Prix in these filters`],
      })
      continue
    }

    const races = `${plural(summary.raceCount, 'Grand Prix', 'Grands Prix')} (${summary.firstYear}–${summary.lastYear})`
    const leaderLine = summary.leaderId !== null
      ? `Most wins: ${constructorName(constructors, summary.leaderId)} · ${summary.topWins}`
      : summary.tiedLeaderIds.length
        ? `Shared lead (${summary.topWins} each): ${summary.tiedLeaderIds.map((id) => constructorName(constructors, id)).join(', ')}`
        : 'No classified winner recorded'
    const lines = [races, leaderLine]
    const wins = highlightId === null ? null : winsFor(summary, highlightId)
    if (wins !== null) lines.push(`${constructorName(constructors, highlightId)}: ${plural(wins, 'win')}`)

    let slices = null
    if (pie) {
      slices = winShares(summary, constructors, { highlightId })
      const total = slices.reduce((sum, slice) => sum + slice.wins, 0)
      if (total > 0) lines.push(`Win share: ${slices.map((slice) => `${slice.name} ${percent(slice.wins, total)}`).join(', ')}`)
      else slices = null
    }

    if (highlightId !== null) {
      markers.push({
        ...base, lines, slices, interactive: true, value: wins,
        kind: wins > 0 ? 'leader' : 'no-wins',
        r: pie ? radius(summary.raceCount) : wins > 0 ? radius(wins) : MARKER_RADIUS.noWins,
        color: wins > 0 ? highlightColor : null,
      })
      continue
    }

    const leader = summary.leaderId === null ? null : constructors.get(summary.leaderId)
    markers.push({
      ...base, lines, slices, interactive: true, value: summary.raceCount,
      kind: summary.leaderId === null ? 'neutral' : 'leader',
      r: radius(summary.raceCount),
      color: summary.leaderId === null ? null : getTeamColor(leader?.constructorRef),
    })
  }
  return markers
}
