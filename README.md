# DATA VISUALISATION

## Participants

 - GRAC Matteo
 - LOIRE Adam
 - DOMINGUES Matthis
 - MANNOCCI Mickael

## Data set :

lien kaggle : https://www.kaggle.com/datasets/jtrotman/formula-1-race-data?select=status.csv

## Project guidelines

See [ANGENT.md — project style and contribution rules](ANGENT.md).
Every new visualization page must include its own root-level `<Topic>Viz.md`
explaining the data pipeline and visual encodings, linked from this README.

## Run locally

```sh
npm install
npm run dev
```

Use the **Drivers** capsule below the top bar to open the explorer. Constructors,
Races and Circuits are placeholders for future visualizations.

## Driver career tree

See [DriverViz.md — data transformation pipeline and visual encodings](DriverViz.md)
for the CSV joins, filtering, hierarchy construction, point-size scale, color rules,
labels and interpretation limits.

## Validation

```sh
npm test
npm run lint
npm run build
```

Tests cover CSV normalization, missing values, result/status classification,
chronological grouping, mid-season switches, filtering, stable team colors,
and tree/result consistency for every driver in the local archive.
