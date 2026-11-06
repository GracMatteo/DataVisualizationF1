import './SectionNav.css'

export default function SectionNav({ activeSection, onDrivers }) {
  return (
    <nav className="section-nav" aria-label="Project visualizations">
      <button
        type="button"
        className={`section-capsule${activeSection === 'drivers' ? ' is-active' : ''}`}
        aria-current={activeSection === 'drivers' ? 'page' : undefined}
        onClick={onDrivers}
      >
        <span>Drivers</span>
        <span aria-hidden="true">↗</span>
      </button>
      {['Constructors', 'Races', 'Circuits'].map((label) => (
        <button key={label} type="button" className="section-capsule" disabled aria-label={`${label}, coming soon`}>
          <span>{label}</span>
          <span className="section-capsule__soon">Soon</span>
        </button>
      ))}
    </nav>
  )
}
