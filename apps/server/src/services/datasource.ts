/**
 * Data Source Service
 * Manages Zabbix and other data source connections
 */

import type { Database } from 'bun:sqlite'
import { getDatabase, generateId, timestamp } from '../db/index.js'
import type { DataSource, DataSourceInput, DataSourceType } from '../types.js'

interface DataSourceRow {
  id: string
  name: string
  type: string
  url: string
  token: string | null
  poll_interval: number
  created_at: number
  updated_at: number
}

function rowToDataSource(row: DataSourceRow): DataSource {
  return {
    id: row.id,
    name: row.name,
    type: row.type as DataSourceType,
    url: row.url,
    token: row.token ?? undefined,
    pollInterval: row.poll_interval,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class DataSourceService {
  private db: Database

  constructor() {
    this.db = getDatabase()
  }

  /**
   * Get all data sources
   */
  list(): DataSource[] {
    const rows = this.db.query('SELECT * FROM data_sources ORDER BY created_at DESC').all() as DataSourceRow[]
    return rows.map(rowToDataSource)
  }

  /**
   * Get a single data source by ID
   */
  get(id: string): DataSource | null {
    const row = this.db.query('SELECT * FROM data_sources WHERE id = ?').get(id) as DataSourceRow | undefined
    return row ? rowToDataSource(row) : null
  }

  /**
   * Get a data source by name
   */
  getByName(name: string): DataSource | null {
    const row = this.db.query('SELECT * FROM data_sources WHERE name = ?').get(name) as DataSourceRow | undefined
    return row ? rowToDataSource(row) : null
  }

  /**
   * Create a new data source
   */
  async create(input: DataSourceInput): Promise<DataSource> {
    const id = await generateId()
    const now = timestamp()

    this.db
      .query(
        `
      INSERT INTO data_sources (id, name, type, url, token, poll_interval, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(id, input.name, input.type || 'zabbix', input.url, input.token || null, input.pollInterval || 30000, now, now)

    return this.get(id)!
  }

  /**
   * Update an existing data source
   */
  update(id: string, input: Partial<DataSourceInput>): DataSource | null {
    const existing = this.get(id)
    if (!existing) {
      return null
    }

    const updates: string[] = []
    const values: (string | number | null)[] = []

    if (input.name !== undefined) {
      updates.push('name = ?')
      values.push(input.name)
    }
    if (input.type !== undefined) {
      updates.push('type = ?')
      values.push(input.type)
    }
    if (input.url !== undefined) {
      updates.push('url = ?')
      values.push(input.url)
    }
    if (input.token !== undefined) {
      updates.push('token = ?')
      values.push(input.token || null)
    }
    if (input.pollInterval !== undefined) {
      updates.push('poll_interval = ?')
      values.push(input.pollInterval)
    }

    if (updates.length === 0) {
      return existing
    }

    updates.push('updated_at = ?')
    values.push(timestamp())
    values.push(id)

    this.db.query(`UPDATE data_sources SET ${updates.join(', ')} WHERE id = ?`).run(...values)

    return this.get(id)
  }

  /**
   * Delete a data source
   */
  delete(id: string): boolean {
    const result = this.db.query('DELETE FROM data_sources WHERE id = ?').run(id)
    return result.changes > 0
  }

  /**
   * Test connection to a data source
   */
  async testConnection(id: string): Promise<{ success: boolean; message: string; version?: string }> {
    const dataSource = this.get(id)
    if (!dataSource) {
      return { success: false, message: 'Data source not found' }
    }

    if (dataSource.type === 'zabbix') {
      return this.testZabbixConnection(dataSource)
    }

    return { success: false, message: `Unknown data source type: ${dataSource.type}` }
  }

  /**
   * Test Zabbix API connection
   */
  private async testZabbixConnection(
    dataSource: DataSource,
  ): Promise<{ success: boolean; message: string; version?: string }> {
    try {
      const apiUrl = `${dataSource.url}/api_jsonrpc.php`

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json-rpc',
          ...(dataSource.token ? { Authorization: `Bearer ${dataSource.token}` } : {}),
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'apiinfo.version',
          params: [],
          id: 1,
        }),
      })

      if (!response.ok) {
        return { success: false, message: `HTTP error: ${response.status} ${response.statusText}` }
      }

      const result = (await response.json()) as { result?: string; error?: { message: string; data: string } }

      if (result.error) {
        return { success: false, message: `API error: ${result.error.message || result.error.data}` }
      }

      return {
        success: true,
        message: 'Connection successful',
        version: result.result,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, message: `Connection failed: ${message}` }
    }
  }
}
