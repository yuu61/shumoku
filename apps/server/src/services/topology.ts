/**
 * Topology Service
 * Manages network topologies with database persistence
 */

import type { Database } from 'bun:sqlite'
import type { LayoutResult, NetworkGraph } from '@shumoku/core'
import { sampleNetwork } from '@shumoku/core'
import { BunHierarchicalLayout } from '../layout.js'
import { YamlParser } from '@shumoku/parser-yaml'
import { getDatabase, generateId, timestamp } from '../db/index.js'
import type { Topology, TopologyInput, MetricsData, ZabbixMapping } from '../types.js'

interface TopologyRow {
  id: string
  name: string
  yaml_content: string
  data_source_id: string | null
  mapping_json: string | null
  created_at: number
  updated_at: number
}

function rowToTopology(row: TopologyRow): Topology {
  return {
    id: row.id,
    name: row.name,
    yamlContent: row.yaml_content,
    dataSourceId: row.data_source_id ?? undefined,
    mappingJson: row.mapping_json ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Parsed topology with layout and metrics ready for rendering
 */
export interface ParsedTopology {
  id: string
  name: string
  graph: NetworkGraph
  layout: LayoutResult
  metrics: MetricsData
  dataSourceId?: string
  mapping?: ZabbixMapping
}

export class TopologyService {
  private db: Database
  private layout: BunHierarchicalLayout
  private cache: Map<string, ParsedTopology> = new Map()

  constructor() {
    this.db = getDatabase()
    this.layout = new BunHierarchicalLayout()
  }

  /**
   * Get all topologies from the database
   */
  list(): Topology[] {
    const rows = this.db.query('SELECT * FROM topologies ORDER BY name ASC').all() as TopologyRow[]
    return rows.map(rowToTopology)
  }

  /**
   * Get a single topology by ID
   */
  get(id: string): Topology | null {
    const row = this.db.query('SELECT * FROM topologies WHERE id = ?').get(id) as TopologyRow | undefined
    return row ? rowToTopology(row) : null
  }

  /**
   * Get a topology by name
   */
  getByName(name: string): Topology | null {
    const row = this.db.query('SELECT * FROM topologies WHERE name = ?').get(name) as TopologyRow | undefined
    return row ? rowToTopology(row) : null
  }

  /**
   * Create a new topology
   */
  async create(input: TopologyInput): Promise<Topology> {
    // Validate YAML content by parsing it
    await this.parseYaml(input.yamlContent)

    const id = await generateId()
    const now = timestamp()

    this.db
      .prepare(
        `
      INSERT INTO topologies (id, name, yaml_content, data_source_id, mapping_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(id, input.name, input.yamlContent, input.dataSourceId || null, input.mappingJson || null, now, now)

    // Clear cache to force re-parse
    this.cache.delete(id)

    return this.get(id)!
  }

  /**
   * Update an existing topology
   */
  async update(id: string, input: Partial<TopologyInput>): Promise<Topology | null> {
    const existing = this.get(id)
    if (!existing) {
      return null
    }

    // If YAML content is being updated, validate it
    if (input.yamlContent !== undefined) {
      await this.parseYaml(input.yamlContent)
    }

    const updates: string[] = []
    const values: (string | number | null)[] = []

    if (input.name !== undefined) {
      updates.push('name = ?')
      values.push(input.name)
    }
    if (input.yamlContent !== undefined) {
      updates.push('yaml_content = ?')
      values.push(input.yamlContent)
    }
    if (input.dataSourceId !== undefined) {
      updates.push('data_source_id = ?')
      values.push(input.dataSourceId || null)
    }
    if (input.mappingJson !== undefined) {
      updates.push('mapping_json = ?')
      values.push(input.mappingJson || null)
    }

    if (updates.length === 0) {
      return existing
    }

    updates.push('updated_at = ?')
    values.push(timestamp())
    values.push(id)

    this.db.query(`UPDATE topologies SET ${updates.join(', ')} WHERE id = ?`).run(...values)

    // Clear cache to force re-parse
    this.cache.delete(id)

    return this.get(id)
  }

  /**
   * Update Zabbix mapping for a topology
   */
  updateMapping(id: string, mapping: ZabbixMapping): Topology | null {
    const existing = this.get(id)
    if (!existing) {
      return null
    }

    const mappingJson = JSON.stringify(mapping)
    this.db.query('UPDATE topologies SET mapping_json = ?, updated_at = ? WHERE id = ?').run(mappingJson, timestamp(), id)

    // Clear cache to force re-parse
    this.cache.delete(id)

    return this.get(id)
  }

  /**
   * Delete a topology
   */
  delete(id: string): boolean {
    const result = this.db.query('DELETE FROM topologies WHERE id = ?').run(id)
    this.cache.delete(id)
    return result.changes > 0
  }

  /**
   * Get a parsed topology ready for rendering
   * Uses cache if available
   */
  async getParsed(id: string): Promise<ParsedTopology | null> {
    // Check cache first
    if (this.cache.has(id)) {
      return this.cache.get(id)!
    }

    const topology = this.get(id)
    if (!topology) {
      return null
    }

    const parsed = await this.parseTopology(topology)
    this.cache.set(id, parsed)
    return parsed
  }

  /**
   * Get a parsed topology by name
   */
  async getParsedByName(name: string): Promise<ParsedTopology | null> {
    const topology = this.getByName(name)
    if (!topology) {
      return null
    }
    return this.getParsed(topology.id)
  }

  /**
   * Parse a topology and generate layout
   */
  private async parseTopology(topology: Topology): Promise<ParsedTopology> {
    const graph = await this.parseYaml(topology.yamlContent)
    const layoutResult = await this.layout.layout(graph)
    const metrics = this.createEmptyMetrics(graph)

    let mapping: ZabbixMapping | undefined
    if (topology.mappingJson) {
      try {
        mapping = JSON.parse(topology.mappingJson) as ZabbixMapping
      } catch {
        // Invalid JSON, ignore
      }
    }

    return {
      id: topology.id,
      name: topology.name,
      graph,
      layout: layoutResult,
      metrics,
      dataSourceId: topology.dataSourceId,
      mapping,
    }
  }

  /**
   * Parse YAML content to NetworkGraph
   */
  private async parseYaml(yamlContent: string): Promise<NetworkGraph> {
    // Check if the content has any file references (hierarchical)
    const hasFileRefs = yamlContent.includes('file:')

    if (hasFileRefs) {
      // For now, we don't support file references in DB-stored topologies
      // They should be resolved/flattened before saving
      throw new Error('File references (file:) are not supported in uploaded topologies. Please flatten your YAML.')
    }

    const parser = new YamlParser()
    const result = parser.parse(yamlContent)
    return result.graph
  }

  /**
   * Create empty metrics structure for a graph
   */
  private createEmptyMetrics(graph: NetworkGraph): MetricsData {
    const nodes: Record<string, { status: 'up' | 'down' | 'unknown' }> = {}
    const links: Record<string, { status: 'up' | 'down' | 'unknown'; utilization?: number }> = {}

    for (const node of graph.nodes) {
      nodes[node.id] = { status: 'unknown' }
    }

    for (let i = 0; i < graph.links.length; i++) {
      const linkId = graph.links[i].id || `link-${i}`
      links[linkId] = { status: 'unknown' }
    }

    return {
      nodes,
      links,
      timestamp: Date.now(),
    }
  }

  /**
   * Update metrics for a cached topology
   */
  updateMetrics(id: string, metrics: MetricsData): void {
    const cached = this.cache.get(id)
    if (cached) {
      cached.metrics = metrics
    }
  }

  /**
   * Clear all cached topologies
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Clear cached topology by ID
   */
  clearCacheEntry(id: string): void {
    this.cache.delete(id)
  }

  /**
   * List all topology names (for compatibility with old API)
   */
  listNames(): string[] {
    return this.list().map((t) => t.name)
  }

  /**
   * Initialize with sample topology if database is empty
   */
  async initializeSample(): Promise<void> {
    const existing = this.list()
    if (existing.length > 0) {
      return
    }

    console.log('[TopologyService] No topologies found, creating sample network')

    // Get the main file from sample network
    const mainFile = sampleNetwork.find((f) => f.name === 'main.yaml')
    if (!mainFile) {
      console.error('[TopologyService] Sample network main.yaml not found')
      return
    }

    // Note: The sample network has file references (hierarchical structure)
    // For DB-stored topologies, we don't support file: references
    // So we create a simplified single-file version for demonstration
    // In production, users would upload their own flattened YAML files

    // Create a simple sample topology instead of the hierarchical one
    const sampleYaml = `name: Sample Network
nodes:
  - id: router1
    label: Core Router
    type: router
  - id: switch1
    label: Distribution Switch
    type: switch
  - id: switch2
    label: Access Switch
    type: switch
  - id: server1
    label: Web Server
    type: server
  - id: server2
    label: Database Server
    type: server
links:
  - from: router1
    to: switch1
    bandwidth: 10G
  - from: switch1
    to: switch2
    bandwidth: 1G
  - from: switch1
    to: server1
    bandwidth: 1G
  - from: switch2
    to: server2
    bandwidth: 1G
`

    await this.create({
      name: 'Sample Network',
      yamlContent: sampleYaml,
    })

    console.log('[TopologyService] Sample network created')
  }
}
