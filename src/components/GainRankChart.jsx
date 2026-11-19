import { useEffect, useId, useRef } from 'react'
import { select } from 'd3'
import { formatRaces, formatSignedPlaces, formatStarts } from '../lib/formatSigned.js'

const ROW = 44
const LABEL = 228
const PLOT = 300
const VALUE = 158
const BAR = 14

function shorten(text, limit = 30) {
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text
}

function valueText(row) {
  return `${formatSignedPlaces(row.medianGain)} · ${formatRaces(row.raceCount)}`
}

function rowText(row, mode) {
  if (mode === 'country') {
    const noun = row.circuitCount > 1 ? 'circuits' : 'circuit'
    return `${row.label} · ${row.circuitCount} ${noun}`
  }
  return row.label
}

export default function GainRankChart({ rows, mode, selectedId, onSelect }) {
  const svgRef = useRef(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const svg = select(svgRef.current)
    const plot = svg.append('g').attr('transform', `translate(${LABEL},8)`)
    const height = rows.length * ROW
    const peak = Math.max(1, ...rows.map((row) => Math.abs(row.medianGain ?? 0)))
    const xOf = (value) => ((value + peak) / (peak * 2)) * PLOT
    svg.attr('width', LABEL + PLOT + VALUE + 12).attr('height', height + 16)

    plot.append('line')
      .attr('class', 'rank-zero')
      .attr('x1', xOf(0))
      .attr('x2', xOf(0))
      .attr('y1', 0)
      .attr('y2', height)
      .attr('aria-hidden', true)

    plot.selectAll('g.rank-row')
      .data(rows, (row) => row.id)
      .join((enter) => {
        const group = enter.append('g').attr('class', 'rank-row')
        if (mode === 'circuit') {
          group.attr('tabindex', 0)
            .attr('role', 'button')
            .on('click', (event, row) => {
              event.stopPropagation()
              onSelect(row)
            })
            .on('keydown', (event, row) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onSelect(row)
              }
            })
        }
        group.append('rect').attr('class', 'rank-hit')
        group.append('rect').attr('class', 'rank-bar')
        group.append('text').attr('class', 'rank-label')
        group.append('text').attr('class', 'rank-value')
        group.append('title')
        return group
      })
      .attr('transform', (_row, index) => `translate(0,${index * ROW})`)
      .classed('is-static', mode !== 'circuit')
      .classed('is-selected', (row) => mode === 'circuit' && row.id === selectedId)
      .attr('aria-pressed', (row) => mode === 'circuit' ? row.id === selectedId : null)
      .attr('aria-label', (row) => {
        const detail = `${rowText(row, mode)}, ${valueText(row)}, ${formatStarts(row.count, true)}, ${row.samePlace} à la place de la grille.`
        if (mode !== 'circuit') return `${detail} Ce classement ne filtre pas la matrice.`
        const action = row.id === selectedId ? 'Retirer ce filtre' : 'Filtrer la matrice'
        return `${detail} ${action}.`
      })

    plot.selectAll('.rank-hit')
      .attr('x', -LABEL)
      .attr('y', 0)
      .attr('width', LABEL + PLOT + VALUE)
      .attr('height', ROW)
    plot.selectAll('.rank-bar')
      .attr('x', (row) => Math.min(xOf(0), xOf(row.medianGain)))
      .attr('y', (ROW - BAR) / 2)
      .attr('width', (row) => Math.abs(xOf(row.medianGain) - xOf(0)))
      .attr('height', BAR)
      .attr('rx', 2)
    plot.selectAll('.rank-label')
      .attr('x', -12)
      .attr('y', ROW / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', 'end')
      .text((row) => shorten(rowText(row, mode)))
    plot.selectAll('.rank-value')
      .attr('x', PLOT + 10)
      .attr('y', ROW / 2)
      .attr('dy', '0.35em')
      .text((row) => valueText(row))
    plot.selectAll('.rank-row title')
      .text((row) => `${rowText(row, mode)} : ${valueText(row)}, ${formatStarts(row.count, true)}`)

    return () => {
      plot.remove()
    }
  }, [rows, mode, selectedId, onSelect])

  const noun = mode === 'country' ? 'pays' : 'circuit'
  return (
    <svg ref={svgRef} role="group" aria-labelledby={titleId} aria-describedby={descriptionId}>
      <title id={titleId}>Classement par {noun}</title>
      <desc id={descriptionId}>
        Chaque ligne est un {noun}. Le chiffre est la médiane de la place de grille moins la place d’arrivée.
        +6 veut dire que le pilote classé typique a fini six places devant sa grille, par exemple parti 10e et classé 4e.
        Partir premier et finir premier donne 0. Le nombre de courses à côté compte les Grands Prix de la ligne.
        Le classement met le plus grand écart en haut. L’espace entre les lignes est constant.
        La couleur de la barre ne varie pas.
      </desc>
    </svg>
  )
}
