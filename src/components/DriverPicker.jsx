import { useMemo, useState } from 'react'

export default function DriverPicker({ drivers, selectedId, onChange }) {
  const [query, setQuery] = useState('')
  const matches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    return drivers.filter((driver) => `${driver.name} ${driver.code ?? ''}`.toLocaleLowerCase().includes(normalized))
  }, [drivers, query])
  const hasSelection = matches.some((driver) => driver.driverId === selectedId)

  return (
    <div className="driver-picker">
      <label className="field">
        <span>Find a driver</span>
        <input
          type="search"
          placeholder="Name or code, e.g. Hamilton"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-controls="driver-select"
        />
      </label>
      <label className="field">
        <span>Driver <small>{matches.length} available</small></span>
        <select
          id="driver-select"
          value={hasSelection ? selectedId : ''}
          onChange={(event) => onChange(Number(event.target.value))}
          disabled={!matches.length}
        >
          {!hasSelection && <option value="" disabled>{matches.length ? 'Choose a matching driver' : 'No matching drivers'}</option>}
          {matches.map((driver) => <option key={driver.driverId} value={driver.driverId}>{driver.name}</option>)}
        </select>
      </label>
    </div>
  )
}
