import { classifyRaceResult } from './raceResults.js';
import { getRaceGroupKey, RESULT_GROUPS } from './raceResultGroups.js';

function compareRaces(a, b) {
  return (a.race.year ?? Infinity) - (b.race.year ?? Infinity)
    || (a.race.round ?? Infinity) - (b.race.round ?? Infinity)
    || (a.race.date ?? '').localeCompare(b.race.date ?? '')
    || a.race.raceId - b.race.raceId
    || a.result.resultId - b.result.resultId;
}

function summarize(entries) {
  return {
    entries: entries.length,
    wins: entries.filter(({ result }) => result.position === 1).length,
    podiums: entries.filter(({ result }) => result.position > 0 && result.position <= 3).length,
    points: entries.reduce((total, { result }) => total + (result.points ?? 0), 0),
    seasons: new Set(entries.map(({ race }) => race.year).filter((year) => year !== null)).size,
    constructors: new Set(entries.map(({ result }) => result.constructorId)
      .filter((id) => id !== null)).size,
  };
}

function raceNode({ result, race }, seasonId, constructorRef, tables) {
  const status = tables.statuses.get(result.statusId)?.status ?? null;
  return {
    id: `${seasonId}/result:${result.resultId}`,
    type: 'race',
    name: race.name ?? `Race ${race.raceId}`,
    raceName: race.name ?? `Race ${race.raceId}`,
    resultId: result.resultId,
    raceId: race.raceId,
    driverId: result.driverId,
    constructorId: result.constructorId,
    constructorRef,
    year: race.year,
    round: race.round,
    date: race.date ?? null,
    grid: result.grid,
    position: result.position,
    positionOrder: result.positionOrder,
    positionText: result.positionText ?? null,
    statusId: result.statusId,
    status,
    points: result.points,
    ...classifyRaceResult(result, status),
  };
}

/**
 * Build a plain driver -> constructor -> season -> resultGroup -> race tree for d3.hierarchy.
 * Bounds are inclusive years (numbers or numeric strings). Unknown/unavailable
 * drivers return null; a known driver with no results in range gets an empty
 * root and zero summary. Reversed bounds also produce an empty tree.
 *
 * Constructor groups are ordered by their first race in the selected range;
 * Seasons ascend by year, nonempty result groups follow RESULT_GROUPS order,
 * and races within each group sort by round (then date/IDs for stable ties).
 * IDs do not depend on labels, input order, or the selected range; race IDs
 * retain their season prefix without a result-group segment.
 * Every non-leaf summary contains numeric counts for entries, wins, podiums,
 * points, seasons and constructors. Entries include DNS/DNQ; missing points
 * contribute zero and wins/podiums use actual classified position only.
 */
export function buildDriverTree(driverId, tables, { fromYear, toYear } = {}) {
  if (driverId == null || String(driverId).trim() === '') return null;
  const driver = tables.drivers.get(Number(driverId));
  if (!driver) return null;

  const entries = (tables.resultsByDriver.get(driver.driverId) ?? [])
    .map((result) => ({ result, race: tables.races.get(result.raceId) }))
    .filter(({ race }) => race
      && (fromYear == null || (race.year !== null && race.year >= Number(fromYear)))
      && (toYear == null || (race.year !== null && race.year <= Number(toYear))))
    .sort(compareRaces);

  const root = {
    id: `driver:${driver.driverId}`,
    type: 'driver',
    name: driver.name,
    driver,
    summary: summarize(entries),
    children: [],
  };
  const byConstructor = new Map();
  for (const entry of entries) {
    const key = entry.result.constructorId;
    if (!byConstructor.has(key)) byConstructor.set(key, []);
    byConstructor.get(key).push(entry);
  }

  for (const [constructorId, constructorEntries] of byConstructor) {
    const constructor = tables.constructors.get(constructorId) ?? null;
    const constructorRef = constructor?.constructorRef ?? null;
    const id = `${root.id}/constructor:${constructorId ?? 'unknown'}`;
    const node = {
      id,
      type: 'constructor',
      name: constructor?.name ?? `Unknown constructor${constructorId === null ? '' : ` ${constructorId}`}`,
      constructorId,
      constructorRef,
      constructor,
      summary: summarize(constructorEntries),
      children: [],
    };
    const bySeason = new Map();
    for (const entry of constructorEntries) {
      const year = entry.race.year;
      if (!bySeason.has(year)) bySeason.set(year, []);
      bySeason.get(year).push(entry);
    }
    for (const [year, seasonEntries] of bySeason) {
      const seasonId = `${id}/season:${year ?? 'unknown'}`;
      const label = year === null ? 'Unknown season' : String(year);
      const byResultGroup = new Map();
      for (const entry of seasonEntries) {
        const leaf = raceNode(entry, seasonId, constructorRef, tables);
        const key = getRaceGroupKey(leaf);
        if (!byResultGroup.has(key)) byResultGroup.set(key, { entries: [], children: [] });
        const group = byResultGroup.get(key);
        group.entries.push(entry);
        group.children.push(leaf);
      }
      const resultGroups = RESULT_GROUPS
        .filter(({ key }) => byResultGroup.has(key))
        .map(({ key, label: groupLabel }) => {
          const group = byResultGroup.get(key);
          return {
            id: `${seasonId}/group:${key}`,
            type: 'resultGroup',
            name: groupLabel,
            groupKey: key,
            year,
            constructorId,
            constructorRef,
            summary: summarize(group.entries),
            children: group.children,
          };
        });
      node.children.push({
        id: seasonId,
        type: 'season',
        name: label,
        label,
        year,
        constructorId,
        constructorRef,
        summary: summarize(seasonEntries),
        children: resultGroups,
      });
    }
    root.children.push(node);
  }
  return root;
}
