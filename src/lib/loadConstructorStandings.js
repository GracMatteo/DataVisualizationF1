import { csv } from 'd3'
import { dataUrl } from './loadF1Data.js'

let standingsPromise

/** Raw constructor_standings.csv rows, fetched once and shared by every caller. */
export function loadConstructorStandings() {
  if (!standingsPromise) {
    standingsPromise = csv(dataUrl('constructor_standings')).catch((error) => {
      standingsPromise = undefined
      throw error
    })
  }
  return standingsPromise
}
