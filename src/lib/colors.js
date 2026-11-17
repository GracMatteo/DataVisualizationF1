// Colors are CSS custom properties (see index.css) so light/dark steps swap in one place.
// Constructor identity: the 8 categorical slots are pinned to the 8 historically most
// winning teams — colour follows the entity, never its rank in the current filter.
// Every other constructor folds into "Autres".
const CONSTRUCTOR_SLOT = {
  ferrari: 8, // red
  mclaren: 2, // orange
  mercedes: 3, // aqua
  red_bull: 7, // violet
  williams: 1, // blue
  team_lotus: 6, // green
  renault: 4, // yellow
  brabham: 5, // magenta
}

export const OTHER_COLOR = 'var(--series-other)'
export const series = (slot) => `var(--series-${slot})`

export function constructorColor(constructor) {
  const slot = constructor && CONSTRUCTOR_SLOT[constructor.constructorRef]
  return slot ? series(slot) : OTHER_COLOR
}

export function constructorLegend(constructorById) {
  const byRef = new Map([...constructorById.values()].map((c) => [c.constructorRef, c]))
  return Object.entries(CONSTRUCTOR_SLOT)
    .sort((a, b) => a[1] - b[1])
    .map(([ref, slot]) => ({ id: byRef.get(ref)?.constructorId, label: byRef.get(ref)?.name ?? ref, color: series(slot) }))
}

// Comparison mode: entity A / entity B always take slots 1 and 2.
export const COMPARE_COLORS = [series(1), series(2)]

// Ordered outcome ramp for the results donut (classified = blue ramp, out = neutrals).
export const OUTCOME_COLORS = {
  P1: 'var(--seq-650)',
  P2: 'var(--seq-500)',
  P3: 'var(--seq-350)',
  other: 'var(--seq-200)',
  dnf: 'var(--neutral-2)',
  nc: 'var(--neutral-3)',
}
