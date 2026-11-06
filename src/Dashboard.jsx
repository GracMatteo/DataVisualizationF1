import { useEffect, useMemo, useState } from 'react'
import LogoF1 from './assets/f1.svg?react'
import DriverPicker from './components/DriverPicker.jsx'
import DriverTree from './components/DriverTree.jsx'
import Legend from './components/Legend.jsx'
import RaceDetails from './components/RaceDetails.jsx'
import SectionNav from './components/SectionNav.jsx'
import { loadF1Data } from './lib/loadF1Data.js'
import { buildDriverTree } from './lib/buildDriverTree.js'
import { getTeamColor } from './lib/teamColors.js'
import './Dashboard.css'

export default function Dashboard({ onBack }) {
  const [tables, setTables] = useState(null)
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const [selectedId, setSelectedId] = useState(null)
  const [fromYear, setFromYear] = useState('')
  const [toYear, setToYear] = useState('')
  const [selectedRace, setSelectedRace] = useState(null)

  useEffect(() => {
    let active = true
    loadF1Data().then((data) => {
      if (active) setTables(data)
    }).catch((reason) => {
      if (active) setError(reason.message || 'The CSV files could not be loaded.')
    })
    return () => { active = false }
  }, [attempt])

  const defaultId = tables?.availableDrivers.find((driver) => driver.driverRef === 'hamilton')?.driverId
    ?? tables?.availableDrivers[0]?.driverId
  const driverId = selectedId ?? defaultId
  const driverTree = useMemo(() => tables ? buildDriverTree(driverId, tables, {
    fromYear: fromYear === '' ? undefined : Number(fromYear),
    toYear: toYear === '' ? undefined : Number(toYear),
  }) : null, [tables, driverId, fromYear, toYear])
  const reversedRange = fromYear !== '' && toYear !== '' && Number(fromYear) > Number(toYear)

  function resetFilters() {
    setFromYear('')
    setToYear('')
    setSelectedRace(null)
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
      <SectionNav activeSection="drivers" />

      <section className="dashboard-intro" aria-labelledby="explorer-title">
        <p className="eyebrow">One driver. Every chapter.</p>
        <h1 id="explorer-title">A career, <span>branch by branch.</span></h1>
        <p>Follow the connections between a driver, their constructors, and every Grand Prix result.</p>
      </section>

      {error ? (
        <section className="empty-state" role="alert">
          <h2>We couldn’t load the race archive.</h2>
          <p>{error}</p>
          <button className="btn btn--primary" type="button" onClick={() => { setError(null); setAttempt((value) => value + 1) }}>Try again</button>
        </section>
      ) : !tables ? (
        <div className="empty-state" role="status"><span className="loading-dot" />Loading drivers and race results…</div>
      ) : !driverTree ? (
        <div className="empty-state" role="status">No driver results are available in this dataset.</div>
      ) : (
        <>
          <section className="explorer-filters" aria-label="Driver and season filters">
            <DriverPicker drivers={tables.availableDrivers} selectedId={driverId} onChange={(id) => { setSelectedId(id); setSelectedRace(null) }} />
            <div className="season-filters">
              <label className="field">
                <span>From season</span>
                <select value={fromYear} aria-invalid={reversedRange} onChange={(event) => { setFromYear(event.target.value); setSelectedRace(null) }}>
                  <option value="">First season</option>
                  {tables.years.map((year) => <option key={year} value={year}>{year}</option>)}
                </select>
              </label>
              <label className="field">
                <span>To season</span>
                <select value={toYear} aria-invalid={reversedRange} onChange={(event) => { setToYear(event.target.value); setSelectedRace(null) }}>
                  <option value="">Latest season</option>
                  {tables.years.map((year) => <option key={year} value={year}>{year}</option>)}
                </select>
              </label>
              <button type="button" className="text-button reset-filters" onClick={resetFilters} disabled={fromYear === '' && toYear === ''}>Reset</button>
            </div>
          </section>

          <section className="driver-overview" aria-label={`${driverTree.name} summary`}>
            <div className="driver-overview__identity">
              <p className="eyebrow">{fromYear || toYear ? 'Selected seasons' : 'Career overview'}</p>
              <h2>{driverTree.name}</h2>
              <p>{driverTree.driver.nationality ?? 'Nationality not recorded'} · {driverTree.summary.seasons} seasons</p>
            </div>
            <dl className="driver-stats">
              {[
                ['Race entries', driverTree.summary.entries], ['Constructors', driverTree.summary.constructors],
                ['Wins', driverTree.summary.wins], ['Podiums', driverTree.summary.podiums], ['Race points', driverTree.summary.points],
              ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value.toLocaleString()}</dd></div>)}
            </dl>
          </section>

          <section className="chart-panel" aria-labelledby="tree-heading">
            <div className="chart-panel__header">
              <div><p className="eyebrow">Career connections</p><h2 id="tree-heading">The driver tree</h2></div>
              <ol className="hierarchy-key" aria-label="Tree levels"><li>Driver</li><li>Constructor</li><li>Season</li><li>Race</li></ol>
            </div>
            {!driverTree.children.length ? (
              <div className="empty-state" role="status">
                <h3>{reversedRange ? 'Choose a valid season range.' : 'No races in these seasons.'}</h3>
                <p>{reversedRange ? 'The first season must be before or equal to the last season.' : `${driverTree.name} has no race entries in the selected range.`}</p>
                <button className="btn btn--ghost" type="button" onClick={resetFilters}>Show full career</button>
              </div>
            ) : <DriverTree key={`${driverId}:${fromYear}:${toYear}`} data={driverTree} onSelectRace={setSelectedRace} />}
            <Legend />
          </section>

          <div className="explorer-notes">
            <RaceDetails race={selectedRace} driver={driverTree.name} constructorName={selectedRace ? tables.constructors.get(selectedRace.constructorId)?.name ?? 'Unknown constructor' : ''} />
            <aside className="reading-guide" aria-labelledby="reading-guide-title">
              <p className="eyebrow">A quick guide</p>
              <h2 id="reading-guide-title">How to read the tree</h2>
              <p>Branches follow each constructor’s first appearance in the selected seasons. Open a season to see its races in round order. Constructor and season dots grow with this driver’s race points in that branch, using the same square-root scale for the selected career range. Zero-point branches keep a minimum size.</p>
              <ul className="constructor-key" aria-label="Constructor colors">
                {driverTree.children.map((constructor) => <li key={constructor.id}><span className="legend-dot" style={{ backgroundColor: getTeamColor(constructor.constructorRef) }} />{constructor.name}</li>)}
              </ul>
              <p>Race labels show the official classified position, not a fallback ranking. A retired driver can still have a classified position; their node remains red.</p>
              <small>Race entries include non-starts and non-qualifications. Points come from Grand Prix results only; sprint points and championship adjustments are not included. Team colors are identifiers, not historical liveries.</small>
            </aside>
          </div>
          <footer className="dashboard-footer">
            <span>Local F1 archive · {tables.yearRange ? `${tables.yearRange.fromYear}–${tables.yearRange.toYear}` : 'No race results'} · {tables.availableDrivers.length} drivers</span>
            <span>D3.js tidy tree / No external data service</span>
          </footer>
        </>
      )}
    </main>
  )
}
