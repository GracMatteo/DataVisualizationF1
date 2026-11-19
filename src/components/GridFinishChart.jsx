import { useEffect, useId, useRef } from 'react'
import { range, scaleBand, select } from 'd3'
import { formatSignedPlaces, formatStarts } from '../lib/formatSigned.js'
import { gridHeat, gridHeatText } from '../lib/gridHeat.js'

const CELL = 28
const MARGIN = { top: 32, right: 12, bottom: 16, left: 52 }

export default function GridFinishChart({ model, selectedKeys, onSelect }) {
  const svgRef = useRef(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const svg = select(svgRef.current)
    const plot = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)
    const width = model.maxGrid * CELL
    const height = model.maxPosition * CELL
    svg.attr('width', width + MARGIN.left + MARGIN.right)
      .attr('height', height + MARGIN.top + MARGIN.bottom)

    const x = scaleBand().domain(range(1, model.maxGrid + 1)).range([0, width]).padding(0.12)
    const y = scaleBand().domain(range(1, model.maxPosition + 1)).range([0, height]).padding(0.12)
    const peak = Math.max(...model.cells.map((cell) => cell.count))
    const diagonal = model.cells.length
      ? range(1, Math.min(model.maxGrid, model.maxPosition) + 1)
      : []

    plot.append('g').attr('class', 'grid-axis grid-axis--x').attr('aria-hidden', true)
      .selectAll('text')
      .data(x.domain())
      .join('text')
      .attr('x', (grid) => x(grid) + x.bandwidth() / 2)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .text((grid) => grid)

    plot.append('g').attr('class', 'grid-axis').attr('aria-hidden', true)
      .selectAll('text')
      .data(y.domain())
      .join('text')
      .attr('x', -10)
      .attr('y', (position) => y(position) + y.bandwidth() / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', 'end')
      .text((position) => position)

    plot.append('path')
      .attr('class', 'grid-diagonal')
      .attr('d', diagonal.map((place, index) => {
        const px = x(place) + x.bandwidth() / 2
        const py = y(place) + y.bandwidth() / 2
        return `${index ? 'L' : 'M'}${px},${py}`
      }).join(''))

    plot.selectAll('g.grid-cell')
      .data(model.cells, (cell) => cell.key)
      .join((enter) => {
        const group = enter.append('g')
          .attr('class', 'grid-cell')
          .attr('tabindex', 0)
          .attr('role', 'button')
          .on('click', (event, cell) => {
            event.stopPropagation()
            onSelect(cell.key)
          })
          .on('keydown', (event, cell) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onSelect(cell.key)
            }
          })
        group.append('rect').attr('rx', 3)
        group.append('text').attr('class', 'grid-cell__count').attr('text-anchor', 'middle').attr('dy', '0.35em')
        group.append('title')
        return group
      })
      .attr('transform', (cell) => `translate(${x(cell.grid)},${y(cell.position)})`)
      .classed('is-selected', (cell) => selectedKeys.includes(cell.key))
      .attr('aria-pressed', (cell) => selectedKeys.includes(cell.key))
      .attr('aria-label', (cell) => `Grille P${cell.grid}, arrivée P${cell.position}, ${formatStarts(cell.count)}. ${selectedKeys.includes(cell.key) ? 'Masquer' : 'Afficher'} les courses.`)
      .select('rect')
      .attr('width', x.bandwidth())
      .attr('height', y.bandwidth())
      .style('fill', (cell) => gridHeat(cell.count, peak))

    plot.selectAll('.grid-cell__count')
      .attr('x', x.bandwidth() / 2)
      .attr('y', y.bandwidth() / 2)
      .attr('fill', (cell) => gridHeatText(gridHeat(cell.count, peak)))
      .text((cell) => cell.count)
    plot.selectAll('.grid-cell title')
      .text((cell) => `Parti P${cell.grid}, classé P${cell.position} : ${formatStarts(cell.count, true)}, écart ${formatSignedPlaces(cell.grid - cell.position)}.`)

    return () => {
      plot.remove()
    }
  }, [model, selectedKeys, onSelect])

  return (
    <svg ref={svgRef} role="group" aria-labelledby={titleId} aria-describedby={descriptionId}>
      <title id={titleId}>Arrivée classée selon la grille de départ</title>
      <desc id={descriptionId}>
        Chaque carré compte les départs classés. Les places de grille sont au-dessus des colonnes. L’arrivée se lit vers le bas, avec P1 en haut.
        Le trait pointillé marque les pilotes classés à leur place de départ. Le bleu est un petit nombre de départs, l’orange un grand nombre dans le filtre en cours. Sélectionner un carré ouvre une liste déplaçable. Une deuxième sélection en ouvre une autre.
      </desc>
    </svg>
  )
}
