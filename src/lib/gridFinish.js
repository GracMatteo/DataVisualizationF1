import { countryIdentity } from './countryLabels.js';
import { classifyRaceResult } from './raceResults.js';

function numericId(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/** Index circuit rows the same way as the other tables: `\N` and blanks become null. */
export function indexCircuits(rows = []) {
  const byId = new Map();
  for (const row of rows) {
    const circuitId = numericId(row.circuitId);
    if (circuitId === null) continue;
    const clean = (value) => {
      if (value == null) return null;
      const text = String(value).trim();
      return text === '' || text === '\\N' ? null : text;
    };
    byId.set(circuitId, {
      circuitId,
      name: clean(row.name),
      location: clean(row.location),
      country: clean(row.country),
    });
  }
  return byId;
}

/**
 * One entry per classified start with a real grid place.
 * Grid 0 and a missing grid are "no grid" (pit lane or unrecorded), not P0.
 * A missing position is excluded even when positionOrder exists.
 * A row failing both checks is counted once, as no grid.
 */
export function collectGridStarts(tables, circuitsById) {
  const entries = [];
  const excluded = [];

  for (const result of tables.results.values()) {
    const race = tables.races.get(result.raceId);
    if (!race) continue;
    const hasGrid = Number.isFinite(result.grid) && result.grid > 0;
    const hasPosition = Number.isFinite(result.position) && result.position > 0;
    const circuit = circuitsById.get(race.circuitId) ?? null;
    const country = countryIdentity(circuit?.country ?? null);
    if (!hasGrid || !hasPosition) {
      excluded.push({
        reason: hasGrid ? 'unclassified' : 'no-grid',
        year: race.year,
        circuitId: race.circuitId ?? null,
        countryKey: country.key,
      });
      continue;
    }

    const driver = tables.drivers.get(result.driverId) ?? null;
    const constructor = tables.constructors.get(result.constructorId) ?? null;
    const status = tables.statuses.get(result.statusId)?.status ?? null;
    entries.push({
      id: `result:${result.resultId}`,
      resultId: result.resultId,
      year: race.year,
      round: race.round,
      date: race.date ?? null,
      raceId: race.raceId,
      raceName: race.name ?? `Race ${race.raceId}`,
      circuitId: race.circuitId ?? null,
      circuitName: circuit?.name ?? (race.circuitId == null ? 'Unknown circuit' : `Circuit ${race.circuitId}`),
      country: circuit?.country ?? null,
      countryKey: country.key,
      countryLabel: country.label,
      driverId: result.driverId,
      driverName: driver?.name ?? `Driver ${result.driverId}`,
      constructorName: constructor?.name ?? 'Unknown constructor',
      constructorRef: constructor?.constructorRef ?? null,
      grid: result.grid,
      position: result.position,
      placesGained: result.grid - result.position,
      points: result.points,
      status,
      ...classifyRaceResult(result, status),
    });
  }

  entries.sort((a, b) => (a.year ?? Infinity) - (b.year ?? Infinity)
    || (a.round ?? Infinity) - (b.round ?? Infinity)
    || a.raceName.localeCompare(b.raceName)
    || a.driverName.localeCompare(b.driverName)
    || a.resultId - b.resultId);
  return { entries, excluded };
}

export function matchesGridFilter(entry, { fromYear, toYear, circuitId, countryKey } = {}) {
  if (fromYear != null && (entry.year === null || entry.year < Number(fromYear))) return false;
  if (toYear != null && (entry.year === null || entry.year > Number(toYear))) return false;
  if (circuitId != null && entry.circuitId !== Number(circuitId)) return false;
  if (countryKey != null && entry.countryKey !== countryKey) return false;
  return true;
}

export function filterGridStarts(entries, filters) {
  return entries.filter((entry) => matchesGridFilter(entry, filters));
}

/** Even counts use the mean of the two central values. Empty input returns null. */
export function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Bin filtered starts by exact grid and classified position.
 * The returned maxima are the largest observed values, so a filter rebuilds the axes.
 */
export function binGridFinish(entries) {
  const cells = new Map();
  for (const entry of entries) {
    const key = `${entry.grid}:${entry.position}`;
    if (!cells.has(key)) cells.set(key, { key, grid: entry.grid, position: entry.position, entries: [] });
    cells.get(key).entries.push(entry);
  }
  const list = [...cells.values()]
    .map((cell) => ({ ...cell, count: cell.entries.length }))
    .sort((a, b) => a.grid - b.grid || a.position - b.position || b.count - a.count);
  const gains = entries.map((entry) => entry.placesGained);
  return {
    cells: list,
    count: entries.length,
    maxGrid: entries.reduce((max, entry) => Math.max(max, entry.grid), 0),
    maxPosition: entries.reduce((max, entry) => Math.max(max, entry.position), 0),
    medianGain: median(gains),
    samePlace: entries.filter((entry) => entry.grid === entry.position).length,
  };
}

function foldSearch(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase();
}

/** Name or country, accent-insensitive. An empty query matches every circuit. */
export function circuitMatchesQuery(circuit, query) {
  const needle = foldSearch(query).trim();
  if (!needle) return true;
  const haystack = foldSearch(`${circuit.name} ${circuit.countryLabel ?? ''} ${circuit.country ?? ''}`);
  return haystack.includes(needle);
}

/**
 * One option per circuit, ordered by the number of distinct races with a classified start.
 * Two drivers in the same race count once. Ties fall back to the French circuit name.
 */
export function circuitOptions(entries) {
  const byId = new Map();
  for (const entry of entries) {
    if (entry.circuitId === null) continue;
    let option = byId.get(entry.circuitId);
    if (!option) {
      const country = countryIdentity(entry.country);
      option = {
        circuitId: entry.circuitId,
        name: entry.circuitName,
        country: entry.country,
        countryKey: country.key,
        countryLabel: country.label,
        raceIds: new Set(),
      };
      byId.set(entry.circuitId, option);
    }
    option.raceIds.add(raceKey(entry));
  }
  return [...byId.values()]
    .map(({ raceIds, ...option }) => ({ ...option, raceCount: raceIds.size }))
    .sort((a, b) => b.raceCount - a.raceCount
      || a.name.localeCompare(b.name, 'fr')
      || a.circuitId - b.circuitId);
}

export function countryOptions(entries) {
  const byKey = new Map();
  for (const entry of entries) {
    const country = countryIdentity(entry.country);
    if (!byKey.has(country.key)) {
      byKey.set(country.key, { key: country.key, label: country.label, circuitIds: new Set() });
    }
    if (entry.circuitId != null) byKey.get(country.key).circuitIds.add(entry.circuitId);
  }
  return [...byKey.values()]
    .map((country) => ({ key: country.key, label: country.label, circuitCount: country.circuitIds.size }))
    .sort((a, b) => a.label.localeCompare(b.label, 'fr') || a.key.localeCompare(b.key));
}

/** One race, even when several classified starters share it. */
function raceKey(entry) {
  if (entry.raceId != null) return `race:${entry.raceId}`;
  return `${entry.year}:${entry.round}:${entry.raceName ?? ''}`;
}

/**
 * One row per circuit or per country.
 * Order is the signed median, largest gain first. A loss sits below a gain of the same size.
 * Equal gaps in that order are not equal differences: the printed median is the comparable number.
 * The season filter is the caller's job. This function does not apply it.
 */
export function rankGridGroups(entries, mode = 'circuit') {
  const byCountry = mode === 'country';
  const groups = new Map();
  for (const entry of entries) {
    const country = countryIdentity(entry.country);
    const circuitId = entry.circuitId ?? null;
    const id = byCountry ? country.key : `circuit:${circuitId ?? 'unknown'}`;
    let group = groups.get(id);
    if (!group) {
      group = {
        id,
        label: byCountry ? country.label : (entry.circuitName ?? 'Circuit inconnu'),
        circuitId: byCountry ? null : circuitId,
        countryKey: country.key,
        countryLabel: country.label,
        gains: [],
        samePlace: 0,
        circuitIds: new Set(),
        raceIds: new Set(),
      };
      groups.set(id, group);
    }
    group.gains.push(entry.placesGained);
    if (entry.grid === entry.position) group.samePlace += 1;
    if (circuitId != null) group.circuitIds.add(circuitId);
    group.raceIds.add(raceKey(entry));
  }
  return [...groups.values()]
    .map((group) => ({
      id: group.id,
      label: group.label,
      circuitId: group.circuitId,
      countryKey: group.countryKey,
      countryLabel: group.countryLabel,
      count: group.gains.length,
      medianGain: median(group.gains),
      samePlace: group.samePlace,
      circuitCount: group.circuitIds.size,
      raceCount: group.raceIds.size,
    }))
    .sort((a, b) => (b.medianGain ?? -Infinity) - (a.medianGain ?? -Infinity)
      || b.count - a.count
      || a.label.localeCompare(b.label, 'fr')
      || String(a.id).localeCompare(String(b.id)));
}

export function summarizePoleStats(entries) {
  const raceIds = new Set();
  let gridOne = 0;
  let gridOneWins = 0;
  let wins = 0;
  for (const entry of entries) {
    raceIds.add(raceKey(entry));
    if (entry.grid === 1) gridOne += 1;
    if (entry.position === 1) wins += 1;
    if (entry.grid === 1 && entry.position === 1) gridOneWins += 1;
  }
  return {
    raceCount: raceIds.size,
    classified: entries.length,
    gridOne,
    gridOneWins,
    wins,
  };
}

/**
 * One chosen circuit, already filtered by the caller.
 * Each gap is an exact grid-minus-finish value. Missing gaps are absent, not zero.
 * Order is the gap itself, largest gain first. Individual starts stay out of this summary.
 */
export function summarizePlaceGaps(entries) {
  const byGap = new Map();
  const raceIds = new Set();
  let gained = 0;
  let lost = 0;
  let samePlace = 0;
  for (const entry of entries) {
    const gap = entry.placesGained;
    byGap.set(gap, (byGap.get(gap) ?? 0) + 1);
    raceIds.add(raceKey(entry));
    if (gap > 0) gained += 1;
    else if (gap < 0) lost += 1;
    if (entry.grid === entry.position) samePlace += 1;
  }
  return {
    count: entries.length,
    raceCount: raceIds.size,
    medianGain: median(entries.map((entry) => entry.placesGained)),
    samePlace,
    gained,
    lost,
    gaps: [...byGap.entries()]
      .map(([gap, count]) => ({ gap, count }))
      .sort((a, b) => b.gap - a.gap || b.count - a.count),
  };
}
