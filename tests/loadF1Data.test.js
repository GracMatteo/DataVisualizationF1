import test from 'node:test';
import assert from 'node:assert/strict';
import { csvFormat } from 'd3';
import { makeRawData } from './fixtures.js';

function responseFor(url, raw) {
  const file = String(url).split('/').at(-1).replace(/\.csv$/, '');
  assert.ok(Object.hasOwn(raw, file), `Unexpected CSV URL: ${url}`);
  return new Response(csvFormat(raw[file]), { status: 200 });
}

test('loads five CSVs with a safe Node base URL and shares the pending/resolved Promise', async (context) => {
  const raw = makeRawData();
  const requests = [];
  context.mock.method(globalThis, 'fetch', async (url) => {
    requests.push(url);
    return responseFor(url, raw);
  });
  const { loadF1Data } = await import('../src/lib/loadF1Data.js?test=successful-cache');
  const first = loadF1Data();
  const concurrent = loadF1Data();
  assert.strictEqual(first, concurrent);
  const tables = await first;
  assert.equal(tables.results.size, 5);
  assert.equal(tables.availableDrivers[0].name, 'Amy Racer');
  assert.deepEqual(requests.sort(), [
    '/data/constructors.csv', '/data/drivers.csv', '/data/races.csv',
    '/data/results.csv', '/data/status.csv',
  ]);
  assert.strictEqual(loadF1Data(), first);
  assert.strictEqual(await loadF1Data(), tables);
  assert.equal(requests.length, 5);
});

test('clears a failed load so the next call retries all five files', async (context) => {
  const raw = makeRawData();
  let fail = true;
  let requests = 0;
  context.mock.method(globalThis, 'fetch', async (url) => {
    requests += 1;
    if (String(url).endsWith('/races.csv') && fail) {
      fail = false;
      return new Response('Unavailable', { status: 503, statusText: 'Service Unavailable' });
    }
    return responseFor(url, raw);
  });
  const { loadF1Data } = await import('../src/lib/loadF1Data.js?test=failed-cache');
  const failed = loadF1Data();
  assert.strictEqual(loadF1Data(), failed);
  await assert.rejects(failed, /503/);
  assert.equal(requests, 5);
  const retry = loadF1Data();
  assert.notStrictEqual(retry, failed);
  assert.strictEqual(loadF1Data(), retry);
  const tables = await retry;
  assert.equal(tables.results.size, 5);
  assert.equal(requests, 10);
  assert.strictEqual(loadF1Data(), retry);
});

test('also clears the cache after a network rejection', async (context) => {
  const raw = makeRawData();
  let fail = true;
  context.mock.method(globalThis, 'fetch', async (url) => {
    if (String(url).endsWith('/results.csv') && fail) {
      fail = false;
      throw new Error('Network unavailable');
    }
    return responseFor(url, raw);
  });
  const { loadF1Data } = await import('../src/lib/loadF1Data.js?test=network-failure');
  await assert.rejects(loadF1Data(), /Network unavailable/);
  assert.equal((await loadF1Data()).results.size, 5);
});
