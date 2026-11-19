import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import LogoF1 from './assets/f1.svg?react'
import GainRankChart from './components/GainRankChart.jsx'
import GapDetailChart from './components/GapDetailChart.jsx'
import GridDetailPanel from './components/GridDetailPanel.jsx'
import GridFinishChart from './components/GridFinishChart.jsx'
import SectionNav from './components/SectionNav.jsx'
import { formatPercent, formatRaces, formatSignedPlaces } from './lib/formatSigned.js'
import { GRID_HEAT_HIGH, GRID_HEAT_LOW } from './lib/gridHeat.js'
import { binGridFinish, circuitMatchesQuery, circuitOptions, filterGridStarts, matchesGridFilter, rankGridGroups, summarizePlaceGaps, summarizePoleStats } from './lib/gridFinish.js'
import { loadCircuitBoard } from './lib/loadCircuitBoard.js'
import './Dashboard.css'
import './Races.css'

function formatCount(value) {
  return value.toLocaleString('fr-FR')
}

// Unplugged for now. Set this to true to show "Qui la grille prédit le moins"
// and the per-circuit gap chart again. The squares stay on the page either way.
const showPlaceRank = false

export default function Races({ onBack, onDrivers, onConstructors, onRaces }) {
  const [board, setBoard] = useState(null)
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const [circuitId, setCircuitId] = useState('')
  const [circuitQuery, setCircuitQuery] = useState('')
  const [fromYear, setFromYear] = useState('')
  const [toYear, setToYear] = useState('')
  const [rankMode, setRankMode] = useState('circuit')
  const [panels, setPanels] = useState({ keys: [], front: null })
  const rankPanelRef = useRef(null)
  const reversedRange = fromYear !== '' && toYear !== '' && Number(fromYear) > Number(toYear)
  const filtersActive = circuitId !== '' || fromYear !== '' || toYear !== '' || circuitQuery.trim() !== ''

  useEffect(() => {
    let active = true
    loadCircuitBoard().then((data) => {
      if (active) setBoard(data)
    }).catch((reason) => {
      if (active) setError(reason.message || 'Les fichiers CSV n’ont pas pu être chargés.')
    })
    return () => { active = false }
  }, [attempt])

  const seasonFilters = useMemo(() => ({
    fromYear: fromYear === '' ? undefined : Number(fromYear),
    toYear: toYear === '' ? undefined : Number(toYear),
  }), [fromYear, toYear])
  const gridFilters = useMemo(() => ({
    ...seasonFilters,
    circuitId: circuitId === '' ? undefined : Number(circuitId),
  }), [seasonFilters, circuitId])

  const rankedEntries = useMemo(() => {
    if (!board || reversedRange) return []
    return filterGridStarts(board.entries, seasonFilters)
  }, [board, reversedRange, seasonFilters])
  const filtered = useMemo(() => {
    if (!board || reversedRange) return []
    return filterGridStarts(board.entries, gridFilters)
  }, [board, reversedRange, gridFilters])
  const model = useMemo(() => binGridFinish(filtered), [filtered])
  const ranks = useMemo(() => rankGridGroups(rankedEntries, rankMode), [rankedEntries, rankMode])
  const gapDetail = useMemo(
    () => (circuitId === '' || reversedRange ? null : summarizePlaceGaps(filtered)),
    [circuitId, reversedRange, filtered],
  )
  const sliceStats = useMemo(() => summarizePoleStats(filtered), [filtered])
  const busiest = useMemo(() => circuitOptions(rankedEntries)[0] ?? null, [rankedEntries])
  const excluded = useMemo(() => {
    if (!board || reversedRange) return { noGrid: 0, unclassified: 0 }
    return {
      noGrid: board.excluded.filter((entry) => entry.reason === 'no-grid' && matchesGridFilter(entry, gridFilters)).length,
      unclassified: board.excluded.filter((entry) => entry.reason === 'unclassified' && matchesGridFilter(entry, gridFilters)).length,
    }
  }, [board, reversedRange, gridFilters])
  const circuits = useMemo(() => (board ? circuitOptions(board.entries) : []), [board])
  const circuitMatches = useMemo(
    () => circuits.filter((circuit) => circuitMatchesQuery(circuit, circuitQuery)),
    [circuits, circuitQuery],
  )
  const activeCircuit = circuits.find((circuit) => circuit.circuitId === Number(circuitId)) ?? null
  const listedCircuits = activeCircuit && !circuitMatches.some((circuit) => circuit.circuitId === activeCircuit.circuitId)
    ? [activeCircuit, ...circuitMatches]
    : circuitMatches
  const matchLabel = !circuitQuery.trim()
    ? `${circuits.length} dans ce filtre`
    : circuitMatches.length === 0
      ? 'Aucun'
      : circuitMatches.length === 1
        ? '1 correspond'
        : `${circuitMatches.length} correspondent`
  const openCells = panels.keys
    .map((key) => model.cells.find((cell) => cell.key === key))
    .filter(Boolean)
  const selectedRankId = rankMode === 'circuit' && circuitId ? `circuit:${Number(circuitId)}` : null
  const focusRow = activeCircuit && gapDetail?.count ? {
    id: `circuit:${activeCircuit.circuitId}`,
    label: activeCircuit.name,
    circuitId: activeCircuit.circuitId,
    countryKey: activeCircuit.countryKey,
    countryLabel: activeCircuit.countryLabel,
    count: gapDetail.count,
    medianGain: gapDetail.medianGain,
    samePlace: gapDetail.samePlace,
    circuitCount: 1,
    raceCount: gapDetail.raceCount,
  } : null
  const seasonLabel = !board || (fromYear === '' && toYear === '')
    ? 'Toutes les saisons'
    : `${fromYear || board.years[0]}–${toYear || board.years.at(-1)}`

  const closePanels = useCallback(() => {
    setPanels({ keys: [], front: null })
  }, [])
  const closePanel = useCallback((key) => {
    setPanels((current) => {
      const keys = current.keys.filter((item) => item !== key)
      return { keys, front: current.front === key ? keys.at(-1) ?? null : current.front }
    })
  }, [])
  const selectCell = useCallback((key) => {
    setPanels((current) => {
      const keys = current.keys.includes(key)
        ? current.keys.filter((item) => item !== key)
        : [...current.keys, key].slice(-2)
      return { keys, front: keys.includes(key) ? key : keys.at(-1) ?? null }
    })
  }, [])
  const focusPanel = useCallback((key) => {
    setPanels((current) => (current.keys.includes(key) && current.front !== key ? { ...current, front: key } : current))
  }, [])
  const selectRank = useCallback((row) => {
    closePanels()
    setCircuitId((current) => (current === String(row.circuitId) ? '' : String(row.circuitId)))
  }, [closePanels])

  useEffect(() => {
    if (!circuitId || !rankPanelRef.current) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    rankPanelRef.current.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' })
  }, [circuitId])

  useEffect(() => {
    if (!panels.front) return undefined
    function onKey(event) {
      if (event.key !== 'Escape') return
      closePanel(panels.front)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panels.front, closePanel])

  function resetFilters() {
    setCircuitId('')
    setCircuitQuery('')
    setFromYear('')
    setToYear('')
    closePanels()
  }

  const heading = activeCircuit?.name ?? 'Tous les circuits'

  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <button type="button" className="brand brand--button" onClick={onBack} aria-label="Accueil DataViz F1">
          <LogoF1 className="brand__icon" aria-hidden="true" />
          <span className="brand__name">DataViz F1</span>
        </button>
        <span className="dashboard-header__tag">GRILLE ET ARRIVÉE</span>
        <button type="button" className="text-button" onClick={onBack}>← Accueil</button>
      </header>
      <SectionNav activeSection="races" onDrivers={onDrivers} onConstructors={onConstructors} onRaces={onRaces} />

      <section className="dashboard-intro" aria-labelledby="races-title">
        <p className="eyebrow">Chaque départ classé</p>
        <h1 id="races-title">Où la grille <span>cesse de prédire l’arrivée.</span></h1>
        <p>Chaque carré compte les pilotes partis de cette place et classés à cette place. Le trait pointillé marque une arrivée à la place du départ.{showPlaceRank ? ' Le classement compare les circuits, ou les pays.' : ''}</p>
      </section>

      {error ? (
        <section className="empty-state" role="alert">
          <h2>L’archive des courses n’a pas pu être chargée.</h2>
          <p>{error}</p>
          <button className="btn btn--primary" type="button" onClick={() => { setError(null); setAttempt((value) => value + 1) }}>Réessayer</button>
        </section>
      ) : !board ? (
        <div className="empty-state" role="status"><span className="loading-dot" />Chargement des courses, des grilles et des circuits…</div>
      ) : (
        <>
          <section className="explorer-filters" aria-label="Filtres de circuit et de saison">
            <div className="circuit-picker">
              <label className="field">
                <span>Chercher un circuit</span>
                <input
                  type="search"
                  placeholder="Nom ou pays, ex. Monaco"
                  value={circuitQuery}
                  onChange={(event) => setCircuitQuery(event.target.value)}
                  aria-controls="circuit-select"
                />
              </label>
              <label className="field circuit-field">
                <span>Circuit <small>{matchLabel}</small></span>
                <select id="circuit-select" value={circuitId} onChange={(event) => { setCircuitId(event.target.value); closePanels() }} disabled={!circuits.length}>
                  <option value="">Tous les circuits</option>
                  {circuitQuery.trim() && !circuitMatches.length && <option value="__none" disabled>Aucun circuit correspondant</option>}
                  {listedCircuits.map((circuit) => (
                    <option key={circuit.circuitId} value={circuit.circuitId}>
                      {circuit.name} · {circuit.countryLabel} · {circuit.raceCount} course{circuit.raceCount > 1 ? 's' : ''}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="season-filters">
              <label className="field">
                <span>Saison de début</span>
                <select value={fromYear} aria-invalid={reversedRange} onChange={(event) => { setFromYear(event.target.value); closePanels() }}>
                  <option value="">Première saison</option>
                  {board.years.map((year) => <option key={year} value={year}>{year}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Saison de fin</span>
                <select value={toYear} aria-invalid={reversedRange} onChange={(event) => { setToYear(event.target.value); closePanels() }}>
                  <option value="">Dernière saison</option>
                  {board.years.map((year) => <option key={year} value={year}>{year}</option>)}
                </select>
              </label>
              <button type="button" className="text-button reset-filters" onClick={resetFilters} disabled={!filtersActive}>Réinitialiser</button>
            </div>
          </section>

          <section className="driver-overview" aria-label="Résumé des départs filtrés">
            <dl className="driver-stats">
              {[
                ['Départs classés', model.count],
                ['Médiane des places gagnées', formatSignedPlaces(model.medianGain)],
                ['Arrivées à la place de la grille', model.samePlace],
                ['Grille non enregistrée', excluded.noGrid],
                ['Non classés', excluded.unclassified],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{typeof value === 'number' ? formatCount(value) : value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {!reversedRange && (
            <section className="known-stats" aria-label="Repères sur les courses et la grille 1">
              <p className="eyebrow">Bon à savoir</p>
              <dl>
                <div>
                  <dt>Courses</dt>
                  <dd>{formatRaces(sliceStats.raceCount)}</dd>
                  <p>{activeCircuit
                    ? (busiest && activeCircuit.circuitId === busiest.circuitId
                      ? 'C’est le maximum sur cette plage.'
                      : `${formatPercent(sliceStats.raceCount, busiest?.raceCount)} du maximum${busiest ? ` · ${busiest.name}, ${formatRaces(busiest.raceCount)}` : ''}.`)
                    : (busiest ? `Le plus couru : ${busiest.name}, ${formatRaces(busiest.raceCount)}.` : 'Aucune course classée.')}</p>
                </div>
                <div>
                  <dt>Partis de la grille 1</dt>
                  <dd>{formatCount(sliceStats.gridOne)}</dd>
                  <p>{formatPercent(sliceStats.gridOne, sliceStats.classified)} des départs classés.</p>
                </div>
                <div>
                  <dt>Grille 1 terminée en P1</dt>
                  <dd>{formatCount(sliceStats.gridOneWins)}</dd>
                  <p>{formatPercent(sliceStats.gridOneWins, sliceStats.gridOne)} des départs en grille 1.</p>
                </div>
                <div>
                  <dt>Arrivées en P1</dt>
                  <dd>{formatCount(sliceStats.wins)}</dd>
                  <p>{formatPercent(sliceStats.gridOneWins, sliceStats.wins)} viennent de la grille 1.</p>
                </div>
              </dl>
            </section>
          )}

          {showPlaceRank && <section className="chart-panel rank-panel" aria-labelledby="rank-heading" ref={rankPanelRef}>
            <div className="chart-panel__header">
              <div>
                <p className="eyebrow">{focusRow ? 'Ce circuit, à chaque course' : 'Qui la grille prédit le moins'}</p>
                <h2 id="rank-heading">{focusRow ? `${activeCircuit.name} · ${seasonLabel}` : `Classement · ${seasonLabel}`}</h2>
                <p className="rank-note">{focusRow
                  ? `Seulement ${activeCircuit.name}, sur toutes ses courses de cette plage. Le chiffre du haut est la médiane. Chaque ligne en dessous est un écart exact : +6 compte les pilotes classés six places devant leur grille. Partir 1er et finir 1er reste 0.`
                  : 'Le +6 n’est pas « partir premier et gagner 6 places ». Partir 1er et finir 1er donne 0 : depuis la première place, on ne peut pas en gagner. Le chiffre est la médiane de la place de grille moins la place d’arrivée, sur les pilotes classés. Partir 10e et finir 4e donne +6. Le nombre à côté compte les courses de ce circuit, par exemple +6 · 10 courses. Le classement met le plus grand écart en haut. Choisir un circuit dans le filtre l’affiche seul, avec le détail de chaque écart.'}</p>
              </div>
              <div className="rank-toolbar">
                {focusRow ? (
                  <button type="button" className="text-button" onClick={() => { setCircuitId(''); closePanels() }}>Revoir tous les circuits</button>
                ) : (
                  <div className="button-group" role="group" aria-label="Regrouper le classement">
                    <button type="button" aria-pressed={rankMode === 'circuit'} onClick={() => setRankMode('circuit')}>Par circuit</button>
                    <button type="button" aria-pressed={rankMode === 'country'} onClick={() => setRankMode('country')}>Par pays</button>
                  </div>
                )}
                <p className="grid-axis-key">
                  {focusRow ? (
                    <>
                      <span>Barre du haut : la médiane</span>
                      <span>Détail : un écart, et le nombre de départs</span>
                    </>
                  ) : (
                    <>
                      <span>À gauche : fini derrière la grille</span>
                      <span>0 : même place qu’au départ</span>
                      <span>À droite : fini devant la grille</span>
                    </>
                  )}
                </p>
              </div>
            </div>
            {reversedRange || (focusRow ? false : !ranks.length) || (circuitId && !focusRow) ? (
              <div className="empty-state" role="status">
                <h3>{reversedRange ? 'Choisissez une plage de saisons valide.' : 'Aucun départ classé sur ces saisons.'}</h3>
                <p>{reversedRange ? 'La première saison doit précéder ou égaler la dernière.' : 'Élargissez les saisons.'}</p>
              </div>
            ) : focusRow ? (
              <>
                <dl className="driver-stats circuit-focus-stats">
                  {[
                    ['Courses', formatRaces(gapDetail.raceCount)],
                    ['Médiane', formatSignedPlaces(gapDetail.medianGain)],
                    ['Ont gagné des places', gapDetail.gained],
                    ['Même place', gapDetail.samePlace],
                    ['Ont perdu des places', gapDetail.lost],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{typeof value === 'number' ? formatCount(value) : value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="rank-chart-scroll is-single">
                  <GainRankChart rows={[focusRow]} mode="circuit" selectedId={selectedRankId} onSelect={selectRank} />
                </div>
                <h3 className="gap-heading">Détail de chaque écart</h3>
                <div className="rank-chart-scroll">
                  <GapDetailChart gaps={gapDetail.gaps} />
                </div>
                <ul className="tree-legend rank-legend" aria-label="Légende du détail">
                  <li><span className="legend-swatch legend-swatch--dark" />Chaque ligne du détail est un écart exact. Sa longueur est le nombre de départs classés. La couleur ne change pas.</li>
                  <li><span className="legend-line" />Trait pointillé de la barre du haut : zéro, classé à la place de la grille</li>
                  <li>L’ordre va du plus grand gain à la plus grande perte. Une ligne absente veut dire qu’aucun départ classé n’a cet écart. Les noms restent dans les carrés.</li>
                </ul>
              </>
            ) : (
              <>
                <div className="rank-chart-scroll">
                  <GainRankChart rows={ranks} mode={rankMode} selectedId={selectedRankId} onSelect={selectRank} />
                </div>
                <ul className="tree-legend rank-legend" aria-label="Légende du classement">
                  <li><span className="legend-swatch legend-swatch--dark" />+6 · 10 courses : six places gagnées en médiane sur 10 courses. Partir 10e et finir 4e compte pour +6. Partir 1er et finir 1er compte pour 0. La couleur ne change pas.</li>
                  <li><span className="legend-line" />0 : classé à la même place que sur la grille</li>
                  <li>Le tri suit cet écart, du plus grand au plus petit. L’espace entre deux lignes ne mesure pas l’écart entre deux médianes.</li>
                </ul>
              </>
            )}
          </section>}

          <section className="chart-panel grid-panel" aria-labelledby="grid-heading">
            <div className="chart-panel__header">
              <div>
                <p className="eyebrow">Grille de départ → arrivée classée</p>
                <h2 id="grid-heading">{heading}</h2>
              </div>
              <p className="grid-axis-key"><span>Axe horizontal : position de départ sur la grille.</span><span>Axe vertical : position d’arrivée classée, P1 en haut.</span></p>
            </div>
            {reversedRange || !model.count ? (
              <div className="empty-state" role="status">
                <h3>{reversedRange ? 'Choisissez une plage de saisons valide.' : 'Aucun départ classé ne correspond à ces filtres.'}</h3>
                <p>{reversedRange ? 'La première saison doit précéder ou égaler la dernière.' : 'Élargissez les saisons, ou choisissez tous les circuits.'}</p>
                <button className="btn btn--ghost" type="button" onClick={resetFilters}>Afficher tous les départs classés</button>
              </div>
            ) : (
              <>
                <div className="grid-chart-scroll">
                  <GridFinishChart model={model} selectedKeys={panels.keys} onSelect={selectCell} />
                </div>
                <ul className="tree-legend" aria-label="Légende de la matrice">
                  <li><span className="legend-swatch" style={{ background: GRID_HEAT_LOW }} />Faible effectif de départs classés.</li>
                  <li><span className="legend-swatch" style={{ background: GRID_HEAT_HIGH }} />Effectif le plus élevé dans le filtre courant.</li>
                  <li><span className="legend-line" />Arrivée classée à la position de grille.</li>
                  <li>La sélection d’une case ouvre la liste des départs correspondants. Une deuxième case ouvre une autre liste. La barre de titre déplace la liste. Fermer, Échap, ou une nouvelle sélection de la même case referme la liste au premier plan. Une troisième sélection remplace la plus ancienne.</li>
                </ul>
              </>
            )}
          </section>

          {openCells.map((cell, index) => (
            <GridDetailPanel
              key={cell.key}
              cell={cell}
              index={index}
              onClose={() => closePanel(cell.key)}
              onFocus={() => focusPanel(cell.key)}
              onOpenDrivers={(entries) => onDrivers?.(entries.map((entry) => ({ driverId: entry.driverId, year: entry.year })))}
            />
          ))}
          <footer className="dashboard-footer">
            <span>Archive F1 locale · {board.years[0]}–{board.years.at(-1)} · départs classés avec une place de grille</span>
            <span>Échelles D3 / aucune source externe</span>
          </footer>
        </>
      )}
    </main>
  )
}
