import LogoF1 from './assets/f1.svg?react'
import './App.css'

function App() {
  return (
    <main className="landing">
      <header className="landing__top">
        <div className="brand">
          <LogoF1 className="brand__icon" aria-hidden="true" />
          <span className="brand__name">DataViz F1</span>
        </div>
      </header>

      <section className="landing__hero">
        <p className="landing__eyebrow">Formula 1 Data Visualization</p>
        <h1>See every race as data.</h1>
        <p className="landing__subtitle">
          Explore lap times, pit strategy, driver trends, and team performance in one clean workspace.
        </p>

        <div className="landing__actions">
          <button type="button" className="btn btn--primary">Open Dashboard</button>
          <a className="btn btn--ghost" href="#about">Learn more</a>
        </div>
      </section>

      <footer id="about" className="landing__meta">
        <span>2026 season ready</span>
        <span>Fast · Clear · Interactive</span>
      </footer>
    </main>
  )
}

export default App
