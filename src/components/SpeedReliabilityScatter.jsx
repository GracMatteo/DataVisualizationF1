import { useEffect, useId, useRef, useState } from 'react'
import { axisBottom, axisLeft, scaleLinear, scaleSqrt, select } from 'd3'
import { getQuadrant } from '../lib/engineReliability.js'
import { QUADRANTS, formatPercent, getRankGroup, shortYear } from '../lib/reliabilityPresentation.js'

const HEIGHT = 440
const MARGIN = { top: 28, right: 24, bottom: 52, left: 56 }

export default function SpeedReliabilityScatter({ rows, splits, xMax, yMax, winsMax, labelChampions, linkedIds, teamColors, highlightedId, selectedId, onHover, onSelect }) {
  const containerRef = useRef(null)
  const svgRef = useRef(null)
  const [width, setWidth] = useState(800)
  const [tooltip, setTooltip] = useState(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(300, entry.contentRect.width)))
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const svg = select(svgRef.current).attr('viewBox', `0 0 ${width} ${HEIGHT}`)
    const scene = svg.append('g')
    const container = containerRef.current
    const x = scaleLinear().domain([1, xMax]).range([MARGIN.left, width - MARGIN.right]).nice()
    const y = scaleLinear().domain([0, yMax]).range([HEIGHT - MARGIN.bottom, MARGIN.top]).nice()
    const radius = scaleSqrt().domain([0, Math.max(1, winsMax)]).range([5, 18])
    const [left, right] = x.range()
    const [bottom, top] = y.range()

    if (splits) {
      const splitX = x(Math.min(splits.grid, x.domain()[1]))
      const splitY = y(Math.min(splits.failureRate, y.domain()[1]))
      // The fast-and-fragile quadrant is the story's focus; a faint wash makes it findable.
      scene.append('rect').attr('class', 'quadrant-wash').attr('aria-hidden', true)
        .attr('x', left).attr('y', top).attr('width', splitX - left).attr('height', splitY - top)
      scene.append('g').attr('class', 'quadrant-lines').attr('aria-hidden', true).call((group) => {
        group.append('line').attr('x1', splitX).attr('x2', splitX).attr('y1', top).attr('y2', bottom)
        group.append('line').attr('x1', left).attr('x2', right).attr('y1', splitY).attr('y2', splitY)
      })
      const corners = [
        ['fastFragile', left + 8, top + 14, 'start'], ['slowFragile', right - 8, top + 14, 'end'],
        ['fastReliable', left + 8, bottom - 10, 'start'], ['slowReliable', right - 8, bottom - 10, 'end'],
      ]
      scene.append('g').attr('class', 'quadrant-labels').attr('aria-hidden', true)
        .selectAll('text').data(corners).join('text')
        .attr('x', (item) => item[1]).attr('y', (item) => item[2]).attr('text-anchor', (item) => item[3])
        .classed('is-focus', (item) => item[0] === 'fastFragile')
        .text((item) => QUADRANTS[item[0]].label)
    }

    scene.append('g').attr('class', 'scatter-axis').attr('aria-hidden', true)
      .attr('transform', `translate(0,${bottom})`)
      .call(axisBottom(x).ticks(Math.min(10, Math.floor(width / 70))).tickFormat((value) => `P${value}`))
    scene.append('g').attr('class', 'scatter-axis').attr('aria-hidden', true)
      .attr('transform', `translate(${left},0)`)
      .call(axisLeft(y).ticks(6).tickFormat((value) => formatPercent(value, 0)))
    scene.append('text').attr('class', 'scatter-axis-label').attr('aria-hidden', true)
      .attr('x', (left + right) / 2).attr('y', HEIGHT - 10).attr('text-anchor', 'middle')
      .text('← faster   ·   average starting position   ·   slower →')
    scene.append('text').attr('class', 'scatter-axis-label').attr('aria-hidden', true)
      .attr('transform', `translate(14,${(top + bottom) / 2}) rotate(-90)`).attr('text-anchor', 'middle')
      .text('engine failures per start ↑')

    function showTooltip(event, row) {
      const bounds = container.getBoundingClientRect()
      const target = event.currentTarget.getBoundingClientRect()
      const centerX = target.left - bounds.left + target.width / 2
      setTooltip({ row, x: Math.max(4, Math.min(centerX + 14, bounds.width - 244)), y: Math.max(130, target.top - bounds.top) })
      onHover(row.constructorId)
    }

    function hideTooltip() {
      setTooltip(null)
      onHover(null)
    }

    const dots = scene.append('g')
      .selectAll('g')
      .data([...rows].sort((a, b) => b.wins - a.wins), (row) => row.id)
      .join('g')
      .attr('class', 'scatter-dot')
      .attr('transform', (row) => `translate(${x(row.avgGrid)},${y(row.failureRate)})`)
      .attr('tabindex', 0)
      .attr('role', 'button')
      .attr('aria-label', (row) => `${row.name} ${row.year}: average grid P${row.avgGrid.toFixed(1)}, ${formatPercent(row.failureRate)} engine failures, ${row.finalPosition ? `finished P${row.finalPosition}` : 'final position not recorded'}, ${row.wins} wins. Mark this season in both views.`)
      .on('mouseenter focus', showTooltip)
      .on('mouseleave blur', hideTooltip)
      .on('click', (event, row) => onSelect(row.id))
      .on('keydown', (event, row) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect(row.id)
        }
        if (event.key === 'Escape') hideTooltip()
      })
    dots.append('circle').attr('class', 'scatter-hit').attr('r', (row) => Math.max(11, radius(row.wins) + 3))
    dots.append('circle').attr('class', 'scatter-ring').attr('r', (row) => radius(row.wins) + 4)
    dots.append('circle').attr('class', 'scatter-mark')
      .attr('r', (row) => radius(row.wins))
      .attr('fill', (row) => teamColors?.get(row.constructorId) ?? getRankGroup(row).color)
      .classed('is-champion', (row) => teamColors != null && row.isChampion)
    dots.append('text').attr('class', 'scatter-label')
      .attr('x', (row) => radius(row.wins) + 5).attr('dy', '0.35em')
      .classed('is-default', (row) => labelChampions && row.isChampion)
      .text((row) => `${row.name} ${shortYear(row.year)}`)

    return () => {
      scene.remove()
      setTooltip(null)
    }
  }, [rows, splits, xMax, yMax, winsMax, labelChampions, teamColors, width, onHover, onSelect])

  // Linked highlight: hovering a constructor anywhere lights up all its seasons here.
  useEffect(() => {
    select(svgRef.current).selectAll('.scatter-dot')
      .classed('is-dimmed', (row) => highlightedId != null && row.constructorId !== highlightedId)
      .classed('is-active', (row) => row.constructorId === highlightedId || row.id === selectedId)
      .classed('is-selected', (row) => row.id === selectedId)
      .classed('is-linked', (row) => linkedIds?.has(row.id) ?? false)
      .filter((row) => row.constructorId === highlightedId || row.id === selectedId || (linkedIds?.has(row.id) ?? false))
      .raise()
  }, [highlightedId, selectedId, linkedIds, rows, width, labelChampions, teamColors])

  const row = tooltip?.row
  return (
    <div className="scatter-plot" ref={containerRef}>
      <svg ref={svgRef} role="group" aria-labelledby={titleId} aria-describedby={descriptionId}>
        <title id={titleId}>Speed against engine reliability, one dot per constructor-season</title>
        <desc id={descriptionId}>Horizontal position is the average starting position, faster to the left. Vertical position is the share of starts that ended with an engine failure. Color is the final constructors’ championship rank and dot area grows with race wins. Dashed lines split the plot at the median starting position and the average failure rate.</desc>
      </svg>
      {row && (
        <div className="scatter-tooltip" role="tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          <strong>{row.name} · {row.year}</strong>
          <span>{QUADRANTS[getQuadrant(row, splits)]?.label}</span>
          <span>Average grid P{row.avgGrid.toFixed(1)}</span>
          <span>{row.failures} engine failures / {row.starts} starts · {formatPercent(row.failureRate)}</span>
          <span>{row.finalPosition ? `Championship P${row.finalPosition}` : 'Final position not recorded'} · {row.wins} wins</span>
          <small>Select to mark this season in both views</small>
        </div>
      )}
    </div>
  )
}
