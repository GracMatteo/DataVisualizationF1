import { lazy, Suspense, useState } from 'react'
import LogoF1 from './assets/f1.svg?react'
import SectionNav from './components/SectionNav.jsx'
import './App.css'

const Dashboard = lazy(() => import('./Dashboard.jsx'))
const ConstructorDashboard = lazy(() => import('./ConstructorDashboard.jsx'))

function App() {
  const [section, setSection] = useState(null)
  const navigation = {
    onBack: () => setSection(null),
    onDrivers: () => setSection('drivers'),
    onConstructors: () => setSection('constructors'),
  }

  if (section) {
    const Page = section === 'drivers' ? Dashboard : ConstructorDashboard
    return (
      <Suspense fallback={<main className="page-status" role="status">Opening the {section === 'drivers' ? 'driver' : 'constructor'} explorer…</main>}>
        <Page {...navigation} />
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
        <SectionNav onDrivers={navigation.onDrivers} onConstructors={navigation.onConstructors} />
      </div>

      <section className="landing__hero">
        <p className="landing__eyebrow">Formula 1 Data Visualization</p>
        <h1>See every race as data.</h1>
        <p className="landing__subtitle">
          Follow a driver’s career, measure what engine failures cost each constructor, and uncover the result behind every race.
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
