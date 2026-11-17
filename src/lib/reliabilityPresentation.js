import { POSITION_COLORS } from './racePresentation.js'

/** Final-rank groups reuse the shared result palette: gold = champion, teal = rest of the top three. */
export const RANK_GROUPS = [
  { key: 'champion', label: 'Champion', color: POSITION_COLORS.win },
  { key: 'podium', label: '2nd–3rd', color: POSITION_COLORS.points },
  { key: 'field', label: '4th or lower', color: POSITION_COLORS.other },
]

export function getRankGroup(row) {
  if (row.finalPosition === 1) return RANK_GROUPS[0]
  if (row.finalPosition === 2 || row.finalPosition === 3) return RANK_GROUPS[1]
  return RANK_GROUPS[2]
}

export const QUADRANTS = {
  fastFragile: { label: 'Fast but fragile', hint: 'quick cars that broke down' },
  fastReliable: { label: 'Fast and reliable', hint: 'where champions live' },
  slowFragile: { label: 'Slow and fragile', hint: 'back of the grid' },
  slowReliable: { label: 'Slow but reliable', hint: 'finishes, but not fast enough' },
}

/** Engine failures are shown in the shared "retired" color; intensity comes from opacity so both themes work. */
export const FAILURE_COLOR = POSITION_COLORS.retired
export const CHAMPION_COLOR = POSITION_COLORS.win

export function formatPercent(value, digits = 1) {
  return value == null ? 'n/a' : `${(value * 100).toFixed(digits)}%`
}

export function formatPoints(value) {
  return Math.round(value).toLocaleString()
}

export function shortYear(year) {
  return `’${String(year).slice(2)}`
}
