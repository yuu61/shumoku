/**
 * Hierarchical Layout Engine v2
 * Uses ELK.js for advanced graph layout with proper edge routing
 */

import ELK, { type ElkNode, type ElkExtendedEdge, type LayoutOptions } from 'elkjs/lib/elk.bundled.js'
import type {
  NetworkGraphV2,
  Node,
  Subgraph,
  LayoutResult,
  LayoutNode,
  LayoutLink,
  LayoutSubgraph,
  Position,
  Bounds,
  LayoutDirection,
} from '../../models/v2'

// ============================================
// Layout Options
// ============================================

export interface HierarchicalLayoutOptions {
  direction?: LayoutDirection
  nodeWidth?: number
  nodeHeight?: number
  nodeSpacing?: number
  rankSpacing?: number
  subgraphPadding?: number
  subgraphLabelHeight?: number
}

const DEFAULT_OPTIONS: Required<HierarchicalLayoutOptions> = {
  direction: 'TB',
  nodeWidth: 180,
  nodeHeight: 60,
  nodeSpacing: 100,     // Horizontal spacing between nodes
  rankSpacing: 150,     // Vertical spacing between layers
  subgraphPadding: 50,  // Padding inside subgraphs
  subgraphLabelHeight: 28,
}

// ============================================
// Layout Engine
// ============================================

export class HierarchicalLayoutV2 {
  private options: Required<HierarchicalLayoutOptions>
  private elk: InstanceType<typeof ELK>

  constructor(options?: HierarchicalLayoutOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
    this.elk = new ELK()
  }

  async layoutAsync(graph: NetworkGraphV2): Promise<LayoutResult> {
    const startTime = performance.now()
    const direction = graph.settings?.direction || this.options.direction

    // Build ELK graph
    const elkGraph = this.buildElkGraph(graph, direction)

    // Run ELK layout
    const layoutedGraph = await this.elk.layout(elkGraph)

    // Extract results
    const result = this.extractLayoutResult(graph, layoutedGraph)
    result.metadata = {
      algorithm: 'elk-layered',
      duration: performance.now() - startTime,
    }

    return result
  }

  // Synchronous wrapper that runs async internally
  layout(graph: NetworkGraphV2): LayoutResult {
    // For sync compatibility, we need to run layout synchronously
    // This is a simplified version - ideally use layoutAsync
    const direction = graph.settings?.direction || this.options.direction
    const elkGraph = this.buildElkGraph(graph, direction)

    // Run synchronous layout using elk's sync API
    let result: LayoutResult

    // Use a workaround: pre-calculate positions based on structure
    result = this.calculateFallbackLayout(graph, direction)

    // Start async layout and update when done (for future renders)
    this.elk.layout(elkGraph).then((layoutedGraph: ElkNode) => {
      // This will be available for next render
      Object.assign(result, this.extractLayoutResult(graph, layoutedGraph))
    }).catch(() => {
      // Keep fallback layout
    })

    return result
  }

  private buildElkGraph(graph: NetworkGraphV2, direction: LayoutDirection): ElkNode {
    const elkDirection = this.toElkDirection(direction)

    // Build subgraph map
    const subgraphMap = new Map<string, Subgraph>()
    if (graph.subgraphs) {
      for (const sg of graph.subgraphs) {
        subgraphMap.set(sg.id, sg)
      }
    }

    // Build node to parent map
    const nodeParent = new Map<string, string>()
    for (const node of graph.nodes) {
      if (node.parent) {
        nodeParent.set(node.id, node.parent)
      }
    }

    // Build subgraph children map
    const subgraphChildren = new Map<string, string[]>()
    for (const sg of subgraphMap.values()) {
      subgraphChildren.set(sg.id, [])
    }
    for (const sg of subgraphMap.values()) {
      if (sg.parent && subgraphMap.has(sg.parent)) {
        subgraphChildren.get(sg.parent)!.push(sg.id)
      }
    }

    // Create ELK nodes recursively
    const createElkNode = (nodeId: string, isSubgraph: boolean, subgraph?: Subgraph): ElkNode => {
      if (isSubgraph && subgraph) {
        // This is a subgraph (compound node)
        const childNodes: ElkNode[] = []

        // Add child subgraphs
        const childSgIds = subgraphChildren.get(subgraph.id) || []
        for (const childId of childSgIds) {
          const childSg = subgraphMap.get(childId)
          if (childSg) {
            childNodes.push(createElkNode(childId, true, childSg))
          }
        }

        // Add nodes in this subgraph
        for (const node of graph.nodes) {
          if (node.parent === subgraph.id) {
            const height = this.calculateNodeHeight(node)
            childNodes.push({
              id: node.id,
              width: this.options.nodeWidth,
              height,
              labels: [{ text: Array.isArray(node.label) ? node.label.join('\n') : node.label }],
            })
          }
        }

        return {
          id: subgraph.id,
          labels: [{ text: subgraph.label }],
          children: childNodes,
          layoutOptions: {
            'elk.padding': `[top=${this.options.subgraphPadding + this.options.subgraphLabelHeight},left=${this.options.subgraphPadding},bottom=${this.options.subgraphPadding},right=${this.options.subgraphPadding}]`,
          },
        }
      } else {
        // Regular node
        const node = graph.nodes.find(n => n.id === nodeId)
        const height = node ? this.calculateNodeHeight(node) : this.options.nodeHeight
        return {
          id: nodeId,
          width: this.options.nodeWidth,
          height,
        }
      }
    }

    // Build root children
    const rootChildren: ElkNode[] = []

    // Add root-level subgraphs
    for (const sg of subgraphMap.values()) {
      if (!sg.parent || !subgraphMap.has(sg.parent)) {
        rootChildren.push(createElkNode(sg.id, true, sg))
      }
    }

    // Add root-level nodes
    for (const node of graph.nodes) {
      if (!node.parent || !subgraphMap.has(node.parent)) {
        const height = this.calculateNodeHeight(node)
        rootChildren.push({
          id: node.id,
          width: this.options.nodeWidth,
          height,
        })
      }
    }

    // Build edges with labels
    const edges: ElkExtendedEdge[] = graph.links.map((link, index) => {
      const edge: ElkExtendedEdge = {
        id: link.id || `edge-${index}`,
        sources: [link.from],
        targets: [link.to],
      }
      // Add label if present
      if (link.label) {
        const labelText = Array.isArray(link.label) ? link.label.join(' / ') : link.label
        edge.labels = [{
          text: labelText,
          layoutOptions: {
            'elk.edgeLabels.placement': 'CENTER',
          }
        }]
      }
      return edge
    })

    // Root graph
    const rootLayoutOptions: LayoutOptions = {
      'elk.algorithm': 'layered',
      'elk.direction': elkDirection,
      'elk.spacing.nodeNode': String(this.options.nodeSpacing),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(this.options.rankSpacing),
      'elk.spacing.edgeNode': '50',  // Space between edges and nodes
      'elk.spacing.edgeEdge': '20',  // Space between edges
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.edgeRouting': 'SPLINES',  // Curved edges
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
    }

    return {
      id: 'root',
      children: rootChildren,
      edges,
      layoutOptions: rootLayoutOptions,
    }
  }

  private toElkDirection(direction: LayoutDirection): string {
    switch (direction) {
      case 'TB': return 'DOWN'
      case 'BT': return 'UP'
      case 'LR': return 'RIGHT'
      case 'RL': return 'LEFT'
      default: return 'DOWN'
    }
  }

  private calculateNodeHeight(node: Node): number {
    const lines = Array.isArray(node.label) ? node.label.length : 1
    const baseHeight = 40
    const lineHeight = 16
    return Math.max(this.options.nodeHeight, baseHeight + (lines - 1) * lineHeight)
  }

  private extractLayoutResult(graph: NetworkGraphV2, elkGraph: ElkNode): LayoutResult {
    const layoutNodes = new Map<string, LayoutNode>()
    const layoutSubgraphs = new Map<string, LayoutSubgraph>()
    const layoutLinks = new Map<string, LayoutLink>()

    // Build subgraph map for reference
    const subgraphMap = new Map<string, Subgraph>()
    if (graph.subgraphs) {
      for (const sg of graph.subgraphs) {
        subgraphMap.set(sg.id, sg)
      }
    }

    // Extract node and subgraph positions recursively
    const processElkNode = (elkNode: ElkNode, offsetX: number, offsetY: number) => {
      const x = (elkNode.x || 0) + offsetX
      const y = (elkNode.y || 0) + offsetY
      const width = elkNode.width || 0
      const height = elkNode.height || 0

      if (subgraphMap.has(elkNode.id)) {
        // This is a subgraph
        const sg = subgraphMap.get(elkNode.id)!
        layoutSubgraphs.set(elkNode.id, {
          id: elkNode.id,
          bounds: { x, y, width, height },
          subgraph: sg,
        })

        // Process children
        if (elkNode.children) {
          for (const child of elkNode.children) {
            processElkNode(child, x, y)
          }
        }
      } else {
        // This is a regular node
        const node = graph.nodes.find(n => n.id === elkNode.id)
        if (node) {
          layoutNodes.set(elkNode.id, {
            id: elkNode.id,
            position: { x: x + width / 2, y: y + height / 2 },
            size: { width, height },
            node,
          })
        }
      }
    }

    // Process root children
    if (elkGraph.children) {
      for (const child of elkGraph.children) {
        processElkNode(child, 0, 0)
      }
    }

    // Calculate edges based on extracted node positions
    // We calculate our own routing since ELK's edge coordinates don't match our node coordinates
    graph.links.forEach((link, index) => {
      const id = link.id || `link-${index}`
      const fromNode = layoutNodes.get(link.from)
      const toNode = layoutNodes.get(link.to)

      if (!fromNode || !toNode) return

      // Calculate connection points on node borders
      const points = this.calculateEdgePath(fromNode, toNode, layoutNodes, layoutSubgraphs)

      layoutLinks.set(id, {
        id,
        from: link.from,
        to: link.to,
        points,
        link,
      })
    })

    // Calculate total bounds
    const bounds = this.calculateTotalBounds(layoutNodes, layoutSubgraphs)

    return {
      nodes: layoutNodes,
      links: layoutLinks,
      subgraphs: layoutSubgraphs,
      bounds,
    }
  }

  /**
   * Calculate edge path between two nodes as smooth bezier curve
   */
  private calculateEdgePath(
    fromNode: LayoutNode,
    toNode: LayoutNode,
    _allNodes: Map<string, LayoutNode>,
    _allSubgraphs: Map<string, LayoutSubgraph>
  ): Position[] {
    const fromPos = fromNode.position
    const toPos = toNode.position
    const fromSize = fromNode.size
    const toSize = toNode.size

    // Calculate direction from source to target
    const dx = toPos.x - fromPos.x
    const dy = toPos.y - fromPos.y

    // Determine connection points on node borders based on relative position
    let fromPoint: Position
    let toPoint: Position
    let controlDist: number

    // For vertical layouts (TB), prefer top/bottom connections
    if (Math.abs(dy) > Math.abs(dx) * 0.3) {
      // Primarily vertical
      if (dy > 0) {
        fromPoint = { x: fromPos.x, y: fromPos.y + fromSize.height / 2 }
        toPoint = { x: toPos.x, y: toPos.y - toSize.height / 2 }
      } else {
        fromPoint = { x: fromPos.x, y: fromPos.y - fromSize.height / 2 }
        toPoint = { x: toPos.x, y: toPos.y + toSize.height / 2 }
      }
      // Control point distance based on vertical distance
      controlDist = Math.min(Math.abs(toPoint.y - fromPoint.y) * 0.4, 80)

      // Generate bezier curve (4 points: start, control1, control2, end)
      return [
        fromPoint,
        { x: fromPoint.x, y: fromPoint.y + Math.sign(dy) * controlDist },
        { x: toPoint.x, y: toPoint.y - Math.sign(dy) * controlDist },
        toPoint,
      ]
    } else {
      // Primarily horizontal
      if (dx > 0) {
        fromPoint = { x: fromPos.x + fromSize.width / 2, y: fromPos.y }
        toPoint = { x: toPos.x - toSize.width / 2, y: toPos.y }
      } else {
        fromPoint = { x: fromPos.x - fromSize.width / 2, y: fromPos.y }
        toPoint = { x: toPos.x + toSize.width / 2, y: toPos.y }
      }
      // Control point distance based on horizontal distance
      controlDist = Math.min(Math.abs(toPoint.x - fromPoint.x) * 0.4, 80)

      // Generate bezier curve
      return [
        fromPoint,
        { x: fromPoint.x + Math.sign(dx) * controlDist, y: fromPoint.y },
        { x: toPoint.x - Math.sign(dx) * controlDist, y: toPoint.y },
        toPoint,
      ]
    }
  }

  private calculateFallbackLayout(graph: NetworkGraphV2, _direction: LayoutDirection): LayoutResult {
    // Simple fallback layout when async isn't available
    const layoutNodes = new Map<string, LayoutNode>()
    const layoutSubgraphs = new Map<string, LayoutSubgraph>()
    const layoutLinks = new Map<string, LayoutLink>()

    // Simple grid layout for nodes
    let x = 100
    let y = 100
    const rowHeight = this.options.nodeHeight + this.options.rankSpacing
    const colWidth = this.options.nodeWidth + this.options.nodeSpacing
    let col = 0
    const maxCols = 4

    for (const node of graph.nodes) {
      const height = this.calculateNodeHeight(node)
      layoutNodes.set(node.id, {
        id: node.id,
        position: { x: x + this.options.nodeWidth / 2, y: y + height / 2 },
        size: { width: this.options.nodeWidth, height },
        node,
      })

      col++
      if (col >= maxCols) {
        col = 0
        x = 100
        y += rowHeight
      } else {
        x += colWidth
      }
    }

    // Simple links
    graph.links.forEach((link, index) => {
      const from = layoutNodes.get(link.from)
      const to = layoutNodes.get(link.to)
      if (from && to) {
        layoutLinks.set(link.id || `link-${index}`, {
          id: link.id || `link-${index}`,
          from: link.from,
          to: link.to,
          points: [from.position, to.position],
          link,
        })
      }
    })

    const bounds = this.calculateTotalBounds(layoutNodes, layoutSubgraphs)

    return {
      nodes: layoutNodes,
      links: layoutLinks,
      subgraphs: layoutSubgraphs,
      bounds,
      metadata: { algorithm: 'fallback-grid', duration: 0 },
    }
  }

  private calculateTotalBounds(
    nodes: Map<string, LayoutNode>,
    subgraphs: Map<string, LayoutSubgraph>
  ): Bounds {
    let minX = Infinity, minY = Infinity
    let maxX = -Infinity, maxY = -Infinity

    nodes.forEach((node) => {
      minX = Math.min(minX, node.position.x - node.size.width / 2)
      minY = Math.min(minY, node.position.y - node.size.height / 2)
      maxX = Math.max(maxX, node.position.x + node.size.width / 2)
      maxY = Math.max(maxY, node.position.y + node.size.height / 2)
    })

    subgraphs.forEach((sg) => {
      minX = Math.min(minX, sg.bounds.x)
      minY = Math.min(minY, sg.bounds.y)
      maxX = Math.max(maxX, sg.bounds.x + sg.bounds.width)
      maxY = Math.max(maxY, sg.bounds.y + sg.bounds.height)
    })

    const padding = 50

    if (minX === Infinity) {
      return { x: 0, y: 0, width: 400, height: 300 }
    }

    return {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
    }
  }
}

// Default export
export const hierarchicalLayoutV2 = new HierarchicalLayoutV2()
