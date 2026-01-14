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
 * Cross-subgraph link info for export connector generation
 */
interface CrossSubgraphLink {
  link: Link
  fromSubgraph: string
  fromSubgraphLabel: string
  fromDevice: string
  fromPort?: string
  toSubgraph: string
  toSubgraphLabel: string
  toDevice: string
  toPort?: string
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

    // Build device → subgraph map as we load child files
    const deviceToSubgraph = new Map<string, string>()

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

            // Store the child graph for sheet navigation (clone to avoid mutation)
            const childGraphClone = JSON.parse(JSON.stringify(childResult.graph))
            sheets.set(subgraph.id, childGraphClone)

            // Merge child sheets with prefixed paths
            for (const [id, sheet] of childResult.sheets) {
              sheets.set(`${subgraph.id}/${id}`, sheet)
            }

            // Merge child nodes and track device → subgraph mapping
            for (const childNode of childResult.graph.nodes) {
              // Skip virtual export connector nodes
              if (isExportNode(childNode.id)) continue

              // Track which subgraph this device belongs to
              deviceToSubgraph.set(childNode.id, subgraph.id)

              // Set parent reference
              const mergedNode = { ...childNode }
              if (!childNode.parent) {
                mergedNode.parent = subgraph.id
              } else {
                mergedNode.parent = `${subgraph.id}/${childNode.parent}`
              }
              graph.nodes.push(mergedNode)
            }

            // Merge child subgraphs with prefixed IDs
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
              if (isExportLink(childLink.id)) continue

              const mergedLink = { ...childLink }
              mergedLink.from = this.cloneEndpoint(childLink.from)
              mergedLink.to = this.cloneEndpoint(childLink.to)
              if (childLink.id) {
                mergedLink.id = `${subgraph.id}/${childLink.id}`
              }
              graph.links.push(mergedLink)
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

    // Build subgraph label map
    const subgraphLabels = new Map<string, string>()
    if (graph.subgraphs) {
      for (const sg of graph.subgraphs) {
        subgraphLabels.set(sg.id, sg.label)
      }
    }

    // Detect cross-subgraph links and generate export connectors
    const crossLinks = this.detectCrossSubgraphLinks(
      graph.links,
      deviceToSubgraph,
      subgraphLabels,
    )

    // Generate export connectors in child sheets
    this.generateExportConnectorsForCrossLinks(crossLinks, sheets)

    return {
      graph,
      sheets,
      warnings: warnings.length > 0 ? warnings : undefined,
    }
  }

  /**
   * Detect links that cross subgraph boundaries
   */
  private detectCrossSubgraphLinks(
    links: Link[],
    deviceToSubgraph: Map<string, string>,
    subgraphLabels: Map<string, string>,
  ): CrossSubgraphLink[] {
    const crossLinks: CrossSubgraphLink[] = []

    for (const link of links) {
      const from = typeof link.from === 'string' ? { node: link.from } : link.from
      const to = typeof link.to === 'string' ? { node: link.to } : link.to

      const fromSubgraph = deviceToSubgraph.get(from.node)
      const toSubgraph = deviceToSubgraph.get(to.node)

      // Check if this link crosses subgraph boundaries
      if (fromSubgraph && toSubgraph && fromSubgraph !== toSubgraph) {
        crossLinks.push({
          link,
          fromSubgraph,
          fromSubgraphLabel: subgraphLabels.get(fromSubgraph) || fromSubgraph,
          fromDevice: from.node,
          fromPort: from.port,
          toSubgraph,
          toSubgraphLabel: subgraphLabels.get(toSubgraph) || toSubgraph,
          toDevice: to.node,
          toPort: to.port,
        })
      }
    }

    return crossLinks
  }

  /**
   * Generate export connector nodes/links in child sheets for cross-subgraph links
   */
  private generateExportConnectorsForCrossLinks(
    crossLinks: CrossSubgraphLink[],
    sheets: Map<string, NetworkGraph>,
  ): void {
    // Group cross-links by subgraph and device:port
    // Map: "subgraphId:device:port" → { destSubgraphLabel, destDevice, destPort, isSource }
    const exportPoints = new Map<
      string,
      {
        subgraphId: string
        device: string
        port?: string
        destSubgraphLabel: string
        destDevice: string
        destPort?: string
        isSource: boolean
      }
    >()

    for (const crossLink of crossLinks) {
      // Source side (from)
      const fromKey = `${crossLink.fromSubgraph}:${crossLink.fromDevice}:${crossLink.fromPort || ''}`
      if (!exportPoints.has(fromKey)) {
        exportPoints.set(fromKey, {
          subgraphId: crossLink.fromSubgraph,
          device: crossLink.fromDevice,
          port: crossLink.fromPort,
          destSubgraphLabel: crossLink.toSubgraphLabel,
          destDevice: crossLink.toDevice,
          destPort: crossLink.toPort,
          isSource: true,
        })
      }

      // Destination side (to)
      const toKey = `${crossLink.toSubgraph}:${crossLink.toDevice}:${crossLink.toPort || ''}`
      if (!exportPoints.has(toKey)) {
        exportPoints.set(toKey, {
          subgraphId: crossLink.toSubgraph,
          device: crossLink.toDevice,
          port: crossLink.toPort,
          destSubgraphLabel: crossLink.fromSubgraphLabel,
          destDevice: crossLink.fromDevice,
          destPort: crossLink.fromPort,
          isSource: false,
        })
      }
    }

    // Generate export connectors for each export point
    for (const [key, exportPoint] of exportPoints) {
      const sheetGraph = sheets.get(exportPoint.subgraphId)
      if (!sheetGraph) continue

      // Create unique ID for this export connector
      const exportId = key.replace(/:/g, '_')

      // Create export connector node
      const exportNodeId = `${EXPORT_NODE_PREFIX}${exportId}`
      const exportNode: Node = {
        id: exportNodeId,
        label: exportPoint.destSubgraphLabel, // Show destination subgraph name
        shape: 'stadium',
        type: 'connector' as any,
        metadata: {
          _isExport: true,
          _destSubgraph: exportPoint.destSubgraphLabel,
          _destDevice: exportPoint.destDevice,
          _destPort: exportPoint.destPort,
          _isSource: exportPoint.isSource,
        },
      }
      sheetGraph.nodes.push(exportNode)

      // Create export connector link
      const exportLinkId = `${EXPORT_LINK_PREFIX}${exportId}`
      const deviceEndpoint = exportPoint.port
        ? { node: exportPoint.device, port: exportPoint.port }
        : exportPoint.device

      const exportLink: Link = {
        id: exportLinkId,
        // Source: device → export connector (outgoing)
        // Destination: export connector → device (incoming)
        from: exportPoint.isSource ? deviceEndpoint : exportNodeId,
        to: exportPoint.isSource ? exportNodeId : deviceEndpoint,
        type: 'dashed',
        arrow: 'forward',
        metadata: {
          _destSubgraphLabel: exportPoint.destSubgraphLabel,
          _destDevice: exportPoint.destDevice,
          _destPort: exportPoint.destPort,
        },
      }
      sheetGraph.links.push(exportLink)
    }
  }

  /**
   * Clone endpoint for merged child links
   */
  private cloneEndpoint(
    endpoint: string | { node: string; port?: string; ip?: string },
  ): string | { node: string; port?: string; ip?: string } {
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
    childParser.loadedFiles = this.loadedFiles

    const result = await childParser.parse(input, basePath)

    result.graph.parentSheet = parentId
    result.graph.breadcrumb = ['root', parentId]

    return result
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
      const fs = await import('node:fs/promises')
      return fs.readFile(path, 'utf-8')
    },

    resolve(basePath: string, relativePath: string): string {
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
