import { useEffect, useMemo, useRef, useState } from 'react'
import { useModel, useStore } from '../state/store.jsx'

export function EntityPicker({ options, value, onChange, placeholder, id }) {
  const current = options.find((o) => o.id === value)
  const [text, setText] = useState(current?.label ?? '')
  useEffect(() => setText(current?.label ?? ''), [current])
  const listId = `${id}-list`
  return (
    <div className="picker">
      <input
        id={id}
        list={listId}
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value)
          const hit = options.find((o) => o.label === e.target.value)
          if (hit) onChange(hit.id)
          if (!e.target.value) onChange(null)
        }}
        onBlur={() => setText(current?.label ?? '')}
      />
      {value != null && (
        <button type="button" className="picker__clear" aria-label="Effacer" onClick={() => onChange(null)}>×</button>
      )}
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o.id} value={o.label} />
        ))}
      </datalist>
    </div>
  )
}

export function useDriverOptions() {
  const model = useModel()
  return useMemo(
    () =>
      [...model.driverById.values()]
        .filter((d) => model.resultsByDriver.has(d.driverId))
        .map((d) => ({ id: d.driverId, label: d.label }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [model],
  )
}

export function useConstructorOptions() {
  const model = useModel()
  return useMemo(
    () =>
      [...model.constructorById.values()]
        .filter((c) => model.resultsByConstructor.has(c.constructorId))
        .map((c) => ({ id: c.constructorId, label: c.name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [model],
  )
}

function SeasonControl() {
  const model = useModel()
  const { state, set } = useStore()
  const [playing, setPlaying] = useState(false)
  const first = model.years[0]
  const last = model.years.at(-1)
  const timer = useRef(null)

  useEffect(() => {
    if (!playing) return
    let year = state.season == null || state.season >= last ? first : state.season
    set({ season: year })
    timer.current = setInterval(() => {
      year += 1
      if (year > last) {
        setPlaying(false)
        return
      }
      set({ season: year })
    }, 900)
    return () => clearInterval(timer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing])

  return (
    <div className="filter filter--season">
      <label htmlFor="season-range">Saison</label>
      <div className="season">
        <button
          type="button"
          className={`chip ${state.season == null ? 'is-on' : ''}`}
          onClick={() => (setPlaying(false), set({ season: null }))}
        >
          Toutes
        </button>
        <input
          id="season-range"
          type="range"
          min={first}
          max={last}
          value={state.season ?? last}
          onChange={(e) => (setPlaying(false), set({ season: +e.target.value }))}
          className={state.season == null ? 'is-idle' : ''}
        />
        <output className="season__value">{state.season ?? `${first}–${last}`}</output>
        <button type="button" className="icon-btn" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause' : 'Parcourir les saisons'}>
          {playing ? '❚❚' : '▶'}
        </button>
      </div>
    </div>
  )
}

function CountryFilter() {
  const model = useModel()
  const { state, dispatch, set } = useStore()
  const n = state.countries.length
  return (
    <div className="filter">
      <span className="filter__label">Pays</span>
      <details className="dropdown">
        <summary>{n === 0 ? 'Tous les pays' : n === 1 ? state.countries[0] : `${n} pays`}</summary>
        <div className="dropdown__panel">
          {n > 0 && (
            <button type="button" className="link" onClick={() => set({ countries: [] })}>
              Tout désélectionner
            </button>
          )}
          {model.countries.map((c) => (
            <label key={c} className="check">
              <input type="checkbox" checked={state.countries.includes(c)} onChange={() => dispatch({ type: 'toggleCountry', country: c })} />
              {c}
            </label>
          ))}
        </div>
      </details>
    </div>
  )
}

export function FilterBar() {
  const model = useModel()
  const { state, set, dispatch } = useStore()
  const drivers = useDriverOptions()
  const constructors = useConstructorOptions()
  const circuits = useMemo(
    () => [...model.circuitById.values()].filter((c) => model.races.some((r) => r.circuitId === c.circuitId)).sort((a, b) => a.name.localeCompare(b.name)),
    [model],
  )
  const active = state.season != null || state.countries.length || state.driverId != null || state.constructorId != null || state.circuitId != null

  return (
    <div className="filterbar" role="search">
      <SeasonControl />
      <CountryFilter />
      <div className="filter">
        <label htmlFor="f-driver">Pilote</label>
        <EntityPicker id="f-driver" options={drivers} value={state.driverId} onChange={(id) => set({ driverId: id })} placeholder="Tous les pilotes" />
      </div>
      <div className="filter">
        <label htmlFor="f-constructor">Constructeur</label>
        <EntityPicker id="f-constructor" options={constructors} value={state.constructorId} onChange={(id) => set({ constructorId: id })} placeholder="Toutes les écuries" />
      </div>
      <div className="filter">
        <label htmlFor="f-circuit">Circuit</label>
        <select id="f-circuit" value={state.circuitId ?? ''} onChange={(e) => set({ circuitId: e.target.value ? +e.target.value : null })}>
          <option value="">Tous les circuits</option>
          {circuits.map((c) => (
            <option key={c.circuitId} value={c.circuitId}>{c.name}</option>
          ))}
        </select>
      </div>
      <button type="button" className="btn btn--ghost btn--sm filterbar__reset" disabled={!active} onClick={() => dispatch({ type: 'reset' })}>
        Réinitialiser
      </button>
    </div>
  )
}
