import { csv } from 'd3'
import { cleanValue, numberOrNull } from './loadF1Data.js'

let circuitsPromise

/**
 * Index raw circuits.csv rows by numeric circuitId without mutating them.
 * Missing text or coordinates stay null; rows without a valid ID are dropped.
 */
export function indexCircuits(rows = []) {
  const byId = new Map()
  for (const row of rows) {
    const circuitId = numberOrNull(row.circuitId)
    if (circuitId === null) continue
    byId.set(circuitId, {
      circuitId,
      circuitRef: cleanValue(row.circuitRef),
      name: cleanValue(row.name) ?? `Circuit ${circuitId}`,
      location: cleanValue(row.location),
      country: cleanValue(row.country),
      lat: numberOrNull(row.lat),
      lng: numberOrNull(row.lng),
    })
  }
  return byId
}

/** Fetch circuits.csv once; the Drivers page never needs it, so it is kept apart from loadF1Data. */
export function loadCircuits() {
  if (!circuitsPromise) {
    const base = import.meta.env?.BASE_URL || '/'
    const url = `${base.endsWith('/') ? base : `${base}/`}data/circuits.csv`
    circuitsPromise = csv(url).then(indexCircuits).catch((error) => {
      circuitsPromise = undefined
      throw error
    })
  }
  return circuitsPromise
}
