import { useCallback, useEffect, useMemo, useState } from 'react'
import LogoF1 from './assets/f1.svg?react'
import FailureHeatmap from './components/FailureHeatmap.jsx'
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
import './Dashboard.css'
import './ConstructorDashboard.css'

// Seasons with very few starts (one-off entries) would sit at extreme rates by chance.
const MIN_STARTS = 10
const MAIN_TEAM_SEASONS = 5
const FIRST_YEAR = ERAS[0].fromYear
const LAST_YEAR = ERAS.at(-1).toYear
// Comparison colors avoid red and gold, which already mean "linked from Races" and "champion".
const TEAM_PALETTE = ['#2563eb', '#16a34a', '#9333ea', '#0891b2', '#ea580c', '#db2777', '#65a30d', '#475569', '#a16207', '#4f46e5']

function listNames(names) {
  return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
}

export default function ConstructorDashboard({ onBack, onDrivers, onConstructors, onRaces, onCircuits, constructorFocus }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const [eraId, setEraId] = useState('all')
  const [selectedId, setSelectedId] = useState(null)
  const [highlightedId, setHighlightedId] = useState(null)
  const [showAllTeams, setShowAllTeams] = useState(false)
  const [teamIds, setTeamIds] = useState(() => constructorFocus?.marks?.length
    ? [...new Set(constructorFocus.marks.map((mark) => mark.constructorId))]
    : null)

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
  const activeTeams = teamIds?.length ? teamIds : null
  const coveredIds = useMemo(() => new Set(rows.map((row) => row.constructorId)), [rows])
  const plottable = useMemo(() => rows.filter((row) => row.avgGrid != null && row.starts >= MIN_STARTS), [rows])
  const eraRows = useMemo(() => eraId === 'all' ? plottable : plottable.filter((row) => row.eraId === eraId), [plottable, eraId])
  const visibleRows = useMemo(() => activeTeams ? eraRows.filter((row) => activeTeams.includes(row.constructorId)) : eraRows, [eraRows, activeTeams])
  // Quadrant lines describe the whole era, so a constructor filter does not move them.
  const splits = useMemo(() => quadrantSplits(eraRows), [eraRows])
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

  const marks = useMemo(() => constructorFocus?.marks ?? [], [constructorFocus])
  const linkedIds = useMemo(() => new Set(marks.map((mark) => `${mark.constructorId}:${mark.year}`)), [marks])
  const linkedRows = useMemo(() => rows.filter((row) => linkedIds.has(row.id)), [rows, linkedIds])
  const linkedTeams = useMemo(() => [...new Set(marks.map((mark) => mark.constructorId))], [marks])
  const nameById = useMemo(() => {
    const names = new Map(marks.map((mark) => [mark.constructorId, mark.name ?? `Constructor ${mark.constructorId}`]))
    for (const [id, constructor] of tables?.constructors ?? []) if (constructor?.name) names.set(id, constructor.name)
    return names
  }, [marks, tables])
  // Linked constructors and seasons that this page cannot show, named for the red note.
  const linkNotes = useMemo(() => {
    const absent = new Map()
    const outside = new Map()
    for (const mark of marks) {
      if (rows.some((row) => row.id === `${mark.constructorId}:${mark.year}`)) continue
      const name = nameById.get(mark.constructorId)
      if (coveredIds.has(mark.constructorId)) outside.set(`${mark.constructorId}:${mark.year}`, `${name} ${mark.year}`)
      else absent.set(mark.constructorId, name)
    }
    return { absent: [...absent.values()], outside: [...outside.values()] }
  }, [marks, rows, coveredIds, nameById])

  const mainTeams = useMemo(() => constructors.filter((item) => item.seasons >= MAIN_TEAM_SEASONS || linkedTeams.includes(item.constructorId)), [constructors, linkedTeams])
  // A filtered constructor with no 2000–2025 season keeps an empty heatmap row, so the filter shows it.
  const heatmapConstructors = useMemo(() => activeTeams
    ? activeTeams.map((id) => constructors.find((item) => item.constructorId === id) ?? { constructorId: id, name: nameById.get(id) ?? `Constructor ${id}`, seasons: 0, wins: 0, starts: 0 })
    : showAllTeams ? constructors : mainTeams, [constructors, mainTeams, showAllTeams, activeTeams, nameById])
  const teamColors = useMemo(() => activeTeams ? new Map(activeTeams.map((id, index) => [id, TEAM_PALETTE[index % TEAM_PALETTE.length]])) : null, [activeTeams])
  const addableTeams = useMemo(() => constructors.filter((item) => !activeTeams?.includes(item.constructorId))
    .sort((a, b) => a.name.localeCompare(b.name)), [constructors, activeTeams])
  const missingLinked = linkedTeams.filter((id) => !activeTeams?.includes(id))
  const filterLabel = !activeTeams ? 'All constructors'
    : activeTeams.length === 1 ? nameById.get(activeTeams[0])
      : linkedTeams.length && !missingLinked.length && activeTeams.length === linkedTeams.length ? `Constructors from Races (${activeTeams.length})`
        : `${activeTeams.length} constructors compared`

  const defaultSeason = useMemo(() => tables ? pickDefaultSeason(tables, rows) : null, [tables, rows])
  const selected = rows.find((row) => row.id === selectedId) ?? linkedRows[0] ?? (marks.length || activeTeams ? null : defaultSeason)
  const lostTitles = useMemo(() => tables ? rows
    .filter((row) => !row.isChampion && row.finalPosition != null && row.finalPosition <= 3 && row.failures > 0)
    .map((row) => buildSeasonTimeline(tables, rows, row.constructorId, row.year))
    .filter((item) => item?.failuresExplainGap) : [], [tables, rows])
  const fastFragile = visibleRows.filter((row) => getQuadrant(row, splits) === 'fastFragile')

  useEffect(() => {
    if (!data || !marks.length) return
    document.getElementById('constructor-filters')?.scrollIntoView({ behavior: 'auto', block: 'start' })
  }, [data, marks])

  const onHover = useCallback((id) => setHighlightedId(id), [])
  const onSelect = useCallback((id) => setSelectedId(id), [])

  function addTeams(value) {
    if (value === 'all') return setTeamIds(null)
    const added = value === 'linked' ? missingLinked : [Number(value)]
    setTeamIds([...(activeTeams ?? []), ...added])
  }

  function removeTeam(id) {
    const remaining = activeTeams.filter((teamId) => teamId !== id)
    setTeamIds(remaining.length ? remaining : null)
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
      <SectionNav activeSection="constructors" onDrivers={onDrivers} onConstructors={onConstructors} onRaces={onRaces} onCircuits={onCircuits} />

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
        <div className="empty-state" role="status">No constructor results between {FIRST_YEAR} and {LAST_YEAR} are available in this dataset.</div>
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

          <section className="explorer-filters" id="constructor-filters" aria-label="Era and constructor filters">
            <div className="field">
              <span>Engine era</span>
              <div className="button-group era-tabs" role="group" aria-label="Engine era">
                {[{ id: 'all', label: 'All eras' }, ...ERAS].map((era) => (
                  <button key={era.id} type="button" aria-pressed={era.id === eraId} onClick={() => setEraId(era.id)}>{era.label}</button>
                ))}
              </div>
            </div>
            <div className="field team-filter">
              <label htmlFor="team-filter-add">Constructors</label>
              <select id="team-filter-add" value="" onChange={(event) => addTeams(event.target.value)}>
                <option value="" disabled>{filterLabel}</option>
                {activeTeams && <option value="all">All constructors (clear the filter)</option>}
                {missingLinked.length > 1 && <option value="linked">Add the constructors from Races ({missingLinked.length})</option>}
                <optgroup label={activeTeams ? 'Add to the comparison' : 'Filter on'}>
                  {addableTeams.map((item) => <option key={item.constructorId} value={item.constructorId}>{item.name}</option>)}
                </optgroup>
              </select>
              {activeTeams && (
                <ul className="team-chips" aria-label="Compared constructors">
                  {activeTeams.map((id) => (
                    <li key={id} style={{ '--team': teamColors.get(id) }}>
                      <span className="team-chips__swatch" aria-hidden="true" />{nameById.get(id)}
                      {!coveredIds.has(id) && <small className="team-chips__empty">no {FIRST_YEAR}–{LAST_YEAR} data</small>}
                      <button type="button" onClick={() => removeTeam(id)} aria-label={`Remove ${nameById.get(id)} from the comparison`}>×</button>
                    </li>
                  ))}
                  <li className="team-chips__clear"><button type="button" className="text-button" onClick={() => setTeamIds(null)}>Clear all</button></li>
                </ul>
              )}
            </div>
            <p className="filters-note">The era filter changes the visible dots and the quadrant lines. The constructor filter keeps only the chosen teams’ seasons in the scatter plot and the heatmap, each team in its own color, and leaves the quadrant lines on the whole era. The axes stay fixed so views can be compared.</p>
            {marks.length > 0 && (
              <div className="linked-note" role="status">
                {linkedRows.length > 0 && (
                  <p>Opened from Races: {linkedRows.length} constructor-season{linkedRows.length === 1 ? '' : 's'} outlined in red.</p>
                )}
                {linkNotes.outside.length > 0 && (
                  <p>
                    {listNames(linkNotes.outside)} {linkNotes.outside.length === 1 ? 'falls' : 'fall'} outside {FIRST_YEAR}–{LAST_YEAR}, the period covered by this page, so {linkNotes.outside.length === 1 ? 'it is' : 'they are'} not outlined.
                    The filter still shows that constructor’s seasons from {FIRST_YEAR} to {LAST_YEAR}.
                  </p>
                )}
                {linkNotes.absent.length > 0 && (
                  <p>
                    {listNames(linkNotes.absent)} did not compete between {FIRST_YEAR} and {LAST_YEAR}.
                    This page has no engine-failure data for {linkNotes.absent.length === 1 ? 'this constructor: it stays in the filter with no dot in the scatter plot and an empty heatmap row.' : 'these constructors: they stay in the filter with no dot in the scatter plot and an empty heatmap row.'}
                  </p>
                )}
              </div>
            )}
          </section>

          <section className="chart-panel" aria-labelledby="scatter-heading">
            <div className="chart-panel__header">
              <div><p className="eyebrow">1 · Overview</p><h2 id="scatter-heading">Is the champion the fastest, the most reliable, or both?</h2></div>
              <ul className="tree-legend reliability-key" aria-label="Dot colors">
                {teamColors ? (
                  <>
                    {activeTeams.map((id) => <li key={id}><span className="legend-dot" style={{ backgroundColor: teamColors.get(id) }} />{nameById.get(id)}</li>)}
                    <li><span className="legend-dot legend-dot--champion" style={{ borderColor: CHAMPION_COLOR }} />Champion season</li>
                  </>
                ) : RANK_GROUPS.map((group) => <li key={group.key}><span className="legend-dot" style={{ backgroundColor: group.color }} />{group.label}</li>)}
                <li>Dot size = race wins</li>
              </ul>
            </div>
            <SpeedReliabilityScatter rows={visibleRows} splits={splits} {...domains} labelChampions={eraId !== 'all'} linkedIds={linkedIds} teamColors={teamColors}
              highlightedId={highlightedId} selectedId={selected?.id} onHover={onHover} onSelect={onSelect} />
            <p className="tree-hint reliability-hint">
              Dashed lines: median starting position ({splits ? `P${splits.grid.toFixed(1)}` : 'n/a'}) and average failure rate ({formatPercent(splits?.failureRate)}) of every season in the selected era.
              {' '}{fastFragile.length} seasons are “{QUADRANTS.fastFragile.label.toLowerCase()}”. Hover a dot to follow the team everywhere · click or press Enter to mark that season in both views.
            </p>
          </section>

          <section className="chart-panel heatmap-panel" id="failure-heatmap" aria-labelledby="heatmap-heading">
            <div className="chart-panel__header">
              <div><p className="eyebrow">2 · Zoom & filter</p><h2 id="heatmap-heading">How many engines did each team break, season by season?</h2></div>
              <ul className="tree-legend reliability-key" aria-label="Grid key">
                <li><span className="legend-bar" style={{ backgroundColor: FAILURE_COLOR, opacity: 0.3 }} /><span className="legend-bar" style={{ backgroundColor: FAILURE_COLOR }} />More engine failures</li>
                <li><span className="legend-bar legend-bar--outline" style={{ borderColor: CHAMPION_COLOR }} />Constructors’ champion</li>
              </ul>
            </div>
            <FailureHeatmap rows={rows} constructors={heatmapConstructors} eraId={eraId} linkedIds={linkedIds} teamColors={teamColors}
              highlightedId={highlightedId} selectedId={selected?.id} onHover={onHover} onSelect={onSelect} />
            <div className="tree-hint reliability-hint heatmap-hint">
              <span>Numbers are engine failures in that season. Empty space: the team did not race. Click a cell to mark that season in both views.</span>
              {activeTeams ? (
                <button type="button" className="text-button" onClick={() => setTeamIds(null)}>Clear the constructor filter</button>
              ) : (
                <button type="button" className="text-button" onClick={() => setShowAllTeams((value) => !value)}>
                  {showAllTeams ? `Show the ${mainTeams.length} main teams only` : `Show all ${constructors.length} constructors`}
                </button>
              )}
            </div>
          </section>

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
            <span>Local F1 archive · {FIRST_YEAR}–{LAST_YEAR} · {rows.length} constructor-seasons</span>
            <span>D3.js scatter plot + heatmap, linked / No external data service</span>
          </footer>
        </>
      )}
    </main>
  )
}
