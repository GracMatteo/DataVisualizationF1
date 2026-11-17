import { useMemo, useRef, useState } from 'react'
import { decadeRows, seasonTimeline } from '../lib/circuitWins.js'
import { getTeamColor } from '../lib/teamColors.js'

const LEADERBOARD_LIMIT = 10
const STANDINGS_LIMIT = 8

function teamOf(constructors, id) {
  const constructor = constructors.get(id)
  return { name: constructor?.name ?? `Constructor ${id}`, color: getTeamColor(constructor?.constructorRef) }
}

function BarRow({ name, color, value, maximum, caption, note, pressed, onToggle }) {
  return (
    <li>
      <button type="button" className="bar-row" aria-pressed={pressed} onClick={onToggle}>
        <span className="bar-row__name"><span className="legend-dot" style={{ backgroundColor: color }} />{name}</span>
        <span className="bar-row__track" aria-hidden="true">
          <span className="bar-row__fill" style={{ width: `${(value / maximum) * 100}%`, backgroundColor: color }} />
        </span>
        <span className="bar-row__value">{caption}{note && <small> {note}</small>}</span>
      </button>
    </li>
  )
}

function Leaderboard({ board, constructors, highlightId, onHighlight, rangeLabel, circuitCount }) {
  const [expanded, setExpanded] = useState(false)
  const rows = expanded ? board : board.slice(0, LEADERBOARD_LIMIT)
  const maximum = Math.max(1, ...board.map((row) => row.led))

  return (
    <>
      <p className="eyebrow">{rangeLabel}</p>
      <h2 id="circuit-panel-title">Who rules the most circuits?</h2>
      <p className="circuit-panel__lead">
        Constructors ranked by the number of circuits where they hold the most wins, across {circuitCount.toLocaleString('en')} circuits.
        Select one to light up its winning tracks.
      </p>
      {board.length === 0 ? (
        <p className="circuit-panel__empty">No winner is recorded for these filters.</p>
      ) : (
        <>
          <ol className="bar-list" aria-label="Circuits led by constructor">
            {rows.map((row) => {
              const team = teamOf(constructors, row.constructorId)
              return (
                <BarRow
                  key={row.constructorId}
                  {...team}
                  value={row.led}
                  maximum={maximum}
                  caption={row.led}
                  note={row.shared ? `+${row.shared}` : null}
                  pressed={highlightId === row.constructorId}
                  onToggle={() => onHighlight(highlightId === row.constructorId ? null : row.constructorId)}
                />
              )
            })}
          </ol>
          {board.length > LEADERBOARD_LIMIT && (
            <button type="button" className="text-button" onClick={() => setExpanded((value) => !value)}>
              {expanded ? 'Show top 10' : `Show all ${board.length} constructors`}
            </button>
          )}
          <p className="circuit-panel__note">Bars and numbers count outright leads; “+N” adds circuits where the constructor is tied for the most wins.</p>
        </>
      )}
    </>
  )
}

function winnersText(race, constructors) {
  const names = race.constructorIds.map((id) => teamOf(constructors, id).name)
  return names.length ? names.join(' and ') : 'no classified winner'
}

function seasonText(season, constructors) {
  if (!season.races.length) return `${season.year} · circuit not used this season`
  return `${season.year} · ${season.races.map((race) => `${race.name}: ${winnersText(race, constructors)}`).join(' · ')}`
}

function raceBackground(race, constructors) {
  const colors = race.constructorIds.map((id) => teamOf(constructors, id).color)
  if (colors.length <= 1) return colors[0]
  const step = 100 / colors.length
  return `linear-gradient(90deg, ${colors.map((color, index) => `${color} ${index * step}% ${(index + 1) * step}%`).join(', ')})`
}

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

/**
 * Season-by-season history over the whole filtered range: one row per decade, one cell per
 * season. Cells are colored by the winner, split when the circuit hosted several Grands Prix
 * that season, gray when it was not used. Arrow keys move between seasons (one tab stop).
 */
function SeasonHistory({ races, seasonRange, constructors }) {
  const timeline = useMemo(() => seasonTimeline(races, seasonRange.from, seasonRange.to), [races, seasonRange.from, seasonRange.to])
  const rows = useMemo(() => decadeRows(timeline), [timeline])
  const [activeYear, setActiveYear] = useState(null)
  const [focusYear, setFocusYear] = useState(timeline.find((season) => season.races.length)?.year ?? seasonRange.from)
  const cellRefs = useRef(new Map())
  const heldSeasons = timeline.filter((season) => season.races.length).length
  const active = timeline.find((season) => season.year === activeYear)

  function moveFocus(event, year) {
    const steps = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -10, ArrowDown: 10 }
    let target = null
    if (event.key in steps) target = year + steps[event.key]
    else if (event.key === 'Home') target = seasonRange.from
    else if (event.key === 'End') target = seasonRange.to
    if (target === null) return
    event.preventDefault()
    target = Math.min(seasonRange.to, Math.max(seasonRange.from, target))
    setFocusYear(target)
    cellRefs.current.get(target)?.focus()
  }

  return (
    <div className="season-history">
      <p className="season-history__summary">
        Used in <strong>{heldSeasons}</strong> of {timeline.length} seasons ({seasonRange.from}–{seasonRange.to}). Read left to right, one row per decade.
      </p>
      <div className="season-grid" role="group" aria-label="Winning constructor by season">
        <div className="season-grid__row season-grid__row--head" aria-hidden="true">
          <span />
          {DIGITS.map((digit) => <span key={digit}>{digit}</span>)}
        </div>
        {rows.map((row) => (
          <div className="season-grid__row" key={row.decade}>
            <span className="season-grid__decade" aria-hidden="true">{row.decade}s</span>
            {row.slots.map((season, index) => {
              if (!season) return <span key={index} className="season-cell season-cell--outside" aria-hidden="true" />
              const label = seasonText(season, constructors)
              const state = !season.races.length ? 'unused'
                : season.races.every((race) => !race.constructorIds.length) ? 'no-winner' : 'held'
              return (
                <button
                  key={index}
                  type="button"
                  ref={(node) => { if (node) cellRefs.current.set(season.year, node); else cellRefs.current.delete(season.year) }}
                  className={`season-cell season-cell--${state}${season.year === activeYear ? ' is-active' : ''}`}
                  tabIndex={season.year === focusYear ? 0 : -1}
                  aria-label={label}
                  title={label}
                  onPointerEnter={() => setActiveYear(season.year)}
                  onPointerLeave={() => setActiveYear(null)}
                  onFocus={() => { setActiveYear(season.year); setFocusYear(season.year) }}
                  onBlur={() => setActiveYear(null)}
                  onKeyDown={(event) => moveFocus(event, season.year)}
                >
                  {season.races.map((race) => (
                    <span key={race.raceId} className="season-cell__race" style={{ background: raceBackground(race, constructors) }} />
                  ))}
                </button>
              )
            })}
          </div>
        ))}
      </div>
      <p className="season-history__readout" aria-hidden="true">
        {active ? seasonText(active, constructors) : 'Hover or focus a season (arrow keys move) to see its Grand Prix and winner.'}
      </p>
      <ul className="season-history__key" aria-label="History legend">
        <li><span className="season-cell season-cell--sample" />Won by the team in that color</li>
        <li><span className="season-cell season-cell--unused" />Circuit not used that season</li>
        <li><span className="season-cell season-cell--split"><span /><span /></span>Several Grands Prix that season</li>
        {timeline.some((season) => season.races.some((race) => !race.constructorIds.length)) && (
          <li><span className="season-cell season-cell--no-winner" />No classified winner</li>
        )}
      </ul>
    </div>
  )
}

function CircuitDetail({ circuit, summary, constructors, highlightId, onHighlight, onClose, rangeLabel, seasonRange }) {
  const [expanded, setExpanded] = useState(false)
  const standings = summary && !expanded ? summary.standings.slice(0, STANDINGS_LIMIT) : summary?.standings
  const place = [circuit.location, circuit.country].filter(Boolean).join(', ')
  return (
    <>
      <div className="circuit-panel__head">
        <div>
          <p className="eyebrow">{rangeLabel}</p>
          <h2 id="circuit-panel-title">{circuit.name}</h2>
          {place && <p className="circuit-panel__place">{place}</p>}
        </div>
        <button type="button" className="text-button" onClick={onClose}>← All circuits</button>
      </div>

      {!summary ? (
        <p className="circuit-panel__empty">This circuit hosted no Grand Prix in the selected filters.</p>
      ) : (
        <>
          <dl className="circuit-facts">
            <div><dt>Grands Prix</dt><dd>{summary.raceCount}</dd></div>
            <div><dt>Seasons</dt><dd>{summary.firstYear === summary.lastYear ? summary.firstYear : `${summary.firstYear}–${summary.lastYear}`}</dd></div>
            <div><dt>Winning constructors</dt><dd>{summary.standings.length}</dd></div>
          </dl>

          <h3>Wins by constructor</h3>
          {summary.standings.length === 0 ? (
            <p className="circuit-panel__empty">No classified winner is recorded here.</p>
          ) : (
            <ol className="bar-list" aria-label={`Wins by constructor at ${circuit.name}`}>
              {standings.map((standing) => (
                <BarRow
                  key={standing.constructorId}
                  {...teamOf(constructors, standing.constructorId)}
                  value={standing.wins}
                  maximum={summary.topWins}
                  caption={standing.wins}
                  pressed={highlightId === standing.constructorId}
                  onToggle={() => onHighlight(highlightId === standing.constructorId ? null : standing.constructorId)}
                />
              ))}
            </ol>
          )}
          {summary.standings.length > STANDINGS_LIMIT && (
            <button type="button" className="text-button" onClick={() => setExpanded((value) => !value)}>
              {expanded ? `Show top ${STANDINGS_LIMIT}` : `Show all ${summary.standings.length} winning constructors`}
            </button>
          )}
          {summary.tiedLeaderIds.length > 0 && (
            <p className="circuit-panel__note">The top total is shared, so the map dot is gray. Ties are listed by who reached the total first.</p>
          )}

          <h3>Season-by-season winners</h3>
          <SeasonHistory key={`${seasonRange.from}-${seasonRange.to}`} races={summary.races} seasonRange={seasonRange} constructors={constructors} />
        </>
      )}
    </>
  )
}

export default function CircuitPanel({ circuit, ...props }) {
  return (
    <aside className="circuit-panel" aria-labelledby="circuit-panel-title">
      {circuit ? <CircuitDetail key={circuit.circuitId} circuit={circuit} {...props} /> : <Leaderboard {...props} />}
    </aside>
  )
}
