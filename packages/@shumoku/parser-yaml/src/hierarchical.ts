/**
 * Hierarchical YAML Parser
 * Resolves file references and builds a complete hierarchical graph
 */

import type { HierarchicalNetworkGraph, NetworkGraph, Node, Link } from '@shumoku/core/models'
import { type ParseResult, type ParseWarning, YamlParser } from './parser.js'

/** Prefix for virtual export connector nodes */
const EXPORT_NODE_PREFIX = '__export_'
/** Prefix for virtual export connector links */
const EXPORT_LINK_PREFIX = '__export_link_'

/**
 * Check if a node is a virtual export connector
 */
export function isExportNode(nodeId: string): boolean {
  return nodeId.startsWith(EXPORT_NODE_PREFIX)
}

/**
 * Check if a link is a virtual export connector link
 */
export function isExportLink(linkId: string | undefined): boolean {
  return linkId?.startsWith(EXPORT_LINK_PREFIX) ?? false
}

/**
 * @deprecated Boundary edges are no longer used. ELK handles cross-hierarchy routing directly.
 */
export function isBoundaryEdge(_linkId: string | undefined): boolean {
  return false
}

/**
 * File resolver interface for loading external YAML files
 */
export interface FileResolver {
  /**
   * Read file contents by path
   */
  read(path: string): Promise<string>

  /**
   * Resolve relative path from base path
   */
  resolve(basePath: string, relativePath: string): string
}

/**
 * Result of hierarchical parsing
 */
export interface HierarchicalParseResult extends ParseResult {
  /**
   * The resolved hierarchical graph
   */
  graph: HierarchicalNetworkGraph

  /**
   * Map of sheet ID to their resolved NetworkGraph
   */
  sheets: Map<string, NetworkGraph>
}

/**
 * Hierarchical parser that resolves file references
 */
export class HierarchicalParser {
  private parser: YamlParser
  private resolver: FileResolver
  private loadedFiles: Set<string> = new Set()

  constructor(resolver: FileResolver) {
    this.parser = new YamlParser()
    this.resolver = resolver
  }

  /**
   * Parse YAML with file reference resolution
   * @param input - YAML content
   * @param basePath - Base path for resolving relative file references
   */
  async parse(input: string, basePath: string): Promise<HierarchicalParseResult> {
    const warnings: ParseWarning[] = []
    const sheets = new Map<string, NetworkGraph>()

    // Parse the main file
    const result = this.parser.parse(input)
    if (result.warnings) {
      warnings.push(...result.warnings)
    }

    const graph = result.graph as HierarchicalNetworkGraph
    graph.sheets = sheets
    graph.breadcrumb = ['root']

    // Resolve file references in subgraphs
    if (graph.subgraphs) {
      for (const subgraph of graph.subgraphs) {
        if (subgraph.file) {
          try {
            const filePath = this.resolver.resolve(basePath, subgraph.file)

            // Check for circular references
            if (this.loadedFiles.has(filePath)) {
              warnings.push({
                code: 'CIRCULAR_REFERENCE',
                message: `Circular file reference detected: ${filePath}`,
                severity: 'error',
              })
              continue
            }

            this.loadedFiles.add(filePath)

            // Load and parse the child file
            const fileContent = await this.resolver.read(filePath)
            const childResult = await this.parseChild(fileContent, filePath, subgraph.id)

            if (childResult.warnings) {
              warnings.push(...childResult.warnings)
            }

            // Store the child graph (as independent, complete graph for sheet navigation)
            // Deep clone to avoid mutation issues
            const childGraphClone = JSON.parse(JSON.stringify(childResult.graph))
            sheets.set(subgraph.id, childGraphClone)

            // Merge child sheets with prefixed paths
            for (const [id, sheet] of childResult.sheets) {
              sheets.set(`${subgraph.id}/${id}`, sheet)
            }

            // Merge child nodes into parent graph with correct parent reference
            // Skip virtual export nodes - they're only for child sheet view
            for (const childNode of childResult.graph.nodes) {
              // Skip virtual export connector nodes
              if (isExportNode(childNode.id)) continue

              // Set parent to this subgraph if node has no parent,
              // otherwise prefix with subgraph id
              const mergedNode = { ...childNode }
              if (!childNode.parent) {
                mergedNode.parent = subgraph.id
              } else {
                mergedNode.parent = `${subgraph.id}/${childNode.parent}`
              }
              graph.nodes.push(mergedNode)
            }

            // Merge child subgraphs with prefixed IDs and parent references
            if (childResult.graph.subgraphs) {
              for (const childSg of childResult.graph.subgraphs) {
                const mergedSg = { ...childSg }
                mergedSg.id = `${subgraph.id}/${childSg.id}`
                if (!childSg.parent) {
                  mergedSg.parent = subgraph.id
                } else {
                  mergedSg.parent = `${subgraph.id}/${childSg.parent}`
                }
                if (!graph.subgraphs) graph.subgraphs = []
                graph.subgraphs.push(mergedSg)
              }
            }

            // Merge child links (skip virtual export links)
            for (const childLink of childResult.graph.links) {
              // Skip virtual export connector links
              if (isExportLink(childLink.id)) continue

              const mergedLink = { ...childLink }
              mergedLink.from = this.cloneEndpoint(childLink.from)
              mergedLink.to = this.cloneEndpoint(childLink.to)
              if (childLink.id) {
                mergedLink.id = `${subgraph.id}/${childLink.id}`
              }
              graph.links.push(mergedLink)
            }

            // Merge child's pin device info into parent subgraph's pins
            // Parent may define pins without device/port, child defines the actual wiring
            if (childResult.graph.pins) {
              if (!subgraph.pins) {
                // No parent pins, use child's pins directly
                subgraph.pins = childResult.graph.pins
              } else {
                // Merge: copy device/port from child pins to parent pins with matching IDs
                for (const childPin of childResult.graph.pins) {
                  const parentPin = subgraph.pins.find((p) => p.id === childPin.id)
                  if (parentPin && childPin.device) {
                    parentPin.device = childPin.device
                    parentPin.port = childPin.port
                  } else if (!parentPin && childPin.device) {
                    // Child has a pin not in parent, add it
                    subgraph.pins.push(childPin)
                  }
                }
              }
            }
          } catch (error) {
            warnings.push({
              code: 'FILE_LOAD_ERROR',
              message: `Failed to load ${subgraph.file}: ${error instanceof Error ? error.message : 'Unknown error'}`,
              severity: 'error',
            })
          }
        }
      }
    }

    // Update child sheet export connectors with connection destination info
    // This must happen BEFORE resolvePinReferences since we need the original pin references
    this.updateExportConnectorsWithDestinations(graph, sheets)

    // Resolve pin references in parent links to actual device:port endpoints
    // This converts { node: subgraph, pin: pinId } to { node: device, port: port }
    this.resolvePinReferences(graph)

    return {
      graph,
      sheets,
      warnings: warnings.length > 0 ? warnings : undefined,
    }
  }

  /**
   * Update child sheet export connectors with connection destination info
   * Analyzes parent links to find where each pin connects to
   */
  private updateExportConnectorsWithDestinations(
    graph: HierarchicalNetworkGraph,
    sheets: Map<string, NetworkGraph>,
  ): void {
    if (!graph.subgraphs) return

    // Build subgraph label map for destination names
    const subgraphLabels = new Map<string, string>()
    for (const sg of graph.subgraphs) {
      subgraphLabels.set(sg.id, sg.label)
    }

    // Build pin resolution map: "subgraphId:pinId" → { device, port }
    const pinMap = new Map<string, { device: string; port?: string }>()
    for (const sg of graph.subgraphs) {
      if (!sg.pins) continue
      for (const pin of sg.pins) {
        if (!pin.device) continue
        pinMap.set(`${sg.id}:${pin.id}`, { device: pin.device, port: pin.port })
      }
    }

    // Analyze links to find pin connections
    // Build map: "subgraphId:pinId" → connection info including resolved device
    const connectionMap = new Map<
      string,
      {
        destSubgraph: string
        destSubgraphLabel: string
        destPin: string
        destDevice: string
        destPort?: string
        isSource: boolean
      }
    >()

    for (const link of graph.links) {
      const from = typeof link.from === 'string' ? { node: link.from } : link.from
      const to = typeof link.to === 'string' ? { node: link.to } : link.to

      // Check if this link uses pin references
      if ('pin' in from && from.pin && 'pin' in to && to.pin) {
        // Both endpoints use pins - this is a cross-subgraph connection
        const fromKey = `${from.node}:${from.pin}`
        const toKey = `${to.node}:${to.pin}`

        // Get resolved device:port for each endpoint
        const fromResolved = pinMap.get(fromKey)
        const toResolved = pinMap.get(toKey)

        // Source side: connects TO the destination
        connectionMap.set(fromKey, {
          destSubgraph: to.node,
          destSubgraphLabel: subgraphLabels.get(to.node) || to.node,
          destPin: to.pin,
          destDevice: toResolved?.device || to.node,
          destPort: toResolved?.port,
          isSource: true,
        })

        // Destination side: connects FROM the source
        connectionMap.set(toKey, {
          destSubgraph: from.node,
          destSubgraphLabel: subgraphLabels.get(from.node) || from.node,
          destPin: from.pin,
          destDevice: fromResolved?.device || from.node,
          destPort: fromResolved?.port,
          isSource: false,
        })
      }
    }

    // Update export connectors (nodes and links) in each child sheet
    for (const [sheetId, sheetGraph] of sheets) {
      for (const node of sheetGraph.nodes) {
        // Check if this is an export connector node
        if (!node.id.startsWith(EXPORT_NODE_PREFIX)) continue

        const pinId = node.id.slice(EXPORT_NODE_PREFIX.length)
        const connectionKey = `${sheetId}:${pinId}`
        const connection = connectionMap.get(connectionKey)

        if (connection) {
          // Update node label with destination subgraph name (no arrow)
          node.label = connection.destSubgraphLabel

          // Store connection info in metadata
          if (!node.metadata) node.metadata = {}
          node.metadata._destSubgraph = connection.destSubgraph
          node.metadata._destSubgraphLabel = connection.destSubgraphLabel
          node.metadata._destPin = connection.destPin
          node.metadata._destDevice = connection.destDevice
          node.metadata._destPort = connection.destPort
          node.metadata._isSource = connection.isSource

          // Also update the export link metadata for tooltip display
          const exportLinkId = `${EXPORT_LINK_PREFIX}${pinId}`
          const exportLink = sheetGraph.links.find((l) => l.id === exportLinkId)
          if (exportLink) {
            if (!exportLink.metadata) exportLink.metadata = {}
            exportLink.metadata._destSubgraphLabel = connection.destSubgraphLabel
            exportLink.metadata._destDevice = connection.destDevice
            exportLink.metadata._destPort = connection.destPort
          }
        }
      }
    }
  }

  /**
   * Resolve pin references in links to actual device:port endpoints
   * Converts { node: subgraphId, pin: pinId } to { node: deviceId, port: portName }
   */
  private resolvePinReferences(graph: HierarchicalNetworkGraph): void {
    if (!graph.subgraphs) return

    // Build pin resolution map: "subgraphId:pinId" → { device, port }
    const pinMap = new Map<string, { device: string; port?: string }>()
    for (const sg of graph.subgraphs) {
      if (!sg.pins) continue
      for (const pin of sg.pins) {
        if (!pin.device) continue
        pinMap.set(`${sg.id}:${pin.id}`, { device: pin.device, port: pin.port })
      }
    }

    // Resolve pin references in all links
    for (const link of graph.links) {
      link.from = this.resolveEndpointPin(link.from, pinMap)
      link.to = this.resolveEndpointPin(link.to, pinMap)
    }
  }

  /**
   * Resolve a single endpoint's pin reference if present
   */
  private resolveEndpointPin(
    endpoint: string | { node: string; port?: string; pin?: string; ip?: string },
    pinMap: Map<string, { device: string; port?: string }>,
  ): string | { node: string; port?: string; ip?: string } {
    if (typeof endpoint === 'string') return endpoint
    if (!endpoint.pin) return endpoint

    const key = `${endpoint.node}:${endpoint.pin}`
    const resolved = pinMap.get(key)
    if (!resolved) {
      // Pin not found, return endpoint as-is (will likely fail in layout)
      return endpoint
    }

    // Return resolved endpoint with device:port
    return {
      node: resolved.device,
      port: resolved.port,
      ip: endpoint.ip,
    }
  }

  /**
   * Clone endpoint for merged child links
   * Node IDs stay as-is since parent reference is set on the node itself
   */
  private cloneEndpoint(
    endpoint: string | { node: string; port?: string; pin?: string; ip?: string },
  ): string | { node: string; port?: string; pin?: string; ip?: string } {
    if (typeof endpoint === 'string') {
      return endpoint
    }
    return { ...endpoint }
  }

  /**
   * Parse a child file with its own context
   */
  private async parseChild(
    input: string,
    basePath: string,
    parentId: string,
  ): Promise<HierarchicalParseResult> {
    const childParser = new HierarchicalParser(this.resolver)
    // Share the loaded files set to detect circular references
    childParser.loadedFiles = this.loadedFiles

    const result = await childParser.parse(input, basePath)

    // Set parent reference
    result.graph.parentSheet = parentId
    result.graph.breadcrumb = ['root', parentId]

    // Generate export connector nodes and links for pins
    // These show "external connection" in child sheet view
    this.generateExportConnectors(result.graph)

    return result
  }

  /**
   * Generate virtual export connector nodes and links from graph.pins
   * These are displayed in child sheet view to show external connections
   */
  private generateExportConnectors(graph: NetworkGraph): void {
    if (!graph.pins || graph.pins.length === 0) return

    for (const pin of graph.pins) {
      if (!pin.device) continue

      // Create virtual export connector node
      const exportNodeId = `${EXPORT_NODE_PREFIX}${pin.id}`
      const exportNode: Node = {
        id: exportNodeId,
        label: pin.label || pin.id,
        shape: 'stadium', // Pill shape for connectors
        type: 'connector' as any, // Special type for rendering
        metadata: {
          _isExport: true,
          _pinId: pin.id,
          _direction: pin.direction || 'bidirectional',
        },
      }
      graph.nodes.push(exportNode)

      // Create virtual link between device and export connector
      // Direction determines link orientation:
      // - out: device → export (data flows out)
      // - in: export → device (data flows in)
      const exportLinkId = `${EXPORT_LINK_PREFIX}${pin.id}`
      const deviceEndpoint = pin.port ? { node: pin.device, port: pin.port } : pin.device
      const isIncoming = pin.direction === 'in'

      const exportLink: Link = {
        id: exportLinkId,
        from: isIncoming ? exportNodeId : deviceEndpoint,
        to: isIncoming ? deviceEndpoint : exportNodeId,
        type: 'dashed',
        arrow: 'forward',
      }
      graph.links.push(exportLink)
    }
  }

  /**
   * Reset the loaded files set (for reusing the parser)
   */
  reset(): void {
    this.loadedFiles.clear()
  }
}

/**
 * Node.js file resolver implementation
 */
export function createNodeFileResolver(): FileResolver {
  return {
    async read(path: string): Promise<string> {
      // Dynamic import for Node.js fs
      const fs = await import('node:fs/promises')
      return fs.readFile(path, 'utf-8')
    },

    resolve(basePath: string, relativePath: string): string {
      // Dynamic import for Node.js path
      const path = require('node:path')
      const dir = path.dirname(basePath)
      return path.resolve(dir, relativePath)
    },
  }
}

/**
 * Browser/in-memory file resolver for testing
 */
export function createMemoryFileResolver(files: Map<string, string>, basePath = '/'): FileResolver {
  return {
    async read(path: string): Promise<string> {
      const content = files.get(path)
      if (content === undefined) {
        throw new Error(`File not found: ${path}`)
      }
      return content
    },

    resolve(_basePath: string, relativePath: string): string {
      // Simple path resolution for memory resolver
      if (relativePath.startsWith('./')) {
        return basePath + relativePath.slice(2)
      }
      if (relativePath.startsWith('/')) {
        return relativePath
      }
      return basePath + relativePath
    },
  }
}
