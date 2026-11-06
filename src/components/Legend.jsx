import { POSITION_COLORS } from '../lib/racePresentation.js'

export default function Legend() {
  const items = [
    ['win', 'P1'], ['second', 'P2'], ['third', 'P3'], ['points', 'Other points finish'],
    ['other', 'Other finish'], ['retired', 'Retired / DNF'], ['unclassified', 'DSQ / DNS / other'],
  ]

  return (
    <ul className="tree-legend" aria-label="Race result colors">
      {items.map(([key, label]) => (
        <li key={key}><span className="legend-dot" style={{ backgroundColor: POSITION_COLORS[key] }} />{label}</li>
      ))}
    </ul>
  )
}
