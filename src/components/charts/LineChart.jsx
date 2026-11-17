import { useState } from 'react'
import { extent, line, max, min, scaleLinear, curveMonotoneX } from 'd3'
import { useTooltip, useWidth, TipRows, Legend } from '../ui.jsx'
import { AxisBottom, GridLeft, M } from './common.jsx'

// series: [{ id, label, color | null, values: [{ x, y }] }]
// Series with color null are context lines (muted gray, no legend entry).
export function LineChart({
  series,
  height = 240,
  xFormat = String,
  yFormat = String,
  yDomain,
  markX,
  onPickX,
  area = false,
  dots = false,
  left = M.left,
  zero = true,
}) {
  const [ref, width] = useWidth()
  const { show, hide } = useTooltip()
  const [hoverX, setHoverX] = useState(null)
  const m = { ...M, left }
  const all = series.flatMap((s) => s.values)
  if (all.length === 0) return <div ref={ref} className="chart"><p className="empty">Aucune donnée disponible.</p></div>

  const xs = [...new Set(all.map((d) => d.x))].sort((a, b) => a - b)
  const x = scaleLinear(extent(xs), [m.left, width - m.right])
  const lo = min(all, (d) => d.y)
  const y = scaleLinear(yDomain ?? [zero ? Math.min(0, lo) : lo, max(all, (d) => d.y) || 1], [height - m.bottom, m.top])
  if (!yDomain) y.nice()
  const clipped = yDomain != null
  const path = line()
    .defined((d) => d.y != null)
    .x((d) => x(d.x))
    .y((d) => y(d.y))
    .curve(curveMonotoneX)
  const areaPath = (vals) => `${path(vals)}L${x(vals.at(-1).x)},${y(0)}L${x(vals[0].x)},${y(0)}Z`
  const keyed = series.filter((s) => s.color)
  const clipId = `clip-${height}-${series.length}-${xs.length}`

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = x.invert(e.clientX - rect.left)
    let nearest = xs[0]
    for (const v of xs) if (Math.abs(v - px) < Math.abs(nearest - px)) nearest = v
    setHoverX(nearest)
    const rows = series
      .map((s) => ({ s, d: s.values.find((v) => v.x === nearest) }))
      .filter((r) => r.d && r.d.y != null)
      .sort((a, b) => (keyed.length ? Number(!a.s.color) - Number(!b.s.color) : 0) || b.d.y - a.d.y)
      .slice(0, 12)
      .map(({ s, d }) => ({ value: yFormat(d.y), label: s.label, color: s.color ?? 'var(--neutral-2)' }))
    show(e, <TipRows title={xFormat(nearest)} rows={rows} />)
  }

  return (
    <div ref={ref} className="chart">
      {keyed.length > 1 && <Legend items={keyed} shape="line" />}
      <svg width={width} height={height}>
        <defs>
          <clipPath id={clipId}>
            <rect x={m.left} y={m.top - 4} width={width - m.left - m.right} height={height - m.top - m.bottom + 8} />
          </clipPath>
        </defs>
        <GridLeft scale={y} x1={m.left} x2={width - m.right} format={yFormat} />
        <AxisBottom scale={x} y={height - m.bottom} width={width} format={xFormat} ticks={xs.length < 8 ? xs : undefined} />
        {markX != null && markX >= x.domain()[0] && markX <= x.domain()[1] && (
          <line className="mark-x" x1={x(markX)} x2={x(markX)} y1={m.top} y2={height - m.bottom} />
        )}
        <g clipPath={clipped ? `url(#${clipId})` : undefined}>
          {series
            .filter((s) => !s.color)
            .map((s) => (
              <path key={s.id} d={path(s.values)} className="line line--muted" />
            ))}
          {keyed.map((s) => (
            <g key={s.id}>
              {area && s.values.length > 1 && <path d={areaPath(s.values)} style={{ fill: s.color }} className="area" />}
              <path d={path(s.values)} style={{ stroke: s.color }} className="line" />
              {(dots || s.values.length === 1) &&
                s.values.map((d) => d.y != null && <circle key={d.x} cx={x(d.x)} cy={y(d.y)} r={3.5} style={{ fill: s.color }} className="dot" />)}
            </g>
          ))}
        </g>
        {hoverX != null && (
          <g pointerEvents="none">
            <line className="crosshair" x1={x(hoverX)} x2={x(hoverX)} y1={m.top} y2={height - m.bottom} />
            {keyed.map((s) => {
              const d = s.values.find((v) => v.x === hoverX)
              return d && d.y != null && <circle key={s.id} cx={x(d.x)} cy={y(d.y)} r={4.5} style={{ fill: s.color }} className="dot" />
            })}
          </g>
        )}
        <rect
          className="overlay"
          x={m.left}
          y={m.top}
          width={width - m.left - m.right}
          height={height - m.top - m.bottom}
          onPointerMove={onMove}
          onPointerLeave={() => (setHoverX(null), hide())}
          onClick={onPickX && hoverX != null ? () => onPickX(hoverX) : undefined}
          style={onPickX ? { cursor: 'pointer' } : undefined}
        />
      </svg>
    </div>
  )
}

// Bump chart: position by lap, one line per driver, position 1 at the top.
// series: [{ id, label, short, color | null, values: [{ x, y }] }]
export function BumpChart({ series, height = 420 }) {
  const [ref, width] = useWidth()
  const { show, hide } = useTooltip()
  const [hover, setHover] = useState(null)
  const all = series.flatMap((s) => s.values)
  if (all.length === 0) return <div ref={ref} className="chart"><p className="empty">Aucune donnée disponible.</p></div>
  const m = { top: 10, right: 48, bottom: 28, left: 32 }
  const maxPos = max(all, (d) => d.y)
  const x = scaleLinear([1, max(all, (d) => d.x)], [m.left, width - m.right])
  const y = scaleLinear([1, maxPos], [m.top, height - m.bottom])
  const path = line()
    .x((d) => x(d.x))
    .y((d) => y(d.y))
  // muted first so coloured lines paint on top; hovered last
  const ordered = [...series].sort((a, b) => (a.id === hover) - (b.id === hover) || Number(!!a.color) - Number(!!b.color))

  return (
    <div ref={ref} className="chart">
      <Legend items={series.filter((s) => s.color)} shape="line" />
      <svg width={width} height={height}>
        <g className="axis">
          {y.ticks(Math.min(maxPos, 10)).filter(Number.isInteger).map((p) => (
            <text key={p} x={m.left - 8} y={y(p)} dy="0.32em" textAnchor="end">
              P{p}
            </text>
          ))}
        </g>
        <AxisBottom scale={x} y={height - m.bottom} width={width} format={(v) => `T${v}`} />
        {ordered.map((s) => {
          const active = hover === s.id
          const end = s.values.at(-1)
          const tip = <TipRows title={s.label} rows={[{ value: `P${end.y}`, label: `au tour ${end.x}` }]} />
          return (
            <g
              key={s.id}
              className={`bump ${hover && !active ? 'is-dim' : ''}`}
              onPointerMove={(e) => (setHover(s.id), show(e, tip))}
              onPointerLeave={() => (setHover(null), hide())}
            >
              <path d={path(s.values)} className="hit-line" />
              <path
                d={path(s.values)}
                className={s.color || active ? 'line' : 'line line--muted'}
                style={s.color || active ? { stroke: s.color ?? 'var(--text-primary)' } : undefined}
              />
              <text x={x(end.x) + 6} y={y(end.y)} dy="0.32em" className="bump__label">
                {s.short}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
