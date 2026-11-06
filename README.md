# DATA VISUALISATION

## Participants

 - GRAC Matteo
 - LOIRE Adam
 - DOMINGUES Matthis
 - MANNOCCI Mickael

## Data set :

lien kaggle : https://www.kaggle.com/datasets/jtrotman/formula-1-race-data?select=status.csv

## Run locally

```sh
npm install
npm run dev
```

Use the **Drivers** capsule below the top bar to open the explorer. Constructors,
Races and Circuits are placeholders for future visualizations.

## Driver career tree

The D3.js tidy tree follows **driver → constructor → season → race result**.
Search for any driver in the archive and optionally filter by an inclusive
season range. Constructors appear in order of their first race in that range;
seasons and race rounds are chronological. Each constructor keeps its own
season branch, including mid-season team changes.

- Click a branch to expand/collapse it; seasons start collapsed.
- Hover a race for a summary, or select it for persistent details.
- Tab to a node and press Enter/Space to expand or select it.
- Drag to pan, scroll/pinch to zoom, or use the zoom and fit controls.
- Use **Expand all** to reveal every result, **Collapse all** for a team overview,
  and **Fit tree** to bring visible branches back into view.

Constructor and season dots scale with the selected driver’s total race points
in each branch. Both levels share one square-root radius scale for the selected
career range (10–24 SVG units); zero-point branches remain visible. Expanding or
collapsing branches does not change the scale. Driver and race dot sizes are
unchanged.

Node colors distinguish podiums, other points finishes, other finishes,
retirements and other non-finishes. Official classified positions are kept
separate from finishing status: a retired driver can still be classified.
`positionOrder` is never presented as a classified finishing position. Labels
and the details panel provide the same information without relying on color.

The dataset is served locally from `public/data/`. The explorer loads only five
CSVs: `drivers`, `constructors`, `races`, `results`, and `status`. Replace those
files to update the visualization. Other large CSVs, such as lap times, are not
downloaded by this visualization.
Coverage is calculated from races with results, not scheduled races.

Race entries include DNS/DNQ records. Points are summed from Grand Prix results
only; sprint points and championship adjustments are not included. Constructor
identities follow the source IDs; colors are visual identifiers, not historical
liveries. The app uses no external API or additional dependencies.

## Validation

```sh
npm test
npm run lint
npm run build
```

Tests cover CSV normalization, missing values, result/status classification,
chronological grouping, mid-season switches, filtering, stable team colors,
and tree/result consistency for every driver in the local archive.
