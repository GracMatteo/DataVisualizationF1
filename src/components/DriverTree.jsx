import { useEffect, useId, useRef, useState } from 'react'
import { hierarchy, linkHorizontal, select, tree, zoom, zoomIdentity, zoomTransform } from 'd3'
import { getTeamColor } from '../lib/teamColors.js'
import { createTreeNodeRadius } from '../lib/treeNodeRadius.js'
import { getRaceColor, getRaceDescription } from '../lib/racePresentation.js'

const shorten = (text, limit) => text.length > limit ? `${text.slice(0, limit - 1)}…` : text

function visitAll(node, callback) {
  const children = node.children || node._children || []
  children.forEach((child) => visitAll(child, callback))
  callback(node)
}

export default function DriverTree({ data, onSelectRace }) {
  const containerRef = useRef(null)
  const svgRef = useRef(null)
  const actionsRef = useRef({})
  const [tooltip, setTooltip] = useState(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const container = containerRef.current
    const svg = select(svgRef.current)
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const duration = reducedMotion ? 0 : 220
    const scene = svg.append('g')
    const linksLayer = scene.append('g').attr('class', 'tree-links').attr('aria-hidden', true)
    const nodesLayer = scene.append('g').attr('class', 'tree-nodes')
    const root = hierarchy(data)
    const nodeRadius = createTreeNodeRadius(root.descendants().map((node) => node.data))
    const layout = tree().nodeSize([64, 260])
    const path = linkHorizontal().x((node) => node.y).y((node) => node.x)
    let width = 1000
    let height = 600
    let selectedRaceId = null

    root.descendants().forEach((node) => {
      if (node.depth === 2) {
        node._children = node.children
        node.children = null
      }
    })

    const zoomBehavior = zoom()
      .scaleExtent([0.02, 3])
      .extent(() => [[0, 0], [width, height]])
      .on('zoom', (event) => {
        scene.attr('transform', event.transform)
        setTooltip(null)
      })
    svg.call(zoomBehavior).on('dblclick.zoom', null)

    function fit(animate = true) {
      const nodes = root.descendants()
      const left = Math.min(...nodes.map((node) => node.y - nodeRadius(node.data) - 8))
      const right = Math.max(...nodes.map((node) => node.y + (node.depth === 3 ? 340 : 230)))
      const top = Math.min(...nodes.map((node) => node.x)) - 30
      const bottom = Math.max(...nodes.map((node) => node.x)) + 30
      const scale = Math.max(0.02, Math.min(1, (width - 64) / (right - left), (height - 72) / (bottom - top)))
      const transform = zoomIdentity.translate(
        (width - (right + left) * scale) / 2,
        (height - (bottom + top) * scale) / 2,
      ).scale(scale)
      svg.interrupt()
      if (animate && duration) svg.transition().duration(duration).call(zoomBehavior.transform, transform)
      else svg.call(zoomBehavior.transform, transform)
    }

    function showTooltip(event, node) {
      if (node.data.type !== 'race') return
      const bounds = container.getBoundingClientRect()
      const target = event.currentTarget.getBoundingClientRect()
      const x = event.type === 'focus' ? target.left - bounds.left : event.clientX - bounds.left
      const y = event.type === 'focus' ? target.bottom - bounds.top : event.clientY - bounds.top
      setTooltip({ race: node.data, x: Math.max(8, Math.min(x + 14, bounds.width - 282)), y: Math.max(8, Math.min(y + 14, bounds.height - 156)) })
    }

    function activate(event, node) {
      event.stopPropagation()
      setTooltip(null)
      if (node.data.type === 'race') {
        selectedRaceId = node.data.id
        nodesLayer.selectAll('.tree-node').classed('is-selected', (item) => item.data.id === selectedRaceId)
        onSelectRace(node.data)
        return
      }
      if (node.children) {
        node._children = node.children
        node.children = null
      } else {
        node.children = node._children
        node._children = null
      }
      update(node)
    }

    function update(source = root) {
      const oldX = source.x0
      layout(root)
      const nodes = root.descendants()
      const origin = { x: source.x0 ?? source.x, y: source.y0 ?? source.y }
      const destination = { x: source.x, y: source.y }

      if (oldX !== undefined) {
        const current = zoomTransform(svg.node())
        svg.interrupt()
        svg.call(zoomBehavior.transform, zoomIdentity.translate(current.x, current.y + (oldX - source.x) * current.k).scale(current.k))
      }
      const transition = svg.transition().duration(duration)

      linksLayer.selectAll('path')
        .data(root.links(), (link) => link.target.data.id)
        .join(
          (enter) => enter.append('path').attr('d', path({ source: origin, target: origin })),
          (existing) => existing,
          (exit) => exit.transition().duration(duration).attr('d', path({ source: destination, target: destination })).remove(),
        )
        .transition(transition)
        .attr('d', path)

      const node = nodesLayer.selectAll('.tree-node')
        .data(nodes, (item) => item.data.id)
        .join(
          (enter) => {
            const group = enter.append('g')
              .attr('class', 'tree-node')
              .attr('transform', `translate(${origin.y},${origin.x})`)
              .attr('tabindex', 0)
              .attr('role', 'button')
              .on('click', activate)
              .on('keydown', (event, item) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  activate(event, item)
                }
                if (event.key === 'Escape') setTooltip(null)
              })
              .on('mouseenter focus', showTooltip)
              .on('mouseleave blur', () => setTooltip(null))
            group.append('circle').attr('class', 'node-focus-ring').attr('r', 12)
            group.append('circle').attr('class', 'node-dot')
            group.append('text').attr('class', 'node-toggle').attr('text-anchor', 'middle').attr('dy', '0.34em').attr('aria-hidden', true)
            group.append('text').attr('class', 'node-label').attr('x', 16).attr('y', -3)
            group.append('text').attr('class', 'node-caption').attr('x', 16).attr('y', 14)
            group.append('title')
            return group
          },
          (existing) => existing,
          (exit) => exit.transition().duration(duration).attr('transform', `translate(${destination.y},${destination.x})`).style('opacity', 0).remove(),
        )

      node.classed('is-race', (item) => item.data.type === 'race')
        .classed('is-selected', (item) => item.data.id === selectedRaceId)
        .attr('aria-expanded', (item) => item.data.type === 'race' ? null : Boolean(item.children))
        .attr('aria-label', (item) => item.data.type === 'race'
          ? `${item.data.year} ${item.data.raceName}, ${getRaceDescription(item.data)}. Show race details.`
          : `${item.data.name}, ${item.data.summary.entries} race entries, ${item.data.summary.points.toLocaleString()} points. ${item.children ? 'Collapse' : 'Expand'} branch.`)
      node.select('.node-dot')
        .attr('r', (item) => nodeRadius(item.data))
        .attr('fill', (item) => item.data.type === 'race' ? getRaceColor(item.data) : item.depth === 0 ? 'var(--text-h)' : getTeamColor(item.data.constructorRef))
      node.select('.node-focus-ring').attr('r', (item) => nodeRadius(item.data) + 4)
      node.selectAll('.node-label, .node-caption').attr('x', (item) => nodeRadius(item.data) + 10)
      node.select('.node-toggle').text((item) => item._children ? '+' : '')
      node.select('.node-label').text((item) => item.data.type === 'race'
        ? `${shorten(item.data.raceName.replace('Grand Prix', 'GP'), 28)} · ${item.data.resultLabel}`
        : shorten(item.data.name, 25))
      node.select('.node-caption').text((item) => {
        if (item.data.type === 'race') {
          const grid = item.data.grid > 0 ? `grid P${item.data.grid}` : 'grid n/a'
          return `R${item.data.round ?? '?'} · ${grid} · ${item.data.points ?? '—'} pts${item.data.outcome === 'retired' ? ' · retired' : ''}`
        }
        return `${item.data.summary.entries} entries · ${item.data.summary.points.toLocaleString()} pts`
      })
      node.select('title').text((item) => item.data.type === 'race'
        ? `${item.data.year} ${item.data.raceName} — ${getRaceDescription(item.data)} — ${item.data.status ?? 'Status unknown'}`
        : `${item.data.name} — ${item.data.summary.entries} race entries — ${item.data.summary.points.toLocaleString()} points`)
      node.transition(transition).attr('transform', (item) => `translate(${item.y},${item.x})`).style('opacity', 1)
      nodes.forEach((item) => { item.x0 = item.x; item.y0 = item.y })
    }

    actionsRef.current = {
      fit: () => fit(),
      zoomIn: () => svg.transition().duration(duration).call(zoomBehavior.scaleBy, 1.4),
      zoomOut: () => svg.transition().duration(duration).call(zoomBehavior.scaleBy, 1 / 1.4),
      expand: () => {
        visitAll(root, (node) => { if (node._children) { node.children = node._children; node._children = null } })
        update()
        fit()
      },
      collapse: () => {
        visitAll(root, (node) => {
          if (node.depth > 0 && node.children) { node._children = node.children; node.children = null }
        })
        if (root._children) { root.children = root._children; root._children = null }
        update()
        fit()
      },
    }

    function resize() {
      const bounds = container.getBoundingClientRect()
      width = Math.max(bounds.width, 320)
      height = Math.max(bounds.height, 400)
      svg.attr('viewBox', `0 0 ${width} ${height}`)
      fit(false)
    }

    update()
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(container)

    return () => {
      observer.disconnect()
      svg.interrupt().on('.zoom', null)
      scene.selectAll('*').interrupt()
      scene.remove()
      actionsRef.current = {}
    }
  }, [data, onSelectRace])

  return (
    <div className="tree-wrapper">
      <div className="tree-toolbar" aria-label="Tree controls">
        <div className="button-group">
          <button type="button" onClick={() => actionsRef.current.expand?.()}>Expand all</button>
          <button type="button" onClick={() => actionsRef.current.collapse?.()}>Collapse all</button>
        </div>
        <div className="button-group">
          <button type="button" onClick={() => actionsRef.current.zoomOut?.()} aria-label="Zoom out">−</button>
          <button type="button" onClick={() => actionsRef.current.zoomIn?.()} aria-label="Zoom in">+</button>
          <button type="button" onClick={() => actionsRef.current.fit?.()}>Fit tree</button>
        </div>
      </div>
      <div className="tree-canvas" ref={containerRef}>
        <svg ref={svgRef} role="group" aria-labelledby={titleId} aria-describedby={descriptionId}>
          <title id={titleId}>{data.name} career tidy tree</title>
          <desc id={descriptionId}>Driver, constructors, seasons, then race results. Constructor and season dots grow with this driver’s total race points in each branch, using a shared square-root scale with a visible minimum for zero points. Click a branch or focus it with Tab and press Enter to expand. Select a race for details. Drag to pan, scroll or pinch to zoom, or use the controls above.</desc>
        </svg>
        {tooltip && (
          <div className="tree-tooltip" role="tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
            <strong>{tooltip.race.year} · {tooltip.race.raceName}</strong>
            <span>{getRaceDescription(tooltip.race)}</span>
            <span>{tooltip.race.status ?? 'Status unknown'} · {tooltip.race.points ?? '—'} points</span>
            <small>Select to see full race details</small>
          </div>
        )}
      </div>
      <p className="tree-hint">Larger constructor and season dots mean more points. Click a season to reveal races.<br />Drag to pan · Scroll or pinch to zoom · Tab + Enter to explore</p>
    </div>
  )
}
