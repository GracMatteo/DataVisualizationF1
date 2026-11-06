import { lazy, Suspense, useState } from 'react'
import LogoF1 from './assets/f1.svg?react'
import SectionNav from './components/SectionNav.jsx'
import './App.css'

const Dashboard = lazy(() => import('./Dashboard.jsx'))

function App() {
  const [showDashboard, setShowDashboard] = useState(false)

  if (showDashboard) {
    return (
      <Suspense fallback={<main className="page-status" role="status">Opening the driver explorer…</main>}>
        <Dashboard onBack={() => setShowDashboard(false)} />
      </Suspense>
    )
  }

  return (
    <main className="landing">
      <div className="landing__masthead">
        <header className="landing__top">
          <div className="brand">
            <LogoF1 className="brand__icon" aria-hidden="true" />
            <span className="brand__name">DataViz F1</span>
          </div>
        </header>
        <SectionNav onDrivers={() => setShowDashboard(true)} />
      </div>

      <section className="landing__hero">
        <p className="landing__eyebrow">Formula 1 Data Visualization</p>
        <h1>See every race as data.</h1>
        <p className="landing__subtitle">
          Follow a driver’s career, explore their constructors, and uncover the result behind every race.
        </p>

        <div className="landing__actions">

          <a className="btn btn--ghost" href="#about">Learn more</a>
        </div>
      </section>

      <footer id="about" className="landing__meta">
        <span>A visual exploration of Formula 1 history</span>
        <span>Fast · Clear · Interactive</span>
      </footer>
    </main>
  )
}

export default App
