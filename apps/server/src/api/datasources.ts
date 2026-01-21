/**
 * Data Sources API
 * CRUD endpoints for data source management
 */

import { Hono } from 'hono'
import { DataSourceService } from '../services/datasource.js'
import type { DataSourceInput } from '../types.js'

export function createDataSourcesApi(): Hono {
  const app = new Hono()
  const service = new DataSourceService()

  // List all data sources
  app.get('/', (c) => {
    const dataSources = service.list()
    // Don't expose tokens in list
    const sanitized = dataSources.map((ds) => ({
      ...ds,
      token: ds.token ? '••••••••' : undefined,
    }))
    return c.json(sanitized)
  })

  // Get single data source
  app.get('/:id', (c) => {
    const id = c.req.param('id')
    const dataSource = service.get(id)
    if (!dataSource) {
      return c.json({ error: 'Data source not found' }, 404)
    }
    // Don't expose token
    return c.json({
      ...dataSource,
      token: dataSource.token ? '••••••••' : undefined,
    })
  })

  // Create new data source
  app.post('/', async (c) => {
    try {
      const body = (await c.req.json()) as DataSourceInput
      if (!body.name || !body.url) {
        return c.json({ error: 'name and url are required' }, 400)
      }

      const dataSource = await service.create(body)
      return c.json(
        {
          ...dataSource,
          token: dataSource.token ? '••••••••' : undefined,
        },
        201,
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 400)
    }
  })

  // Update data source
  app.put('/:id', async (c) => {
    const id = c.req.param('id')
    try {
      const body = (await c.req.json()) as Partial<DataSourceInput>
      const dataSource = service.update(id, body)
      if (!dataSource) {
        return c.json({ error: 'Data source not found' }, 404)
      }
      return c.json({
        ...dataSource,
        token: dataSource.token ? '••••••••' : undefined,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 400)
    }
  })

  // Delete data source
  app.delete('/:id', (c) => {
    const id = c.req.param('id')
    const deleted = service.delete(id)
    if (!deleted) {
      return c.json({ error: 'Data source not found' }, 404)
    }
    return c.json({ success: true })
  })

  // Test connection
  app.post('/:id/test', async (c) => {
    const id = c.req.param('id')
    const result = await service.testConnection(id)
    return c.json(result)
  })

  return app
}
