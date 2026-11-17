import './SectionNav.css'

export default function SectionNav({ activeSection, onDrivers, onCircuits }) {
  const capsule = (id, label, onClick) => (
    <button
      type="button"
      className={`section-capsule${activeSection === id ? ' is-active' : ''}`}
      aria-current={activeSection === id ? 'page' : undefined}
      onClick={onClick}
    >
      <span>{label}</span>
      <span aria-hidden="true">↗</span>
    </button>
  )

  return (
    <nav className="section-nav" aria-label="Project visualizations">
      {capsule('drivers', 'Drivers', onDrivers)}
      {['Constructors', 'Races'].map((label) => (
        <button key={label} type="button" className="section-capsule" disabled aria-label={`${label}, coming soon`}>
          <span>{label}</span>
          <span className="section-capsule__soon">Soon</span>
        </button>
      ))}
      {capsule('circuits', 'Circuits', onCircuits)}
    </nav>
  )
}
