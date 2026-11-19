# DATA VISUALISATION

## Participants

 - GRAC Matteo
 - LOIRE Adam
 - DOMINGUES Matthis
 - MANNOCCI Mickael

## Data set :

lien kaggle : https://www.kaggle.com/datasets/jtrotman/formula-1-race-data?select=status.csv

## Project guidelines

See [AGENT.md — project style and contribution rules](AGENT.md).
See [AGENT.md — project style and contribution rules](AGENT.md).
Every new visualization page must include its own root-level `<Topic>Viz.md`
explaining the data pipeline and visual encodings, linked from this README.

## Run locally

```sh
npm install
npm run dev
```

Use the capsules below the top bar. **Drivers** opens the championship timeline. **Constructors**
opens the speed and reliability explorer. **Races** opens the grid-against-finish chart.
Circuits is still a placeholder.

## Driver championship timeline

See [DriverTimelineViz.md — final championship place per season](DriverTimelineViz.md)
for the standings join, medal colors, scales, keyboard access and limits.

## Constructor speed × reliability

*Fast or reliable: what makes a champion?* See
[ConstructorViz.md — question, definitions, data pipeline and visual encodings](ConstructorViz.md)
for the engine-failure classification, the three engine eras, the linked scatter plot,
heatmap and season timeline, the points-lost estimate and its limits.

## Grid against finish

See [CircuitViz.md — data transformation pipeline and visual encodings](CircuitViz.md)
for which starts are counted, how places gained are calculated, and how the French
labels, the country filter, the ranking and the blue-to-orange square scale should be read.

## Validation

```sh
npm test
npm run lint
npm run build
```

Tests cover CSV normalization, missing values, result/status classification,
chronological grouping, mid-season switches, filtering, stable team colors,
per-driver result and summary consistency for every driver in the local archive,
and final championship standings.
tree/result consistency for every driver in the local archive, and circuit win
aggregation, ties, filters and map-marker scales (including a real-archive check).
