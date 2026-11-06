import { csv } from 'd3';

const DATA_FILES = ['results', 'races', 'drivers', 'constructors', 'status'];
const RESULT_NUMBERS = [
  'resultId', 'raceId', 'driverId', 'constructorId', 'number', 'grid',
  'position', 'positionOrder', 'points', 'laps', 'milliseconds', 'fastestLap',
  'rank', 'fastestLapSpeed', 'statusId',
];
let dataPromise;

function cleanValue(value) {
  if (value == null) return null;
  if (typeof value !== 'string') return value;
  const text = value.trim();
  return text === '' || text === '\\N' ? null : text;
}

function numberOrNull(value) {
  const cleaned = cleanValue(value);
  if (cleaned === null) return null;
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

function normalizeRows(rows, idField, numericFields) {
  const byId = new Map();
  for (const row of rows) {
    const normalized = Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, cleanValue(value)]),
    );
    for (const field of numericFields) normalized[field] = numberOrNull(row[field]);
    if (normalized[idField] !== null) byId.set(normalized[idField], normalized);
  }
  return byId;
}

/**
 * Index five raw CSV row arrays without mutating them. All Map keys are numeric.
 * Results without a matching driver or race are omitted; a missing constructor
 * or status is allowed. Only drivers with joinable results are exposed.
 *
 * Returns { results, races, drivers, constructors, statuses, resultsByDriver,
 * availableDrivers, years, yearRange }. The first six properties are Maps;
 * resultsByDriver values are arrays of normalized result rows (in input order).
 * availableDrivers is sorted by full name. years and the inclusive yearRange
 * describe races with results, not future/scheduled races. Empty yearRange: null.
 * Dates and race times remain strings; numeric missing/invalid values are null.
 */
export function indexF1Data({
  results = [], races = [], drivers = [], constructors = [], status = [],
} = {}) {
  const racesById = normalizeRows(races, 'raceId', ['raceId', 'year', 'round', 'circuitId']);
  const allDrivers = normalizeRows(drivers, 'driverId', ['driverId', 'number']);
  const constructorsById = normalizeRows(constructors, 'constructorId', ['constructorId']);
  const statuses = normalizeRows(status, 'statusId', ['statusId']);
  const normalizedResults = normalizeRows(results, 'resultId', RESULT_NUMBERS);

  for (const driver of allDrivers.values()) {
    driver.name = [driver.forename, driver.surname].filter(Boolean).join(' ')
      || driver.driverRef || `Driver ${driver.driverId}`;
  }

  const resultsById = new Map();
  const resultsByDriver = new Map();
  const yearSet = new Set();
  for (const result of normalizedResults.values()) {
    const race = racesById.get(result.raceId);
    if (!race || !allDrivers.has(result.driverId)) continue;
    resultsById.set(result.resultId, result);
    if (!resultsByDriver.has(result.driverId)) resultsByDriver.set(result.driverId, []);
    resultsByDriver.get(result.driverId).push(result);
    if (race.year !== null) yearSet.add(race.year);
  }

  const driversById = new Map(
    [...allDrivers].filter(([driverId]) => resultsByDriver.has(driverId)),
  );
  const availableDrivers = [...driversById.values()].sort(
    (a, b) => a.name.localeCompare(b.name) || a.driverId - b.driverId,
  );
  const years = [...yearSet].sort((a, b) => a - b);

  return {
    results: resultsById,
    races: racesById,
    drivers: driversById,
    constructors: constructorsById,
    statuses,
    resultsByDriver,
    availableDrivers,
    years,
    yearRange: years.length ? { fromYear: years[0], toYear: years.at(-1) } : null,
  };
}

/** Load once per module; concurrent and subsequent calls share the same Promise. */
export function loadF1Data() {
  if (!dataPromise) {
    // Vite supplies BASE_URL; native Node has no import.meta.env.
    const base = import.meta.env?.BASE_URL || '/';
    const directory = `${base.endsWith('/') ? base : `${base}/`}data/`;
    dataPromise = Promise.all(DATA_FILES.map((file) => csv(`${directory}${file}.csv`)))
      .then((arrays) => indexF1Data(Object.fromEntries(
        DATA_FILES.map((file, index) => [file, arrays[index]]),
      )))
      .catch((error) => {
        dataPromise = undefined;
        throw error;
      });
  }
  return dataPromise;
}
