import { useEffect, useState } from 'react'
import LogoF1 from './assets/f1.svg?react'
import { loadCore } from './data/load.js'
import { ModelProvider, StoreProvider, useStore } from './state/store.jsx'
import { TooltipProvider } from './components/ui.jsx'
import { FilterBar } from './components/FilterBar.jsx'
import { Overview } from './views/Overview.jsx'
import { CircuitView } from './views/CircuitView.jsx'
import { DriverView } from './views/DriverView.jsx'
import { ConstructorView } from './views/ConstructorView.jsx'
import { RaceView } from './views/RaceView.jsx'
import SectionNav from './components/SectionNav.jsx'
import './circuit-explorer.css'

const VIEWS = [
  { id: 'overview', label: 'Vue d’ensemble', component: Overview },
  { id: 'circuits', label: 'Circuits', component: CircuitView },
  { id: 'drivers', label: 'Pilotes', component: DriverView },
  { id: 'constructors', label: 'Constructeurs', component: ConstructorView },
  { id: 'races', label: 'Courses', component: RaceView },
]

// Map-centred explorer opened from the "Circuits" section pill.
export default function CircuitExplorer({ onHome, onDrivers }) {
  const [model, setModel] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => {
    loadCore().then(setModel, setError)
  }, [])

  return (
    <div className="dash">
      {error ? (
        <p className="empty">Impossible de charger les données : {String(error.message ?? error)}</p>
      ) : !model ? (
        <p className="empty dash__loading">Chargement des données F1…</p>
      ) : (
        <ModelProvider value={model}>
          <StoreProvider>
            <TooltipProvider>
              <Shell onHome={onHome} onDrivers={onDrivers} />
            </TooltipProvider>
          </StoreProvider>
        </ModelProvider>
      )}
    </div>
  )
}

function Shell({ onHome, onDrivers }) {
  const { state, set } = useStore()
  const View = VIEWS.find((v) => v.id === state.view).component
  return (
    <>
      <header className="dash__top">
        <button type="button" className="brand brand--btn" onClick={onHome}>
          <LogoF1 className="brand__icon" aria-hidden="true" />
          <span className="brand__name">F1 World Explorer</span>
        </button>
        <nav className="tabs" aria-label="Vues">
          {VIEWS.map((v) => (
            <button key={v.id} type="button" className="tab" aria-current={state.view === v.id ? 'page' : undefined} onClick={() => set({ view: v.id })}>
              {v.label}
            </button>
          ))}
        </nav>
      </header>
      <SectionNav activeSection="circuits" onDrivers={onDrivers} />
      <FilterBar />
      <main>
        <View />
      </main>
      <footer className="dash__foot muted">
        Victoire = positionOrder 1 · podium = positionOrder ≤ 3 · pole = qualifying.position 1 · les sprints sont exclus des statistiques Grand Prix · « n/d » : donnée absente du jeu de données.
      </footer>
    </>
  )
}
