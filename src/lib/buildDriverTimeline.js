import { classifyRaceResult } from './raceResults.js';

function numericInput(value) {
  if (value == null || (typeof value === 'string' && value.trim() === '')) return null;
  if (typeof value !== 'number' && typeof value !== 'string') return NaN;
  return Number(value);
}

function compareDrivers(a, b) {
  return a.name.localeCompare(b.name) || a.driverId - b.driverId;
}

function compareEntries(a, b) {
  return (a.race.year ?? Infinity) - (b.race.year ?? Infinity)
    || (a.race.round ?? Infinity) - (b.race.round ?? Infinity)
    || (a.race.date ?? '').localeCompare(b.race.date ?? '')
    || a.race.raceId - b.race.raceId
    || a.result.resultId - b.result.resultId;
}

function joinedEntries(tables) {
  const entries = [];
  for (const result of tables.results.values()) {
    const race = tables.races.get(result.raceId);
    const driver = tables.drivers.get(result.driverId);
    if (race && driver) entries.push({ result, race, driver });
  }
  return entries;
}

function summarize(results) {
  return {
    entries: results.length,
    wins: results.filter((result) => result.position === 1).length,
    podiums: results.filter((result) => result.position > 0 && result.position <= 3).length,
    points: results.reduce((total, result) => total + (result.points ?? 0), 0),
    seasons: new Set(results.map((result) => result.year).filter((year) => year !== null)).size,
    constructors: new Set(results.map((result) => result.constructorId)
      .filter((id) => id !== null)).size,
  };
}

function raceColumn(race) {
  const name = race.name ?? `Race ${race.raceId}`;
  return {
    id: `race:${race.raceId}`,
    raceId: race.raceId,
    name,
    raceName: name,
    year: race.year ?? null,
    round: race.round ?? null,
    date: race.date ?? null,
  };
}

function enrichResult({ result, race, driver }, tables) {
  const constructorId = result.constructorId ?? null;
  const constructor = tables.constructors.get(constructorId);
  const status = tables.statuses.get(result.statusId)?.status ?? null;
  return {
    id: `result:${result.resultId}`,
    resultId: result.resultId,
    raceId: race.raceId,
    driverId: driver.driverId,
    driverName: driver.name,
    constructorId,
    constructorRef: constructor?.constructorRef ?? null,
    constructorName: constructor?.name
      ?? `Unknown constructor${constructorId === null ? '' : ` ${constructorId}`}`,
    raceName: race.name ?? `Race ${race.raceId}`,
    year: race.year ?? null,
    round: race.round ?? null,
    date: race.date ?? null,
    grid: result.grid ?? null,
    position: result.position ?? null,
    positionOrder: result.positionOrder ?? null,
    positionText: result.positionText ?? null,
    statusId: result.statusId ?? null,
    status,
    points: result.points ?? null,
    ...classifyRaceResult(result, status),
  };
}

/**
 * Build aligned timeline columns and driver rows from indexF1Data's numeric-keyed
 * tables. Columns use all joined results, independently of the driver selection;
 * scheduled races without results are omitted. Each historical result stays a
 * separate entry, including multiple entries for one driver in the same race.
 *
 * Year bounds are inclusive finite numbers or numeric strings; null/undefined
 * and blank strings are unbounded. Unknown years appear only without bounds.
 * Invalid or reversed bounds retain selected known rows with empty results.
 * Selection order is preserved after ID normalization/deduplication, unless
 * sortOrder is 'name'. Unknown drivers are omitted. Missing rounds sort last,
 * then dates (missing first), race IDs and result IDs break chronological ties.
 *
 * Summaries count entries, not starts. Wins/podiums use official position only;
 * missing points contribute zero. No source Maps, arrays or rows are mutated.
 */
export function buildDriverTimeline(driverIds, tables, { fromYear, toYear, sortOrder = 'selection' } = {}) {
  const from = numericInput(fromYear);
  const to = numericInput(toYear);
  const invalidRange = (from !== null && !Number.isFinite(from))
    || (to !== null && !Number.isFinite(to))
    || (from !== null && to !== null && from > to);
  const selected = new Map();
  for (const value of driverIds ?? []) {
    const driverId = numericInput(value);
    if (driverId === null || !Number.isFinite(driverId) || selected.has(driverId)) continue;
    const driver = tables.drivers.get(driverId);
    if (driver) selected.set(driverId, driver);
  }
  const drivers = [...selected.values()];
  if (sortOrder === 'name') drivers.sort(compareDrivers);
  const rows = drivers.map((driver) => ({
    id: `driver:${driver.driverId}`,
    driverId: driver.driverId,
    name: driver.name,
    driver,
    summary: summarize([]),
    results: [],
    resultsByRace: new Map(),
  }));
  if (invalidRange) return { races: [], rows, invalidRange, entryCount: 0 };

  const entries = joinedEntries(tables)
    .filter(({ race }) => (from === null || (race.year !== null && race.year >= from))
      && (to === null || (race.year !== null && race.year <= to)))
    .sort(compareEntries);
  const racesById = new Map();
  const rowsByDriver = new Map(rows.map((row) => [row.driverId, row]));
  let entryCount = 0;
  for (const entry of entries) {
    const { race, driver } = entry;
    if (!racesById.has(race.raceId)) racesById.set(race.raceId, raceColumn(race));
    const row = rowsByDriver.get(driver.driverId);
    if (!row) continue;
    const result = enrichResult(entry, tables);
    row.results.push(result);
    if (!row.resultsByRace.has(race.raceId)) row.resultsByRace.set(race.raceId, []);
    row.resultsByRace.get(race.raceId).push(result);
    entryCount += 1;
  }
  for (const row of rows) row.summary = summarize(row.results);
  return { races: [...racesById.values()], rows, invalidRange, entryCount };
}

/**
 * Select up to two participants in the latest known year with joined results.
 * Prefer Hamilton, then Verstappen; fill remaining places by entry count,
 * full name and numeric ID. Scheduled races and unknown years do not set the
 * default year. Without a known result year, return empty IDs and blank bounds.
 */
export function getDriverTimelineDefaults(tables) {
  let latestYear = null;
  const counts = new Map();
  for (const { result, race } of joinedEntries(tables)) {
    if (!Number.isFinite(race.year)) continue;
    if (latestYear === null || race.year > latestYear) {
      latestYear = race.year;
      counts.clear();
    }
    if (race.year === latestYear) {
      counts.set(result.driverId, (counts.get(result.driverId) ?? 0) + 1);
    }
  }
  if (latestYear === null) return { driverIds: [], fromYear: '', toYear: '' };

  const ranked = [...counts].map(([driverId, entries]) => ({
    driver: tables.drivers.get(driverId), entries,
  })).sort((a, b) => b.entries - a.entries || compareDrivers(a.driver, b.driver));
  const preferred = ['hamilton', 'max_verstappen']
    .map((ref) => ranked.find(({ driver }) => driver.driverRef === ref))
    .filter(Boolean);
  const driverIds = [...new Set([...preferred, ...ranked].map(({ driver }) => driver.driverId))]
    .slice(0, 2);
  return { driverIds, fromYear: latestYear, toYear: latestYear };
}
