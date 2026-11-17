import { useCallback, useEffect, useMemo, useState } from 'react'
import LogoF1 from './assets/f1.svg?react'
import FailureHeatmap from './components/FailureHeatmap.jsx'
import SeasonTimeline from './components/SeasonTimeline.jsx'
import SectionNav from './components/SectionNav.jsx'
import SpeedReliabilityScatter from './components/SpeedReliabilityScatter.jsx'
import { loadConstructorStandings } from './lib/loadConstructorStandings.js'
import { loadF1Data } from './lib/loadF1Data.js'
import {
  ERAS, buildSeasonRows, buildSeasonTimeline, getQuadrant, indexFinalStandings, pickDefaultSeason, quadrantSplits, summarizeEras,
} from './lib/engineReliability.js'
import {
  CHAMPION_COLOR, FAILURE_COLOR, QUADRANTS, RANK_GROUPS, formatPercent, formatPoints,
} from './lib/reliabilityPresentation.js'
import { getTeamColor } from './lib/teamColors.js'
import './Dashboard.css'
import './ConstructorDashboard.css'

// Seasons with very few starts (one-off entries) would sit at extreme rates by chance.
const MIN_STARTS = 10
const MAIN_TEAM_SEASONS = 5

export default function ConstructorDashboard({ onBack, onDrivers }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const [eraId, setEraId] = useState('all')
  const [selectedId, setSelectedId] = useState(null)
  const [highlightedId, setHighlightedId] = useState(null)
  const [showAllTeams, setShowAllTeams] = useState(false)

  useEffect(() => {
    let active = true
    Promise.all([loadF1Data(), loadConstructorStandings()]).then(([tables, standings]) => {
      if (active) setData({ tables, rows: buildSeasonRows(tables, indexFinalStandings(standings, tables.races)) })
    }).catch((reason) => {
      if (active) setError(reason.message || 'The CSV files could not be loaded.')
    })
    return () => { active = false }
  }, [attempt])

  const tables = data?.tables
  const rows = useMemo(() => data?.rows ?? [], [data])
  const summaries = useMemo(() => summarizeEras(rows), [rows])
  const plottable = useMemo(() => rows.filter((row) => row.avgGrid != null && row.starts >= MIN_STARTS), [rows])
  const visibleRows = useMemo(() => eraId === 'all' ? plottable : plottable.filter((row) => row.eraId === eraId), [plottable, eraId])
  const splits = useMemo(() => quadrantSplits(visibleRows), [visibleRows])
  // Domains come from every era so positions stay comparable when the era filter changes.
  const domains = useMemo(() => ({
    xMax: Math.max(2, ...plottable.map((row) => row.avgGrid)),
    yMax: Math.max(0.05, ...plottable.map((row) => row.failureRate)),
    winsMax: Math.max(1, ...plottable.map((row) => row.wins)),
  }), [plottable])

  const constructors = useMemo(() => {
    const byId = new Map()
    for (const row of rows) {
      const item = byId.get(row.constructorId) ?? { constructorId: row.constructorId, constructorRef: row.constructorRef, name: row.name, seasons: 0, wins: 0, starts: 0 }
      item.seasons += 1
      item.wins += row.wins
      item.starts += row.starts
      byId.set(row.constructorId, item)
    }
    return [...byId.values()].sort((a, b) => b.wins - a.wins || b.starts - a.starts || a.name.localeCompare(b.name))
  }, [rows])
  const heatmapConstructors = useMemo(() => showAllTeams ? constructors : constructors.filter((item) => item.seasons >= MAIN_TEAM_SEASONS), [constructors, showAllTeams])

  const defaultSeason = useMemo(() => tables ? pickDefaultSeason(tables, rows) : null, [tables, rows])
  const selected = rows.find((row) => row.id === selectedId) ?? defaultSeason
  const timeline = useMemo(() => tables && selected ? buildSeasonTimeline(tables, rows, selected.constructorId, selected.year) : null, [tables, rows, selected])
  const lostTitles = useMemo(() => tables ? rows
    .filter((row) => !row.isChampion && row.finalPosition != null && row.finalPosition <= 3 && row.failures > 0)
    .map((row) => buildSeasonTimeline(tables, rows, row.constructorId, row.year))
    .filter((item) => item?.failuresExplainGap) : [], [tables, rows])
  const fastFragile = visibleRows.filter((row) => getQuadrant(row, splits) === 'fastFragile')
  const constructorSeasons = selected ? rows.filter((row) => row.constructorId === selected.constructorId) : []

  const onHover = useCallback((id) => setHighlightedId(id), [])
  const onSelect = useCallback((id) => {
    setSelectedId(id)
    document.getElementById('season-detail')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
  }, [])

  function selectConstructor(constructorId) {
    const seasons = rows.filter((row) => row.constructorId === constructorId)
    const sameYear = seasons.find((row) => row.year === selected?.year)
    setSelectedId((sameYear ?? seasons.at(-1))?.id ?? null)
  }

  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <button type="button" className="brand brand--button" onClick={onBack} aria-label="DataViz F1 home">
          <LogoF1 className="brand__icon" aria-hidden="true" />
          <span className="brand__name">DataViz F1</span>
        </button>
        <span className="dashboard-header__tag">THE CONSTRUCTOR ARCHIVE</span>
        <button type="button" className="text-button" onClick={onBack}>← Back home</button>
      </header>
      <SectionNav activeSection="constructors" onDrivers={onDrivers} />

      <section className="dashboard-intro" aria-labelledby="reliability-title">
        <p className="eyebrow">Speed × reliability × results · 2000–2025</p>
        <h1 id="reliability-title">Fast or reliable: <span>what makes a champion?</span></h1>
        <p>Every constructor-season crosses three facts: where its cars started, how often their engines broke, and where it finished in the championship.</p>
      </section>

      {error ? (
        <section className="empty-state" role="alert">
          <h2>We couldn’t load the race archive.</h2>
          <p>{error}</p>
          <button className="btn btn--primary" type="button" onClick={() => { setError(null); setAttempt((value) => value + 1) }}>Try again</button>
        </section>
      ) : !data ? (
        <div className="empty-state" role="status"><span className="loading-dot" />Loading results, statuses and championship standings…</div>
      ) : !plottable.length ? (
        <div className="empty-state" role="status">No constructor results between {ERAS[0].fromYear} and {ERAS.at(-1).toYear} are available in this dataset.</div>
      ) : (
        <>
          <section className="definitions" aria-labelledby="definitions-title">
            <h2 id="definitions-title" className="eyebrow">Read this first</h2>
            <dl>
              <div><dt>Speed</dt><dd>Average starting position of the team’s cars. <strong>Lower is faster</strong>: P2.6 means a front-row car.</dd></div>
              <div><dt>Engine failure</dt><dd>A retirement whose official cause is the engine or power unit: Engine, Turbo, ERS, Oil pressure, Overheating… Gearbox failures and crashes do not count.</dd></div>
              <div><dt>Failure rate</dt><dd>Engine failures ÷ race starts. 12% means about one start in eight ended with a broken engine.</dd></div>
              <div><dt>Era</dt><dd>A period with the same engine rules: <strong>V10</strong> 2000–05 (free development), <strong>V8</strong> 2006–13 (frozen, long-life engines), <strong>Turbo-hybrid</strong> 2014–25.</dd></div>
            </dl>
          </section>

          <section className="era-overview" aria-labelledby="eras-title">
            <h2 id="eras-title" className="visually-hidden">Era summary</h2>
            {summaries.map((summary) => (
              <article key={summary.era.id} className="era-card">
                <p className="eyebrow">{summary.era.label} · {summary.era.fromYear}–{summary.era.toYear}</p>
                <div className="era-card__compare">
                  <div><span className="era-card__value" style={{ '--bar': CHAMPION_COLOR }}>{formatPercent(summary.championFailureRate)}</span><span>champions’ failure rate</span></div>
                  <div><span className="era-card__value">{formatPercent(summary.fieldFailureRate)}</span><span>whole field</span></div>
                </div>
                <p className="era-card__caption">
                  {summary.championFailureRate != null && summary.championFailureRate < summary.fieldFailureRate * 0.6
                    ? `Champions broke ${(summary.fieldFailureRate / summary.championFailureRate).toFixed(1)}× less often than the field.`
                    : 'Everyone was reliable: engines barely separated the champion from the rest.'}
                </p>
                <p className="era-card__caption">Speed ↔ final rank r = {summary.speedCorrelation?.toFixed(2) ?? 'n/a'} · Engine failures ↔ final rank r = {summary.reliabilityCorrelation?.toFixed(2) ?? 'n/a'}</p>
              </article>
            ))}
          </section>

          <section className="explorer-filters" aria-label="Era filter">
            <div className="field">
              <span>Engine era</span>
              <div className="button-group era-tabs" role="group" aria-label="Engine era">
                {[{ id: 'all', label: 'All eras' }, ...ERAS].map((era) => (
                  <button key={era.id} type="button" aria-pressed={era.id === eraId} onClick={() => setEraId(era.id)}>{era.label}</button>
                ))}
              </div>
            </div>
            <p className="filters-note">The era filter changes the visible dots and the quadrant lines; the axes stay fixed so eras can be compared.</p>
          </section>

          <section className="chart-panel" aria-labelledby="scatter-heading">
            <div className="chart-panel__header">
              <div><p className="eyebrow">1 · Overview</p><h2 id="scatter-heading">Is the champion the fastest, the most reliable, or both?</h2></div>
              <ul className="tree-legend reliability-key" aria-label="Dot colors">
                {RANK_GROUPS.map((group) => <li key={group.key}><span className="legend-dot" style={{ backgroundColor: group.color }} />{group.label}</li>)}
                <li>Dot size = race wins</li>
              </ul>
            </div>
            <SpeedReliabilityScatter rows={visibleRows} splits={splits} {...domains} labelChampions={eraId !== 'all'}
              highlightedId={highlightedId} selectedId={selected?.id} onHover={onHover} onSelect={onSelect} />
            <p className="tree-hint">
              Dashed lines: median starting position ({splits ? `P${splits.grid.toFixed(1)}` : 'n/a'}) and average failure rate ({formatPercent(splits?.failureRate)}) of the visible seasons.
              {' '}{fastFragile.length} seasons are “{QUADRANTS.fastFragile.label.toLowerCase()}”. Hover a dot to follow the team everywhere · click or press Enter for the season detail.
            </p>
          </section>

          <section className="chart-panel heatmap-panel" aria-labelledby="heatmap-heading">
            <div className="chart-panel__header">
              <div><p className="eyebrow">2 · Zoom & filter</p><h2 id="heatmap-heading">How many engines did each team break, season by season?</h2></div>
              <ul className="tree-legend reliability-key" aria-label="Grid key">
                <li><span className="legend-bar" style={{ backgroundColor: FAILURE_COLOR, opacity: 0.3 }} /><span className="legend-bar" style={{ backgroundColor: FAILURE_COLOR }} />More engine failures</li>
                <li><span className="legend-bar legend-bar--outline" style={{ borderColor: CHAMPION_COLOR }} />Constructors’ champion</li>
              </ul>
            </div>
            <FailureHeatmap rows={rows} constructors={heatmapConstructors} eraId={eraId}
              highlightedId={highlightedId} selectedId={selected?.id} onHover={onHover} onSelect={onSelect} />
            <div className="tree-hint heatmap-hint">
              <span>Numbers are engine failures in that season. Empty space: the team did not race. Click a cell for its season detail.</span>
              <button type="button" className="text-button" onClick={() => setShowAllTeams((value) => !value)}>
                {showAllTeams ? `Show the ${constructors.filter((item) => item.seasons >= MAIN_TEAM_SEASONS).length} main teams only` : `Show all ${constructors.length} constructors`}
              </button>
            </div>
          </section>

          {timeline && (
            <section className="chart-panel season-panel" id="season-detail" aria-labelledby="season-heading">
              <div className="chart-panel__header">
                <div>
                  <p className="eyebrow">3 · Details on demand</p>
                  <h2 id="season-heading">Did engine failures cost {timeline.row.name} the {timeline.row.year} title?</h2>
                </div>
                <div className="season-pickers">
                  <label className="field">
                    <span>Constructor</span>
                    <select value={timeline.row.constructorId} onChange={(event) => selectConstructor(Number(event.target.value))}>
                      {[...constructors].sort((a, b) => a.name.localeCompare(b.name)).map((item) => <option key={item.constructorId} value={item.constructorId}>{item.name}</option>)}
                    </select>
                  </label>
                  <label className="field">
                    <span>Season</span>
                    <select value={timeline.row.id} onChange={(event) => setSelectedId(event.target.value)}>
                      {constructorSeasons.map((row) => <option key={row.id} value={row.id}>{row.year}</option>)}
                    </select>
                  </label>
                </div>
              </div>
              <div className="season-summary">
                <dl className="driver-stats">
                  <div><dt>Average grid</dt><dd>{timeline.row.avgGrid ? `P${timeline.row.avgGrid.toFixed(1)}` : 'n/a'}</dd></div>
                  <div><dt>Engine failures</dt><dd>{timeline.row.failures}<small> / {timeline.row.starts}</small></dd></div>
                  <div><dt>Wins</dt><dd>{timeline.row.wins}</dd></div>
                  <div><dt>Championship</dt><dd>{timeline.row.finalPosition ? `P${timeline.row.finalPosition}` : 'n/a'}</dd></div>
                  <div><dt>≈ Points lost</dt><dd>{formatPoints(timeline.row.pointsLost)}</dd></div>
                </dl>
                <p className="season-verdict">
                  {!timeline.rival ? 'No rival found in the final standings for this season.'
                    : timeline.row.isChampion
                      ? `Champion${timeline.row.failures ? ` despite ${timeline.row.failures} engine failure${timeline.row.failures > 1 ? 's' : ''}` : ' with no engine failure'}: ${formatPoints(-timeline.gap)} race points ahead of ${timeline.rival.name}.`
                      : timeline.failuresExplainGap
                        ? `Finished ${formatPoints(timeline.gap)} race points behind ${timeline.rival.name}, but its engine failures cost about ${formatPoints(timeline.row.pointsLost)}. Engines alone can explain the lost title.`
                        : `Finished ${formatPoints(timeline.gap)} race points behind ${timeline.rival.name}. Engine failures cost about ${formatPoints(timeline.row.pointsLost)}, so they do not explain the gap on their own.`}
                </p>
              </div>
              <SeasonTimeline timeline={timeline} />
              <ul className="tree-legend" aria-label="Line key">
                <li><span className="legend-line" style={{ borderColor: getTeamColor(timeline.row.constructorRef) }} />{timeline.row.name}</li>
                {timeline.rival && <li><span className="legend-line" style={{ borderColor: timeline.row.isChampion ? RANK_GROUPS[1].color : CHAMPION_COLOR }} />{timeline.rival.name} ({timeline.row.isChampion ? 'runner-up' : 'champion'})</li>}
                {timeline.row.failures > 0 && <li><span className="legend-line legend-line--dashed" style={{ borderColor: getTeamColor(timeline.row.constructorRef) }} />Without engine failures (estimate)</li>}
                {timeline.row.failures > 0 && <li><span style={{ color: FAILURE_COLOR }} aria-hidden="true">✕</span>Engine failure</li>}
              </ul>
              {timeline.row.failures > 0 && (
                <div className="table-scroll">
                  <table className="trace-table">
                    <caption>Engine failures in {timeline.row.year}</caption>
                    <thead><tr><th scope="col">Round</th><th scope="col">Driver</th><th scope="col">Cause</th><th scope="col">Laps done</th><th scope="col">≈ Points lost</th></tr></thead>
                    <tbody>
                      {timeline.rounds.flatMap((round) => round.failures.map((failure) => (
                        <tr key={failure.resultId}>
                          <th scope="row">R{round.round} {round.raceName.replace('Grand Prix', 'GP')}</th>
                          <td>{failure.driver}</td><td>{failure.status}</td><td>{failure.laps ?? '—'}</td>
                          <td>{formatPoints(timeline.row.pointsPerFinish)}</td>
                        </tr>
                      )))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          <div className="explorer-notes">
            <aside className="reading-guide reading-guide--first" aria-labelledby="findings-title">
              <p className="eyebrow">What the data says</p>
              <h2 id="findings-title">Speed gets you in the fight; reliability decides it</h2>
              <p>Starting position tracks the final rank very closely in every era (r ≈ {summaries.map((summary) => summary.speedCorrelation?.toFixed(2)).join(' / ')}). Engine failures alone track it weakly, because slow and reliable teams still finish at the back.</p>
              <p>Among the fast teams, though, champions broke far fewer engines than the field in the V10 and hybrid eras. In {lostTitles.length} seasons, a top-three team lost the title by fewer points than its engine failures cost it:</p>
              <ul className="lost-titles">
                {lostTitles.map((item) => (
                  <li key={item.row.id}>
                    <button type="button" className="text-button" onClick={() => onSelect(item.row.id)}>
                      {item.row.name} {item.row.year}: {formatPoints(item.gap)} pts behind {item.rival.name}, ≈ {formatPoints(item.row.pointsLost)} lost
                    </button>
                  </li>
                ))}
              </ul>
            </aside>
            <aside className="reading-guide" aria-labelledby="limits-title">
              <p className="eyebrow">Read with care</p>
              <h2 id="limits-title">Limits of the estimate</h2>
              <p>Each engine failure is credited with the points the same team scored on average when its cars finished that season. It is an estimate, not a replay of the race: the car might have crashed later, and rivals’ results stay unchanged.</p>
              <small>Race points only: sprint points and championship penalties are not added, so totals can differ slightly from official standings, which give the final rank. Seasons with fewer than {MIN_STARTS} starts are left out of the scatter plot. 2026 starts a new engine formula and is not included. A correlation is not proof that engines decided results.</small>
            </aside>
          </div>
          <footer className="dashboard-footer">
            <span>Local F1 archive · {ERAS[0].fromYear}–{ERAS.at(-1).toYear} · {rows.length} constructor-seasons</span>
            <span>D3.js scatter plot + heatmap + line chart, linked / No external data service</span>
          </footer>
        </>
      )}
    </main>
  )
}
