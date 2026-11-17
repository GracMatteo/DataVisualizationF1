import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { scaleLinear, select } from 'd3'
import { ERAS } from '../lib/engineReliability.js'
import { CHAMPION_COLOR, FAILURE_COLOR } from '../lib/reliabilityPresentation.js'

const LABEL_WIDTH = 128
const ERA_GAP = 10
const ROW_HEIGHT = 26
// Room for the era brackets and full, rotated season labels.
const HEADER = 78
const MIN_CELL = 22

/** Constructor × season grid; each cell counts engine failures and the champion gets a gold outline. */
export default function FailureHeatmap({ rows, constructors, eraId, highlightedId, selectedId, onHover, onSelect }) {
  const containerRef = useRef(null)
  const svgRef = useRef(null)
  const [width, setWidth] = useState(900)
  const titleId = useId()
  const years = useMemo(() => ERAS.flatMap((era) => Array.from({ length: era.toYear - era.fromYear + 1 }, (_, index) => era.fromYear + index)), [])
  const byId = useMemo(() => new Map(rows.map((row) => [row.id, row])), [rows])
  const maxFailures = useMemo(() => Math.max(1, ...rows.map((row) => row.failures)), [rows])

  const gaps = ERA_GAP * (ERAS.length - 1)
  const cell = Math.max(MIN_CELL, (width - LABEL_WIDTH - gaps) / years.length)
  const svgWidth = LABEL_WIDTH + gaps + cell * years.length
  const height = HEADER + constructors.length * ROW_HEIGHT + 4

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(320, entry.contentRect.width)))
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const svg = select(svgRef.current).attr('viewBox', `0 0 ${svgWidth} ${height}`).attr('width', svgWidth).attr('height', height)
    const scene = svg.append('g')
    const opacity = scaleLinear().domain([1, maxFailures]).range([0.22, 1]).clamp(true)
    const columnX = (year) => {
      const eraIndex = ERAS.findIndex((era) => year <= era.toYear)
      return LABEL_WIDTH + eraIndex * ERA_GAP + years.indexOf(year) * cell
    }

    const eras = scene.append('g').attr('class', 'heatmap-eras').attr('aria-hidden', true)
      .selectAll('g').data(ERAS).join('g')
      .classed('is-active', (era) => era.id === eraId)
    eras.append('text')
      .attr('x', (era) => columnX(era.fromYear) + 1).attr('y', 12)
      .text((era) => `${era.label} · ${era.fromYear}–${era.toYear}`)
    eras.append('line')
      .attr('x1', (era) => columnX(era.fromYear) + 1).attr('x2', (era) => columnX(era.toYear) + cell - 1)
      .attr('y1', 20).attr('y2', 20)
    scene.append('text').attr('class', 'heatmap-axis-title').attr('aria-hidden', true)
      .attr('x', LABEL_WIDTH - 10).attr('y', HEADER - 8).attr('text-anchor', 'end')
      .text('Season →')
    // Full four-digit years; rotated when a column is too narrow to fit them flat.
    const rotate = cell < 40
    scene.append('g').attr('class', 'heatmap-years').attr('aria-hidden', true)
      .selectAll('text').data(years).join('text')
      .attr('transform', (year) => `translate(${columnX(year) + cell / 2},${HEADER - 8})${rotate ? ' rotate(-55)' : ''}`)
      .attr('text-anchor', rotate ? 'start' : 'middle')
      .attr('dy', rotate ? '0.35em' : 0)
      .text((year) => year)

    const rowGroups = scene.append('g').selectAll('g')
      .data(constructors, (constructor) => constructor.constructorId)
      .join('g')
      .attr('class', 'heatmap-row')
      .attr('data-constructor', (constructor) => constructor.constructorId)
      .attr('transform', (constructor, index) => `translate(0,${HEADER + index * ROW_HEIGHT})`)
      .on('mouseenter', (event, constructor) => onHover(constructor.constructorId))
      .on('mouseleave', () => onHover(null))

    rowGroups.append('text').attr('class', 'heatmap-name')
      .attr('x', LABEL_WIDTH - 10).attr('y', ROW_HEIGHT / 2).attr('dy', '0.35em').attr('text-anchor', 'end')
      .text((constructor) => constructor.name.length > 17 ? `${constructor.name.slice(0, 16)}…` : constructor.name)

    const cells = rowGroups.selectAll('g.heatmap-cell')
      .data((constructor) => years.map((year) => byId.get(`${constructor.constructorId}:${year}`)).filter(Boolean), (row) => row.id)
      .join('g')
      .attr('class', 'heatmap-cell')
      .classed('is-outside', (row) => eraId !== 'all' && row.eraId !== eraId)
      .attr('transform', (row) => `translate(${columnX(row.year)},0)`)
      .on('click', (event, row) => onSelect(row.id))
    cells.append('rect').attr('class', 'heatmap-base').attr('x', 1).attr('y', 1)
      .attr('width', cell - 2).attr('height', ROW_HEIGHT - 2).attr('rx', 2)
    cells.append('rect').attr('class', 'heatmap-fill').attr('x', 1).attr('y', 1)
      .attr('width', cell - 2).attr('height', ROW_HEIGHT - 2).attr('rx', 2)
      .attr('fill', FAILURE_COLOR).attr('fill-opacity', (row) => row.failures ? opacity(row.failures) : 0)
    cells.filter((row) => row.isChampion).append('rect').attr('class', 'heatmap-champion')
      .attr('x', 2).attr('y', 2).attr('width', cell - 4).attr('height', ROW_HEIGHT - 4).attr('rx', 2)
      .attr('stroke', CHAMPION_COLOR)
    cells.append('rect').attr('class', 'heatmap-selection').attr('x', 0).attr('y', 0)
      .attr('width', cell).attr('height', ROW_HEIGHT).attr('rx', 3)
    cells.append('text').attr('class', 'heatmap-count')
      .attr('x', cell / 2).attr('y', ROW_HEIGHT / 2).attr('dy', '0.35em').attr('text-anchor', 'middle')
      .classed('is-strong', (row) => row.failures && opacity(row.failures) > 0.6)
      .text((row) => row.failures || '')
    cells.append('title').text((row) => `${row.name} ${row.year}: ${row.failures} engine failures in ${row.starts} starts${row.finalPosition ? ` · championship P${row.finalPosition}` : ''}${row.isChampion ? ' (champion)' : ''}`)

    return () => scene.remove()
  }, [constructors, years, byId, maxFailures, cell, svgWidth, height, eraId, onHover, onSelect])

  useEffect(() => {
    const svg = select(svgRef.current)
    svg.selectAll('.heatmap-row')
      .classed('is-dimmed', (constructor) => highlightedId != null && constructor.constructorId !== highlightedId)
    svg.selectAll('.heatmap-cell').classed('is-selected', (row) => row.id === selectedId)
  }, [highlightedId, selectedId, constructors, cell, eraId])

  return (
    <div className="heatmap" ref={containerRef}>
      <div className="heatmap__scroll">
        <svg ref={svgRef} role="img" aria-labelledby={titleId}>
          <title id={titleId}>Engine failures per constructor and season, 2000 to 2025. Champions are outlined in gold.</title>
        </svg>
      </div>
    </div>
  )
}
