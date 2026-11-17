import { useMemo } from 'react'
import { max, rollup, scaleSqrt } from 'd3'
import { useModel, useStore } from '../state/store.jsx'
import { countBy, isPodium, isWin, ranked, resultsOf, scopeRaces } from '../data/model.js'
import { Card, Kpi, KpiRow, Legend } from '../components/ui.jsx'
import { WorldMap } from '../components/WorldMap.jsx'
import { HBarChart } from '../components/charts/BarCharts.jsx'
import { LineChart } from '../components/charts/LineChart.jsx'
import { OTHER_COLOR, constructorColor, constructorLegend } from '../lib/colors.js'
import { fmtInt, fmtLap } from '../lib/format.js'
import { circuitPoints, circuitStats, constructorName, driverName } from './shared.jsx'

export function MapLegend() {
  const model = useModel()
  return (
    <>
      <span className="muted">Couleur : constructeur dominant · taille : nombre de GP · opacité : activité sur la période</span>
      <Legend items={[...constructorLegend(model.constructorById), { label: 'Autres', color: OTHER_COLOR }]} shape="dot" />
    </>
  )
}

export function Overview() {
  const model = useModel()
  const { state, set, dispatch } = useStore()

  const periodRaces = useMemo(() => scopeRaces(model, state, { circuit: false }), [model, state])
  const races = useMemo(() => scopeRaces(model, state), [model, state])
  const results = useMemo(() => resultsOf(model, races), [model, races])

  const kpis = useMemo(
    () => ({
      gp: races.length,
      circuits: new Set(races.map((r) => r.circuitId)).size,
      drivers: new Set(results.map((r) => r.driverId)).size,
      constructors: new Set(results.map((r) => r.constructorId)).size,
      seasons: new Set(races.map((r) => r.year)).size,
      countries: new Set(races.map((r) => r.circuit.country)).size,
    }),
    [races, results],
  )

  const points = useMemo(() => {
    const counts = rollup(periodRaces, (v) => v.length, (r) => r.circuitId)
    const rScale = scaleSqrt([0, max(counts.values()) || 1], [3, 16])
    const { driverId, constructorId } = state
    const highlight =
      driverId != null || constructorId != null
        ? (_, rs) => rs.filter((r) => isWin(r) && (driverId == null || r.driverId === driverId) && (constructorId == null || r.constructorId === constructorId)).length
        : null
    return circuitPoints(model, periodRaces, { highlight, rScale })
  }, [model, periodRaces, state])

  // GP per season: every season, scoped by country/circuit only, so the line keeps its context.
  const perSeason = useMemo(() => {
    const rs = scopeRaces(model, { ...state, season: null })
    const counts = rollup(rs, (v) => v.length, (r) => r.year)
    return model.years.map((y) => ({ x: y, y: counts.get(y) ?? 0 }))
  }, [model, state])

  const byCountry = ranked(countBy(races, (r) => r.circuit.country)).map(([country, value]) => ({ id: country, label: country, value }))
  const topDrivers = ranked(countBy(results, 'driverId', isWin), 10).map(([id, value]) => ({
    id,
    label: driverName(model, id),
    value,
    extra: [{ value: results.filter((r) => r.driverId === id && isPodium(r)).length, label: 'podiums' }],
  }))
  const topConstructors = ranked(countBy(results, 'constructorId', isWin), 10).map(([id, value]) => ({
    id,
    label: constructorName(model, id),
    value,
    color: constructorColor(model.constructorById.get(id)),
  }))

  const scopeLabel = state.season ? `Saison ${state.season}` : `${model.years[0]}–${model.years.at(-1)}`

  return (
    <div className="view">
      <KpiRow>
        <Kpi label="Grands Prix" value={fmtInt(kpis.gp)} hint={scopeLabel} />
        <Kpi label="Circuits" value={fmtInt(kpis.circuits)} />
        <Kpi label="Pilotes" value={fmtInt(kpis.drivers)} />
        <Kpi label="Constructeurs" value={fmtInt(kpis.constructors)} />
        <Kpi label="Saisons" value={fmtInt(kpis.seasons)} />
        <Kpi label="Pays hôtes" value={fmtInt(kpis.countries)} />
      </KpiRow>

      <div className="map-layout">
        <Card title="Carte mondiale des circuits" subtitle="Survolez un circuit pour un aperçu, cliquez pour son détail." className="card--map">
          <WorldMap
            points={points}
            selectedId={state.circuitId}
            onSelect={(id) => set({ circuitId: state.circuitId === id ? null : id })}
            legend={<MapLegend />}
          />
        </Card>
        <CircuitPanel />
      </div>

      <div className="grid grid--2">
        <Card
          title="Grands Prix par saison"
          subtitle="Cliquez sur le graphique pour sélectionner une saison."
          table={{ columns: [{ key: 'x', label: 'Saison' }, { key: 'y', label: 'Courses', align: 'right' }], rows: perSeason }}
        >
          <LineChart series={[{ id: 'gp', label: 'Grands Prix', color: 'var(--series-1)', values: perSeason }]} area markX={state.season} onPickX={(y) => set({ season: y })} />
        </Card>
        <Card
          title="Grands Prix par pays"
          subtitle="Cliquez sur un pays pour filtrer."
          table={{ columns: [{ key: 'label', label: 'Pays' }, { key: 'value', label: 'GP', align: 'right' }], rows: byCountry }}
          empty={byCountry.length ? null : 'Aucune course sur cette sélection.'}
        >
          <div className="scroll-y">
            <HBarChart data={byCountry} unit="Grands Prix" onSelect={(c) => dispatch({ type: 'toggleCountry', country: c })} labelWidth={110} />
          </div>
        </Card>
        <Card
          title="Pilotes les plus victorieux"
          subtitle={`Victoires en Grand Prix · ${scopeLabel}`}
          table={{ columns: [{ key: 'label', label: 'Pilote' }, { key: 'value', label: 'Victoires', align: 'right' }], rows: topDrivers }}
          empty={topDrivers.length ? null : 'Aucune victoire sur cette sélection.'}
        >
          <HBarChart data={topDrivers} unit="victoires" selectedId={state.driverId} onSelect={(id) => set({ driverId: state.driverId === id ? null : id })} />
        </Card>
        <Card
          title="Constructeurs les plus victorieux"
          subtitle={`Victoires en Grand Prix · ${scopeLabel}`}
          table={{ columns: [{ key: 'label', label: 'Constructeur' }, { key: 'value', label: 'Victoires', align: 'right' }], rows: topConstructors }}
          empty={topConstructors.length ? null : 'Aucune victoire sur cette sélection.'}
        >
          <HBarChart
            data={topConstructors}
            unit="victoires"
            selectedId={state.constructorId}
            onSelect={(id) => set({ constructorId: state.constructorId === id ? null : id })}
          />
        </Card>
      </div>
    </div>
  )
}

// Side panel shown when a circuit is selected on the map.
function CircuitPanel() {
  const model = useModel()
  const { state, set } = useStore()
  const periodRaces = useMemo(() => scopeRaces(model, state, { circuit: false }), [model, state])
  if (state.circuitId == null) {
    return (
      <aside className="card panel panel--empty">
        <p className="muted">Sélectionnez un circuit sur la carte pour afficher son historique, ses vainqueurs et ses records.</p>
      </aside>
    )
  }
  const c = model.circuitById.get(state.circuitId)
  const s = circuitStats(model, state.circuitId, periodRaces)
  const cons = state.constructorId != null ? s.results.filter((r) => r.constructorId === state.constructorId) : null
  const drv = state.driverId != null ? s.results.filter((r) => r.driverId === state.driverId) : null

  return (
    <aside className="card panel">
      <header className="panel__head">
        <div>
          <h3 className="card__title">{c.name}</h3>
          <p className="card__subtitle">{c.location}, {c.country}</p>
        </div>
        <button type="button" className="icon-btn" aria-label="Fermer" onClick={() => set({ circuitId: null })}>×</button>
      </header>
      {s.races.length === 0 ? (
        <p className="muted">Aucun Grand Prix sur la période sélectionnée.</p>
      ) : (
        <dl className="facts">
          <div><dt>Courses</dt><dd>{s.races.length}</dd></div>
          <div><dt>Saisons</dt><dd>{s.firstYear} – {s.lastYear}</dd></div>
          <div><dt>Pilotes vainqueurs</dt><dd>{s.winsByDriver.size}</dd></div>
          <div><dt>Pole positions</dt><dd>{s.poles.length || 'n/d'}</dd></div>
          <div className="wide"><dt>Pilote le plus victorieux</dt><dd>{s.topDriver ? `${driverName(model, s.topDriver[0])} · ${s.topDriver[1]}` : 'n/d'}</dd></div>
          <div className="wide"><dt>Constructeur le plus victorieux</dt><dd>{s.topConstructor ? `${constructorName(model, s.topConstructor[0])} · ${s.topConstructor[1]}` : 'n/d'}</dd></div>
          <div className="wide">
            <dt>Meilleur tour enregistré</dt>
            <dd>{s.bestLap ? `${fmtLap(s.bestLap.ms)} · ${driverName(model, s.bestLap.driverId)} (${s.bestLap.race.year})` : 'n/d'}</dd>
          </div>
        </dl>
      )}
      {cons && (
        <div className="panel__focus">
          <strong>{constructorName(model, state.constructorId)} sur ce circuit</strong>
          <span>{new Set(cons.map((r) => r.raceId)).size} courses · {cons.filter(isWin).length} victoires · {cons.filter(isPodium).length} podiums</span>
          <button type="button" className="link" onClick={() => set({ view: 'constructors' })}>Comparer avec un autre constructeur →</button>
        </div>
      )}
      {drv && (
        <div className="panel__focus">
          <strong>{driverName(model, state.driverId)} sur ce circuit</strong>
          <span>{new Set(drv.map((r) => r.raceId)).size} courses · {drv.filter(isWin).length} victoires · {drv.filter(isPodium).length} podiums</span>
        </div>
      )}
      {s.races.length > 0 && (
        <div className="panel__history">
          <span className="facts__label">Historique</span>
          <ol>
            {[...s.races].reverse().slice(0, 8).map((r) => (
              <li key={r.raceId}>
                <button type="button" className="link" onClick={() => set({ view: 'races', raceId: r.raceId })}>{r.year}</button>
                <span>{r.winner ? driverName(model, r.winner.driverId) : 'n/d'}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      <button type="button" className="btn btn--primary btn--sm" onClick={() => set({ view: 'circuits' })}>Ouvrir la vue circuit</button>
    </aside>
  )
}
