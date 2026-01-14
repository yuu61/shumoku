/**
 * Hierarchical YAML Parser
 * Resolves file references and builds a complete hierarchical graph
 */

import type { HierarchicalNetworkGraph, NetworkGraph } from '@shumoku/core/models'
import { type ParseResult, type ParseWarning, YamlParser } from './parser.js'

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
            // This enables ELK to build proper hierarchical layout
            for (const childNode of childResult.graph.nodes) {
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

            // Merge child links (node IDs stay as-is, parent is set on nodes)
            for (const childLink of childResult.graph.links) {
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

    // Resolve pin references in links to actual device:port endpoints
    // This allows cross-subgraph links to connect to internal devices
    this.resolvePinReferences(graph)

    return {
      graph,
      sheets,
      warnings: warnings.length > 0 ? warnings : undefined,
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
   * Resolve pin references in links to actual device:port endpoints
   */
  private resolvePinReferences(graph: HierarchicalNetworkGraph): void {
    if (!graph.links || !graph.subgraphs) return

    // Build pin map: subgraphId -> pinId -> { device, port }
    // Skip file-referenced subgraphs - they don't have device mappings in parent
    const pinMap = new Map<string, Map<string, { device?: string; port?: string }>>()
    for (const sg of graph.subgraphs) {
      if (sg.file) continue // Skip file-referenced subgraphs

      if (sg.pins) {
        const pins = new Map<string, { device?: string; port?: string }>()
        for (const pin of sg.pins) {
          pins.set(pin.id, { device: pin.device, port: pin.port })
        }
        pinMap.set(sg.id, pins)
      }
    }

    // Resolve each link endpoint
    for (const link of graph.links) {
      this.resolveEndpoint(link.from, pinMap)
      this.resolveEndpoint(link.to, pinMap)
    }
  }

  /**
   * Resolve a single endpoint's pin reference
   */
  private resolveEndpoint(
    endpoint: unknown,
    pinMap: Map<string, Map<string, { device?: string; port?: string }>>,
  ): void {
    if (typeof endpoint !== 'object' || !endpoint) return
    const ep = endpoint as { node?: string; pin?: string; port?: string }
    if (!ep.node || !ep.pin) return

    const subgraphPins = pinMap.get(ep.node)
    if (!subgraphPins) return

    const pin = subgraphPins.get(ep.pin)
    if (!pin || !pin.device) return

    // Replace endpoint with resolved device:port
    ep.node = pin.device
    ep.port = pin.port || ep.port
    delete ep.pin
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
