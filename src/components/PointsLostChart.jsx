import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { axisTop, scaleBand, scaleLinear, select } from 'd3'
import { getTeamColor } from '../lib/teamColors.js'
import { LOST_POINTS_COLOR, formatPercent } from '../lib/reliabilityPresentation.js'

const ROW = 30
const MARGIN = { top: 28, right: 112, bottom: 8, left: 132 }

export default function PointsLostChart({ rows, eraLabel, highlightedId, selectedId, onHover, onSelect }) {
  const containerRef = useRef(null)
  const svgRef = useRef(null)
  const [width, setWidth] = useState(640)
  const patternId = `lost-hatch-${useId().replace(/:/g, '')}`
  const titleId = useId()
  const sorted = useMemo(() => [...rows].sort((a, b) => b.pointsLost - a.pointsLost || a.name.localeCompare(b.name)), [rows])
  const height = MARGIN.top + MARGIN.bottom + sorted.length * ROW

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(320, entry.contentRect.width)))
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const svg = select(svgRef.current).attr('viewBox', `0 0 ${width} ${height}`)
    const scene = svg.append('g')
    const maxTotal = Math.max(1, ...sorted.map((row) => row.points + row.pointsLost))
    const x = scaleLinear().domain([0, maxTotal]).range([MARGIN.left, width - MARGIN.right]).nice()
    const y = scaleBand().domain(sorted.map((row) => row.id)).range([MARGIN.top, height - MARGIN.bottom]).padding(0.3)

    const defs = scene.append('defs')
    defs.append('pattern').attr('id', patternId).attr('width', 6).attr('height', 6)
      .attr('patternUnits', 'userSpaceOnUse').attr('patternTransform', 'rotate(45)')
      .call((pattern) => {
        pattern.append('rect').attr('width', 6).attr('height', 6).attr('fill', LOST_POINTS_COLOR).attr('opacity', 0.25)
        pattern.append('line').attr('y2', 6).attr('stroke', LOST_POINTS_COLOR).attr('stroke-width', 2.5)
      })

    scene.append('g').attr('class', 'scatter-grid').attr('aria-hidden', true)
      .attr('transform', `translate(0,${MARGIN.top})`)
      .call(axisTop(x).ticks(Math.max(2, Math.floor(width / 140))).tickSize(-(height - MARGIN.top - MARGIN.bottom)).tickFormat(''))
    scene.append('g').attr('class', 'scatter-axis').attr('aria-hidden', true)
      .attr('transform', `translate(0,${MARGIN.top})`)
      .call(axisTop(x).ticks(Math.max(2, Math.floor(width / 140))).tickSize(0).tickPadding(8))

    const bars = scene.append('g').selectAll('g')
      .data(sorted, (row) => row.id)
      .join('g')
      .attr('class', 'lost-row')
      .attr('transform', (row) => `translate(0,${y(row.id)})`)
      .attr('tabindex', 0)
      .attr('role', 'button')
      .attr('aria-label', (row) => `${row.name}: ${Math.round(row.points)} points scored, about ${Math.round(row.pointsLost)} lost to ${row.failures} engine failures. Select to compare eras.`)
      .on('mouseenter focus', (event, row) => onHover(row.constructorId))
      .on('mouseleave blur', () => onHover(null))
      .on('click', (event, row) => onSelect(row.constructorId))
      .on('keydown', (event, row) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect(row.constructorId)
        }
      })

    bars.append('rect').attr('class', 'lost-row__hit').attr('x', 0).attr('y', -y.step() * y.padding() / 2)
      .attr('width', width).attr('height', y.step())
    bars.append('text').attr('class', 'lost-row__name').attr('x', MARGIN.left - 10).attr('y', y.bandwidth() / 2)
      .attr('dy', '0.35em').attr('text-anchor', 'end').text((row) => row.name.length > 18 ? `${row.name.slice(0, 17)}…` : row.name)
    bars.append('rect').attr('class', 'lost-row__scored').attr('x', x(0)).attr('height', y.bandwidth()).attr('rx', 2)
      .attr('width', (row) => Math.max(0, x(row.points) - x(0)))
      .attr('fill', (row) => getTeamColor(row.constructorRef))
    // 2px surface gap between the scored and lost segments.
    bars.append('rect').attr('class', 'lost-row__lost').attr('height', y.bandwidth()).attr('rx', 2)
      .attr('x', (row) => x(row.points) + (row.points > 0 ? 2 : 0))
      .attr('width', (row) => Math.max(0, x(row.points + row.pointsLost) - x(row.points) - (row.points > 0 ? 2 : 0)))
      .attr('fill', `url(#${patternId})`).attr('stroke', LOST_POINTS_COLOR).attr('stroke-width', 1)
      .attr('display', (row) => row.pointsLost > 0 ? null : 'none')
    bars.append('text').attr('class', 'lost-row__value')
      .attr('x', (row) => x(row.points + row.pointsLost) + 8).attr('y', y.bandwidth() / 2).attr('dy', '0.35em')
      .text((row) => row.failures ? `−${Math.round(row.pointsLost)} pts · ${formatPercent(row.lostShare, 0)}` : 'no engine DNF')
    bars.append('title').text((row) => `${row.name} — ${Math.round(row.points)} pts scored, ≈ ${Math.round(row.pointsLost)} pts lost, ${row.failures} engine failures in ${row.starts} starts`)

    return () => scene.remove()
  }, [sorted, width, height, patternId, onHover, onSelect])

  useEffect(() => {
    const active = highlightedId ?? selectedId
    select(svgRef.current).selectAll('.lost-row')
      .classed('is-dimmed', (row) => active != null && row.constructorId !== active)
      .classed('is-selected', (row) => row.constructorId === selectedId)
  }, [highlightedId, selectedId, sorted, width])

  return (
    <div className="lost-chart" ref={containerRef}>
      <svg ref={svgRef} role="group" aria-labelledby={titleId}>
        <title id={titleId}>{eraLabel} era: race points scored and estimated points lost to engine failures, per constructor</title>
      </svg>
    </div>
  )
}
