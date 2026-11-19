# Driver championship timeline

Back to [README.md](README.md).

## Purpose and unit of observation

Compare up to twenty drivers' careers through their Drivers' Championship finishes.
Each **lane** is one driver. Each **dot** is one driver-season: the final
championship place that driver held that year.

## Source data

- `driver_standings.csv` (`raceId`, `driverId`, `points`, `position`,
  `positionText`, `wins`): the standings after every race. Loaded separately by
  `loadDriverStandings` in [`src/lib/championshipStandings.js`](src/lib/championshipStandings.js).
- `races.csv` (`raceId` → `year`, `round`), `drivers.csv`, and `results.csv` plus
  `constructors.csv` for the teams a driver raced for in a season.
- Not used: `constructor_standings.csv`, `seasons.csv`, `sprint_results.csv`.

## Transformation pipeline

1. `buildFinalStandings(rows, races)`: join each standings row to its race. For every
   driver and year keep the row with the highest `round`, which is the standing
   after their last race that season.
2. `positionText` `D` (exclusion: Schumacher 1997) and `-` (not ranked) get
   `position = null`. `\N` stays `null`.
3. A standing taken before the year's last scheduled round in `races.csv` is marked
   `provisional` (the season in progress).
4. `buildChampionshipLanes(driverIds, tables, finals, { fromYear, toYear })`: one lane
   per known driver, seasons inside the inclusive year bounds,
   sorted by year, each with a place category and `teamShares`: that year's
   constructors from `results.csv`, ordered by their first round, with the number of
   distinct races driven for each.
5. `buildTeamBands(seasons)` turns those shares into background bands in year
   units. Each season's slot `[year − 0.5, year + 0.5]` is split between its teams by
   race count, and touching pieces of the same team merge into one band per stint.

## Layout and scales

A lane (strip) chart. One row per driver, 60px high. The most recent career is on
top: drivers are sorted by their latest championship season, then by their first
season (the newer driver first), then by name. The order uses the whole career, so it
does not change with the season filters. Drivers without standings go last.

- **x:** `scaleLinear` over years, domain `[first − 0.5, last + 0.5]` across all
  selected drivers' seasons, so every season gets an equal slot. It is recalculated
  when drivers or season filters change.
- **y:** a lane band per driver. Vertical position within a lane carries no data.

## Visual encodings

| Datum | Encoding |
| --- | --- |
| Driver | Lane, with name and summary (`N titles · best Xth`) on the left |
| Season | Dot at the season's year |
| Final place | Dot fill **and** the number written inside the dot |
| Consecutive seasons | Solid line between dots |
| Seasons missed | Dashed, fainter line across the gap |
| Season in progress | Dashed ring around the dot |
| Hover / keyboard / selected | Dark ring / dark ring / accent ring |
| Team that season | Pale background band in the team color, named in small text at its top-left when it fits; a mid-season switch splits the slot by races (e.g. Gasly 2019: 12 Red Bull, 9 Toro Rosso) |

Dot radius = `clamp(slotWidth / 2 − 1.5, 4, 11)` px. Numbers are hidden below a 7.5px
radius; the tooltip and the table still give them.

## Palette

A fixed, documented medal encoding, not a quantitative scale:

| Category | Light | Dark |
| --- | --- | --- |
| Champion (1st) | `#c9a227` gold | `#e0b83a` |
| 2nd | `#a3a9b0` silver | `#b8bec6` |
| 3rd | `#b06f35` bronze | `#c8844a` |
| 4th or lower | `#2e9d5b` green | `#3fb874` |
| Excluded / not ranked | `#9a97a3` gray | `#6e6b78` |

Team bands use `getTeamColor(constructorRef)` from
[`src/lib/teamColors.js`](src/lib/teamColors.js): curated colors for known teams,
otherwise a stable hash into `d3.schemeTableau10`. They are identifiers, not
historical liveries. Fill opacity is 0.16 (light) / 0.22 (dark), with a 1px gap
between touching bands of different teams. Band names, the tooltip, the season panel
and the table carry team identity in text.

Numbers inside dots use dark ink (`#14121a`) on every fill. Color is never the only
cue, because the place number is always available in the dot, tooltip or table.

## Labels and details

- **Tooltip:** place (`Champion`, `2nd`, … `Excluded`, `Not ranked`, with "so far" for
  the current season), driver and year, championship points and wins, teams (with
  race counts when a season was split), and
  for a provisional season the round the standing was taken after.
- **Season details panel:** the same fields for the clicked season.
- **Short names:** on narrow screens, lane labels use the driver's surname.

## Interactions

- **Filters:** the driver picker (up to twenty) and the From / To season filters
  change the data.
- **Mouse:** hover shows the tooltip; click selects a season for the details panel.
- **Keyboard:** Tab to the chart. Left / Right moves through a driver's seasons,
  Home / End jump, and Up / Down move to the nearest season of the next driver.
  Enter selects; Escape clears.
- **Table:** "Show table" lists every driver-season as an alternative to the chart.

## Interpretation limits

Championship places and points are the official standings, so they include sprint
points and penalties. Points systems and season lengths changed over the decades,
so places compare better across eras than points do. A driver with no standings
row in a year has no dot. The latest season can be incomplete, which the
provisional ring marks.

## Implementation and validation

[`src/components/DriverChampionshipChart.jsx`](src/components/DriverChampionshipChart.jsx),
[`src/components/SeasonDetails.jsx`](src/components/SeasonDetails.jsx),
[`src/lib/championshipStandings.js`](src/lib/championshipStandings.js),
[`src/Dashboard.jsx`](src/Dashboard.jsx).

[`tests/championshipStandings.test.js`](tests/championshipStandings.test.js) checks:
- the last-round selection, the exclusion and unranked rows, provisional seasons and
  the place labels;
- on the real archive, exactly one champion in every completed season, Hamilton's
  seven titles, Schumacher's 1997 exclusion and the year filter.

Rendering and keyboard behavior are not covered by automated tests.
