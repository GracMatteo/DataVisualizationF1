import { useId, useMemo, useState } from 'react'

export const MAX_COMPARED_DRIVERS = 20

export default function DriverMultiPicker({ drivers, selectedIds, onChange }) {
  const [query, setQuery] = useState('')
  const selectId = useId()
  const byId = useMemo(() => new Map(drivers.map((driver) => [driver.driverId, driver])), [drivers])
  const full = selectedIds.length >= MAX_COMPARED_DRIVERS
  const matches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    return drivers.filter((driver) => !selectedIds.includes(driver.driverId)
      && `${driver.name} ${driver.code ?? ''}`.toLocaleLowerCase().includes(normalized))
  }, [drivers, selectedIds, query])

  return (
    <div className="driver-multi-picker">
      <div className="driver-picker">
        <label className="field">
          <span>Find a driver to compare</span>
          <input type="search" placeholder="Name or code, e.g. Verstappen" value={query} onChange={(event) => setQuery(event.target.value)} aria-controls={selectId} disabled={full} />
        </label>
        <label className="field">
          <span>Add driver <small>{full ? `up to ${MAX_COMPARED_DRIVERS}` : `${matches.length} available`}</small></span>
          <select id={selectId} value="" disabled={full || !matches.length} onChange={(event) => { onChange([...selectedIds, Number(event.target.value)]); setQuery('') }}>
            <option value="" disabled>{full ? 'Remove a driver to add another' : matches.length ? 'Choose a driver' : 'No matching drivers'}</option>
            {matches.map((driver) => <option key={driver.driverId} value={driver.driverId}>{driver.name}</option>)}
          </select>
        </label>
      </div>
      <ul className="driver-chips" aria-label="Compared drivers">
        {selectedIds.map((id) => {
          const name = byId.get(id)?.name ?? `Driver ${id}`
          return (
            <li key={id}>
              <span>{name}</span>
              <button type="button" onClick={() => onChange(selectedIds.filter((value) => value !== id))} aria-label={`Remove ${name}`}>×</button>
            </li>
          )
        })}
        {!selectedIds.length && <li className="driver-chips__empty">No drivers selected</li>}
      </ul>
    </div>
  )
}
