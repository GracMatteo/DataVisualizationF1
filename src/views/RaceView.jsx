import { useEffect, useMemo, useState } from 'react'
import { group, quantile } from 'd3'
import { useModel, useStore } from '../state/store.jsx'
import { lapTimeToMs, scopeRaces } from '../data/model.js'
import { loadPitStops, loadRaceLaps } from '../data/load.js'
import { Card, DataTable, Kpi, KpiRow, Loading, TipRows } from '../components/ui.jsx'
import { BumpChart, LineChart } from '../components/charts/LineChart.jsx'
import { DotPlot, DumbbellChart } from '../components/charts/Misc.jsx'
import { StackedHBarChart } from '../components/charts/BarCharts.jsx'
import { series } from '../lib/colors.js'
import { fmtDate, fmtInt, fmtLap, fmtPoints } from '../lib/format.js'
import { constructorName, driverName } from './shared.jsx'

function useAsync(fn, deps) {
  const [state, setState] = useState({ loading: true, data: null })
  useEffect(() => {
    let alive = true
    setState((s) => ({ ...s, loading: true }))
    fn().then((data) => alive && setState({ loading: false, data }))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return state
}

export function RaceView() {
  const model = useModel()
  const { state, set } = useStore()
  const scoped = useMemo(() => scopeRaces(model, state), [model, state])
  const raceId = state.raceId ?? scoped.at(-1)?.raceId ?? model.races.at(-1).raceId
  const race = model.raceById.get(raceId)
  const season = race.year
  const seasonRaces = model.races.filter((r) => r.year === season)

  return (
    <div className="view">
      <div className="race-picker">
        <div className="filter">
          <label htmlFor="race-season">Saison</label>
          <select
            id="race-season"
            value={season}
            onChange={(e) => {
              const y = +e.target.value
              set({ raceId: model.races.find((r) => r.year === y).raceId })
            }}
          >
            {[...model.years].reverse().map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div className="filter">
          <label htmlFor="race-gp">Grand Prix</label>
          <select id="race-gp" value={raceId} onChange={(e) => set({ raceId: +e.target.value })}>
            {seasonRaces.map((r) => (
              <option key={r.raceId} value={r.raceId}>
                {r.round}. {r.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <RaceDetail key={raceId} race={race} />
    </div>
  )
}

function RaceDetail({ race }) {
  const model = useModel()
  const { state, set } = useStore()
  const results = useMemo(() => [...(model.resultsByRace.get(race.raceId) ?? [])].sort((a, b) => a.positionOrder - b.positionOrder), [model, race])
  const quali = useMemo(() => [...(model.qualifyingByRace.get(race.raceId) ?? [])].sort((a, b) => a.position - b.position), [model, race])
  const sprint = useMemo(() => [...(model.sprintByRace.get(race.raceId) ?? [])].sort((a, b) => a.positionOrder - b.positionOrder), [model, race])
  const laps = useAsync(() => loadRaceLaps(race.raceId), [race.raceId])
  const pits = useAsync(() => loadPitStops().then((m) => m.get(race.raceId) ?? []), [race.raceId])

  const winner = results[0]
  const pole = model.poleByRace.get(race.raceId)
  const fastest = results.find((r) => r.rank === 1) ?? null
  const summary = model.lapSummaryByRace.get(race.raceId)
  const fastestLabel = fastest
    ? `${fmtLap(fastest.fastestLapMs)} · ${driverName(model, fastest.driverId)}`
    : summary
      ? `${fmtLap(summary.bestLapMs)} · ${driverName(model, summary.bestLapDriverId)}`
      : 'n/d'

  // Top 3 finishers carry colour (slots 1-3); everyone else is muted context.
  const keyColor = new Map(results.slice(0, 3).map((r, i) => [r.driverId, series(i + 1)]))
  const code = (id) => model.driverById.get(id)?.code ?? model.driverById.get(id)?.surname?.slice(0, 3).toUpperCase()

  const lapSeries = useMemo(() => {
    if (!laps.data?.length) return []
    return [...group(laps.data, (d) => d.driverId)].map(([driverId, rows]) => ({
      id: driverId,
      label: driverName(model, driverId),
      short: code(driverId),
      color: keyColor.get(driverId) ?? null,
      pos: rows.sort((a, b) => a.lap - b.lap).map((r) => ({ x: r.lap, y: r.position })),
      time: rows.map((r) => ({ x: r.lap, y: r.milliseconds })),
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laps.data, model])
  // Slow laps (pit stops, safety car) would flatten the chart: clip the scale at the 95th percentile.
  const lapDomain = useMemo(() => {
    const all = lapSeries.flatMap((s) => s.time.map((d) => d.y)).sort((a, b) => a - b)
    return all.length ? [all[0] * 0.99, quantile(all, 0.95) * 1.02] : null
  }, [lapSeries])

  const pitRows = useMemo(() => {
    const byDriver = group(pits.data ?? [], (p) => p.driverId)
    return [...byDriver]
      .map(([driverId, stops]) => ({
        id: driverId,
        label: driverName(model, driverId),
        segments: stops
          .sort((a, b) => a.stop - b.stop)
          .map((s) => ({
            value: s.milliseconds / 1000,
            color: series(1),
            tip: <TipRows title={driverName(model, driverId)} rows={[{ value: `${(s.milliseconds / 1000).toFixed(3)} s`, label: `arrêt ${s.stop} · tour ${s.lap}` }]} />,
          })),
      }))
      .sort((a, b) => results.findIndex((r) => r.driverId === a.id) - results.findIndex((r) => r.driverId === b.id))
  }, [pits.data, model, results])

  return (
    <>
      <header className="view__head">
        <h2>{race.name}</h2>
        <p className="muted">
          Saison {race.year} · manche {race.round} · {fmtDate(race.date)} ·{' '}
          <button type="button" className="link" onClick={() => set({ view: 'circuits', circuitId: race.circuitId })}>{race.circuit.name}</button> · {race.circuit.country}
        </p>
      </header>

      <KpiRow>
        <Kpi label="Pilotes participants" value={fmtInt(results.length)} />
        <Kpi label="Tours" value={fmtInt(winner?.laps)} />
        <Kpi label="Vainqueur" value={winner ? driverName(model, winner.driverId) : 'n/d'} hint={winner && constructorName(model, winner.constructorId)} />
        <Kpi label="Poleman" value={pole ? driverName(model, pole.driverId) : 'n/d'} hint={pole ? pole.q3 ?? pole.q2 ?? pole.q1 : 'qualifications depuis 1994'} />
        <Kpi label="Meilleur tour" value={fastestLabel.split(' · ')[0]} hint={fastestLabel.split(' · ')[1]} />
        <Kpi label="Arrêts aux stands" value={pits.loading ? '…' : pits.data.length ? fmtInt(pits.data.length) : 'n/d'} hint="donnée depuis 2011" />
      </KpiRow>

      <Card title="Classement final">
        <DataTable
          rows={results}
          rowKey={(r) => r.resultId}
          highlight={(r) => r.driverId === state.driverId || r.constructorId === state.constructorId}
          columns={[
            { key: 'positionText', label: 'Pos.', render: (r) => (r.position ?? r.positionText) },
            { key: 'driver', label: 'Pilote', render: (r) => driverName(model, r.driverId) },
            { key: 'constructor', label: 'Constructeur', render: (r) => constructorName(model, r.constructorId) },
            { key: 'grid', label: 'Grille', align: 'right', render: (r) => (r.grid === 0 ? 'stands' : r.grid ?? 'n/d') },
            { key: 'laps', label: 'Tours', align: 'right' },
            { key: 'time', label: 'Temps', align: 'right', render: (r) => r.time ?? '—' },
            { key: 'points', label: 'Points', align: 'right', render: (r) => fmtPoints(r.points) },
            { key: 'status', label: 'Statut' },
          ]}
        />
      </Card>

      <div className="grid grid--2">
        <Card title="Grille de départ / arrivée" subtitle="Pilotes classés · départ des stands exclu de la grille">
          <DumbbellChart
            rows={results
              .filter((r) => r.position != null)
              .map((r) => ({
                id: r.resultId,
                label: driverName(model, r.driverId),
                from: r.grid > 0 ? r.grid : null,
                to: r.position,
                tip: <TipRows title={driverName(model, r.driverId)} rows={[{ value: r.grid > 0 ? `P${r.grid}` : 'stands', label: 'grille' }, { value: `P${r.position}`, label: 'arrivée' }]} />,
              }))}
          />
        </Card>
        <Card title="Évolution des positions" subtitle="Position à la fin de chaque tour · podium en couleur, survolez une ligne">
          {laps.loading ? <Loading /> : lapSeries.length ? <BumpChart series={lapSeries.map((s) => ({ ...s, values: s.pos }))} /> : <p className="empty">Données tour par tour disponibles depuis 1996.</p>}
        </Card>
      </div>

      <div className="grid grid--2">
        <Card title="Temps au tour" subtitle="Échelle limitée au 95e centile (tours de stand et voiture de sécurité coupés)">
          {laps.loading ? (
            <Loading />
          ) : lapSeries.length ? (
            <LineChart series={lapSeries.map((s) => ({ ...s, values: s.time }))} yFormat={fmtLap} yDomain={lapDomain} xFormat={(v) => `Tour ${v}`} height={300} left={64} />
          ) : (
            <p className="empty">Données tour par tour disponibles depuis 1996.</p>
          )}
        </Card>
        <Card title="Arrêts aux stands" subtitle="Durée cumulée par pilote · un segment par arrêt">
          {pits.loading ? <Loading /> : pitRows.length ? <StackedHBarChart rows={pitRows} unit="s" format={(v) => v.toFixed(1).replace('.', ',')} /> : <p className="empty">Données d’arrêts disponibles depuis 2011.</p>}
        </Card>
      </div>

      <Qualifying quali={quali} results={results} />

      {sprint.length > 0 && (
        <Card title="Course sprint" subtitle="Résultats séparés du Grand Prix">
          <DataTable
            rows={sprint}
            rowKey={(r) => r.resultId}
            columns={[
              { key: 'pos', label: 'Pos.', render: (r) => r.position ?? r.positionText },
              { key: 'driver', label: 'Pilote', render: (r) => driverName(model, r.driverId) },
              { key: 'constructor', label: 'Constructeur', render: (r) => constructorName(model, r.constructorId) },
              { key: 'grid', label: 'Grille', align: 'right' },
              { key: 'laps', label: 'Tours', align: 'right' },
              { key: 'time', label: 'Temps', align: 'right', render: (r) => r.time ?? '—' },
              { key: 'points', label: 'Points', align: 'right', render: (r) => fmtPoints(r.points) },
              { key: 'status', label: 'Statut', render: (r) => model.statusById.get(r.statusId) ?? 'n/d' },
            ]}
          />
        </Card>
      )}
    </>
  )
}

function Qualifying({ quali, results }) {
  const model = useModel()
  if (!quali.length) {
    return (
      <Card title="Qualifications">
        <p className="empty">Aucune donnée de qualification pour cette course (disponibles depuis 1994).</p>
      </Card>
    )
  }
  const finish = new Map(results.map((r) => [r.driverId, r]))
  const keys = [
    { key: 'q1', label: 'Q1', color: series(1) },
    { key: 'q2', label: 'Q2', color: series(2) },
    { key: 'q3', label: 'Q3', color: series(3) },
  ].filter((k) => quali.some((q) => q[k.key]))
  return (
    <div className="grid grid--2">
      <Card title="Classement des qualifications" subtitle={`Poleman : ${driverName(model, quali[0].driverId)}`}>
        <DataTable
          rows={quali}
          rowKey={(r) => r.qualifyId}
          highlight={(r) => r.position === 1}
          columns={[
            { key: 'position', label: 'Pos.' },
            { key: 'driver', label: 'Pilote', render: (r) => driverName(model, r.driverId) },
            ...keys.map((k) => ({ key: k.key, label: k.label, align: 'right', render: (r) => r[k.key] ?? '—' })),
            { key: 'grid', label: 'Grille', align: 'right', render: (r) => finish.get(r.driverId)?.grid || '—' },
            { key: 'final', label: 'Arrivée', align: 'right', render: (r) => finish.get(r.driverId)?.position ?? finish.get(r.driverId)?.positionText ?? '—' },
          ]}
        />
      </Card>
      <Card title="Temps Q1 · Q2 · Q3" subtitle="Un point par session disputée">
        <DotPlot
          keys={keys}
          format={fmtLap}
          rows={quali.map((q) => ({
            id: q.qualifyId,
            label: driverName(model, q.driverId),
            values: Object.fromEntries(keys.map((k) => [k.key, lapTimeToMs(q[k.key])])),
          }))}
        />
      </Card>
    </div>
  )
}
