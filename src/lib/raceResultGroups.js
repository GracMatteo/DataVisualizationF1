export const RESULT_GROUPS = [
  { key: 'win', label: 'P1' },
  { key: 'second', label: 'P2' },
  { key: 'third', label: 'P3' },
  { key: 'points', label: 'Points' },
  { key: 'other', label: 'No points' },
  { key: 'retired', label: 'DNF' },
  { key: 'unclassified', label: 'Other outcomes' },
];

/** Group classified race leaves with the same precedence as their outcome colors. */
export function getRaceGroupKey(race) {
  if (race.outcome === 'retired') return 'retired';
  if (race.outcome !== 'finished') return 'unclassified';
  if (race.position === 1) return 'win';
  if (race.position === 2) return 'second';
  if (race.position === 3) return 'third';
  return (race.points ?? 0) > 0 ? 'points' : 'other';
}
