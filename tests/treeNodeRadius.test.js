import test from 'node:test'
import assert from 'node:assert/strict'
import { createTreeNodeRadius } from '../src/lib/treeNodeRadius.js'

const branch = (type, points) => ({ type, summary: { points } })

test('constructor and season dots grow with points on one shared square-root scale', () => {
  const nodes = [branch('constructor', 400), branch('constructor', 100), branch('season', 100), branch('season', 25)]
  const radius = createTreeNodeRadius(nodes)
  assert.equal(radius(nodes[0]), 24)
  assert.equal(radius(nodes[1]), 17)
  assert.equal(radius(nodes[1]), radius(nodes[2]))
  assert.ok(radius(nodes[2]) > radius(nodes[3]))
  assert.ok(radius(nodes[3]) > 10)
})

test('zero, missing and negative points keep a visible minimum radius', () => {
  const radius = createTreeNodeRadius([branch('constructor', 0), branch('season', 0)])
  for (const node of [branch('constructor', 0), branch('season', 0), branch('season', null), branch('constructor', -1)]) {
    assert.equal(radius(node), 10)
  }
  assert.equal(createTreeNodeRadius([])(branch('season', 0)), 10)
})

test('driver and race dots keep their original sizes and do not influence the points domain', () => {
  const constructor = branch('constructor', 100)
  const radius = createTreeNodeRadius([branch('driver', 10000), constructor, { type: 'race', points: 1000 }])
  assert.equal(radius(constructor), 24)
  assert.equal(radius({ type: 'driver' }), 8)
  for (const position of [1, 2, 3]) assert.equal(radius({ type: 'race', position }), 7)
  for (const position of [4, 10, null]) assert.equal(radius({ type: 'race', position }), 5)
})

test('the full hierarchy keeps season sizes stable when constructor children are collapsed', () => {
  const season = branch('season', 100)
  const constructor = { ...branch('constructor', 400), children: [season] }
  const radius = createTreeNodeRadius([constructor, season])
  const initial = radius(season)
  constructor.children = null
  assert.equal(radius(season), initial)
  assert.equal(radius(constructor), 24)
})
