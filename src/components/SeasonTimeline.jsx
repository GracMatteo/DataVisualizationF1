import { useEffect, useId, useRef, useState } from 'react'
import { axisBottom, axisLeft, line, scaleLinear, select } from 'd3'
import { getTeamColor } from '../lib/teamColors.js'
import { CHAMPION_COLOR, FAILURE_COLOR, formatPoints } from '../lib/reliabilityPresentation.js'
import { POSITION_COLORS } from '../lib/racePresentation.js'

const HEIGHT = 320
const MARGIN = { top: 20, right: 150, bottom: 40, left: 52 }

export default function SeasonTimeline({ timeline }) {
  const containerRef = useRef(null)
  const svgRef = useRef(null)
  const [width, setWidth] = useState(800)
  const [tooltip, setTooltip] = useState(null)
  const titleId = useId()
  const { row, rival, rounds } = timeline
  const teamColor = getTeamColor(row.constructorRef)
  const rivalColor = row.isChampion ? POSITION_COLORS.points : CHAMPION_COLOR

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(320, entry.contentRect.width)))
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const svg = select(svgRef.current).attr('viewBox', `0 0 ${width} ${HEIGHT}`)
    const scene = svg.append('g')
    const container = containerRef.current
    const right = width - (width < 520 ? 24 : MARGIN.right)
    const x = scaleLinear().domain([0, rounds.length]).range([MARGIN.left, right])
    const maxPoints = Math.max(1, timeline.whatIfPoints, timeline.rivalPoints, timeline.teamPoints)
    const y = scaleLinear().domain([0, maxPoints]).range([HEIGHT - MARGIN.bottom, MARGIN.top]).nice()
    // Every line starts at 0 points before round 1.
    const points = (key) => [[0, 0], ...rounds.map((round, index) => [index + 1, round[key]])]
    const path = line().x(([index]) => x(index)).y(([, value]) => y(value))

    scene.append('g').attr('class', 'scatter-grid').attr('aria-hidden', true)
      .attr('transform', `translate(${MARGIN.left},0)`)
      .call(axisLeft(y).ticks(5).tickSize(-(right - MARGIN.left)).tickFormat(''))
    scene.append('g').attr('class', 'scatter-axis').attr('aria-hidden', true)
      .attr('transform', `translate(0,${HEIGHT - MARGIN.bottom})`)
      .call(axisBottom(x).ticks(Math.min(rounds.length, Math.floor(width / 50))).tickFormat((value) => value ? `R${value}` : ''))
    scene.append('g').attr('class', 'scatter-axis').attr('aria-hidden', true)
      .attr('transform', `translate(${MARGIN.left},0)`)
      .call(axisLeft(y).ticks(5))
    scene.append('text').attr('class', 'scatter-axis-label').attr('aria-hidden', true)
      .attr('x', MARGIN.left).attr('y', 10).text('cumulative race points')

    const series = [
      { key: 'cumulativeWhatIf', label: 'Without engine failures', color: teamColor, className: 'timeline-line is-what-if', show: row.failures > 0 },
      { key: 'cumulativeRival', label: rival ? `${rival.name}${row.isChampion ? ' (2nd)' : ' (champion)'}` : '', color: rivalColor, className: 'timeline-line', show: Boolean(rival) },
      { key: 'cumulativeTeam', label: row.name, color: teamColor, className: 'timeline-line is-team', show: true },
    ].filter((item) => item.show)

    scene.append('g').selectAll('path').data(series).join('path')
      .attr('class', (item) => item.className).attr('stroke', (item) => item.color)
      .attr('d', (item) => path(points(item.key)))

    // Direct end labels, nudged apart so close finishes stay readable.
    if (width >= 520) {
      const labels = series.map((item) => ({ ...item, y: y(rounds.at(-1)?.[item.key] ?? 0) })).sort((a, b) => a.y - b.y)
      for (let index = 1; index < labels.length; index += 1) labels[index].y = Math.max(labels[index].y, labels[index - 1].y + 14)
      scene.append('g').attr('class', 'timeline-end-labels').selectAll('text').data(labels).join('text')
        .attr('x', right + 8).attr('y', (item) => item.y).attr('dy', '0.35em')
        .text((item) => `${item.label.length > 20 ? `${item.label.slice(0, 19)}…` : item.label} ${formatPoints(rounds.at(-1)?.[item.key] ?? 0)}`)
    }

    const failures = rounds.map((round, index) => ({ ...round, index: index + 1 })).filter((round) => round.failures.length)
    scene.append('g').attr('class', 'timeline-failures').attr('aria-hidden', true)
      .selectAll('text').data(failures).join('text')
      .attr('x', (round) => x(round.index)).attr('y', (round) => y(round.cumulativeTeam)).attr('dy', '0.35em')
      .attr('text-anchor', 'middle').attr('fill', FAILURE_COLOR)
      .text((round) => round.failures.length > 1 ? '✕✕' : '✕')

    const step = x(1) - x(0)
    scene.append('g').selectAll('rect').data(rounds).join('rect')
      .attr('class', 'timeline-hit')
      .attr('x', (round, index) => x(index + 1) - step / 2).attr('width', step)
      .attr('y', MARGIN.top).attr('height', HEIGHT - MARGIN.top - MARGIN.bottom)
      .on('mouseenter', (event, round) => {
        const index = rounds.indexOf(round) + 1
        const bounds = container.getBoundingClientRect()
        const svgBounds = svgRef.current.getBoundingClientRect()
        const scale = svgBounds.width / width
        const left = x(index) * scale + (svgBounds.left - bounds.left)
        setTooltip({ round, index, x: Math.max(4, Math.min(left + 12, bounds.width - 244)) })
        scene.select('.timeline-crosshair').attr('x1', x(index)).attr('x2', x(index)).attr('opacity', 1)
      })
      .on('mouseleave', () => {
        setTooltip(null)
        scene.select('.timeline-crosshair').attr('opacity', 0)
      })
    scene.append('line').attr('class', 'timeline-crosshair').attr('aria-hidden', true)
      .attr('y1', MARGIN.top).attr('y2', HEIGHT - MARGIN.bottom).attr('opacity', 0)
      .lower()

    return () => {
      scene.remove()
      setTooltip(null)
    }
  }, [timeline, rounds, row, rival, width, teamColor, rivalColor])

  return (
    <div className="timeline" ref={containerRef}>
      <svg ref={svgRef} role="img" aria-labelledby={titleId}>
        <title id={titleId}>{row.name} {row.year}: cumulative race points by round{rival ? ` against ${rival.name}` : ''}, with engine failures marked and a line without those failures.</title>
      </svg>
      {tooltip && (
        <div className="scatter-tooltip timeline-tooltip" role="tooltip" style={{ left: tooltip.x, top: 8 }}>
          <strong>R{tooltip.index} · {tooltip.round.raceName}</strong>
          <span>{row.name}: {formatPoints(tooltip.round.cumulativeTeam)} pts (+{formatPoints(tooltip.round.team)})</span>
          {rival && <span>{rival.name}: {formatPoints(tooltip.round.cumulativeRival)} pts (+{formatPoints(tooltip.round.rival)})</span>}
          {row.failures > 0 && <span>Without failures: {formatPoints(tooltip.round.cumulativeWhatIf)} pts</span>}
          {tooltip.round.failures.map((failure) => <span key={failure.resultId} className="timeline-tooltip__failure">✕ {failure.driver} · {failure.status} · ≈ {formatPoints(tooltip.round.lost / tooltip.round.failures.length)} pts</span>)}
        </div>
      )}
    </div>
  )
}
