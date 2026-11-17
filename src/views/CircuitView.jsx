import { useMemo } from 'react'
import { rollup } from 'd3'
import { useModel, useStore } from '../state/store.jsx'
import { isPodium, isWin, outcomeBreakdown, ranked, scopeRaces } from '../data/model.js'
import { Card, DataTable, Kpi, KpiRow, TipRows } from '../components/ui.jsx'
import { HBarChart } from '../components/charts/BarCharts.jsx'
import { LineChart } from '../components/charts/LineChart.jsx'
import { DonutChart, Timeline } from '../components/charts/Misc.jsx'
import { OUTCOME_COLORS, constructorColor } from '../lib/colors.js'
import { fmtDate, fmtInt, fmtLap } from '../lib/format.js'
import { circuitStats, constructorName, driverName } from './shared.jsx'

export function CircuitView() {
  const { state } = useStore()
  return state.circuitId == null ? <CircuitRanking /> : <CircuitDetail circuitId={state.circuitId} />
}

function CircuitRanking() {
  const model = useModel()
  const { state, set } = useStore()
  const races = useMemo(() => scopeRaces(model, state, { circuit: false }), [model, state])
  const rows = useMemo(() => {
    const ids = [...new Set(races.map((r) => r.circuitId))]
    return ids
      .map((id) => {
        const s = circuitStats(model, id, races)
        const c = model.circuitById.get(id)
        return {
          id,
          name: c.name,
          country: c.country,
          gp: s.races.length,
          span: `${s.firstYear}–${s.lastYear}`,
          topDriver: s.topDriver ? `${driverName(model, s.topDriver[0])} (${s.topDriver[1]})` : 'n/d',
          topConstructor: s.topConstructor ? `${constructorName(model, s.topConstructor[0])} (${s.topConstructor[1]})` : 'n/d',
        }
      })
      .sort((a, b) => b.gp - a.gp)
  }, [model, races])

  return (
    <div className="view">
      <Card title="Classement des circuits" subtitle="Par nombre de Grands Prix sur la période · cliquez sur une ligne pour ouvrir le circuit.">
        <DataTable
          rows={rows}
          rowKey={(r) => r.id}
          onRowClick={(r) => set({ circuitId: r.id })}
          columns={[
            { key: 'name', label: 'Circuit' },
            { key: 'country', label: 'Pays' },
            { key: 'gp', label: 'GP', align: 'right' },
            { key: 'span', label: 'Période' },
            { key: 'topDriver', label: 'Pilote le plus victorieux' },
            { key: 'topConstructor', label: 'Constructeur dominant' },
          ]}
        />
      </Card>
    </div>
  )
}

function CircuitDetail({ circuitId }) {
  const model = useModel()
  const { state, set } = useStore()
  const c = model.circuitById.get(circuitId)
  const all = useMemo(() => circuitStats(model, circuitId, model.races), [model, circuitId])
  const scoped = useMemo(() => circuitStats(model, circuitId, scopeRaces(model, state)), [model, circuitId, state])
  const scopeLabel = state.season ? `Saison ${state.season}` : 'Toutes saisons'

  const topDrivers = ranked(scoped.winsByDriver, 10).map(([id, value]) => ({ id, label: driverName(model, id), value }))
  const topConstructors = ranked(scoped.winsByConstructor, 10).map(([id, value]) => ({
    id,
    label: constructorName(model, id),
    value,
    color: constructorColor(model.constructorById.get(id)),
  }))

  const scopedIds = new Set(scoped.races.map((r) => r.raceId))
  const timeline = all.races.map((r) => ({
    id: r.raceId,
    x: r.year,
    highlight: scopedIds.has(r.raceId) && (state.season != null || state.countries.length > 0),
    tip: <TipRows title={r.name} rows={[{ value: fmtDate(r.date), label: '' }, { value: r.winner ? driverName(model, r.winner.driverId) : 'n/d', label: 'vainqueur' }]} />,
  }))

  // Best lap per season (lap-by-lap data first, else results' fastest lap). Layouts change
  // over time, so the chart compares seasons on this circuit only.
  const bestLaps = useMemo(() => {
    const bySeason = rollup(
      all.races,
      (rs) => {
        let best = null
        for (const r of rs) {
          const s = model.lapSummaryByRace.get(r.raceId)
          let ms = s?.bestLapMs ?? null
          if (ms == null) {
            for (const res of model.resultsByRace.get(r.raceId) ?? []) if (res.fastestLapMs && (ms == null || res.fastestLapMs < ms)) ms = res.fastestLapMs
          }
          if (ms != null && (best == null || ms < best)) best = ms
        }
        return best
      },
      (r) => r.year,
    )
    return [...bySeason].filter(([, v]) => v != null).sort((a, b) => a[0] - b[0]).map(([x, y]) => ({ x, y }))
  }, [model, all])

  const outcomes = outcomeBreakdown(scoped.results).map((o) => ({ ...o, color: OUTCOME_COLORS[o.key] }))
  const cons = state.constructorId != null ? scoped.results.filter((r) => r.constructorId === state.constructorId) : null

  return (
    <div className="view">
      <header className="view__head">
        <button type="button" className="link" onClick={() => set({ circuitId: null })}>← Tous les circuits</button>
        <h2>{c.name}</h2>
        <p className="muted">
          {c.location}, {c.country} · {c.lat.toFixed(4)}, {c.lng.toFixed(4)} · altitude {c.alt != null ? `${c.alt} m` : 'n/d'} · {all.races.length} Grands Prix ·{' '}
          {all.firstYear}–{all.lastYear} · {all.seasons} saisons
        </p>
      </header>

      <KpiRow>
        <Kpi label="Victoires" value={fmtInt(scoped.races.filter((r) => r.winner).length)} hint={scopeLabel} />
        <Kpi label="Pilotes victorieux" value={fmtInt(scoped.winsByDriver.size)} />
        <Kpi label="Constructeurs victorieux" value={fmtInt(scoped.winsByConstructor.size)} />
        <Kpi label="Pole positions" value={scoped.poles.length ? fmtInt(scoped.poles.length) : 'n/d'} hint="qualifications depuis 1994" />
        <Kpi label="Meilleur tour" value={fmtLap(scoped.bestLap?.ms)} hint={scoped.bestLap ? `${driverName(model, scoped.bestLap.driverId)}, ${scoped.bestLap.race.year}` : 'tours chronométrés depuis 1996'} />
        <Kpi label="Moyenne des tours" value={fmtLap(scoped.meanLapMs)} hint="tous tours, depuis 1996" />
        <Kpi label="Tours par course" value={scoped.avgLaps ? scoped.avgLaps.toFixed(1).replace('.', ',') : 'n/d'} hint="moyenne" />
      </KpiRow>

      {cons && (
        <p className="callout">
          <strong>{constructorName(model, state.constructorId)}</strong> sur ce circuit : {new Set(cons.map((r) => r.raceId)).size} courses,{' '}
          {cons.filter(isWin).length} victoires, {cons.filter(isPodium).length} podiums.
        </p>
      )}

      <Card title="Historique des courses" subtitle="Un point par Grand Prix · cliquez pour ouvrir la course.">
        <Timeline items={timeline} onSelect={(raceId) => set({ view: 'races', raceId })} domain={[model.years[0], model.years.at(-1)]} />
      </Card>

      <div className="grid grid--2">
        <Card
          title="Top 10 des pilotes"
          subtitle={`Victoires sur le circuit · ${scopeLabel}`}
          empty={topDrivers.length ? null : 'Aucune victoire sur la sélection.'}
          table={{ columns: [{ key: 'label', label: 'Pilote' }, { key: 'value', label: 'Victoires', align: 'right' }], rows: topDrivers }}
        >
          <HBarChart data={topDrivers} unit="victoires" selectedId={state.driverId} onSelect={(id) => set({ driverId: state.driverId === id ? null : id })} />
        </Card>
        <Card
          title="Top des constructeurs"
          subtitle={`Victoires sur le circuit · ${scopeLabel}`}
          empty={topConstructors.length ? null : 'Aucune victoire sur la sélection.'}
          table={{ columns: [{ key: 'label', label: 'Constructeur' }, { key: 'value', label: 'Victoires', align: 'right' }], rows: topConstructors }}
        >
          <HBarChart data={topConstructors} unit="victoires" selectedId={state.constructorId} onSelect={(id) => set({ constructorId: state.constructorId === id ? null : id })} />
        </Card>
        <Card
          title="Évolution du meilleur tour"
          subtitle="Meilleur tour en course par saison · les tracés ont pu évoluer"
          empty={bestLaps.length ? null : 'Aucun temps au tour disponible pour ce circuit.'}
          table={{ columns: [{ key: 'x', label: 'Saison' }, { key: 'y', label: 'Meilleur tour', align: 'right', render: (r) => fmtLap(r.y) }], rows: bestLaps }}
        >
          <LineChart series={[{ id: 'best', label: 'Meilleur tour', color: 'var(--series-1)', values: bestLaps }]} yFormat={fmtLap} dots zero={false} markX={state.season} left={64} />
        </Card>
        <Card title="Répartition des positions finales" subtitle={`Tous les résultats · ${scopeLabel}`}>
          <DonutChart data={outcomes} centerLabel="résultats" />
        </Card>
      </div>
    </div>
  )
}
