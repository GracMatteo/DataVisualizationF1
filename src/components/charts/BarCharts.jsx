import { max, scaleBand, scaleLinear } from 'd3'
import { useTipHandlers, useWidth, TipRows, Legend } from '../ui.jsx'
import { series } from '../../lib/colors.js'
import { fmtCompact } from '../../lib/format.js'
import { AxisBottom, GridLeft, M, hBarPath, vBarPath } from './common.jsx'

const ROW = 26
const BAR = 14

// Ranked horizontal bars: label | bar | value at the tip.
export function HBarChart({ data, unit = '', onSelect, selectedId, color = series(1), labelWidth = 150, format = String }) {
  const [ref, width] = useWidth()
  const tip = useTipHandlers()
  const height = data.length * ROW
  const valueRoom = 52
  const x = scaleLinear([0, max(data, (d) => d.value) || 1], [0, Math.max(40, width - labelWidth - valueRoom)])
  const hasSelection = selectedId != null && data.some((d) => d.id === selectedId)

  return (
    <div ref={ref} className="chart">
      <svg width={width} height={height} role="img" aria-label={`Classement ${unit}`}>
        {data.map((d, i) => {
          const y = i * ROW
          const dim = hasSelection && d.id !== selectedId
          return (
            <g
              key={d.id}
              className={`bar-row ${dim ? 'is-dim' : ''}`}
              {...tip(<TipRows title={d.label} rows={[{ value: format(d.value), label: unit }, ...(d.extra ?? [])]} />, onSelect && (() => onSelect(d.id)))}
            >
              <rect x={0} y={y} width={width} height={ROW} className="hit" />
              <text x={labelWidth - 10} y={y + ROW / 2} dy="0.32em" textAnchor="end" className="bar-label">
                {truncate(d.label, labelWidth / 7)}
              </text>
              <path d={hBarPath(labelWidth, y + (ROW - BAR) / 2, x(d.value), BAR)} style={{ fill: d.color ?? color }} className="bar" />
              <text x={labelWidth + x(d.value) + 6} y={y + ROW / 2} dy="0.32em" className="bar-value">
                {format(d.value)}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// Grouped vertical columns. groups: [{ id, label }]; keys: [{ key, label, color }]; value(group, key)
export function GroupedBarChart({ groups, keys, value, height = 260, onSelect, selectedId }) {
  const [ref, width] = useWidth()
  const tip = useTipHandlers()
  const m = { ...M, bottom: 44 }
  const x0 = scaleBand(groups.map((g) => g.id), [m.left, width - m.right]).paddingInner(0.25).paddingOuter(0.1)
  const inner = Math.min(x0.bandwidth(), keys.length * 26)
  const x1 = scaleBand(keys.map((k) => k.key), [0, inner]).paddingInner(0.12)
  const barW = Math.min(x1.bandwidth(), 24)
  const yMax = max(groups, (g) => max(keys, (k) => value(g, k.key))) || 1
  const y = scaleLinear([0, yMax], [height - m.bottom, m.top]).nice()
  const labelOf = new Map(groups.map((g) => [g.id, g.label]))

  return (
    <div ref={ref} className="chart">
      <Legend items={keys} />
      <svg width={width} height={height}>
        <GridLeft scale={y} x1={m.left} x2={width - m.right} format={fmtCompact} />
        {groups.map((g) => {
          const gx = x0(g.id) + (x0.bandwidth() - inner) / 2
          const dim = selectedId != null && g.id !== selectedId
          return (
            <g key={g.id} className={dim ? 'is-dim' : ''}>
              {keys.map((k) => {
                const v = value(g, k.key)
                const bx = gx + x1(k.key) + (x1.bandwidth() - barW) / 2
                return (
                  <g key={k.key} {...tip(<TipRows title={g.label} rows={[{ value: v, label: k.label, color: k.color }]} />, onSelect && (() => onSelect(g.id)))}>
                    <rect x={bx - 3} y={m.top} width={barW + 6} height={height - m.bottom - m.top} className="hit" />
                    <path d={vBarPath(bx, y(v), barW, y(0) - y(v))} style={{ fill: k.color }} className="bar" />
                  </g>
                )
              })}
            </g>
          )
        })}
        <AxisBottom scale={x0} y={height - m.bottom} width={width} format={(id) => truncate(labelOf.get(id), Math.max(6, x0.bandwidth() / 6.5))} />
      </svg>
    </div>
  )
}

// Horizontal stacked bars, segments separated by a 2px surface gap.
// rows: [{ id, label, segments: [{ value, color, tip }] }]
export function StackedHBarChart({ rows, unit = '', format = String, labelWidth = 130 }) {
  const [ref, width] = useWidth()
  const tip = useTipHandlers()
  const totals = rows.map((r) => r.segments.reduce((s, x) => s + x.value, 0))
  const x = scaleLinear([0, max(totals) || 1], [0, Math.max(40, width - labelWidth - 60)])
  return (
    <div ref={ref} className="chart">
      <svg width={width} height={rows.length * ROW}>
        {rows.map((r, i) => {
          const y = i * ROW + (ROW - BAR) / 2
          let acc = 0
          return (
            <g key={r.id}>
              <text x={labelWidth - 10} y={i * ROW + ROW / 2} dy="0.32em" textAnchor="end" className="bar-label">
                {truncate(r.label, labelWidth / 7)}
              </text>
              {r.segments.map((s, j) => {
                const x0 = labelWidth + x(acc)
                acc += s.value
                const w = Math.max(1, x(s.value) - (j < r.segments.length - 1 ? 2 : 0))
                const last = j === r.segments.length - 1
                return (
                  <g key={j} {...tip(s.tip)}>
                    <rect x={x0} y={i * ROW} width={x(s.value)} height={ROW} className="hit" />
                    {last ? (
                      <path d={hBarPath(x0, y, w, BAR)} style={{ fill: s.color }} className="bar" />
                    ) : (
                      <rect x={x0} y={y} width={w} height={BAR} style={{ fill: s.color }} className="bar" />
                    )}
                  </g>
                )
              })}
              <text x={labelWidth + x(totals[i]) + 6} y={i * ROW + ROW / 2} dy="0.32em" className="bar-value">
                {format(totals[i])} {unit}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export function truncate(s, n) {
  s = String(s ?? '')
  n = Math.floor(n)
  return s.length > n ? s.slice(0, Math.max(1, n - 1)) + '…' : s
}
