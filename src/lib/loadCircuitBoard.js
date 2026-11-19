import { csv } from 'd3';
import { collectGridStarts, indexCircuits } from './gridFinish.js';
import { loadF1Data } from './loadF1Data.js';

let boardPromise;

/** Race archive plus circuits.csv. A failed load can be retried. */
export function loadCircuitBoard() {
  if (!boardPromise) {
    const base = import.meta.env?.BASE_URL || '/';
    const directory = `${base.endsWith('/') ? base : `${base}/`}data/`;
    boardPromise = Promise.all([loadF1Data(), csv(`${directory}circuits.csv`)])
      .then(([tables, circuitRows]) => {
        const collected = collectGridStarts(tables, indexCircuits(circuitRows));
        return { ...collected, years: tables.years };
      })
      .catch((error) => {
        boardPromise = undefined;
        throw error;
      });
  }
  return boardPromise;
}
