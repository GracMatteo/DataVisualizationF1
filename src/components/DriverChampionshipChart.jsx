import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { axisBottom, scaleLinear, select } from 'd3'
import { buildTeamBands, getPlaceLabel, PLACE_CATEGORIES } from '../lib/championshipStandings.js'
import { getTeamColor } from '../lib/teamColors.js'
import './DriverChampionshipChart.css'

const LANE_HEIGHT = 60
const MARGIN = { top: 8, right: 20, bottom: 32 }
const LABEL_WIDTH = 168
const NARROW_LABEL_WIDTH = 104
const MIN_LABEL_RADIUS = 7.5
const BAND_LABEL_CHAR = 5.6

const formatPoints = (value) => value == null ? '—' : Number(value.toFixed(1)).toLocaleString()
const dotText = (season) => season.position != null ? String(season.position) : season.positionText === 'D' ? 'D' : '–'

function laneSummary(lane) {
  const titles = lane.seasons.filter((season) => season.category === 'champion' && !season.provisional).length
  const best = lane.seasons.reduce((top, season) => season.position != null && (top == null || season.position < top) ? season.position : top, null)
  if (!lane.seasons.length) return 'No standings in range'
  return `${titles} title${titles === 1 ? '' : 's'} · best ${best == null ? '—' : getPlaceLabel({ position: best })}`
}

export default function DriverChampionshipChart({ lanes, selected, marked, onSelectSeason }) {
  const instanceId = useId()
  const wrapRef = useRef(null)
  const sceneRef = useRef(null)
  const [width, setWidth] = useState(800)
  const [active, setActive] = useState(null)
  const [pointer, setPointer] = useState(null)
  const [focused, setFocused] = useState(false)
  const [showTable, setShowTable] = useState(false)

  const years = useMemo(() => lanes.flatMap((lane) => lane.seasons.map((season) => season.year)), [lanes])
  const hasData = years.length > 0
  const labelWidth = width < 560 ? NARROW_LABEL_WIDTH : LABEL_WIDTH
  const innerWidth = Math.max(120, width - labelWidth - MARGIN.right)
  const height = MARGIN.top + lanes.length * LANE_HEIGHT + MARGIN.bottom
  const x = useMemo(() => {
    const first = Math.min(...years)
    const last = Math.max(...years)
    return scaleLinear().domain([first - 0.5, last + 0.5]).range([0, innerWidth])
  }, [years, innerWidth])
  const step = hasData ? x(1) - x(0) : 0
  const radius = Math.max(4, Math.min(11, step / 2 - 1.5))
  const laneY = (index) => MARGIN.top + index * LANE_HEIGHT + LANE_HEIGHT / 2

  useEffect(() => {
    const node = wrapRef.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasData])

  useEffect(() => {
    if (!sceneRef.current) return
    const scene = select(sceneRef.current)
    const span = x.domain()[1] - x.domain()[0]
    scene.selectAll('.champ-chart__axis').data([null]).join('g')
      .attr('class', 'champ-chart__axis')
      .attr('transform', `translate(0,${height - MARGIN.bottom})`)
      .call(axisBottom(x).ticks(Math.min(Math.ceil(span), Math.max(2, Math.floor(innerWidth / 56)))).tickFormat((year) => Number.isInteger(year) ? String(year) : '').tickSizeOuter(0))

    const laneNodes = scene.selectAll('.champ-chart__lane')
      .data(lanes, (lane) => lane.driverId)
      .join((enter) => {
        const group = enter.append('g').attr('class', 'champ-chart__lane')
        group.append('g').attr('class', 'champ-chart__bands')
        group.append('line').attr('class', 'champ-chart__lane-rule')
        group.append('g').attr('class', 'champ-chart__links')
        group.append('g').attr('class', 'champ-chart__dots')
        return group
      })
      .attr('transform', (lane, index) => `translate(0,${laneY(index)})`)
    laneNodes.select('.champ-chart__lane-rule')
      .attr('x1', -labelWidth).attr('x2', innerWidth + MARGIN.right)
      .attr('y1', LANE_HEIGHT / 2).attr('y2', LANE_HEIGHT / 2)

    laneNodes.each(function (lane, laneIndex) {
      const group = select(this)
      const bands = group.select('.champ-chart__bands').selectAll('.champ-chart__band')
        .data(buildTeamBands(lane.seasons), (band) => `${band.constructorRef}-${band.from}`)
        .join((enter) => {
          const band = enter.append('g').attr('class', 'champ-chart__band')
          band.append('rect')
          band.append('text')
          return band
        })
      // A 1px surface gap separates touching bands of different teams.
      bands.select('rect')
        .attr('x', (band) => x(band.from))
        .attr('width', (band) => Math.max(1, x(band.to) - x(band.from) - 1))
        .attr('y', -LANE_HEIGHT / 2 + 1).attr('height', LANE_HEIGHT - 2)
        .attr('fill', (band) => getTeamColor(band.constructorRef))
      bands.select('text')
        .attr('x', (band) => x(band.from) + 4).attr('y', -LANE_HEIGHT / 2 + 11)
        .attr('display', (band) => x(band.to) - x(band.from) > band.name.length * BAND_LABEL_CHAR + 8 ? null : 'none')
        .text((band) => band.name)
      const links = lane.seasons.slice(1).map((season, index) => ({
        key: `${lane.seasons[index].year}-${season.year}`, from: lane.seasons[index].year, to: season.year, gap: season.year - lane.seasons[index].year > 1,
      }))
      group.select('.champ-chart__links').selectAll('line')
        .data(links, (link) => link.key)
        .join('line')
        .attr('class', (link) => `champ-chart__link${link.gap ? ' is-gap' : ''}`)
        .attr('x1', (link) => x(link.from)).attr('x2', (link) => x(link.to))
      const dots = group.select('.champ-chart__dots').selectAll('.champ-chart__dot')
        .data(lane.seasons, (season) => season.year)
        .join((enter) => {
          const dot = enter.append('g').attr('class', 'champ-chart__dot')
          dot.append('circle').attr('class', 'champ-chart__hit')
          dot.append('circle').attr('class', 'champ-chart__mark')
          dot.append('text').attr('dy', '0.35em')
          return dot
        })
        .attr('transform', (season) => `translate(${x(season.year)},0)`)
        .classed('is-provisional', (season) => season.provisional)
        .classed('is-active', (season, seasonIndex) => active?.lane === laneIndex && active?.season === seasonIndex)
        .classed('is-selected', (season) => selected?.driverId === lane.driverId && selected?.year === season.year)
        .classed('is-linked', (season) => marked?.some((mark) => mark.driverId === lane.driverId && mark.year === season.year) ?? false)
        .on('pointerenter', (event, season) => {
          setActive({ lane: laneIndex, season: lane.seasons.indexOf(season) })
          setPointer(true)
        })
        .on('pointerleave', () => setPointer(null))
        .on('click', (event, season) => onSelectSeason?.({ ...season, driverName: lane.name }))
      dots.select('.champ-chart__hit').attr('r', Math.max(radius + 3, 12))
      dots.select('.champ-chart__mark').attr('r', radius).attr('fill', (season) => PLACE_CATEGORIES[season.category].color)
      dots.select('text')
        .attr('display', radius >= MIN_LABEL_RADIUS ? null : 'none')
        .attr('font-size', radius >= 10 ? 10 : 9)
        .text(dotText)
    })
    return () => { scene.selectAll('.champ-chart__dot').on('pointerenter', null).on('pointerleave', null).on('click', null) }
  }, [lanes, x, innerWidth, labelWidth, height, radius, active, selected, marked, onSelectSeason])

  const move = (event) => {
    if (!hasData) return
    const lane = active?.lane ?? 0
    const season = active?.season ?? 0
    const clampSeason = (laneIndex, index) => Math.max(0, Math.min(lanes[laneIndex].seasons.length - 1, index))
    const findLane = (from, direction) => {
      for (let index = from + direction; index >= 0 && index < lanes.length; index += direction) {
        if (lanes[index].seasons.length) return index
      }
      return from
    }
    const nearest = (laneIndex) => {
      const year = lanes[lane].seasons[season]?.year
      const seasons = lanes[laneIndex].seasons
      return seasons.reduce((best, item, index) => Math.abs(item.year - year) < Math.abs(seasons[best].year - year) ? index : best, 0)
    }
    let next = null
    if (event.key === 'ArrowRight') next = { lane, season: clampSeason(lane, season + 1) }
    else if (event.key === 'ArrowLeft') next = { lane, season: clampSeason(lane, season - 1) }
    else if (event.key === 'Home') next = { lane, season: 0 }
    else if (event.key === 'End') next = { lane, season: lanes[lane].seasons.length - 1 }
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const target = findLane(lane, event.key === 'ArrowDown' ? 1 : -1)
      next = { lane: target, season: nearest(target) }
    } else if ((event.key === 'Enter' || event.key === ' ') && active) {
      event.preventDefault()
      const item = lanes[active.lane].seasons[active.season]
      if (item) onSelectSeason?.({ ...item, driverName: lanes[active.lane].name })
      return
    } else if (event.key === 'Escape') {
      setActive(null)
      onSelectSeason?.(null)
      return
    }
    if (next) {
      event.preventDefault()
      setPointer(null)
      setActive(next)
    }
  }

  const handleFocus = () => {
    setFocused(true)
    if (active || !hasData) return
    const lane = lanes.findIndex((item) => item.seasons.length)
    setActive({ lane, season: 0 })
  }

  const activeLane = active ? lanes[active.lane] : null
  const activeSeason = activeLane?.seasons[active.season]
  const showTooltip = activeSeason && (pointer || focused)
  const tooltipX = activeSeason ? labelWidth + x(activeSeason.year) : 0
  const tooltipY = active ? laneY(active.lane) + LANE_HEIGHT / 2 : 0
  const flip = tooltipX > width * 0.6

  return (
    <section className="champ-chart" aria-label="Championship position by season">
      <div className="champ-chart__toolbar">
        <ul className="champ-chart__legend" aria-label="Final championship place">
          {Object.entries(PLACE_CATEGORIES).map(([key, item]) => (
            <li key={key}><span className={`champ-chart__swatch is-${key}`} aria-hidden="true" />{item.label}</li>
          ))}
          <li><span className="champ-chart__swatch is-provisional" aria-hidden="true" />Season in progress</li>
          <li><span className="champ-chart__gap-key" aria-hidden="true" />Seasons missed</li>
          <li><span className="champ-chart__band-key" aria-hidden="true" />Background: team that season</li>
        </ul>
        <button type="button" disabled={!hasData} aria-expanded={showTable} aria-controls={`${instanceId}-table`} onClick={() => setShowTable((value) => !value)}>
          {showTable ? 'Hide' : 'Show'} table
        </button>
      </div>

      {!lanes.length ? (
        <p className="champ-chart__empty" role="status">Select drivers to compare their championship finishes.</p>
      ) : !hasData ? (
        <p className="champ-chart__empty" role="status">No championship standings in these seasons. Change the drivers or seasons.</p>
      ) : (
        <div
          className="champ-chart__figure"
          ref={wrapRef}
          tabIndex={0}
          role="application"
          aria-label="Championship chart. Left and right arrows move between seasons, up and down between drivers, Enter shows season details, Escape clears."
          aria-describedby={`${instanceId}-desc`}
          onKeyDown={move}
          onFocus={handleFocus}
          onBlur={() => { setFocused(false); setPointer(null) }}
        >
          <svg width={width} height={height} aria-hidden="true">
            <g className="champ-chart__labels">
              {lanes.map((lane, index) => (
                <g key={lane.driverId} transform={`translate(0,${laneY(index)})`}>
                  <text className="champ-chart__name" y={-4}>{width < 560 ? lane.driver?.surname ?? lane.name : lane.name}</text>
                  <text className="champ-chart__summary" y={13}>{laneSummary(lane)}</text>
                </g>
              ))}
            </g>
            <g ref={sceneRef} transform={`translate(${labelWidth},0)`} />
          </svg>
          <p id={`${instanceId}-desc`} className="champ-chart__sr">
            {lanes.map((lane) => `${lane.name}: ${lane.seasons.map((season) => `${season.year} ${getPlaceLabel(season)}${season.provisional ? ' so far' : ''}`).join(', ') || 'no standings'}.`).join(' ')}
          </p>
          {showTooltip && (
            <div
              className="champ-chart__tooltip"
              style={{ top: tooltipY, ...(flip ? { right: width - tooltipX + 14 } : { left: tooltipX + 14 }) }}
              aria-live="polite"
            >
              <strong>{getPlaceLabel(activeSeason)}{activeSeason.provisional ? ' so far' : ''}</strong>
              <span>{activeLane.name} · {activeSeason.year}</span>
              <span>{formatPoints(activeSeason.points)} pts · {activeSeason.wins ?? '—'} win{activeSeason.wins === 1 ? '' : 's'}</span>
              {activeSeason.teamShares.length > 0 && <small>{activeSeason.teamShares.map((team) => activeSeason.teamShares.length > 1 ? `${team.name} (${team.races} races)` : team.name).join(', ')}</small>}
              {activeSeason.provisional && <small>Standings after round {activeSeason.round}</small>}
            </div>
          )}
        </div>
      )}

      {showTable && hasData && (
        <div className="champ-chart__table" id={`${instanceId}-table`} role="region" aria-label="Championship table" tabIndex={0}>
          <table>
            <caption>Final championship standing per season</caption>
            <thead><tr><th scope="col">Driver</th><th scope="col">Season</th><th scope="col">Place</th><th scope="col">Points</th><th scope="col">Wins</th><th scope="col">Teams</th></tr></thead>
            <tbody>
              {lanes.flatMap((lane) => lane.seasons.map((season) => (
                <tr key={`${lane.driverId}-${season.year}`}>
                  <th scope="row">{lane.name}</th>
                  <td>{season.year}</td>
                  <td>{getPlaceLabel(season)}{season.provisional ? ` (after round ${season.round})` : ''}</td>
                  <td>{formatPoints(season.points)}</td>
                  <td>{season.wins ?? '—'}</td>
                  <td>{season.teams.join(', ') || '—'}</td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      )}

      <p className="champ-chart__note">
        Each dot is a driver’s final place in the Drivers’ Championship that season, numbered inside the dot. The pale background shows the team they drove for; a season split between teams is divided by number of races. The line joins consecutive seasons; a dashed stretch means seasons without a championship standing. Standings are the official ones, including sprint points and penalties; “D” marks an exclusion (Schumacher, 1997) and “–” a driver left unranked.
      </p>
    </section>
  )
}
