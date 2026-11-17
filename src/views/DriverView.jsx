import { useMemo } from 'react'
import { useModel, useStore } from '../state/store.jsx'
import { countBy, isPodium, isWin, ranked, resultsOf, scopeRaces } from '../data/model.js'
import { Card, DataTable, Kpi, KpiRow } from '../components/ui.jsx'
import { EntityPicker, useDriverOptions } from '../components/FilterBar.jsx'
import { fmtDate, fmtInt, fmtPct, fmtPoints } from '../lib/format.js'
import { COMMON_METRICS, CircuitWinsCard, ComparisonTable, OutcomeCard, PointsCard, WinsMapCard, entityData } from './entity.jsx'
import { constructorName, driverName } from './shared.jsx'

export function DriverView() {
  const model = useModel()
  const { state, set } = useStore()
  const options = useDriverOptions()
  const races = useMemo(() => scopeRaces(model, state), [model, state])
  const periodRaces = useMemo(() => scopeRaces(model, state, { circuit: false }), [model, state])
  const a = useMemo(() => entityData(model, 'driver', state.driverId, races, state), [model, state, races])
  const b = useMemo(() => entityData(model, 'driver', state.compareDriverId, races, state), [model, state, races])

  if (!a) return <DriverRanking races={races} />

  const driver = model.driverById.get(a.id)
  const entities = [{ name: driver.label, data: a }, ...(b ? [{ name: driverName(model, b.id), data: b }] : [])]
  const seasonsCount = a.seasons.length
  const selectCircuit = (id) => set({ circuitId: state.circuitId === id ? null : id })

  return (
    <div className="view">
      <header className="view__head view__head--row">
        <div>
          <h2>{driver.label}</h2>
          <p className="muted">
            {driver.nationality} · né le {fmtDate(driver.dob)} · {driver.number != null ? `n° ${driver.number}` : 'numéro n/d'}
            {driver.code ? ` · ${driver.code}` : ''} · {seasonsCount} saison{seasonsCount > 1 ? 's' : ''} ({a.seasons[0]?.year}–{a.seasons.at(-1)?.year})
          </p>
        </div>
        <div className="filter">
          <label htmlFor="cmp-driver">Comparer avec</label>
          <EntityPicker
            id="cmp-driver"
            options={options.filter((o) => o.id !== a.id)}
            value={state.compareDriverId}
            onChange={(id) => set({ compareDriverId: id })}
            placeholder="Choisir un pilote"
          />
        </div>
      </header>

      {b ? (
        <Card title="Comparaison" subtitle="Sur la sélection en cours · la meilleure valeur est soulignée">
          <ComparisonTable a={a} b={b} nameA={entities[0].name} nameB={entities[1].name} metrics={[...COMMON_METRICS, { label: 'Meilleurs tours', get: (d) => d.fastestLaps }]} />
        </Card>
      ) : (
        <KpiRow>
          <Kpi label="Courses" value={fmtInt(a.starts)} />
          <Kpi label="Victoires" value={fmtInt(a.wins)} />
          <Kpi label="Podiums" value={fmtInt(a.podiums)} />
          <Kpi label="Pole positions" value={fmtInt(a.poles)} hint="qualifications depuis 1994" />
          <Kpi label="Points" value={fmtPoints(a.points)} hint={a.pointsPartial ? 'marqués sur la sélection' : 'classements de fin de saison'} />
          <Kpi label="Meilleurs tours" value={fmtInt(a.fastestLaps)} hint="donnée depuis 2004" />
          <Kpi label="Taux de victoire" value={fmtPct(a.winRate)} />
          <Kpi label="Taux de podium" value={fmtPct(a.podiumRate)} />
        </KpiRow>
      )}

      <div className="grid grid--2">
        <PointsCard entities={entities} markX={state.season} />
        {b ? (
          <div className="grid grid--2 grid--nested">
            <OutcomeCard entity={entities[0]} />
            <OutcomeCard entity={entities[1]} />
          </div>
        ) : (
          <OutcomeCard entity={entities[0]} />
        )}
      </div>
      <div className="grid grid--2">
        <WinsMapCard model={model} entities={entities} periodRaces={periodRaces} onSelectCircuit={selectCircuit} selectedCircuit={state.circuitId} />
        <CircuitWinsCard model={model} entities={entities} onSelectCircuit={selectCircuit} selectedCircuit={state.circuitId} />
      </div>

      <Card title="Historique des saisons" subtitle={driver.label}>
        <DataTable
          rows={[...a.seasons].reverse()}
          rowKey={(r) => r.year}
          highlight={(r) => r.year === state.season}
          onRowClick={(r) => set({ season: state.season === r.year ? null : r.year })}
          columns={[
            { key: 'year', label: 'Saison' },
            { key: 'teams', label: 'Constructeur', render: (r) => r.teams.map((id) => constructorName(model, id)).join(', ') },
            { key: 'races', label: 'Courses', align: 'right' },
            { key: 'wins', label: 'Victoires', align: 'right' },
            { key: 'podiums', label: 'Podiums', align: 'right' },
            { key: 'points', label: 'Points', align: 'right', render: (r) => fmtPoints(r.points) },
            { key: 'position', label: 'Classement', align: 'right', render: (r) => (r.position ? `${r.position}e` : 'n/d') },
          ]}
        />
      </Card>
    </div>
  )
}

function DriverRanking({ races }) {
  const model = useModel()
  const { set } = useStore()
  const rows = useMemo(() => {
    const results = resultsOf(model, races)
    const wins = countBy(results, 'driverId', isWin)
    const podiums = countBy(results, 'driverId', isPodium)
    const starts = countBy(results, 'driverId')
    return ranked(starts)
      .map(([id, n]) => ({ id, name: driverName(model, id), nationality: model.driverById.get(id)?.nationality, starts: n, wins: wins.get(id) ?? 0, podiums: podiums.get(id) ?? 0 }))
      .sort((x, y) => y.wins - x.wins || y.podiums - x.podiums || y.starts - x.starts)
      .slice(0, 50)
  }, [model, races])
  return (
    <div className="view">
      <Card title="Choisissez un pilote" subtitle="Utilisez le filtre Pilote ou cliquez sur une ligne · 50 pilotes les plus victorieux de la sélection">
        <DataTable
          rows={rows}
          rowKey={(r) => r.id}
          onRowClick={(r) => set({ driverId: r.id })}
          columns={[
            { key: 'name', label: 'Pilote' },
            { key: 'nationality', label: 'Nationalité' },
            { key: 'starts', label: 'Courses', align: 'right' },
            { key: 'wins', label: 'Victoires', align: 'right' },
            { key: 'podiums', label: 'Podiums', align: 'right' },
          ]}
        />
      </Card>
    </div>
  )
}
