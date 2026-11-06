import { OUTCOME_LEGEND } from './raceResults.js'

export const POSITION_COLORS = {
  win: '#bb8b20',
  second: '#8b96a5',
  third: '#b77748',
  points: '#23877d',
  other: '#95929e',
  retired: '#d54c59',
  unclassified: '#9a64bc',
}

export function getRaceColor(race) {
  if (race.outcome === 'retired') return POSITION_COLORS.retired
  if (race.outcome !== 'finished') return POSITION_COLORS.unclassified
  if (race.position === 1) return POSITION_COLORS.win
  if (race.position === 2) return POSITION_COLORS.second
  if (race.position === 3) return POSITION_COLORS.third
  return (race.points ?? 0) > 0 ? POSITION_COLORS.points : POSITION_COLORS.other
}

export function getRaceDescription(race) {
  return `${race.resultLabel} · ${OUTCOME_LEGEND[race.outcome]?.label ?? 'Unknown'}`
}
