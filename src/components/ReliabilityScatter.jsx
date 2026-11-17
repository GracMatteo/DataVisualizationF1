import { useEffect, useId, useRef, useState } from 'react'
import { axisBottom, axisLeft, scaleLinear, scaleSqrt, select } from 'd3'
import { getTeamColor } from '../lib/teamColors.js'
import { METRICS, formatPercent } from '../lib/reliabilityPresentation.js'

const HEIGHT = 300
const MARGIN = { top: 16, right: 16, bottom: 42, left: 48 }

/** Least-squares line through the visible rows, or null when x is constant. */
function trendLine(rows, metric) {
  if (rows.length < 3) return null
  const meanX = rows.reduce((sum, row) => sum + row.failureRate, 0) / rows.length
  const meanY = rows.reduce((sum, row) => sum + row[metric], 0) / rows.length
  const denominator = rows.reduce((sum, row) => sum + (row.failureRate - meanX) ** 2, 0)
  if (!denominator) return null
  const slope = rows.reduce((sum, row) => sum + (row.failureRate - meanX) * (row[metric] - meanY), 0) / denominator
  return (x) => meanY + slope * (x - meanX)
}

export default function ReliabilityScatter({ summary, metric, xMax, yMax, startsMax, highlightedId, selectedId, onHover, onSelect }) {
  const containerRef = useRef(null)
  const svgRef = useRef(null)
  const [width, setWidth] = useState(360)
  const [tooltip, setTooltip] = useState(null)
  const titleId = useId()
  const descriptionId = useId()
  const metricLabel = METRICS[metric].label

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(260, entry.contentRect.width)))
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const svg = select(svgRef.current).attr('viewBox', `0 0 ${width} ${HEIGHT}`)
    const scene = svg.append('g').attr('class', 'scatter-scene')
    const x = scaleLinear().domain([0, xMax]).range([MARGIN.left, width - MARGIN.right]).nice()
    const y = scaleLinear().domain([0, yMax]).range([HEIGHT - MARGIN.bottom, MARGIN.top]).nice()
    const radius = scaleSqrt().domain([0, startsMax]).range([0, 16])
    const container = containerRef.current

    scene.append('g').attr('class', 'scatter-grid').attr('aria-hidden', true)
      .attr('transform', `translate(${MARGIN.left},0)`)
      .call(axisLeft(y).ticks(5).tickSize(-(width - MARGIN.left - MARGIN.right)).tickFormat(''))
    scene.append('g').attr('class', 'scatter-axis').attr('aria-hidden', true)
      .attr('transform', `translate(0,${HEIGHT - MARGIN.bottom})`)
      .call(axisBottom(x).ticks(5).tickFormat((value) => formatPercent(value, 0)))
    scene.append('g').attr('class', 'scatter-axis').attr('aria-hidden', true)
      .attr('transform', `translate(${MARGIN.left},0)`)
      .call(axisLeft(y).ticks(5).tickFormat((value) => formatPercent(value, 0)))
    scene.append('text').attr('class', 'scatter-axis-label').attr('aria-hidden', true)
      .attr('x', width - MARGIN.right).attr('y', HEIGHT - 6).attr('text-anchor', 'end')
      .text('Engine failures per start →')

    const line = trendLine(summary.rows, metric)
    if (line) {
      const [x0, x1] = x.domain()
      const clampY = (value) => Math.max(y.domain()[0], Math.min(y.domain()[1], value))
      scene.append('line').attr('class', 'scatter-trend').attr('aria-hidden', true)
        .attr('x1', x(x0)).attr('y1', y(clampY(line(x0))))
        .attr('x2', x(x1)).attr('y2', y(clampY(line(x1))))
    }

    function showTooltip(event, row) {
      const bounds = container.getBoundingClientRect()
      const target = event.currentTarget.getBoundingClientRect()
      const left = target.left - bounds.left + target.width / 2
      const top = target.top - bounds.top
      setTooltip({ row, x: Math.max(4, Math.min(left + 12, bounds.width - 232)), y: Math.max(4, top - 8) })
      onHover(row.constructorId)
    }

    function hideTooltip() {
      setTooltip(null)
      onHover(null)
    }

    // Larger teams first so small dots stay on top and remain hoverable.
    const labelled = new Set([...summary.rows].sort((a, b) => b[metric] - a[metric]).slice(0, 3).map((row) => row.constructorId))
    const dots = scene.append('g').attr('class', 'scatter-dots')
      .selectAll('g')
      .data([...summary.rows].sort((a, b) => b.starts - a.starts), (row) => row.id)
      .join('g')
      .attr('class', 'scatter-dot')
      .attr('data-constructor', (row) => row.constructorId)
      .attr('transform', (row) => `translate(${x(row.failureRate)},${y(row[metric])})`)
      .attr('tabindex', 0)
      .attr('role', 'button')
      .attr('aria-label', (row) => `${row.name}: ${formatPercent(row.failureRate)} engine failures over ${row.starts} starts, ${metricLabel.toLowerCase()} ${formatPercent(row[metric])}. Select to compare eras.`)
      .on('mouseenter focus', showTooltip)
      .on('mouseleave blur', hideTooltip)
      .on('click', (event, row) => onSelect(row.constructorId))
      .on('keydown', (event, row) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect(row.constructorId)
        }
        if (event.key === 'Escape') hideTooltip()
      })
    dots.append('circle').attr('class', 'scatter-hit').attr('r', (row) => Math.max(12, radius(row.starts) + 4))
    dots.append('circle').attr('class', 'scatter-ring').attr('r', (row) => Math.max(4, radius(row.starts)) + 4)
    dots.append('circle').attr('class', 'scatter-mark')
      .attr('r', (row) => Math.max(4, radius(row.starts)))
      .attr('fill', (row) => getTeamColor(row.constructorRef))
    dots.append('text').attr('class', 'scatter-label')
      .attr('x', (row) => Math.max(4, radius(row.starts)) + 5).attr('dy', '0.35em')
      .classed('is-default', (row) => labelled.has(row.constructorId))
      .text((row) => row.name)

    return () => {
      scene.remove()
      setTooltip(null)
    }
  }, [summary, metric, metricLabel, xMax, yMax, startsMax, width, onHover, onSelect])

  // Linked highlight: presentation only, applied to the scene D3 already owns.
  useEffect(() => {
    const active = highlightedId ?? selectedId
    select(svgRef.current).selectAll('.scatter-dot')
      .classed('is-dimmed', (row) => active != null && row.constructorId !== active)
      .classed('is-active', (row) => row.constructorId === active)
      .classed('is-selected', (row) => row.constructorId === selectedId)
      .filter((row) => row.constructorId === active)
      .raise()
  }, [highlightedId, selectedId, summary, metric, width])

  const { era, correlation } = summary
  return (
    <figure className="era-panel">
      <figcaption className="era-panel__header">
        <div>
          <h3>{era.label} <span>{era.fromYear}–{era.toYear}</span></h3>
          <p>{era.description}</p>
        </div>
        <dl className="era-panel__stats">
          <div><dt>Era failure rate</dt><dd>{formatPercent(summary.failureRate)}</dd></div>
          <div><dt>Correlation r</dt><dd>{correlation == null ? 'n/a' : correlation.toFixed(2)}</dd></div>
        </dl>
      </figcaption>
      <div className="era-panel__plot" ref={containerRef}>
        <svg ref={svgRef} role="group" aria-labelledby={titleId} aria-describedby={descriptionId}>
          <title id={titleId}>{era.label} era: engine failure rate against {metricLabel.toLowerCase()}</title>
          <desc id={descriptionId}>One dot per constructor. Horizontal position is the share of starts ending in an engine or power-unit failure; vertical position is {metricLabel.toLowerCase()}; dot area grows with the number of starts. The dashed line is a least-squares trend.</desc>
        </svg>
        {tooltip && (
          <div className="scatter-tooltip" role="tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
            <strong>{tooltip.row.name}</strong>
            <span>{tooltip.row.failures} engine failures / {tooltip.row.starts} starts · {formatPercent(tooltip.row.failureRate)}</span>
            <span>{tooltip.row.wins} wins · {formatPercent(tooltip.row.winRate)} of starts</span>
            <span>{Math.round(tooltip.row.points).toLocaleString()} pts · {formatPercent(tooltip.row.pointsShare)} of era points</span>
            <span>≈ {Math.round(tooltip.row.pointsLost).toLocaleString()} pts lost to engines</span>
          </div>
        )}
      </div>
      <p className="era-panel__note">{summary.rows.length} constructors shown{summary.hidden ? ` · ${summary.hidden} below the start threshold hidden` : ''}</p>
    </figure>
  )
}
