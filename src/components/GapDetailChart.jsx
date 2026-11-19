import { useEffect, useId, useRef } from 'react'
import { select } from 'd3'
import { formatSignedPlaces, formatStarts } from '../lib/formatSigned.js'

const ROW = 32
const LABEL = 64
const PLOT = 220
const BAR = 12

export default function GapDetailChart({ gaps }) {
  const svgRef = useRef(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const svg = select(svgRef.current)
    const plot = svg.append('g').attr('transform', `translate(${LABEL},8)`)
    const height = gaps.length * ROW
    const peak = Math.max(1, ...gaps.map((gap) => gap.count))
    const widthOf = (count) => (count / peak) * PLOT
    svg.attr('height', height + 16)

    plot.selectAll('g.gap-row')
      .data(gaps, (gap) => gap.gap)
      .join((enter) => {
        const group = enter.append('g').attr('class', 'gap-row')
        group.append('rect').attr('class', 'gap-bar')
        group.append('text').attr('class', 'gap-label')
        group.append('text').attr('class', 'gap-value')
        group.append('title')
        return group
      })
      .attr('transform', (_gap, index) => `translate(0,${index * ROW})`)

    plot.selectAll('.gap-bar')
      .attr('x', 0)
      .attr('y', (ROW - BAR) / 2)
      .attr('width', (gap) => widthOf(gap.count))
      .attr('height', BAR)
      .attr('rx', 2)
    plot.selectAll('.gap-label')
      .attr('x', -12)
      .attr('y', ROW / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', 'end')
      .text((gap) => formatSignedPlaces(gap.gap))
    plot.selectAll('.gap-value')
      .attr('x', (gap) => widthOf(gap.count) + 8)
      .attr('y', ROW / 2)
      .attr('dy', '0.35em')
      .text((gap) => formatStarts(gap.count, true))
    plot.selectAll('.gap-row title')
      .text((gap) => `Écart ${formatSignedPlaces(gap.gap)}, ${formatStarts(gap.count, true)}`)

    let right = PLOT
    plot.selectAll('.gap-value').each(function () {
      const box = this.getBBox()
      right = Math.max(right, box.x + box.width)
    })
    svg.attr('width', LABEL + right + 16)

    return () => {
      plot.remove()
    }
  }, [gaps])

  return (
    <svg ref={svgRef} role="group" aria-labelledby={titleId} aria-describedby={descriptionId}>
      <title id={titleId}>Détail des écarts</title>
      <desc id={descriptionId}>
        Chaque ligne est un écart exact : place de grille moins place d’arrivée.
        La longueur de la barre est le nombre de départs classés qui ont cet écart.
        Le plus grand gain est en haut. 0 veut dire classé à la place de la grille.
        Cette liste ne nomme pas les pilotes. La couleur ne change pas.
      </desc>
    </svg>
  )
}
