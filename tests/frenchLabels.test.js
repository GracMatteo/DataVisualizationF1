import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { countryIdentity } from '../src/lib/countryLabels.js';
import { hasStatusLabel, statusLabel } from '../src/lib/statusLabels.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function quotedFields(line) {
  return [...line.matchAll(/"([^"]*)"/g)].map((match) => match[1]);
}

test('every circuit country has a French label, and the two United States names match', () => {
  const lines = fs.readFileSync(path.join(root, 'public/data/circuits.csv'), 'utf8').trim().split(/\r?\n/).slice(1);
  const countries = new Set(lines.map((line) => quotedFields(line)[3]));
  assert.ok(countries.has('USA'));
  assert.ok(countries.has('United States'));
  for (const country of countries) {
    const identity = countryIdentity(country);
    assert.equal(identity.key.startsWith('other:'), false, country);
    assert.ok(identity.label, country);
  }
  assert.equal(countryIdentity('USA').key, 'united-states');
  assert.equal(countryIdentity('United States').label, 'États-Unis');
});

test('every archive status has a French display label', () => {
  const lines = fs.readFileSync(path.join(root, 'public/data/status.csv'), 'utf8').trim().split(/\r?\n/).slice(1);
  const missing = lines
    .map((line) => quotedFields(line)[0])
    .filter((status) => !hasStatusLabel(status));
  assert.deepEqual(missing, []);
  assert.equal(statusLabel('+1 Lap'), '+1 tour');
  assert.equal(statusLabel('+2 Laps'), '+2 tours');
  assert.equal(statusLabel('Engine'), 'Moteur');
  assert.equal(statusLabel(null), 'Non enregistré');
  assert.equal(statusLabel('Future status'), 'Future status');
});
