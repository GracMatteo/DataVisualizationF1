import { getPlaceLabel, PLACE_CATEGORIES } from '../lib/championshipStandings.js'

export default function SeasonDetails({ season }) {
  return (
    <section className="race-details" aria-labelledby="season-details-title" aria-live="polite">
      <p className="eyebrow">The season, in detail</p>
      <h2 id="season-details-title">{season ? `${season.driverName} · ${season.year}` : 'Every season has a story.'}</h2>
      {!season ? (
        <p>Click a dot on the championship chart to see that season’s final place, points, wins and teams. You can also Tab to the chart, move with the arrow keys and press Enter.</p>
      ) : (
        <>
          <span className="result-badge" style={{ borderColor: PLACE_CATEGORIES[season.category].color }}>
            {getPlaceLabel(season)}{season.provisional ? ' so far' : ''}
          </span>
          <dl className="race-facts">
            <div><dt>Championship points</dt><dd>{season.points == null ? 'Not recorded' : Number(season.points.toFixed(1)).toLocaleString()}</dd></div>
            <div><dt>Wins</dt><dd>{season.wins ?? 'Not recorded'}</dd></div>
            <div><dt>Teams</dt><dd>{season.teams.join(', ') || 'Not recorded'}</dd></div>
            <div><dt>Standings after</dt><dd>Round {season.round}{season.provisional ? ' (season in progress)' : ' (final)'}</dd></div>
          </dl>
        </>
      )}
    </section>
  )
}
