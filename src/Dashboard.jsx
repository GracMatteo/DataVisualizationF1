import { useEffect, useMemo, useState } from 'react'
import LogoF1 from './assets/f1.svg?react'
import DriverMultiPicker from './components/DriverMultiPicker.jsx'
import DriverPicker from './components/DriverPicker.jsx'
import DriverChampionshipChart from './components/DriverChampionshipChart.jsx'
import SeasonDetails from './components/SeasonDetails.jsx'
import SectionNav from './components/SectionNav.jsx'
import { loadF1Data } from './lib/loadF1Data.js'
import { buildDriverTimeline, getDriverTimelineDefaults } from './lib/buildDriverTimeline.js'
import { buildChampionshipLanes, buildFinalStandings, loadDriverStandings } from './lib/championshipStandings.js'
import './Dashboard.css'

export default function Dashboard({ onBack, onConstructors }) {
  const [tables, setTables] = useState(null)
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const [selectedId, setSelectedId] = useState(null)
  const [fromYear, setFromYear] = useState('')
  const [toYear, setToYear] = useState('')
  const [selectedSeason, setSelectedSeason] = useState(null)
  const [timelineIds, setTimelineIds] = useState(null)
  const [standingRows, setStandingRows] = useState(null)
  const [standingsError, setStandingsError] = useState(null)

  useEffect(() => {
    let active = true
    loadF1Data().then((data) => {
      if (active) setTables(data)
    }).catch((reason) => {
      if (active) setError(reason.message || 'The CSV files could not be loaded.')
    })
    loadDriverStandings().then((rows) => {
      if (active) setStandingRows(rows)
    }).catch((reason) => {
      if (active) setStandingsError(reason.message || 'The championship standings could not be loaded.')
    })
    return () => { active = false }
  }, [attempt])

  const defaultId = tables?.availableDrivers.find((driver) => driver.driverRef === 'hamilton')?.driverId
    ?? tables?.availableDrivers[0]?.driverId
  const driverId = selectedId ?? defaultId
  const driverSummary = useMemo(() => tables ? buildDriverTimeline([driverId], tables, {
    fromYear: fromYear === '' ? undefined : Number(fromYear),
    toYear: toYear === '' ? undefined : Number(toYear),
  }).rows[0] ?? null : null, [tables, driverId, fromYear, toYear])
  const defaultIds = useMemo(() => tables ? getDriverTimelineDefaults(tables).driverIds : [], [tables])
  const compareIds = timelineIds ?? defaultIds
  const finalStandings = useMemo(() => tables && standingRows ? buildFinalStandings(standingRows, tables.races) : null, [tables, standingRows])
  const championshipLanes = useMemo(() => finalStandings ? buildChampionshipLanes(compareIds, tables, finalStandings, {
    fromYear: fromYear === '' ? undefined : Number(fromYear),
    toYear: toYear === '' ? undefined : Number(toYear),
  }) : null, [tables, finalStandings, compareIds, fromYear, toYear])
  const reversedRange = fromYear !== '' && toYear !== '' && Number(fromYear) > Number(toYear)

  function resetFilters() {
    setFromYear('')
    setToYear('')
    setSelectedSeason(null)
  }

  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <button type="button" className="brand brand--button" onClick={onBack} aria-label="DataViz F1 home">
          <LogoF1 className="brand__icon" aria-hidden="true" />
          <span className="brand__name">DataViz F1</span>
        </button>
        <span className="dashboard-header__tag">THE DRIVER ARCHIVE</span>
        <button type="button" className="text-button" onClick={onBack}>← Back home</button>
      </header>
      <SectionNav activeSection="drivers" onConstructors={onConstructors} />

      <section className="dashboard-intro" aria-labelledby="explorer-title">
        <p className="eyebrow">Side by side. Season by season.</p>
        <h1 id="explorer-title">Careers, <span>compared.</span></h1>
        <p>Line drivers up season by season and see where each one finished in the championship.</p>
      </section>

      {error ? (
        <section className="empty-state" role="alert">
          <h2>We couldn’t load the race archive.</h2>
          <p>{error}</p>
          <button className="btn btn--primary" type="button" onClick={() => { setError(null); setAttempt((value) => value + 1) }}>Try again</button>
        </section>
      ) : !tables ? (
        <div className="empty-state" role="status"><span className="loading-dot" />Loading drivers and race results…</div>
      ) : !driverSummary ? (
        <div className="empty-state" role="status">No driver results are available in this dataset.</div>
      ) : (
        <>
          <section className="chart-panel" aria-labelledby="timeline-heading">
            <div className="chart-panel__header">
              <div><p className="eyebrow">Compare careers</p><h2 id="timeline-heading">Championship timeline</h2></div>
            </div>
            <div className="timeline-panel__controls">
              <DriverMultiPicker drivers={tables.availableDrivers} selectedIds={compareIds} onChange={(ids) => { setTimelineIds(ids); setSelectedSeason(null) }} />
            </div>
            {reversedRange ? (
              <div className="empty-state" role="status"><h3>Choose a valid season range.</h3><p>The first season must be before or equal to the last season.</p></div>
            ) : standingsError ? (
              <div className="empty-state" role="alert"><h3>We couldn’t load the championship standings.</h3><p>{standingsError}</p><button className="btn btn--primary" type="button" onClick={() => { setStandingsError(null); setAttempt((value) => value + 1) }}>Try again</button></div>
            ) : !championshipLanes ? (
              <div className="empty-state" role="status"><span className="loading-dot" />Loading championship standings…</div>
            ) : <DriverChampionshipChart lanes={championshipLanes} selected={selectedSeason} onSelectSeason={setSelectedSeason} />}
          </section>

          <div className="explorer-notes">
            <SeasonDetails season={selectedSeason} />
            <aside className="reading-guide" aria-labelledby="reading-guide-title">
              <p className="eyebrow">A quick guide</p>
              <h2 id="reading-guide-title">How to read the timeline</h2>
              <p>Each row is one driver; seasons run left to right. Every dot is that season’s final place in the Drivers’ Championship, with the number written inside: gold for the champion, silver for 2nd, bronze for 3rd and green for everyone else.</p>
              <p>The line joins consecutive seasons. A dashed stretch is a break in the career. A dashed ring marks the current season, where the place is the standing so far.</p>
              <small>Championship places and points are the official standings, including sprint points and penalties. The summary card above counts Grand Prix results only, so its points can differ.</small>
            </aside>
          </div>
          <footer className="dashboard-footer">
            <span>Local F1 archive · {tables.yearRange ? `${tables.yearRange.fromYear}–${tables.yearRange.toYear}` : 'No race results'} · {tables.availableDrivers.length} drivers</span>
            <span>D3.js championship timeline / No external data service</span>
          </footer>
        </>
      )}
    </main>
  )
}
