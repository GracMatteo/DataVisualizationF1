# Project guidelines for contributors and coding agents

This guide defines the coding, visual and documentation conventions for DataViz F1.
Read it alongside the [README](README.md) before changing the project. Preserve existing
work and keep changes focused on the requested visualization or feature.

## 1. Stack and project structure

- **React 19 + Vite**, using JavaScript ES modules and JSX.
- **D3.js 7** for data parsing, scales, hierarchical layouts and SVG interactions.
- Plain CSS with shared theme variables; no UI framework or CSS-in-JS dependency.
- **Oxlint** for linting and Node's built-in **`node:test`** for automated tests.
- SVG assets can be imported as React components with the existing `?react` convention.

| Location | Responsibility |
|---|---|
| `src/App.jsx` | Landing page and entry into the explorer |
| `src/components/` | Reusable controls and visualization components |
| `src/lib/` | Data loading, normalization, transformations, scales and presentation helpers |
| `src/index.css` | Global base styles, fonts and light/dark theme tokens |
| `src/App.css` | Landing-page and shared brand/button styles |
| `src/Dashboard.jsx`, `src/Dashboard.css` | Explorer state, layout, filters, summaries and details |
| `public/data/` | Local CSV dataset served by Vite |
| `tests/` | Transformation and regression tests |
| Root-level `*Viz.md` files | Explanation of each visualization's data pipeline and visual encodings |

Prefer existing helpers and dependencies. Do not add a router, charting library, UI kit
or external data service unless the requested feature genuinely needs one. Inspect the
current files before assuming that a previously discussed view is implemented.

## 2. Coding style

- Use two-space indentation, single-quoted JavaScript strings and ES module imports.
- Use functional React components and hooks. Component files use PascalCase and `.jsx`;
  non-React utilities use descriptive camelCase names and `.js`.
- New UI code generally omits semicolons. Some existing utility files use them: follow
  the surrounding file rather than reformatting unrelated code.
- Keep components focused. Put reusable calculations and transformations in `src/lib/`,
  not inside JSX render expressions or duplicated across visualizations.
- Keep transformation functions pure where practical. Do not mutate the shared indexed
  dataset or attach expansion state to cached source rows.
- Give nodes stable IDs derived from source IDs/group keys, not screen coordinates,
  array positions or shortened labels.
- Keep component modules focused on component exports. Share non-component helpers
  through `.js` modules to preserve React Fast Refresh and avoid lint warnings.
- Use descriptive names and explain non-obvious constraints, rather than commenting
  every line. Do not add unrelated refactors, rename existing files or discard user work.

## 3. Visual style

The interface is **minimalist, spacious and data-first**, with Formula 1 identity coming
from the data and constructor colors rather than decorative effects.

### Layout and typography

- Keep generous whitespace, clear headings and short supporting explanations.
- Reuse the shared brand/header and capsule navigation below the top bar.
- Keep placeholders clearly disabled or marked as coming soon; do not imply they work.
- Prefer subtle one-pixel borders, restrained corner rounding and simple chart panels.
  Avoid heavy shadows, gradients and unnecessary animation; tooltip shadows can remain subtle.
- Use the system sans-serif stack from `--sans`; use `--mono` for numeric summaries,
  compact chart captions or technical metadata where it helps scanning.
- Keep filter labels visible. Prefer existing native search inputs, selects and buttons.
- Keep layouts responsive without horizontal page overflow. Stack controls/panels on
  narrow screens and provide usable pan/zoom for charts larger than the viewport.
- Keep interactive controls comfortably sized; existing primary controls use a minimum
  height of approximately 44 pixels.

### Theme and colors

Use the tokens in [`src/index.css`](src/index.css) instead of hard-coded interface colors:

| Token | Use |
|---|---|
| `--bg`, `--surface` | Page and secondary surfaces |
| `--text-h`, `--text` | Primary headings/content and secondary text |
| `--border` | Dividers, panel outlines and neutral chart links |
| `--accent`, `--accent-bg`, `--accent-border` | Interactive emphasis, focus and hover states |
| `--sans`, `--mono` | Shared type stacks |

Support both light and dark themes through these tokens. Fixed colors are appropriate
for **documented data encodings**, such as constructor identity or race outcomes. Reuse
[`teamColors.js`](src/lib/teamColors.js) and
[`racePresentation.js`](src/lib/racePresentation.js) rather than inventing conflicting
palettes. Keep selection/focus styling distinct from a data category's fill color.

Color must not be the only way to identify a result: provide labels, a legend, tooltips
or persistent details. Explain which colors are categorical, quantitative or merely
interaction feedback in the visualization's documentation.

## 4. React and D3 responsibilities

- React owns loading/error state, filters, page/view selection and persistent details.
- D3 handles scales, layout, links and SVG marks inside a scoped `ref`/effect boundary.
  Do not let React and D3 independently update the same generated SVG elements.
- Use keyed data joins for stable updates. Clean up transitions, observers, listeners
  and generated scene elements when data changes or a component unmounts.
- Respect `prefers-reduced-motion` in both CSS and D3 transitions.
- Provide meaningful SVG titles/descriptions, visible focus states and keyboard access
  to node interactions. Native buttons/selects should have clear accessible labels.
- Make hover information available through keyboard focus or persistent selection too.
- Include loading, error/retry, empty-result and invalid-filter states where applicable.
- Avoid rendering an entire large dataset when it would make the visualization unusable.
  Use appropriate filtering, progressive disclosure or bounded expansion, and explain
  any limits instead of silently hiding data.

## 5. Data transformation conventions

- Load local CSVs from `public/data/` with paths that respect Vite's `BASE_URL`.
  Fetch only the tables needed by the visualization, not the full archive by default.
- Reuse [`loadF1Data.js`](src/lib/loadF1Data.js) for the tables it already indexes.
  Normalize identifiers before joining and preserve missing values as `null`.
- The dataset uses the literal `\N` for missing values. Do not turn missing positions,
  times or points into valid zero values accidentally. Document any aggregation fallback.
- Join by IDs rather than names. Be explicit about which unmatched rows are retained
  or excluded, the grouping keys, chronological order and inclusive/exclusive filters.
- Distinguish a race entry from a race start, and an individual driver's points from
  constructor or championship totals.
- Preserve the difference between official classified position and finishing status.
  Do not use `positionOrder` as a substitute for `position` or treat every missing
  position as a retirement. Reuse [`raceResults.js`](src/lib/raceResults.js).
- State whether sprint results, scoring adjustments and historical points differences
  are included. Do not describe raw race-point sums as official championship standings.
- Keep scale domains and missing/zero-value behavior deliberate and tested. Explain
  when filtering changes a scale and therefore changes visual comparability.

## 6. Required documentation for every new visualization page

**A new visualization page is not complete until it has its own Markdown document and
a working link to that document in `README.md`. Include both in the same change.**

### File and link rules

1. Create a descriptive root-level file named `<Topic>Viz.md`, using PascalCase.
   Examples of naming: `DriverViz.md`, `ConstructorViz.md`, `CircuitViz.md`.
2. Use [`DriverViz.md`](DriverViz.md) as the existing reference for detail and structure.
   Do not document a different topic by appending it to the driver guide.
3. Add a relative Markdown link to the new document in [`README.md`](README.md), under
   its visualization's section or a clearly labeled documentation index. A mention
   in plain text or an unlinked filename is not sufficient.
4. Put a link back to `README.md` in the new document. Link relevant source files using
   real project-relative paths; do not commit placeholder links.
5. Update that document whenever its pipeline, filters, marks, colors, scales or
   interaction behavior changes. A new layout on an existing page must also be
   explained in that page's documentation.
6. Describe implemented behavior only. Clearly label limitations and future ideas;
   do not claim that a proposed view, measurement or validation already exists.

### Required contents

Each visualization document must explain:

- **Purpose and unit of observation:** the question it answers and what one mark means
  (a driver, a result row, a lap, a constructor-season, etc.).
- **Source data:** CSV filenames, relevant columns, primary/foreign keys, joins and
  tables deliberately not used.
- **Transformation pipeline:** parsing, missing-value rules, row exclusions, filtering,
  sorting, grouping, derived fields and aggregation formulas. Add a readable pipeline
  diagram when useful.
- **Layout:** the chart type and how transformed data becomes positions, ordering,
  hierarchy or spatial relationships. Explain what distances do and do not mean.
- **Every visual encoding:** map each displayed datum to its mark/shape, position, size,
  color, line width/style and text. Explicitly identify constant/decorative channels
  that do not encode data.
- **Scale details:** domain, range, units, linear/square-root/log behavior, zero/missing
  handling and whether filtering recalculates the domain. Include formulas when needed.
- **Palette and precedence:** color values or shared palette source, categorical versus
  quantitative meaning, fallback colors, and which rule wins when categories overlap.
- **Labels and details:** captions, abbreviations, legends, tooltips and selected-item
  fields, including missing-value labels and shortened versus full names.
- **Interactions:** filters, expansion, selection, zoom/pan, reset, keyboard access and
  the difference between changing data and changing its presentation.
- **Interpretation limits:** dataset coverage, excluded records, historical comparability,
  possible duplicates, scoring assumptions and other caveats relevant to that page.
- **Implementation and validation:** links to the code/tests and what is actually tested.

## 7. Validation and completion checklist

For implementation changes, start with focused regression tests, then run:

```sh
npm test
npm run lint
npm run build
```

Add tests for new joins, calculations, filtering, missing values, classifications and
visual scale behavior. Check interactive changes in a browser when available, including
keyboard behavior, a narrow viewport, both themes and applicable empty/error states.
Report what was actually checked and any validation that could not be performed.

For documentation-only changes, verify relative links/anchors, source-code consistency
and formatting. Do not claim application tests or a build passed if they were not run.

Before completing a new visualization page, confirm:

- [ ] The page is reachable through the project's navigation and fits the shared style.
- [ ] Data processing is separated from presentation and tested where appropriate.
- [ ] Filters, legends, labels and details match the actual calculations and marks.
- [ ] Responsive, keyboard, loading, empty and error behavior is considered.
- [ ] A dedicated root-level `<Topic>Viz.md` documents the complete pipeline and encodings.
- [ ] `README.md` contains a working relative link to that document.
- [ ] Relevant existing documentation is updated and validation results are reported honestly.
