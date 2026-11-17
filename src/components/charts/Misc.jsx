import { arc, extent, max, min, pie, scaleLinear, interpolateRgb } from 'd3'
import { useTipHandlers, useWidth, TipRows, Legend } from '../ui.jsx'
import { fmtPct } from '../../lib/format.js'
import { AxisBottom, M } from './common.jsx'
import { truncate } from './BarCharts.jsx'

// Part-to-whole: <= 6 segments, separated by a surface gap; legend carries values.
export function DonutChart({ data, centerLabel = 'total' }) {
  const tip = useTipHandlers()
  const total = data.reduce((s, d) => s + d.value, 0)
  if (!total) return <p className="empty">Aucune donnée disponible.</p>
  const size = 180
  const arcs = pie()
    .value((d) => d.value)
    .sort(null)
    .padAngle(0.012)(data.filter((d) => d.value > 0))
  const a = arc().innerRadius(size / 2 - 26).outerRadius(size / 2).cornerRadius(2)
  return (
    <div className="donut">
      <svg width={size} height={size} viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`}>
        {arcs.map((d) => (
          <path
            key={d.data.key}
            d={a(d)}
            style={{ fill: d.data.color }}
            className="bar"
            {...tip(<TipRows title={d.data.label} rows={[{ value: d.data.value, label: fmtPct(d.data.value / total) }]} />)}
          />
        ))}
        <text className="donut__total" textAnchor="middle" dy="0.1em">{total}</text>
        <text className="donut__caption" textAnchor="middle" dy="1.6em">{centerLabel}</text>
      </svg>
      <ul className="donut__legend">
        {data.map((d) => (
          <li key={d.key}>
            <span className="legend__key legend__key--rect" style={{ background: d.color }} />
            <span className="donut__label">{d.label}</span>
            <strong>{d.value}</strong>
            <span className="muted">{fmtPct(d.value / total)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// Sequential (one hue, light -> dark) heatmap with a scale legend. Scrolls horizontally.
export function Heatmap({ rows, cols, value, onCell, rowLabelWidth = 120, unit = 'victoires' }) {
  const tip = useTipHandlers()
  const cell = 22
  const colLabel = 110
  const width = rowLabelWidth + cols.length * cell + 8
  const height = colLabel + rows.length * cell
  const vmax = max(rows, (r) => max(cols, (c) => value(r, c))) || 1
  const color = interpolateRgb('#cde2fb', '#0d366b')
  return (
    <>
      <div className="heat-legend">
        <span>1</span>
        <span className="heat-legend__ramp" />
        <span>{vmax} {unit}</span>
        <span className="muted"> · case vide = aucune victoire</span>
      </div>
      <div className="scroll-x">
        <svg width={width} height={height}>
          {cols.map((c, j) => (
            <text key={c.id} className="axis-text" transform={`translate(${rowLabelWidth + j * cell + cell / 2 + 4},${colLabel - 6}) rotate(-60)`}>
              {truncate(c.label, 16)}
            </text>
          ))}
          {rows.map((r, i) => (
            <g key={r.id} transform={`translate(0,${colLabel + i * cell})`}>
              <text x={rowLabelWidth - 8} y={cell / 2} dy="0.32em" textAnchor="end" className="axis-text">
                {truncate(r.label, 18)}
              </text>
              {cols.map((c, j) => {
                const v = value(r, c)
                return (
                  <rect
                    key={c.id}
                    x={rowLabelWidth + j * cell + 1}
                    y={1}
                    width={cell - 2}
                    height={cell - 2}
                    rx={3}
                    className={v ? 'heat-cell' : 'heat-cell heat-cell--empty'}
                    style={v ? { fill: color(Math.sqrt(v / vmax)) } : undefined}
                    {...tip(<TipRows title={`${r.label} · ${c.label}`} rows={[{ value: v, label: unit }]} />, onCell && (() => onCell(r, c)))}
                  />
                )
              })}
            </g>
          ))}
        </svg>
      </div>
    </>
  )
}

// Race history on a year axis — one dot per Grand Prix.
// items: [{ id, x (year), tip, highlight }]
export function Timeline({ items, onSelect, domain }) {
  const [ref, width] = useWidth()
  const tip = useTipHandlers()
  const height = 64
  const x = scaleLinear(domain ?? extent(items, (d) => d.x), [M.left / 2, width - M.right]).nice()
  return (
    <div ref={ref} className="chart">
      <svg width={width} height={height}>
        <line x1={x.range()[0]} x2={x.range()[1]} y1={24} y2={24} className="axis__base" />
        {items.map((d) => (
          <g key={d.id} {...tip(d.tip, onSelect && (() => onSelect(d.id)))}>
            <circle cx={x(d.x)} cy={24} r={11} className="hit" />
            <circle cx={x(d.x)} cy={24} r={5} className={`dot ${d.highlight ? 'dot--accent' : 'dot--base'}`} />
          </g>
        ))}
        <AxisBottom scale={x} y={height - 24} width={width} />
      </svg>
    </div>
  )
}

// Grid vs. finish: one row per driver, connector + two markers.
// rows: [{ id, label, from, to, tip }]
export function DumbbellChart({ rows, fromLabel = 'Grille', toLabel = 'Arrivée' }) {
  const [ref, width] = useWidth()
  const tip = useTipHandlers()
  const row = 20
  const m = { top: 4, right: 16, bottom: 26, left: 130 }
  const valid = rows.filter((r) => r.from != null || r.to != null)
  const hi = max(valid, (r) => Math.max(r.from ?? 0, r.to ?? 0)) || 1
  const x = scaleLinear([1, hi], [m.left, width - m.right])
  const height = m.top + valid.length * row + m.bottom
  return (
    <div ref={ref} className="chart">
      <Legend
        items={[
          { label: fromLabel, color: 'var(--neutral-2)' },
          { label: toLabel, color: 'var(--series-1)' },
        ]}
        shape="dot"
      />
      <svg width={width} height={height}>
        {x.ticks(10).filter(Number.isInteger).map((t) => (
          <line key={t} x1={x(t)} x2={x(t)} y1={m.top} y2={height - m.bottom} className="axis__grid" />
        ))}
        {valid.map((r, i) => {
          const cy = m.top + i * row + row / 2
          return (
            <g key={r.id} {...tip(r.tip)}>
              <rect x={0} y={cy - row / 2} width={width} height={row} className="hit" />
              <text x={m.left - 10} y={cy} dy="0.32em" textAnchor="end" className="bar-label">
                {truncate(r.label, 18)}
              </text>
              {r.from != null && r.to != null && <line x1={x(r.from)} x2={x(r.to)} y1={cy} y2={cy} className="dumbbell__bar" />}
              {r.from != null && <circle cx={x(r.from)} cy={cy} r={4.5} className="dot" style={{ fill: 'var(--neutral-2)' }} />}
              {r.to != null && <circle cx={x(r.to)} cy={cy} r={4.5} className="dot" style={{ fill: 'var(--series-1)' }} />}
            </g>
          )
        })}
        <AxisBottom scale={x} y={height - m.bottom} width={width} format={(v) => `P${v}`} ticks={x.ticks(10).filter(Number.isInteger)} />
      </svg>
    </div>
  )
}

// Dot plot: one row per category, several keyed values on a shared axis.
// rows: [{ id, label, values: { [key]: number|null } }]; keys: [{ key, label, color }]
export function DotPlot({ rows, keys, format = String }) {
  const [ref, width] = useWidth()
  const tip = useTipHandlers()
  const row = 20
  const m = { top: 4, right: 20, bottom: 26, left: 130 }
  const vals = rows.flatMap((r) => keys.map((k) => r.values[k.key])).filter((v) => v != null)
  if (!vals.length) return <div ref={ref} className="chart"><p className="empty">Aucun temps de qualification disponible.</p></div>
  const x = scaleLinear([min(vals), max(vals)], [m.left, width - m.right]).nice()
  const height = m.top + rows.length * row + m.bottom
  return (
    <div ref={ref} className="chart">
      <Legend items={keys} shape="dot" />
      <svg width={width} height={height}>
        {x.ticks(6).map((t) => (
          <line key={t} x1={x(t)} x2={x(t)} y1={m.top} y2={height - m.bottom} className="axis__grid" />
        ))}
        {rows.map((r, i) => {
          const cy = m.top + i * row + row / 2
          const t = <TipRows title={r.label} rows={keys.map((k) => ({ value: format(r.values[k.key]), label: k.label, color: k.color }))} />
          return (
            <g key={r.id} {...tip(t)}>
              <rect x={0} y={cy - row / 2} width={width} height={row} className="hit" />
              <text x={m.left - 10} y={cy} dy="0.32em" textAnchor="end" className="bar-label">
                {truncate(r.label, 18)}
              </text>
              {keys.map((k) => r.values[k.key] != null && <circle key={k.key} cx={x(r.values[k.key])} cy={cy} r={4.5} className="dot" style={{ fill: k.color }} />)}
            </g>
          )
        })}
        <AxisBottom scale={x} y={height - m.bottom} width={width} format={format} ticks={x.ticks(6)} />
      </svg>
    </div>
  )
}

