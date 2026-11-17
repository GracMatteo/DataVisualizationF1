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
Every new visualization page must include its own root-level `<Topic>Viz.md`
explaining the data pipeline and visual encodings, linked from this README.

## Run locally

```sh
npm install
npm run dev
```

Use the **Drivers** or **Circuits** capsule below the top bar to open a visualization.
Constructors and Races are placeholders for future visualizations.

## Driver career tree

See [DriverViz.md — data transformation pipeline and visual encodings](DriverViz.md)
for the CSV joins, filtering, hierarchy construction, point-size scale, color rules,
labels and interpretation limits.

## Circuit constructor map

A world map of every circuit, colored by the constructor with the most Grand Prix wins
there, with season, country and constructor filters.
See [CircuitViz.md — data transformation pipeline and visual encodings](CircuitViz.md)
for the win definition, aggregation, tie rules, marker scales, colors and limits.

## Validation

```sh
npm test
npm run lint
npm run build
```

Tests cover CSV normalization, missing values, result/status classification,
chronological grouping, mid-season switches, filtering, stable team colors,
tree/result consistency for every driver in the local archive, and circuit win
aggregation, ties, filters and map-marker scales (including a real-archive check).
