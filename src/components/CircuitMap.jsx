import { useEffect, useMemo, useRef, useState } from 'react'
import { arc, geoNaturalEarth1, geoPath, pie, select, zoom, zoomIdentity } from 'd3'
import { feature } from 'topojson-client'
import world from 'world-atlas/countries-110m.json'

// Antarctica (ISO 010) hosts no circuit and would waste a third of the height.
const COUNTRIES = feature(world, world.objects.countries).features.filter((country) => country.id !== '010')
const LAND = { type: 'FeatureCollection', features: COUNTRIES }
const ZOOM_STEP = 1.6

// Slices start at 12 o'clock and keep the standings order (largest share first, Others last).
const PIE_LAYOUT = pie().value((slice) => slice.wins).sort(null)
const PIE_ARC = arc().innerRadius(0)

function PieMarker({ slices, r }) {
  return (
    <g className="circuit-marker__pie">
      {PIE_LAYOUT(slices).map((part) => (
        <path
          key={part.data.key}
          d={PIE_ARC.outerRadius(r)(part)}
          className={part.data.color ? undefined : 'circuit-marker__others'}
          style={part.data.color ? { fill: part.data.color } : undefined}
        />
      ))}
    </g>
  )
}

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

function markerLabel(marker) {
  return [marker.name, marker.place, ...marker.lines].filter(Boolean).join('. ')
}

/**
 * React renders land and markers from the current zoom transform; D3 only owns the
 * projection math and the zoom behavior. Markers keep a constant on-screen size.
 */
export default function CircuitMap({ markers, selectedId, onSelect, onClear }) {
  const frameRef = useRef(null)
  const svgRef = useRef(null)
  const zoomRef = useRef(null)
  const [width, setWidth] = useState(900)
  const [transform, setTransform] = useState(zoomIdentity)
  const [hoveredId, setHoveredId] = useState(null)
  const height = Math.round(Math.min(600, Math.max(260, width * 0.52)))

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return undefined
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.floor(entry.contentRect.width))))
    observer.observe(frame)
    return () => observer.disconnect()
  }, [])

  const { projection, countries } = useMemo(() => {
    const fitted = geoNaturalEarth1().fitExtent([[8, 8], [width - 8, height - 8]], LAND)
    const path = geoPath(fitted)
    return { projection: fitted, countries: COUNTRIES.map((country) => ({ id: country.id ?? country.properties.name, d: path(country) })) }
  }, [width, height])

  useEffect(() => {
    const svg = select(svgRef.current)
    const behavior = zoom()
      .scaleExtent([1, 12])
      .extent([[0, 0], [width, height]])
      .translateExtent([[0, 0], [width, height]])
      .on('zoom', (event) => setTransform(event.transform))
    zoomRef.current = behavior
    svg.call(behavior).on('dblclick.zoom', null)
    // A new size means a new projection: restart from the full world view.
    svg.call(behavior.transform, zoomIdentity)
    return () => {
      svg.interrupt()
      svg.on('.zoom', null)
    }
  }, [width, height])

  function applyZoom(method, value) {
    const svg = select(svgRef.current)
    const target = prefersReducedMotion() ? svg : svg.transition().duration(250)
    target.call(zoomRef.current[method], value)
  }

  const placed = useMemo(() => markers
    .map((marker) => {
      const point = projection([marker.lng, marker.lat])
      return point ? { ...marker, x: transform.applyX(point[0]), y: transform.applyY(point[1]) } : null
    })
    .filter(Boolean)
    // Inactive first, then large under small so every marker stays reachable; selection on top.
    .sort((a, b) => (a.id === selectedId) - (b.id === selectedId)
      || a.interactive - b.interactive
      || b.r - a.r
      || a.id - b.id), [markers, projection, transform, selectedId])

  const hovered = placed.find((marker) => marker.id === hoveredId)

  return (
    <div className="circuit-map" ref={frameRef}>
      <svg
        ref={svgRef}
        className="circuit-map__svg"
        width={width}
        height={height}
        aria-labelledby="circuit-map-title circuit-map-desc"
        onClick={(event) => { if (!event.target.closest('.circuit-marker')) onClear() }}
      >
        <title id="circuit-map-title">World map of Formula 1 circuits</title>
        <desc id="circuit-map-desc">Each dot is a circuit. Use Tab to move between circuits and Enter to open one.</desc>
        <g transform={transform.toString()} aria-hidden="true">
          {countries.map((country) => (
            <path key={country.id} d={country.d} className="circuit-map__land" strokeWidth={0.6 / transform.k} />
          ))}
        </g>
        <g>
          {placed.map((marker) => {
            const selected = marker.id === selectedId
            const choose = () => onSelect(marker.id)
            return (
              <g
                key={marker.id}
                className={`circuit-marker circuit-marker--${marker.kind}${selected ? ' is-selected' : ''}`}
                transform={`translate(${marker.x},${marker.y})`}
                {...(marker.interactive ? {
                  role: 'button',
                  tabIndex: 0,
                  'aria-label': markerLabel(marker),
                  'aria-pressed': selected,
                  onClick: choose,
                  onKeyDown: (event) => {
                    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose() }
                  },
                  onPointerEnter: () => setHoveredId(marker.id),
                  onPointerLeave: () => setHoveredId(null),
                  onFocus: () => setHoveredId(marker.id),
                  onBlur: () => setHoveredId(null),
                } : { 'aria-hidden': true })}
              >
                {marker.interactive && <circle className="circuit-marker__hit" r={Math.max(marker.r, 10)} />}
                <circle className="circuit-marker__focus" r={marker.r + 4} />
                {marker.slices
                  ? <PieMarker slices={marker.slices} r={marker.r} />
                  : <circle className="circuit-marker__dot" r={marker.r} style={marker.color ? { fill: marker.color } : undefined} />}
              </g>
            )
          })}
        </g>
      </svg>

      {hovered && (
        <div
          className="circuit-map__tooltip"
          role="presentation"
          style={{
            left: Math.min(hovered.x + 14, width - 250),
            top: hovered.y + 14 > height - 110 ? Math.max(8, hovered.y - 110) : hovered.y + 14,
          }}
        >
          <strong>{hovered.name}</strong>
          {hovered.place && <small>{hovered.place}</small>}
          {hovered.lines.map((line) => <span key={line}>{line}</span>)}
        </div>
      )}

      <div className="circuit-map__controls" role="group" aria-label="Map zoom">
        <button type="button" onClick={() => applyZoom('scaleBy', ZOOM_STEP)} aria-label="Zoom in">+</button>
        <button type="button" onClick={() => applyZoom('scaleBy', 1 / ZOOM_STEP)} aria-label="Zoom out">−</button>
        <button type="button" onClick={() => applyZoom('transform', zoomIdentity)}>Reset</button>
      </div>
    </div>
  )
}
