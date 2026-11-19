import './SectionNav.css'

export default function SectionNav({ activeSection, onDrivers, onConstructors, onRaces }) {
  const sections = [
    ['drivers', 'Drivers', onDrivers],
    ['constructors', 'Constructors', onConstructors],
    ['races', 'Races', onRaces],
  ]

  return (
    <nav className="section-nav" aria-label="Project visualizations">
      {sections.map(([key, label, onClick]) => (
        <button
          key={key}
          type="button"
          className={`section-capsule${activeSection === key ? ' is-active' : ''}`}
          aria-current={activeSection === key ? 'page' : undefined}
          onClick={onClick}
        >
          <span>{label}</span>
          <span aria-hidden="true">↗</span>
        </button>
      ))}
      <button type="button" className="section-capsule" disabled aria-label="Circuits, coming soon">
        <span>Circuits</span>
        <span className="section-capsule__soon">Soon</span>
      </button>
    </nav>
  )
}
