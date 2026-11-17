import { useMemo } from 'react'
import { countBy, isPodium, isWin, polesOf, ranked, resultsOf, scopeRaces } from '../data/model.js'
import { useModel, useStore } from '../state/store.jsx'
import { Card, DataTable, Kpi, KpiRow } from '../components/ui.jsx'
import { EntityPicker, useConstructorOptions } from '../components/FilterBar.jsx'
import { GroupedBarChart, HBarChart } from '../components/charts/BarCharts.jsx'
import { Heatmap } from '../components/charts/Misc.jsx'
import { constructorColor, series } from '../lib/colors.js'
import { fmtInt, fmtPct, fmtPoints } from '../lib/format.js'
import { COMMON_METRICS, CircuitWinsCard, ComparisonTable, OutcomeCard, PointsCard, WinsMapCard, entityData } from './entity.jsx'
import { constructorName, driverName } from './shared.jsx'

function titlesOf(model, id, races) {
  const years = [...new Set(races.map((r) => r.year))]
  return years.filter((y) => model.seasonComplete(y) && model.constructorSeason.get(y)?.get(id)?.position === 1).length
}

export function ConstructorView() {
  const model = useModel()
  const { state, set } = useStore()
  const options = useConstructorOptions()
  const races = useMemo(() => scopeRaces(model, state), [model, state])
  const periodRaces = useMemo(() => scopeRaces(model, state, { circuit: false }), [model, state])
  const results = useMemo(() => resultsOf(model, races), [model, races])
  const periodResults = useMemo(() => resultsOf(model, periodRaces), [model, periodRaces])

  const extra = (d) => d && { ...d, drivers: new Set(d.results.map((r) => r.driverId)).size, titles: titlesOf(model, d.id, races) }
  const a = useMemo(() => extra(entityData(model, 'constructor', state.constructorId, races, state)), [model, state, races]) // eslint-disable-line react-hooks/exhaustive-deps
  const b = useMemo(() => extra(entityData(model, 'constructor', state.compareConstructorId, races, state)), [model, state, races]) // eslint-disable-line react-hooks/exhaustive-deps

  const wins = countBy(results, 'constructorId', isWin)
  const ranking = ranked(wins, 15).map(([id, value]) => ({ id, label: constructorName(model, id), value, color: constructorColor(model.constructorById.get(id)) }))
  const selectCircuit = (id) => set({ circuitId: state.circuitId === id ? null : id })

  const entities = a ? [{ name: constructorName(model, a.id), data: a }, ...(b ? [{ name: constructorName(model, b.id), data: b }] : [])] : []
  const ctor = a && model.constructorById.get(a.id)

  return (
    <div className="view">
      <div className="grid grid--2">
        <Card
          title="Classement historique"
          subtitle="Victoires en Grand Prix · cliquez pour sélectionner une écurie"
          empty={ranking.length ? null : 'Aucune victoire sur la sélection.'}
          table={{ columns: [{ key: 'label', label: 'Constructeur' }, { key: 'value', label: 'Victoires', align: 'right' }], rows: ranking }}
        >
          <HBarChart data={ranking} unit="victoires" selectedId={state.constructorId} onSelect={(id) => set({ constructorId: state.constructorId === id ? null : id })} />
        </Card>
        <ComparisonBars races={races} results={results} pinned={entities.map((e) => e.data.id)} />
      </div>

      {a && (
        <>
          <header className="view__head view__head--row">
            <div>
              <h2>{ctor.name}</h2>
              <p className="muted">
                {ctor.nationality} · {a.seasons.length} saison{a.seasons.length > 1 ? 's' : ''} ({a.seasons[0]?.year}–{a.seasons.at(-1)?.year})
              </p>
            </div>
            <div className="filter">
              <label htmlFor="cmp-constructor">Comparer avec</label>
              <EntityPicker
                id="cmp-constructor"
                options={options.filter((o) => o.id !== a.id)}
                value={state.compareConstructorId}
                onChange={(id) => set({ compareConstructorId: id })}
                placeholder="Choisir une écurie"
              />
            </div>
          </header>

          {b ? (
            <Card title="Comparaison" subtitle="Sur la sélection en cours · la meilleure valeur est soulignée">
              <ComparisonTable
                a={a}
                b={b}
                nameA={entities[0].name}
                nameB={entities[1].name}
                metrics={[...COMMON_METRICS, { label: 'Pilotes différents', get: (d) => d.drivers }, { label: 'Titres constructeurs', get: (d) => d.titles }]}
              />
            </Card>
          ) : (
            <KpiRow>
              <Kpi label="Courses" value={fmtInt(a.starts)} />
              <Kpi label="Victoires" value={fmtInt(a.wins)} />
              <Kpi label="Podiums" value={fmtInt(a.podiums)} />
              <Kpi label="Pole positions" value={fmtInt(a.poles)} hint="qualifications depuis 1994" />
              <Kpi label="Points" value={fmtPoints(a.points)} hint={a.pointsPartial ? 'marqués sur la sélection' : 'classements de fin de saison'} />
              <Kpi label="Pilotes" value={fmtInt(a.drivers)} />
              <Kpi label="Titres constructeurs" value={fmtInt(a.titles)} hint="championnat depuis 1958" />
              <Kpi label="Taux de victoire" value={fmtPct(a.winRate)} />
            </KpiRow>
          )}

          <div className="grid grid--2">
            <PointsCard entities={entities} markX={state.season} />
            <WinsMapCard
              model={model}
              entities={entities}
              periodRaces={periodRaces}
              singleColor={constructorColor(ctor)}
              onSelectCircuit={selectCircuit}
              selectedCircuit={state.circuitId}
            />
            <CircuitWinsCard model={model} entities={entities} onSelectCircuit={selectCircuit} selectedCircuit={state.circuitId} />
            {!b && <OutcomeCard entity={entities[0]} />}
          </div>

          <Card title="Historique des saisons" subtitle={ctor.name}>
            <DataTable
              rows={[...a.seasons].reverse()}
              rowKey={(r) => r.year}
              highlight={(r) => r.year === state.season}
              onRowClick={(r) => set({ season: state.season === r.year ? null : r.year })}
              columns={[
                { key: 'year', label: 'Saison' },
                { key: 'teams', label: 'Pilotes', render: (r) => r.teams.map((id) => driverName(model, id)).join(', ') },
                { key: 'races', label: 'Courses', align: 'right' },
                { key: 'wins', label: 'Victoires', align: 'right' },
                { key: 'podiums', label: 'Podiums', align: 'right' },
                { key: 'points', label: 'Points', align: 'right', render: (r) => fmtPoints(r.points) },
                { key: 'position', label: 'Classement', align: 'right', render: (r) => (r.position ? `${r.position}e` : 'n/d') },
              ]}
            />
          </Card>
        </>
      )}

      <DominationHeatmap races={periodRaces} results={periodResults} />
    </div>
  )
}

// Wins / podiums / poles for the top constructors (or the compared pair).
function ComparisonBars({ races, results, pinned }) {
  const model = useModel()
  const { state, set } = useStore()
  const wins = countBy(results, 'constructorId', isWin)
  const podiums = countBy(results, 'constructorId', isPodium)
  const poles = countBy(polesOf(model, races), 'constructorId')
  const ids = pinned.length > 1 ? pinned : ranked(wins, 6).map(([id]) => id)
  const groups = ids.map((id) => ({ id, label: constructorName(model, id) }))
  const keys = [
    { key: 'wins', label: 'Victoires', color: series(1) },
    { key: 'podiums', label: 'Podiums', color: series(2) },
    { key: 'poles', label: 'Pole positions', color: series(3) },
  ]
  const maps = { wins, podiums, poles }
  const value = (g, k) => maps[k].get(g.id) ?? 0
  return (
    <Card
      title="Comparaison des constructeurs"
      subtitle={pinned.length > 1 ? 'Écuries comparées' : '6 écuries les plus victorieuses de la sélection · poles depuis 1994'}
      empty={groups.length ? null : 'Aucune donnée sur la sélection.'}
      table={{ columns: [{ key: 'label', label: 'Constructeur' }, ...keys.map((k) => ({ key: k.key, label: k.label, align: 'right' }))], rows: groups.map((g) => ({ ...g, wins: value(g, 'wins'), podiums: value(g, 'podiums'), poles: value(g, 'poles') })) }}
    >
      <GroupedBarChart groups={groups} keys={keys} value={value} selectedId={state.constructorId} onSelect={(id) => set({ constructorId: id })} />
    </Card>
  )
}

function DominationHeatmap({ races, results }) {
  const model = useModel()
  const { state, set } = useStore()
  const { rows, cols, cells } = useMemo(() => {
    const winners = results.filter(isWin)
    const topC = ranked(countBy(winners, 'constructorId'), 12).map(([id]) => id)
    if (state.constructorId != null && !topC.includes(state.constructorId)) topC.push(state.constructorId)
    const topCircuits = ranked(countBy(races, 'circuitId'), 30).map(([id]) => id)
    const cells = new Map()
    for (const w of winners) {
      const k = `${w.constructorId}|${w.circuitId}`
      cells.set(k, (cells.get(k) ?? 0) + 1)
    }
    return {
      rows: topC.map((id) => ({ id, label: constructorName(model, id) })),
      cols: topCircuits.map((id) => ({ id, label: model.circuitById.get(id).name })),
      cells,
    }
  }, [model, races, results, state.constructorId])
  return (
    <Card
      title="Domination par circuit"
      subtitle="Victoires par constructeur sur les 30 circuits les plus utilisés de la sélection · cliquez une case pour filtrer"
      empty={rows.length ? null : 'Aucune victoire sur la sélection.'}
    >
      <Heatmap rows={rows} cols={cols} value={(r, c) => cells.get(`${r.id}|${c.id}`) ?? 0} onCell={(r, c) => set({ constructorId: r.id, circuitId: c.id })} />
    </Card>
  )
}
