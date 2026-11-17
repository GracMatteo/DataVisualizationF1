import { useCallback, useEffect, useMemo, useState } from 'react'
import LogoF1 from './assets/f1.svg?react'
import PointsLostChart from './components/PointsLostChart.jsx'
import ReliabilityScatter from './components/ReliabilityScatter.jsx'
import SectionNav from './components/SectionNav.jsx'
import { loadF1Data } from './lib/loadF1Data.js'
import { ERAS, buildEraRows, summarizeEras } from './lib/engineReliability.js'
import { LOST_POINTS_COLOR, METRICS, formatPercent } from './lib/reliabilityPresentation.js'
import { getTeamColor } from './lib/teamColors.js'
import './Dashboard.css'
import './ConstructorDashboard.css'

const START_THRESHOLDS = [0, 40, 80, 150]
const DEFAULT_MIN_STARTS = 40

export default function ConstructorDashboard({ onBack, onDrivers }) {
  const [tables, setTables] = useState(null)
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const [metric, setMetric] = useState('winRate')
  const [minStarts, setMinStarts] = useState(DEFAULT_MIN_STARTS)
  const [eraId, setEraId] = useState(ERAS.at(-1).id)
  const [selectedId, setSelectedId] = useState(null)
  const [highlightedId, setHighlightedId] = useState(null)

  useEffect(() => {
    let active = true
    loadF1Data().then((data) => {
      if (active) setTables(data)
    }).catch((reason) => {
      if (active) setError(reason.message || 'The CSV files could not be loaded.')
    })
    return () => { active = false }
  }, [attempt])

  const rows = useMemo(() => tables ? buildEraRows(tables) : [], [tables])
  const summaries = useMemo(() => summarizeEras(rows, { minStarts, metric }), [rows, minStarts, metric])
  // Shared domains keep the three panels comparable; they follow the visible rows only.
  const domains = useMemo(() => {
    const visible = summaries.flatMap((summary) => summary.rows)
    return {
      xMax: Math.max(0.01, ...visible.map((row) => row.failureRate)),
      yMax: Math.max(0.01, ...visible.map((row) => row[metric])),
      startsMax: Math.max(1, ...visible.map((row) => row.starts)),
    }
  }, [summaries, metric])
  const constructorOptions = useMemo(() => {
    const byId = new Map()
    for (const row of rows) if (row.starts >= minStarts) byId.set(row.constructorId, row.name)
    return [...byId].sort((a, b) => a[1].localeCompare(b[1]))
  }, [rows, minStarts])
  const selectedRows = useMemo(() => ERAS.map((era) => ({
    era, row: rows.find((row) => row.eraId === era.id && row.constructorId === selectedId) ?? null,
  })), [rows, selectedId])
  const activeSummary = summaries.find((summary) => summary.era.id === eraId)
  const selectedName = rows.find((row) => row.constructorId === selectedId)?.name

  const toggleSelected = useCallback((id) => setSelectedId((current) => current === id ? null : id), [])
  const onHover = useCallback((id) => setHighlightedId(id), [])

  function resetFilters() {
    setMetric('winRate')
    setMinStarts(DEFAULT_MIN_STARTS)
    setSelectedId(null)
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
        <p className="eyebrow">Reliability across three engine eras</p>
        <h1 id="reliability-title">Does a fragile engine <span>cost the win?</span></h1>
        <p>Each dot is a constructor in one engine era. Compare how often its engines broke with how often it won, then see how many points those failures took away.</p>
      </section>

      {error ? (
        <section className="empty-state" role="alert">
          <h2>We couldn’t load the race archive.</h2>
          <p>{error}</p>
          <button className="btn btn--primary" type="button" onClick={() => { setError(null); setAttempt((value) => value + 1) }}>Try again</button>
        </section>
      ) : !tables ? (
        <div className="empty-state" role="status"><span className="loading-dot" />Loading constructors and race results…</div>
      ) : !rows.length ? (
        <div className="empty-state" role="status">No results between {ERAS[0].fromYear} and {ERAS.at(-1).toYear} are available in this dataset.</div>
      ) : (
        <>
          <section className="explorer-filters" aria-label="Reliability filters">
            <label className="field">
              <span>Success measure</span>
              <select value={metric} onChange={(event) => setMetric(event.target.value)}>
                {Object.entries(METRICS).map(([key, { label }]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Minimum starts per era <small>hides part-time teams</small></span>
              <select value={minStarts} onChange={(event) => setMinStarts(Number(event.target.value))}>
                {START_THRESHOLDS.map((value) => <option key={value} value={value}>{value ? `${value}+ starts` : 'All constructors'}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Follow a constructor</span>
              <select value={selectedId ?? ''} onChange={(event) => setSelectedId(event.target.value === '' ? null : Number(event.target.value))}>
                <option value="">None</option>
                {constructorOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </label>
            <button type="button" className="text-button reset-filters" onClick={resetFilters}
              disabled={metric === 'winRate' && minStarts === DEFAULT_MIN_STARTS && selectedId == null}>Reset</button>
          </section>

          <section className="era-overview" aria-label="Era overview">
            {summaries.map((summary) => (
              <div key={summary.era.id}>
                <p className="eyebrow">{summary.era.label}</p>
                <p className="era-overview__value">{formatPercent(summary.failureRate)}</p>
                <p className="era-overview__caption">of {summary.starts.toLocaleString()} starts ended with an engine failure</p>
              </div>
            ))}
          </section>

          <section className="chart-panel" aria-labelledby="scatter-heading">
            <div className="chart-panel__header">
              <div><p className="eyebrow">Overview · same scales in every era</p><h2 id="scatter-heading">Engine failures vs {METRICS[metric].label.toLowerCase()}</h2></div>
              <ul className="tree-legend reliability-key" aria-label="Chart key">
                <li><span className="legend-dot" style={{ backgroundColor: 'var(--text)' }} />Dot area = starts</li>
                <li><span className="trend-swatch" />Least-squares trend</li>
                <li>Color = constructor</li>
              </ul>
            </div>
            <div className="era-grid">
              {summaries.map((summary) => (
                <ReliabilityScatter key={summary.era.id} summary={summary} metric={metric} {...domains}
                  highlightedId={highlightedId} selectedId={selectedId} onHover={onHover} onSelect={toggleSelected} />
              ))}
            </div>
            <p className="tree-hint">Hover or focus a dot to highlight the team in every era · Click or press Enter to follow it · Top three teams per era are labelled</p>
          </section>

          {selectedId != null && (
            <section className="constructor-trace" aria-labelledby="trace-title">
              <div className="constructor-trace__heading">
                <p className="eyebrow">Followed constructor</p>
                <h2 id="trace-title"><span className="legend-dot" style={{ backgroundColor: getTeamColor(rows.find((row) => row.constructorId === selectedId)?.constructorRef) }} />{selectedName}</h2>
                <button type="button" className="text-button" onClick={() => setSelectedId(null)}>Clear</button>
              </div>
              <div className="table-scroll">
                <table className="trace-table">
                  <thead><tr><th scope="col">Era</th><th scope="col">Starts</th><th scope="col">Engine failures</th><th scope="col">Wins</th><th scope="col">Points</th><th scope="col">≈ Points lost</th></tr></thead>
                  <tbody>
                    {selectedRows.map(({ era, row }) => (
                      <tr key={era.id}>
                        <th scope="row">{era.label} <small>{era.fromYear}–{era.toYear}</small></th>
                        {row ? (
                          <>
                            <td>{row.starts}</td>
                            <td>{row.failures} <small>{formatPercent(row.failureRate)}</small></td>
                            <td>{row.wins} <small>{formatPercent(row.winRate)}</small></td>
                            <td>{Math.round(row.points).toLocaleString()} <small>{formatPercent(row.pointsShare)}</small></td>
                            <td>{Math.round(row.pointsLost).toLocaleString()} <small>{formatPercent(row.lostShare)}</small></td>
                          </>
                        ) : <td colSpan={5}>Did not race in this era</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="chart-panel lost-panel" aria-labelledby="lost-heading">
            <div className="chart-panel__header">
              <div><p className="eyebrow">Detail · points cost</p><h2 id="lost-heading">What engine failures took away</h2></div>
              <div className="button-group era-tabs" role="group" aria-label="Era">
                {ERAS.map((era) => (
                  <button key={era.id} type="button" aria-pressed={era.id === eraId} onClick={() => setEraId(era.id)}>{era.label}</button>
                ))}
              </div>
            </div>
            {activeSummary.rows.length ? (
              <PointsLostChart rows={activeSummary.rows} eraLabel={activeSummary.era.label}
                highlightedId={highlightedId} selectedId={selectedId} onHover={onHover} onSelect={toggleSelected} />
            ) : <div className="empty-state" role="status">No constructor reaches {minStarts} starts in this era. Lower the threshold to see them.</div>}
            <ul className="tree-legend" aria-label="Bar colors">
              <li><span className="legend-bar" style={{ backgroundColor: 'var(--text)' }} />Race points scored (team color)</li>
              <li><span className="legend-bar legend-bar--lost" style={{ borderColor: LOST_POINTS_COLOR }} />Estimated points lost to engine failures</li>
            </ul>
          </section>

          <div className="explorer-notes">
            <aside className="reading-guide reading-guide--first" aria-labelledby="method-title">
              <p className="eyebrow">How it is measured</p>
              <h2 id="method-title">From data to insight</h2>
              <p><strong>Data:</strong> every race result between {ERAS[0].fromYear} and {ERAS.at(-1).toYear}, with its official finishing status.</p>
              <p><strong>Information:</strong> a start counts as an engine failure when the car retired with an engine or power-unit status, such as Engine, Turbo, ERS, Oil pressure or Overheating. Non-qualifications and non-starts are excluded.</p>
              <p><strong>Knowledge:</strong> the trend line and r value show whether teams that broke more engines also won less within the same rules. The bars estimate the cost: each failure is worth the average points that team scored per finished race that season.</p>
              <small>Points are Grand Prix race points only; sprint points are excluded. The points share compares teams within an era, which neutralises the 2003 and 2010 scoring changes. 2026 starts a new power-unit formula and is not included.</small>
            </aside>
            <aside className="reading-guide" aria-labelledby="reading-title">
              <p className="eyebrow">A quick guide</p>
              <h2 id="reading-title">How to read it</h2>
              <p>Further right means less reliable. Higher means more successful. A dot in the top-left won a lot and rarely broke down. If the trend line slopes down, unreliability and losing went together in that era.</p>
              <p>A correlation is not proof that engines decided results: a fast car may simply push its engine harder. Use the followed-team table to see whether a team’s reliability changed between eras, and the bars to see which teams paid the highest price.</p>
            </aside>
          </div>
          <footer className="dashboard-footer">
            <span>Local F1 archive · {ERAS[0].fromYear}–{ERAS.at(-1).toYear} · {rows.length} constructor-era rows</span>
            <span>D3.js small-multiple scatter plots + linked bar chart / No external data service</span>
          </footer>
        </>
      )}
    </main>
  )
}
