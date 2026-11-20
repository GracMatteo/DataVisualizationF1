import { useEffect, useMemo, useState } from 'react'
import LogoF1 from './assets/f1.svg?react'
import SectionNav from './components/SectionNav.jsx'
import CircuitMap from './components/CircuitMap.jsx'
import CircuitPanel from './components/CircuitPanel.jsx'
import { loadF1Data } from './lib/loadF1Data.js'
import { loadCircuits } from './lib/loadCircuits.js'
import { buildRaceWinners, circuitLeaderboard, circuitSpans, filterRaces, summarizeCircuits } from './lib/circuitWins.js'
import { PIE_TOP_CONSTRUCTORS, buildCircuitMarkers } from './lib/circuitMarkers.js'
import { getTeamColor } from './lib/teamColors.js'
import './Dashboard.css'
import './CircuitExplorer.css'

const PLAY_INTERVAL_MS = 1200
const parseYear = (value) => (value === '' ? null : Number(value))
const focusValue = (value) => (value == null ? '' : String(value))

export default function CircuitExplorer({ onHome, onDrivers, onConstructors, onRaces, onCircuits, circuitFocus }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0)
  // Opening from another view (Races) can preset the seasons, the country and a circuit.
  const [fromYear, setFromYear] = useState(() => focusValue(circuitFocus?.fromYear))
  const [lastYear, setLastYear] = useState(() => focusValue(circuitFocus?.toYear))
  const [country, setCountry] = useState(() => circuitFocus?.country ?? '')
  const [highlightId, setHighlightId] = useState(null)
  const [selectedId, setSelectedId] = useState(() => circuitFocus?.circuitId ?? null)
  // Several circuits or countries sent from Races restrict the map until cleared.
  const [linkedSet, setLinkedSet] = useState(() => (circuitFocus?.circuitIds
    ? { kind: 'circuits', values: circuitFocus.circuitIds }
    : circuitFocus?.countries ? { kind: 'countries', values: circuitFocus.countries } : null))
  const [playing, setPlaying] = useState(false)
  // Pies are the default; a single-season range still falls back to dots (see pieAvailable).
  const [display, setDisplay] = useState('pie')

  useEffect(() => {
    let active = true
    Promise.all([loadF1Data(), loadCircuits()]).then(([tables, circuits]) => {
      if (!active) return
      const raceWinners = buildRaceWinners(tables)
      const winningIds = new Set(raceWinners.flatMap((race) => race.constructorIds))
      setData({
        tables,
        circuits,
        raceWinners,
        spans: circuitSpans(raceWinners),
        // All-season summaries fix the marker size domain, so sizes compare across filters.
        archiveSummaries: summarizeCircuits(raceWinners),
        countries: [...new Set(raceWinners.map((race) => circuits.get(race.circuitId)?.country).filter(Boolean))].sort(),
        winningConstructors: [...winningIds]
          .map((id) => ({ id, name: tables.constructors.get(id)?.name ?? `Constructor ${id}` }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      })
    }).catch((reason) => {
      if (active) setError(reason.message || 'The CSV files could not be loaded.')
    })
    return () => { active = false }
  }, [attempt])

  const years = data?.tables.years
  // Season playback shows one season at a time, starting from the chosen first season.
  useEffect(() => {
    if (!playing || !years?.length) return undefined
    let index = Math.max(0, years.indexOf(parseYear(fromYear)))
    if (index >= years.length - 1) index = 0
    const show = () => {
      setFromYear(String(years[index]))
      setLastYear(String(years[index]))
    }
    show()
    const timer = setInterval(() => {
      index += 1
      if (index >= years.length) setPlaying(false)
      else show()
    }, PLAY_INTERVAL_MS)
    return () => clearInterval(timer)
    // fromYear is only read when playback starts.
  }, [playing, years]) // eslint-disable-line react-hooks/exhaustive-deps

  const reversedRange = fromYear !== '' && lastYear !== '' && Number(fromYear) > Number(lastYear)
  const summaries = useMemo(() => (data ? summarizeCircuits(filterRaces(data.raceWinners, data.circuits, {
    fromYear: parseYear(fromYear), toYear: parseYear(lastYear), country: country || null,
    circuitIds: linkedSet?.kind === 'circuits' ? linkedSet.values : null,
    countries: linkedSet?.kind === 'countries' ? linkedSet.values : null,
  })) : new Map()), [data, fromYear, lastYear, country, linkedSet])
  const board = useMemo(() => circuitLeaderboard(summaries), [summaries])
  const seasonCount = useMemo(
    () => new Set([...summaries.values()].flatMap((summary) => summary.races.map((race) => race.year))).size,
    [summaries],
  )
  // A single season gives each circuit one race, so a pie would always be a full disc.
  const pieAvailable = seasonCount > 1
  const shownDisplay = pieAvailable ? display : 'dots'
  const markers = useMemo(() => (data ? buildCircuitMarkers({
    circuits: data.circuits,
    spans: data.spans,
    summaries,
    archiveSummaries: data.archiveSummaries,
    constructors: data.tables.constructors,
    highlightId,
    display: shownDisplay,
  }) : []), [data, summaries, highlightId, shownDisplay])

  const raceCount = [...summaries.values()].reduce((sum, summary) => sum + summary.raceCount, 0)
  const highlightWins = highlightId === null ? 0 : markers.filter((marker) => marker.kind === 'leader').length
  const rangeLabel = !data ? '' : reversedRange ? 'Invalid season range'
    : `${fromYear || data.tables.yearRange.fromYear}–${lastYear || data.tables.yearRange.toYear}${country ? ` · ${country}` : ''}`
  const filtered = fromYear !== '' || lastYear !== '' || country !== '' || highlightId !== null || linkedSet !== null
  const linkedNames = !linkedSet || !data ? [] : linkedSet.kind === 'countries' ? linkedSet.values
    : linkedSet.values.map((id) => data.circuits.get(id)?.name ?? `Circuit ${id}`)

  // Any manual filter change stops playback so the user's choice is never overwritten.
  const manual = (setter) => (event) => { setPlaying(false); setter(event.target.value) }
  function resetFilters() {
    setPlaying(false)
    setFromYear('')
    setLastYear('')
    setCountry('')
    setHighlightId(null)
    setLinkedSet(null)
  }

  const highlightName = highlightId === null ? null : data?.tables.constructors.get(highlightId)?.name

  return (
    <main className="dashboard circuit-explorer">
      <header className="dashboard-header">
        <button type="button" className="brand brand--button" onClick={onHome} aria-label="DataViz F1 home">
          <LogoF1 className="brand__icon" aria-hidden="true" />
          <span className="brand__name">DataViz F1</span>
        </button>
        <span className="dashboard-header__tag">THE CIRCUIT ARCHIVE</span>
        <button type="button" className="text-button" onClick={onHome}>← Back home</button>
      </header>
      <SectionNav activeSection="circuits" onDrivers={onDrivers} onConstructors={onConstructors} onRaces={onRaces} onCircuits={onCircuits} />

      <section className="dashboard-intro" aria-labelledby="circuits-title">
        <p className="eyebrow">One map. Every winning team.</p>
        <h1 id="circuits-title">Who rules <span>each circuit?</span></h1>
        <p>Every circuit is colored by the constructor that has won there most often. Narrow the seasons to see how dominance shifts across eras.</p>
      </section>

      {error ? (
        <section className="empty-state" role="alert">
          <h2>We couldn’t load the race archive.</h2>
          <p>{error}</p>
          <button className="btn btn--primary" type="button" onClick={() => { setError(null); setAttempt((value) => value + 1) }}>Try again</button>
        </section>
      ) : !data ? (
        <div className="empty-state" role="status"><span className="loading-dot" />Loading circuits and race winners…</div>
      ) : (
        <>
          <section className="explorer-filters circuit-filters" aria-label="Season, country and constructor filters">
            <div className="season-filters">
              <label className="field">
                <span>From season</span>
                <select value={fromYear} aria-invalid={reversedRange} onChange={manual(setFromYear)}>
                  <option value="">First season</option>
                  {years.map((year) => <option key={year} value={year}>{year}</option>)}
                </select>
              </label>
              <label className="field">
                <span>To season</span>
                <select value={lastYear} aria-invalid={reversedRange} onChange={manual(setLastYear)}>
                  <option value="">Latest season</option>
                  {years.map((year) => <option key={year} value={year}>{year}</option>)}
                </select>
              </label>
              <button type="button" className="play-button" aria-pressed={playing} onClick={() => setPlaying((value) => !value)}>
                {playing ? 'Pause' : '▶ Play seasons'}
              </button>
            </div>
            <label className="field circuit-filters__country">
              <span>Host country</span>
              <select value={country} onChange={manual(setCountry)}>
                <option value="">All countries</option>
                {data.countries.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>
            <label className="field circuit-filters__team">
              <span>Highlight a constructor</span>
              <select value={highlightId ?? ''} onChange={(event) => setHighlightId(event.target.value === '' ? null : Number(event.target.value))}>
                <option value="">Most-winning team per circuit</option>
                {data.winningConstructors.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
              </select>
            </label>
            <button type="button" className="text-button reset-filters" onClick={resetFilters} disabled={!filtered}>Reset</button>
            {linkedSet && (
              <p className="linked-set" role="status">
                <span>
                  From Races: {linkedSet.values.length} {linkedSet.kind === 'countries' ? 'countries' : 'circuits'}
                  {' '}<small>({linkedNames.join(', ')})</small>
                </span>
                <button type="button" className="text-button" onClick={() => setLinkedSet(null)}>Show all circuits</button>
              </p>
            )}
          </section>

          <section className="driver-overview" aria-label="Selection summary">
            <div className="driver-overview__identity">
              <p className="eyebrow">{highlightName ? 'Highlighted constructor' : 'Selected seasons'}</p>
              <h2>{highlightName ?? rangeLabel}</h2>
              <p>{highlightName ? `${rangeLabel} · won at ${highlightWins} of ${summaries.size} circuits` : 'Grands Prix with recorded results'}</p>
            </div>
            <dl className="driver-stats">
              {[
                ['Grands Prix', raceCount], ['Circuits', summaries.size],
                ['Leading constructors', board.filter((row) => row.led > 0).length],
              ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value.toLocaleString('en')}</dd></div>)}
            </dl>
          </section>

          <div className="circuit-layout">
            <section className="chart-panel" aria-labelledby="map-heading">
              <div className="chart-panel__header">
                <div><p className="eyebrow">Circuit dominance</p><h2 id="map-heading">The constructor map</h2></div>
                <div className="chart-panel__tools">
                  <div className="display-toggle" role="group" aria-label="Marker style">
                    <button type="button" aria-pressed={shownDisplay === 'dots'} onClick={() => setDisplay('dots')}>Dots</button>
                    <button type="button" aria-pressed={shownDisplay === 'pie'} disabled={!pieAvailable} onClick={() => setDisplay('pie')}>Pie charts</button>
                  </div>
                  {!pieAvailable && display === 'pie' && <p className="display-toggle__note">Pie charts need more than one season.</p>}
                  <MapKey
                    display={shownDisplay}
                    highlightName={highlightName}
                    highlightColor={highlightId === null ? null : getTeamColor(data.tables.constructors.get(highlightId)?.constructorRef)}
                  />
                </div>
              </div>
              {reversedRange ? (
                <div className="empty-state" role="status">
                  <h3>Choose a valid season range.</h3>
                  <p>The first season must be before or equal to the last season.</p>
                  <button className="btn btn--ghost" type="button" onClick={resetFilters}>Show every season</button>
                </div>
              ) : (
                <>
                  <CircuitMap
                    markers={markers}
                    selectedId={selectedId}
                    onSelect={(id) => setSelectedId((current) => (current === id ? null : id))}
                    onClear={() => setSelectedId(null)}
                  />
                  {summaries.size === 0 && <p className="tree-hint" role="status">No Grand Prix matches these filters.</p>}
                  <p className="tree-hint">Drag to pan, scroll or use the buttons to zoom. Hover, focus or select a circuit for details.</p>
                </>
              )}
            </section>

            <CircuitPanel
              circuit={selectedId === null ? null : data.circuits.get(selectedId)}
              summary={summaries.get(selectedId)}
              board={board}
              circuitCount={summaries.size}
              constructors={data.tables.constructors}
              drivers={data.tables.drivers}
              onOpenDrivers={(marks) => onDrivers?.(marks)}
              onOpenConstructors={(marks) => onConstructors?.(marks.map((mark) => ({
                ...mark, name: data.tables.constructors.get(mark.constructorId)?.name ?? null,
              })))}
              onOpenRaces={(circuitId, years) => onRaces?.({
                circuitId,
                fromYear: years ? years.fromYear : parseYear(fromYear),
                toYear: years ? years.toYear : parseYear(lastYear),
              })}
              highlightId={highlightId}
              onHighlight={setHighlightId}
              onClose={() => setSelectedId(null)}
              rangeLabel={rangeLabel}
              seasonRange={{
                from: parseYear(fromYear) ?? data.tables.yearRange.fromYear,
                to: parseYear(lastYear) ?? data.tables.yearRange.toYear,
              }}
            />
          </div>

          <div className="explorer-notes">
            <aside className="reading-guide reading-guide--first" aria-labelledby="circuit-guide-title">
              <p className="eyebrow">A quick guide</p>
              <h2 id="circuit-guide-title">How to read the map</h2>
              <p>Each dot is a circuit, placed at its coordinates. Its color is the constructor with the most Grand Prix wins there in the selected seasons; its size grows with the number of Grands Prix held there, on one scale for every season range (the largest dot is the most-raced circuit of the whole archive). Gray dots have a tied top total or no classified winner, and faint dots hosted no race in the filters.</p>
              <p>When a constructor is highlighted, colored dots are the circuits it has won at, sized by its win count; hollow dots are circuits where it never won.</p>
              <p>With several seasons selected, <strong>Pie charts</strong> split each circuit into the win shares of its top {PIE_TOP_CONSTRUCTORS} constructors, with every other winner grouped as gray “Others”. With a highlighted constructor, each pie shows that team against everyone else.</p>
            </aside>
            <aside className="reading-guide" aria-labelledby="circuit-data-title">
              <p className="eyebrow">About the data</p>
              <h2 id="circuit-data-title">What counts as a win</h2>
              <p>A win is a Grand Prix result with official classified position 1. Sprint races are not included. Constructors are counted by their identifier in the archive, so renamed teams (for example Toleman, Benetton and Renault) are kept separate.</p>
              <small>Team colors are identifiers, not historical liveries, and some historical teams can share a color: names in the tooltip and panel remain the reference.</small>
            </aside>
          </div>

          <footer className="dashboard-footer">
            <span>Local F1 archive · {data.tables.yearRange.fromYear}–{data.tables.yearRange.toYear} · {data.spans.size} circuits · {data.raceWinners.length.toLocaleString('en')} Grands Prix</span>
            <span>D3.js Natural Earth projection / No external data service</span>
          </footer>
        </>
      )}
    </main>
  )
}

// The default swatch samples three team colors: it means "a team color", not one team.
const SAMPLE_SWATCH = `conic-gradient(${['ferrari', 'mclaren', 'mercedes'].map((ref, index) => `${getTeamColor(ref)} ${index * 120}deg ${(index + 1) * 120}deg`).join(', ')})`

function MapKey({ display, highlightName, highlightColor }) {
  const colorSwatch = { background: highlightColor ?? SAMPLE_SWATCH }
  if (display === 'pie') {
    return (
      <ul className="map-key" aria-label="Map legend">
        <li><span className="map-key__dot" style={colorSwatch} />{highlightName ? `${highlightName} share of wins` : `Top ${PIE_TOP_CONSTRUCTORS} teams' share of wins`}</li>
        <li><span className="map-key__dot map-key__dot--others" />Others</li>
        <li><span className="map-key__sizes" aria-hidden="true"><span /><span /></span>Size = Grands Prix</li>
      </ul>
    )
  }
  return (
    <ul className="map-key" aria-label="Map legend">
      <li><span className="map-key__dot" style={colorSwatch} />{highlightName ? `${highlightName} won` : 'Team color = most wins'}</li>
      <li><span className={`map-key__dot ${highlightName ? 'map-key__dot--hollow' : 'map-key__dot--neutral'}`} />{highlightName ? 'Never won (hollow)' : 'Tie / no winner'}</li>
      <li><span className="map-key__sizes" aria-hidden="true"><span /><span /></span>{highlightName ? 'Size = its wins' : 'Size = Grands Prix'}</li>
    </ul>
  )
}
