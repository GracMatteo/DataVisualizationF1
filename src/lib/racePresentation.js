import { OUTCOME_LEGEND } from './raceResults.js'
import { getRaceGroupKey } from './raceResultGroups.js'

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
  return POSITION_COLORS[getRaceGroupKey(race)]
}

export function getRaceDescription(race) {
  return `${race.resultLabel} · ${OUTCOME_LEGEND[race.outcome]?.label ?? 'Unknown'}`
}
