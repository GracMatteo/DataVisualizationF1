// Shared chart anatomy: hairline axes, recessive grid, bar shapes.

export const M = { top: 12, right: 16, bottom: 28, left: 44 }

// Bar with a 4px rounded data-end and a square baseline end.
export function hBarPath(x, y, w, h, r = 4) {
  if (w <= 0) return ''
  r = Math.min(r, w, h / 2)
  return `M${x},${y}h${w - r}a${r},${r} 0 0 1 ${r},${r}v${h - 2 * r}a${r},${r} 0 0 1 ${-r},${r}h${-(w - r)}z`
}

export function vBarPath(x, y, w, h, r = 4) {
  // y = top of the bar, baseline at y + h
  if (h <= 0) return ''
  r = Math.min(r, h, w / 2)
  return `M${x},${y + h}v${-(h - r)}a${r},${r} 0 0 1 ${r},${-r}h${w - 2 * r}a${r},${r} 0 0 1 ${r},${r}v${h - r}z`
}

export function AxisBottom({ scale, y, ticks, format = String, width }) {
  const values = ticks ?? (scale.ticks ? scale.ticks(Math.max(2, Math.floor(width / 80))) : scale.domain())
  const offset = scale.bandwidth ? scale.bandwidth() / 2 : 0
  const [r0, r1] = scale.range()
  return (
    <g className="axis" transform={`translate(0,${y})`}>
      <line x1={r0} x2={r1} className="axis__base" />
      {values.map((v) => (
        <text key={String(v)} x={scale(v) + offset} y={18} textAnchor="middle">
          {format(v)}
        </text>
      ))}
    </g>
  )
}

export function GridLeft({ scale, x1, x2, ticks = 4, format = String }) {
  return (
    <g className="axis">
      {scale.ticks(ticks).map((v) => (
        <g key={v} transform={`translate(0,${scale(v)})`}>
          <line x1={x1} x2={x2} className="axis__grid" />
          <text x={x1 - 8} dy="0.32em" textAnchor="end">
            {format(v)}
          </text>
        </g>
      ))}
    </g>
  )
}
