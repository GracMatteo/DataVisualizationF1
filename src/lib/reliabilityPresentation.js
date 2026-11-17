import { POSITION_COLORS } from './racePresentation.js'

export const METRICS = {
  winRate: { label: 'Win rate', axis: 'Wins per start' },
  pointsShare: { label: 'Share of era points', axis: 'Share of all points in the era' },
}

/** Lost points reuse the shared "retired" race color so a DNF reads the same on every page. */
export const LOST_POINTS_COLOR = POSITION_COLORS.retired

export function formatPercent(value, digits = 1) {
  return `${(value * 100).toFixed(digits)}%`
}
