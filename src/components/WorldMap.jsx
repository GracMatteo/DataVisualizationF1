import { useEffect, useMemo, useRef, useState } from 'react'
import { geoNaturalEarth1, geoPath, select, zoom, zoomIdentity } from 'd3'
import { feature } from 'topojson-client'
import world from 'world-atlas/countries-110m.json'
import { useTipHandlers, useWidth } from './ui.jsx'

const land = feature(world, world.objects.countries)
land.features = land.features.filter((f) => f.id !== '010') // drop Antarctica

// points: [{ key, id, lat, lng, r, color, opacity, ring, tip }]
// Markers keep a constant on-screen size while the map zooms.
export function WorldMap({ points, selectedId, onSelect, height: fixedHeight, legend }) {
  const [ref, width] = useWidth(900)
  const height = fixedHeight ?? Math.round(Math.min(560, Math.max(300, width * 0.5)))
  const svgRef = useRef(null)
  const zoomRef = useRef(null)
  const [t, setT] = useState(zoomIdentity)
  const tip = useTipHandlers()

  const { path, projection } = useMemo(() => {
    const projection = geoNaturalEarth1().fitExtent([[8, 8], [width - 8, height - 8]], land)
    return { projection, path: geoPath(projection) }
  }, [width, height])
  const countries = useMemo(() => land.features.map((f) => ({ id: f.id ?? f.properties.name, d: path(f) })), [path])

  useEffect(() => {
    const z = zoom()
      .scaleExtent([1, 12])
      .translateExtent([[0, 0], [width, height]])
      .on('zoom', (e) => setT(e.transform))
    zoomRef.current = z
    const svg = select(svgRef.current).call(z)
    return () => svg.on('.zoom', null)
  }, [width, height])

  const zoomBy = (k) => select(svgRef.current).transition().duration(250).call(zoomRef.current.scaleBy, k)
  const reset = () => select(svgRef.current).transition().duration(250).call(zoomRef.current.transform, zoomIdentity)

  const placed = points
    .map((p) => {
      const [px, py] = projection([p.lng, p.lat])
      return { ...p, x: t.applyX(px), y: t.applyY(py) }
    })
    .sort((a, b) => (a.id === selectedId) - (b.id === selectedId) || b.r - a.r)

  return (
    <div ref={ref} className="map">
      <svg ref={svgRef} width={width} height={height} className="map__svg" role="img" aria-label="Carte mondiale des circuits">
        <g transform={t.toString()}>
          {countries.map((c) => (
            <path key={c.id} d={c.d} className="map__land" strokeWidth={0.5 / t.k} />
          ))}
        </g>
        {placed.map((p) => {
          const selected = p.id === selectedId
          return (
            <g key={p.key ?? p.id} {...tip(p.tip, onSelect && (() => onSelect(p.id)))} className="map__marker">
              <circle cx={p.x} cy={p.y} r={Math.max(p.r, 10)} className="hit" />
              {selected && <circle cx={p.x} cy={p.y} r={p.r + 5} className="map__selected" />}
              <circle
                cx={p.x}
                cy={p.y}
                r={p.r}
                className={`map__dot ${p.ring ? 'map__dot--ring' : ''}`}
                style={{ fill: p.color, fillOpacity: p.opacity ?? 0.85 }}
              />
            </g>
          )
        })}
      </svg>
      <div className="map__controls">
        <button type="button" onClick={() => zoomBy(1.6)} aria-label="Zoomer">+</button>
        <button type="button" onClick={() => zoomBy(1 / 1.6)} aria-label="Dézoomer">−</button>
        <button type="button" onClick={reset} aria-label="Réinitialiser le zoom">⟲</button>
      </div>
      {legend && <div className="map__legend">{legend}</div>}
    </div>
  )
}
