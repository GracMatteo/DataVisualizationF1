import { getRaceColor, getRaceDescription } from '../lib/racePresentation.js'

export default function RaceDetails({ race, driver, constructorName }) {
  return (
    <section className="race-details" aria-labelledby="race-details-title" aria-live="polite">
      <p className="eyebrow">The race, in detail</p>
      <h2 id="race-details-title">{race ? race.raceName : 'Every result has a story.'}</h2>
      {!race ? (
        <p>Select a race node to see its starting grid, finishing position, points and official status. You can also focus a node with Tab and press Enter.</p>
      ) : (
        <>
          <p>{driver} · {constructorName}</p>
          <span className="result-badge" style={{ borderColor: getRaceColor(race) }}>{getRaceDescription(race)}</span>
          <dl className="race-facts">
            <div><dt>Season / round</dt><dd>{race.year} / {race.round ?? '—'}</dd></div>
            <div><dt>Date</dt><dd>{race.date ?? 'Not recorded'}</dd></div>
            <div><dt>Starting grid</dt><dd>{race.grid > 0 ? `P${race.grid}` : 'Not recorded / pit lane'}</dd></div>
            <div><dt>Classified position</dt><dd>{race.position > 0 ? `P${race.position}` : 'Not classified'}</dd></div>
            <div><dt>Race points</dt><dd>{race.points ?? 'Not recorded'}</dd></div>
            <div><dt>Official status</dt><dd>{race.status ?? 'Not recorded'}</dd></div>
          </dl>
        </>
      )}
    </section>
  )
}
