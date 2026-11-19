import { useId, useRef, useState } from 'react'
import { formatSignedPlaces, formatStarts } from '../lib/formatSigned.js'
import { getTeamColor } from '../lib/teamColors.js'

let layer = 30

function placePanel(index) {
  const width = Math.min(640, window.innerWidth - 32)
  return {
    x: Math.max(16, window.innerWidth - width - 24 - index * 28),
    y: 72 + index * 40,
  }
}

function formatRaceDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''))
  if (!match) return value ? String(value) : '—'
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date)
}

export default function GridDetailPanel({ cell, index, onClose, onFocus }) {
  const titleId = useId()
  const panelRef = useRef(null)
  const [position, setPosition] = useState(() => placePanel(index))
  const [z, setZ] = useState(() => ++layer)

  function raise() {
    setZ(++layer)
    onFocus()
  }

  function onDragStart(event) {
    if (event.button !== 0 || event.target.closest('button')) return
    event.preventDefault()
    raise()
    const originX = position.x
    const originY = position.y
    const startX = event.clientX
    const startY = event.clientY

    function move(moveEvent) {
      const panel = panelRef.current
      const width = panel?.offsetWidth ?? 320
      const x = originX + moveEvent.clientX - startX
      const y = originY + moveEvent.clientY - startY
      setPosition({
        x: Math.min(Math.max(16 - width + 72, x), window.innerWidth - 72),
        y: Math.min(Math.max(8, y), window.innerHeight - 48),
      })
    }

    function end() {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // The pointer is already gone. Window listeners still follow the drag.
    }
  }

  return (
    <section
      ref={panelRef}
      className="grid-dialog"
      role="dialog"
      aria-labelledby={titleId}
      style={{ left: position.x, top: position.y, zIndex: z }}
      onPointerDown={raise}
    >
      <div className="grid-dialog__bar" onPointerDown={onDragStart}>
        <div>
          <p className="eyebrow">Grille P{cell.grid} → arrivée P{cell.position}</p>
          <h2 id={titleId}>{formatStarts(cell.count, true)}</h2>
          <p>Écart {formatSignedPlaces(cell.grid - cell.position)}. Partis de la place {cell.grid}, classés à la place {cell.position}. Glissez la barre pour déplacer.</p>
        </div>
        <button type="button" className="text-button" onClick={onClose}>Fermer</button>
      </div>
      <div className="grid-table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Pays</th>
              <th scope="col">Circuit</th>
              <th scope="col">Pilote</th>
              <th scope="col">Écurie</th>
            </tr>
          </thead>
          <tbody>
            {cell.entries.map((entry) => (
              <tr key={entry.id}>
                <td>{formatRaceDate(entry.date)}</td>
                <td>{entry.countryLabel}</td>
                <td>{entry.circuitName}</td>
                <td>{entry.driverName}</td>
                <td className="constructor-cell"><span className="legend-dot" style={{ backgroundColor: getTeamColor(entry.constructorRef) }} />{entry.constructorName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
