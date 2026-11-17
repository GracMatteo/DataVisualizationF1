// Shared machinery for the Driver and Constructor views (single entity + A/B comparison).
import { max, scaleSqrt } from 'd3'
import { countBy, isWin, outcomeBreakdown, polesOf, ranked, seasonRows } from '../data/model.js'
import { Card, DataTable, Legend, TipRows } from '../components/ui.jsx'
import { WorldMap } from '../components/WorldMap.jsx'
import { GroupedBarChart, HBarChart } from '../components/charts/BarCharts.jsx'
import { LineChart } from '../components/charts/LineChart.jsx'
import { DonutChart } from '../components/charts/Misc.jsx'
import { COMPARE_COLORS, OUTCOME_COLORS } from '../lib/colors.js'
import { fmtPct, fmtPoints } from '../lib/format.js'
import { entityStats } from './shared.jsx'

export function entityData(model, kind, id, races, filters) {
  if (id == null) return null
  const idKey = kind === 'driver' ? 'driverId' : 'constructorId'
  const career = (kind === 'driver' ? model.resultsByDriver : model.resultsByConstructor).get(id) ?? []
  const stats = entityStats(model, career, races)
  const poles = polesOf(model, races).filter((q) => q[idKey] === id).length
  const seasons = seasonRows(model, career, kind)
  const scopedYears = new Set(races.map((r) => r.year))
  // End-of-season standings when the scope is whole seasons; points scored in the
  // selected races when a country/circuit filter cuts seasons apart.
  const partial = filters.countries.length > 0 || filters.circuitId != null
  const points = partial
    ? stats.results.reduce((s, r) => s + (r.points ?? 0), 0)
    : seasons.filter((s) => scopedYears.has(s.year)).reduce((s, r) => s + (r.points ?? 0), 0)
  return {
    id,
    career,
    ...stats,
    poles,
    seasons,
    points,
    pointsPartial: partial,
    winsByCircuit: countBy(stats.results, 'circuitId', isWin),
    outcomes: outcomeBreakdown(stats.results).map((o) => ({ ...o, color: OUTCOME_COLORS[o.key] })),
    winRate: stats.starts ? stats.wins / stats.starts : null,
    podiumRate: stats.starts ? stats.podiums / stats.starts : null,
  }
}

export function ComparisonTable({ a, b, nameA, nameB, metrics }) {
  return (
    <DataTable
      rows={metrics}
      rowKey={(m) => m.label}
      columns={[
        { key: 'label', label: 'Indicateur' },
        { key: 'a', label: nameA, align: 'right', render: (m) => <Cmp v={m.get(a)} o={m.get(b)} fmt={m.fmt} /> },
        { key: 'b', label: nameB, align: 'right', render: (m) => <Cmp v={m.get(b)} o={m.get(a)} fmt={m.fmt} /> },
      ]}
    />
  )
}

function Cmp({ v, o, fmt = String }) {
  return <span className={v != null && o != null && v > o ? 'is-better' : ''}>{v == null ? 'n/d' : fmt(v)}</span>
}

export const COMMON_METRICS = [
  { label: 'Courses disputées', get: (d) => d.starts },
  { label: 'Victoires', get: (d) => d.wins },
  { label: 'Podiums', get: (d) => d.podiums },
  { label: 'Pole positions', get: (d) => d.poles },
  { label: 'Points', get: (d) => d.points, fmt: fmtPoints },
  { label: 'Taux de victoire', get: (d) => d.winRate, fmt: fmtPct },
  { label: 'Taux de podium', get: (d) => d.podiumRate, fmt: fmtPct },
]

// Points per season (end-of-season standings), one line per entity.
export function PointsCard({ entities, markX }) {
  const series = entities.map((e, i) => ({
    id: e.data.id,
    label: e.name,
    color: COMPARE_COLORS[i],
    values: e.data.seasons.filter((s) => s.points != null).map((s) => ({ x: s.year, y: s.points })),
  }))
  const years = [...new Set(series.flatMap((s) => s.values.map((v) => v.x)))].sort((a, b) => a - b)
  return (
    <Card
      title="Évolution des points"
      subtitle="Points au classement final de chaque saison · barème de l'époque"
      table={{
        columns: [{ key: 'year', label: 'Saison' }, ...series.map((s) => ({ key: s.id, label: s.label, align: 'right', render: (r) => fmtPoints(r[s.id]) }))],
        rows: years.map((y) => Object.fromEntries([['year', y], ...series.map((s) => [s.id, s.values.find((v) => v.x === y)?.y ?? null])])),
      }}
    >
      <LineChart series={series} dots markX={markX} yFormat={fmtPoints} />
    </Card>
  )
}

export function OutcomeCard({ entity }) {
  return (
    <Card title="Répartition des résultats" subtitle={entity.name}>
      <DonutChart data={entity.data.outcomes} centerLabel="résultats" />
    </Card>
  )
}

// World map of wins: every circuit of the period as faint context, winning circuits sized by wins.
export function WinsMapCard({ model, entities, periodRaces, singleColor, onSelectCircuit, selectedCircuit }) {
  const vmax = max(entities, (e) => max(e.data.winsByCircuit.values())) || 1
  const r = scaleSqrt([0, vmax], [0, 16])
  const context = [...new Set(periodRaces.map((x) => x.circuitId))].map((id) => {
    const c = model.circuitById.get(id)
    return { key: `ctx-${id}`, id, lat: c.lat, lng: c.lng, r: 2.5, color: 'var(--neutral-2)', opacity: 0.4, tip: <TipRows title={c.name} rows={[{ value: 0, label: 'victoire' }]} /> }
  })
  const marks = entities.flatMap((e, i) =>
    [...e.data.winsByCircuit].map(([id, wins]) => {
      const c = model.circuitById.get(id)
      return {
        key: `${i}-${id}`,
        id,
        lat: c.lat,
        lng: c.lng,
        r: Math.max(4, r(wins)),
        color: entities.length === 1 && singleColor ? singleColor : COMPARE_COLORS[i],
        opacity: entities.length > 1 ? 0.75 : 0.9,
        ring: true,
        tip: <TipRows title={c.name} rows={entities.map((x, j) => ({ value: x.data.winsByCircuit.get(id) ?? 0, label: `victoires · ${x.name}`, color: COMPARE_COLORS[j] }))} />,
      }
    }),
  )
  const winning = new Set(marks.map((m) => m.id))
  return (
    <Card title="Carte des victoires" subtitle="Taille : nombre de victoires sur le circuit" className="card--map">
      <WorldMap
        points={[...context.filter((p) => !winning.has(p.id)), ...marks]}
        height={380}
        selectedId={selectedCircuit}
        onSelect={onSelectCircuit}
        legend={entities.length > 1 && <Legend items={entities.map((e, i) => ({ label: e.name, color: COMPARE_COLORS[i] }))} shape="dot" />}
      />
    </Card>
  )
}

// Wins per circuit: single bars, or grouped bars when comparing.
export function CircuitWinsCard({ model, entities, onSelectCircuit, selectedCircuit }) {
  const union = new Map()
  for (const e of entities) for (const [id, w] of e.data.winsByCircuit) union.set(id, (union.get(id) ?? 0) + w)
  const top = ranked(union, 12)
  const label = (id) => model.circuitById.get(id)?.name ?? id
  const rows = top.map(([id]) => ({ id, label: label(id), ...Object.fromEntries(entities.map((e, i) => [`v${i}`, e.data.winsByCircuit.get(id) ?? 0])) }))
  return (
    <Card
      title="Performances par circuit"
      subtitle="Victoires par circuit (12 premiers)"
      empty={top.length ? null : 'Aucune victoire sur la sélection.'}
      table={{ columns: [{ key: 'label', label: 'Circuit' }, ...entities.map((e, i) => ({ key: `v${i}`, label: e.name, align: 'right' }))], rows }}
    >
      {entities.length === 1 ? (
        <HBarChart data={rows.map((r) => ({ id: r.id, label: r.label, value: r.v0 }))} unit="victoires" labelWidth={170} onSelect={onSelectCircuit} selectedId={selectedCircuit} />
      ) : (
        <GroupedBarChart
          groups={rows.map((r) => ({ id: r.id, label: r.label }))}
          keys={entities.map((e, i) => ({ key: `v${i}`, label: e.name, color: COMPARE_COLORS[i] }))}
          value={(g, k) => rows.find((r) => r.id === g.id)[k]}
          onSelect={onSelectCircuit}
          selectedId={selectedCircuit}
        />
      )}
    </Card>
  )
}
