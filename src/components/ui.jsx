import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'

// ---------- Tooltip: one floating tooltip shared by every chart ----------
const TooltipContext = createContext(null)

export function TooltipProvider({ children }) {
  const [tip, setTip] = useState(null)
  const ref = useRef(null)
  const [pos, setPos] = useState({ left: 0, top: 0 })

  useLayoutEffect(() => {
    if (!tip || !ref.current) return
    const { width, height } = ref.current.getBoundingClientRect()
    const pad = 14
    let left = tip.x + pad
    let top = tip.y + pad
    if (left + width > window.innerWidth - 8) left = tip.x - width - pad
    if (top + height > window.innerHeight - 8) top = tip.y - height - pad
    setPos({ left: Math.max(8, left), top: Math.max(8, top) })
  }, [tip])

  const show = useCallback((event, content) => {
    let x = event.clientX
    let y = event.clientY
    if (x == null || (x === 0 && y === 0)) {
      // keyboard focus: anchor to the element
      const r = event.currentTarget.getBoundingClientRect()
      x = r.right
      y = r.top
    }
    setTip({ x, y, content })
  }, [])
  const hide = useCallback(() => setTip(null), [])

  return (
    <TooltipContext.Provider value={{ show, hide }}>
      {children}
      {tip && (
        <div className="tooltip" ref={ref} style={pos} role="tooltip">
          {tip.content}
        </div>
      )}
    </TooltipContext.Provider>
  )
}

export const useTooltip = () => useContext(TooltipContext)

// Spread onto any SVG/HTML mark to give it hover + keyboard-focus tooltips.
export function useTipHandlers() {
  const { show, hide } = useTooltip()
  return (content, onClick) => ({
    onPointerMove: (e) => show(e, content),
    onPointerLeave: hide,
    onFocus: (e) => show(e, content),
    onBlur: hide,
    tabIndex: 0,
    ...(onClick && {
      onClick,
      onKeyDown: (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onClick()),
      'data-clickable': true,
    }),
  })
}

export function TipRows({ title, rows }) {
  return (
    <>
      {title && <div className="tooltip__title">{title}</div>}
      {rows.map((r, i) => (
        <div className="tooltip__row" key={i}>
          {r.color && <span className="tooltip__key" style={{ background: r.color }} />}
          <strong>{r.value}</strong>
          <span>{r.label}</span>
        </div>
      ))}
    </>
  )
}

// ---------- Element width via ResizeObserver ----------
export function useWidth(initial = 600) {
  const ref = useRef(null)
  const [width, setWidth] = useState(initial)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.floor(entry.contentRect.width))))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}

// ---------- Layout primitives ----------
export function Card({ title, subtitle, table, actions, children, className = '', empty }) {
  const [mode, setMode] = useState('chart')
  return (
    <section className={`card ${className}`}>
      <header className="card__head">
        <div>
          <h3 className="card__title">{title}</h3>
          {subtitle && <p className="card__subtitle">{subtitle}</p>}
        </div>
        <div className="card__actions">
          {actions}
          {table && !empty && (
            <div className="seg" role="group" aria-label="Affichage">
              <button type="button" aria-pressed={mode === 'chart'} onClick={() => setMode('chart')}>Graphique</button>
              <button type="button" aria-pressed={mode === 'table'} onClick={() => setMode('table')}>Tableau</button>
            </div>
          )}
        </div>
      </header>
      {empty ? <p className="empty">{empty}</p> : mode === 'table' && table ? <DataTable {...table} compact /> : children}
    </section>
  )
}

export function Kpi({ label, value, hint }) {
  return (
    <div className="kpi">
      <span className="kpi__label">{label}</span>
      <span className="kpi__value">{value}</span>
      {hint && <span className="kpi__hint">{hint}</span>}
    </div>
  )
}

export function KpiRow({ children }) {
  return <div className="kpi-row">{children}</div>
}

export function Legend({ items, shape = 'rect' }) {
  return (
    <ul className="legend">
      {items.map((it) => (
        <li key={it.label}>
          <span className={`legend__key legend__key--${shape}`} style={{ background: it.color }} />
          {it.label}
        </li>
      ))}
    </ul>
  )
}

// columns: [{ key, label, align, render? }]
export function DataTable({ columns, rows, compact, onRowClick, rowKey = (r, i) => i, highlight }) {
  return (
    <div className={`table-wrap ${compact ? 'table-wrap--compact' : ''}`}>
      <table className="table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={c.align === 'right' ? 'num' : ''}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={rowKey(r, i)}
              className={`${onRowClick ? 'clickable' : ''} ${highlight?.(r) ? 'is-highlight' : ''}`}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
            >
              {columns.map((c) => (
                <td key={c.key} className={c.align === 'right' ? 'num' : ''}>
                  {c.render ? c.render(r) : (r[c.key] ?? 'n/d')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Loading({ label = 'Chargement…' }) {
  return <p className="empty">{label}</p>
}
