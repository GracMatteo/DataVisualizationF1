import { max, scaleSqrt } from 'd3'

const isPointNode = (node) => node.type === 'constructor' || node.type === 'season'
const points = (node) => Math.max(0, node.summary?.points ?? 0)

export function createTreeNodeRadius(nodes) {
  // Use the complete hierarchy so expanding/collapsing never changes the scale.
  const maximum = max(nodes.filter(isPointNode), points) || 1
  const pointRadius = scaleSqrt().domain([0, maximum]).range([10, 24]).clamp(true).unknown(10)

  return (node) => {
    if (isPointNode(node)) return pointRadius(points(node))
    if (node.type === 'race') return node.position > 0 && node.position <= 3 ? 7 : 5
    return 8
  }
}
