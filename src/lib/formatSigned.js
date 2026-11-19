/** Count of races, with the French plural. */
export function formatRaces(count) {
  const noun = count === 1 ? 'course' : 'courses';
  return `${Number(count).toLocaleString('fr-FR')} ${noun}`;
}

/** Count of classified starts, with the French plural. */
export function formatStarts(count, classified = false) {
  const many = count !== 1
  const noun = many ? 'départs' : 'départ'
  const adjective = classified ? (many ? ' classés' : ' classé') : ''
  return `${count.toLocaleString('fr-FR')} ${noun}${adjective}`
}

/** Share of a count, half-up to one decimal. A zero total has no percentage. */
export function formatPercent(part, whole) {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return '—';
  const rounded = Math.round((part / whole) * 1000) / 10;
  const text = String(rounded).replace('.', ',');
  return `${text} %`;
}

/** Signed place gap for French captions. Half-up to one decimal, comma as the separator. */
export function formatSignedPlaces(value) {
  if (!Number.isFinite(value)) return '—';
  const rounded = Math.round(value * 10) / 10;
  const text = String(rounded).replace('.', ',');
  return rounded > 0 ? `+${text}` : text;
}
