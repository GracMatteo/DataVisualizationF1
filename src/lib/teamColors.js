import { schemeTableau10 } from 'd3';

const TEAM_COLORS = {
  ferrari: '#e80020',
  mclaren: '#ff8000',
  mercedes: '#27f4d2',
  red_bull: '#3671c6',
  aston_martin: '#229971',
  alpine: '#ff87bc',
  williams: '#64c4ff',
  haas: '#b6babd',
  haas_f1_team: '#b6babd',
  rb: '#6692ff',
  alphatauri: '#5e8faa',
  toro_rosso: '#4169e1',
  sauber: '#52e252',
  kick_sauber: '#52e252',
  alfa: '#a50f2d',
  renault: '#ffd800',
  racing_point: '#f596c8',
  force_india: '#f596c8',
  brawn: '#b8d900',
  benetton: '#00875a',
  jordan: '#e6c700',
  lotus_f1: '#a39161',
  lotus: '#006b3c',
  team_lotus: '#006b3c',
  tyrrell: '#164b8e',
  brabham: '#3c8672',
  cooper: '#2d6b45',
  ligier: '#1261ba',
  toyota: '#cc1e2c',
  honda: '#c62d32',
  bmw_sauber: '#4771a5',
  jaguar: '#006b54',
};

/** Stable across calls, filtering and page loads; unknown historical teams hash into D3's palette. */
export function getTeamColor(constructorRef) {
  const ref = String(constructorRef ?? '').trim().toLowerCase();
  if (!ref) return '#8b949e';
  if (Object.hasOwn(TEAM_COLORS, ref)) return TEAM_COLORS[ref];

  let hash = 2166136261;
  for (let index = 0; index < ref.length; index += 1) {
    hash = Math.imul(hash ^ ref.charCodeAt(index), 16777619) >>> 0;
  }
  return schemeTableau10[hash % schemeTableau10.length];
}
