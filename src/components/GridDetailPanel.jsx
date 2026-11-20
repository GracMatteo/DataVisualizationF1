import { useId, useRef, useState } from 'react'
import { formatSignedPlaces, formatStarts } from '../lib/formatSigned.js'
import { getTeamColor } from '../lib/teamColors.js'

let layer = 30

function placePanel(index) {
  const width = Math.min(880, window.innerWidth - 32)
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

export default function GridDetailPanel({ cell, index, onClose, onFocus, onOpenDrivers, onOpenConstructors, onOpenCircuits, onOpenCountries }) {
  const linked = cell.entries.filter((entry) => entry.driverId != null)
  const linkedTeams = cell.entries.filter((entry) => entry.constructorId != null)
  const linkedCircuits = cell.entries.filter((entry) => entry.circuitId != null)
  const linkedCountries = cell.entries.filter((entry) => entry.country != null)
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
          <p>Écart {formatSignedPlaces(cell.grid - cell.position)}. Position de grille {cell.grid}, position d’arrivée {cell.position}. La barre de titre déplace cette liste.</p>
        </div>
        <button type="button" className="text-button" onClick={onClose}>Fermer</button>
      </div>
      <div className="grid-table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">
                {linkedCountries.length ? (
                  <button
                    type="button"
                    className="driver-link driver-link--header"
                    title="Afficher tous les pays de cette case dans la visualisation Circuits"
                    onClick={() => onOpenCountries?.(linkedCountries)}
                  >
                    Pays
                  </button>
                ) : 'Pays'}
              </th>
              <th scope="col">
                {linkedCircuits.length ? (
                  <button
                    type="button"
                    className="driver-link driver-link--header"
                    title="Afficher tous les circuits de cette case dans la visualisation Circuits"
                    onClick={() => onOpenCircuits?.(linkedCircuits)}
                  >
                    Circuit
                  </button>
                ) : 'Circuit'}
              </th>
              <th scope="col">
                {linked.length ? (
                  <button
                    type="button"
                    className="driver-link driver-link--header"
                    title="Afficher tous les pilotes de cette case dans la visualisation Pilotes"
                    onClick={() => onOpenDrivers?.(linked)}
                  >
                    Pilote
                  </button>
                ) : 'Pilote'}
              </th>
              <th scope="col">
                {linkedTeams.length ? (
                  <button
                    type="button"
                    className="driver-link driver-link--header"
                    title="Afficher toutes les écuries de cette case dans la visualisation Constructeurs"
                    onClick={() => onOpenConstructors?.(linkedTeams)}
                  >
                    Écurie
                  </button>
                ) : 'Écurie'}
              </th>
            </tr>
          </thead>
          <tbody>
            {cell.entries.map((entry) => (
              <tr key={entry.id}>
                <td>{formatRaceDate(entry.date)}</td>
                <td>
                  {entry.country == null ? entry.countryLabel : (
                    <button
                      type="button"
                      className="driver-link"
                      title={`Afficher les circuits de ce pays en ${entry.year} dans la visualisation Circuits`}
                      onClick={() => onOpenCountries?.([entry])}
                    >
                      {entry.countryLabel}
                    </button>
                  )}
                </td>
                <td>
                  {entry.circuitId == null ? entry.circuitName : (
                    <button
                      type="button"
                      className="driver-link"
                      title={`Afficher ce circuit en ${entry.year} dans la visualisation Circuits`}
                      onClick={() => onOpenCircuits?.([entry])}
                    >
                      {entry.circuitName}
                    </button>
                  )}
                </td>
                <td>
                  {entry.driverId == null ? entry.driverName : (
                    <button type="button" className="driver-link" onClick={() => onOpenDrivers?.([entry])}>
                      {entry.driverName}
                    </button>
                  )}
                </td>
                <td className="constructor-cell">
                  <span className="legend-dot" style={{ backgroundColor: getTeamColor(entry.constructorRef) }} />
                  {entry.constructorId == null ? entry.constructorName : (
                    <button type="button" className="driver-link" onClick={() => onOpenConstructors?.([entry])}>
                      {entry.constructorName}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
