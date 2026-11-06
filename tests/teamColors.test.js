import test from 'node:test';
import assert from 'node:assert/strict';
import { schemeTableau10 } from 'd3';
import { getTeamColor } from '../src/lib/teamColors.js';

test('known modern and historical teams have sensible consistent colors', () => {
  assert.equal(getTeamColor('ferrari'), '#e80020');
  assert.equal(getTeamColor('mclaren'), '#ff8000');
  assert.equal(getTeamColor('mercedes'), '#27f4d2');
  assert.equal(getTeamColor('team_lotus'), getTeamColor('lotus'));
  assert.equal(getTeamColor('  FERRARI  '), getTeamColor('ferrari'));
  assert.match(getTeamColor('tyrrell'), /^#[0-9a-f]{6}$/i);
});

test('unknown teams hash into the D3 palette independently of call order', () => {
  const first = getTeamColor('historic_team_a');
  assert.ok(schemeTableau10.includes(first));
  for (const ref of ['historic_team_b', 'historic_team_c', 'ferrari', 'toString', '__proto__']) {
    assert.match(getTeamColor(ref), /^#[0-9a-f]{6}$/i);
  }
  assert.equal(getTeamColor('historic_team_a'), first);
  assert.equal(getTeamColor(' HISTORIC_TEAM_A '), first);
});

test('missing constructor references use a neutral color', () => {
  assert.equal(getTeamColor(null), '#8b949e');
  assert.equal(getTeamColor(undefined), '#8b949e');
  assert.equal(getTeamColor(''), '#8b949e');
});
