/**
 * Share API
 * Public endpoints for viewing shared topologies and dashboards (no auth required)
 */

import { Hono } from 'hono'
import { getDashboardService } from './dashboards.js'
import { buildRenderOutput, buildTopologyContext, getTopologyService } from './topologies.js'

export function createShareApi(): Hono {
  const app = new Hono()

  // Get shared topology context data
  app.get('/topologies/:token', async (c) => {
    const token = c.req.param('token')
    const service = getTopologyService()
    const topology = service.getByShareToken(token)
    if (!topology) {
      return c.json({ error: 'Not found' }, 404)
    }

    try {
      const parsed = await service.getParsed(topology.id)
      if (!parsed) {
        return c.json({ error: 'Failed to parse topology' }, 500)
      }

      return c.json({
        id: parsed.id,
        name: parsed.name,
        ...buildTopologyContext(parsed.graph),
        subgraphs: parsed.graph.subgraphs || [],
        metrics: parsed.metrics,
      })
    } catch (err) {
      console.error('[Share] Error:', err)
      return c.json({ error: 'Internal server error' }, 500)
    }
  })

  // Get shared topology render output
  app.get('/topologies/:token/render', async (c) => {
    const token = c.req.param('token')
    const service = getTopologyService()
    const topology = service.getByShareToken(token)
    if (!topology) {
      return c.json({ error: 'Not found' }, 404)
    }

    try {
      const parsed = await service.getParsed(topology.id)
      if (!parsed) {
        return c.json({ error: 'Failed to parse topology' }, 500)
      }
      return c.json(await buildRenderOutput(parsed))
    } catch (err) {
      console.error('[Share] Error:', err)
      return c.json({ error: 'Internal server error' }, 500)
    }
  })

  // Get shared dashboard data
  app.get('/dashboards/:token', (c) => {
    const token = c.req.param('token')
    const service = getDashboardService()
    const dashboard = service.getByShareToken(token)
    if (!dashboard) {
      return c.json({ error: 'Not found' }, 404)
    }

    return c.json({
      id: dashboard.id,
      name: dashboard.name,
      layoutJson: dashboard.layoutJson,
    })
  })

  return app
}
