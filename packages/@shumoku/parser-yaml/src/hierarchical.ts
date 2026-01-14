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

            // Store the child graph
            sheets.set(subgraph.id, childResult.graph)

            // Merge child sheets with prefixed paths
            for (const [id, sheet] of childResult.sheets) {
              sheets.set(`${subgraph.id}/${id}`, sheet)
            }

            // If the child has pins defined, merge them with subgraph pins
            if (childResult.graph.pins && childResult.graph.pins.length > 0) {
              if (!subgraph.pins) {
                subgraph.pins = []
              }
              // Merge pins from child file (child pins take precedence for device/port mapping)
              for (const childPin of childResult.graph.pins) {
                const existingPin = subgraph.pins.find((p) => p.id === childPin.id)
                if (existingPin) {
                  // Merge: child's device/port info into parent's pin
                  existingPin.device = childPin.device || existingPin.device
                  existingPin.port = childPin.port || existingPin.port
                  existingPin.direction = childPin.direction || existingPin.direction
                  existingPin.position = childPin.position || existingPin.position
                } else {
                  subgraph.pins.push(childPin)
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

    return {
      graph,
      sheets,
      warnings: warnings.length > 0 ? warnings : undefined,
    }
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
