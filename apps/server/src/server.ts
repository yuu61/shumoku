/**
 * HTTP + WebSocket Server using Hono + Node.js
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

// __dirname and __filename are provided by esbuild banner in the bundle
declare const __dirname: string
declare const __filename: string

import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { createNodeWebSocket } from '@hono/node-ws'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { WSContext } from 'hono/ws'
import type { Config, ClientMessage, ClientState, MetricsMessage, MetricsData } from './types.js'
import { TopologyManager } from './topology.js'
import { generateMetricsHtml } from './html-generator.js'
import { MockMetricsProvider } from './mock-metrics.js'
import { initDatabase, closeDatabase } from './db/index.js'
import { createApiRouter } from './api/index.js'
import { TopologyService } from './services/topology.js'

export class Server {
  private app: Hono
  private config: Config
  private topologyManager: TopologyManager
  private topologyService: TopologyService | null = null
  private metricsProvider: MockMetricsProvider
  private clients: Map<WSContext, ClientState> = new Map()
  private pollInterval: ReturnType<typeof setInterval> | null = null
  private wsUpgradeHandler: ReturnType<typeof createNodeWebSocket>['injectWebSocket'] | null = null
  private httpServer: ReturnType<typeof serve> | null = null
  // Metrics cache for DB topologies (keyed by topology ID)
  private dbTopologyMetrics: Map<string, MetricsData> = new Map()

  constructor(config: Config) {
    this.config = config
    this.app = new Hono()
    this.topologyManager = new TopologyManager(config)
    this.metricsProvider = new MockMetricsProvider()

    this.setupBaseRoutes()
  }

  /**
   * Setup routes that don't require database
   */
  private setupBaseRoutes(): void {
    // CORS for API access
    this.app.use('*', cors())

    // Legacy API: Get topology details with current metrics (by name)
    this.app.get('/api/topology/:name', (c) => {
      const name = c.req.param('name')
      const instance = this.topologyManager.getTopology(name)
      if (!instance) {
        return c.json({ error: 'Topology not found' }, 404)
      }
      return c.json({
        name: instance.name,
        graph: instance.graph,
        metrics: instance.metrics,
      })
    })

    // Legacy: Topology view (HTML page with real-time updates)
    // Kept for backward compatibility with file-based topologies
    this.app.get('/topology/:name', (c) => {
      const name = c.req.param('name')
      const instance = this.topologyManager.getTopology(name)
      if (!instance) {
        return c.html('<h1>Topology not found</h1>', 404)
      }

      const wsUrl = `ws://${c.req.header('host')}/ws`
      const html = generateMetricsHtml(instance, {
        wsUrl,
        weathermap: this.config.weathermap,
      })
      return c.html(html)
    })
  }

  /**
   * Setup static file serving (called after API routes)
   */
  private setupStaticFileServing(): void {
    const webBuildPath = this.getWebBuildPath()
    if (webBuildPath && fs.existsSync(webBuildPath)) {
      console.log(`[Server] Serving static files from: ${webBuildPath}`)

      // Serve static assets
      this.app.use(
        '/*',
        serveStatic({
          root: webBuildPath,
          rewriteRequestPath: (pathStr) => pathStr,
        }),
      )

      // SPA fallback - serve index.html for all non-API routes
      this.app.get('*', async (c) => {
        const indexPath = path.join(webBuildPath, 'index.html')
        if (fs.existsSync(indexPath)) {
          const html = fs.readFileSync(indexPath, 'utf-8')
          return c.html(html)
        }
        return c.text('Not found', 404)
      })
    } else {
      // Fallback to legacy dashboard if web UI is not built
      console.log('[Server] Web UI not found, using legacy dashboard')

      this.app.get('/', (c) => {
        const topologies = this.topologyManager.listTopologies()
        const html = this.renderDashboard(topologies)
        return c.html(html)
      })

      this.app.get('/settings', (c) => {
        const html = this.renderSettingsPage()
        return c.html(html)
      })
    }
  }

  /**
   * Get the path to the web build directory
   */
  private getWebBuildPath(): string | null {
    // Check various possible locations
    const possiblePaths = [
      path.join(process.cwd(), 'web', 'build'),
      path.join(process.cwd(), 'apps', 'server', 'web', 'build'),
      path.join(__dirname, '..', 'web', 'build'),
      '/app/web/build', // Docker path
    ]

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return p
      }
    }

    return null
  }

  private setupWebSocket(): void {
    const { upgradeWebSocket, injectWebSocket } = createNodeWebSocket({ app: this.app })
    this.wsUpgradeHandler = injectWebSocket

    // WebSocket endpoint
    this.app.get(
      '/ws',
      upgradeWebSocket(() => ({
        onOpen: (_event, ws) => {
          this.handleWebSocketOpen(ws)
        },
        onMessage: (event, ws) => {
          this.handleClientMessage(ws, event.data.toString())
        },
        onClose: (_event, ws) => {
          this.handleWebSocketClose(ws)
        },
        onError: (_event, ws) => {
          console.error('[WebSocket] Error')
          this.clients.delete(ws)
        },
      })),
    )
  }

  private renderDashboard(topologies: string[]): string {
    const items = topologies
      .map(
        (name) => `
      <a href="/topology/${encodeURIComponent(name)}" class="topology-card">
        <h2>${this.escapeHtml(name)}</h2>
        <p>View real-time network topology</p>
      </a>
    `,
      )
      .join('')

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Shumoku - Network Topologies</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: #f8fafc;
      min-height: 100vh;
      padding: 2rem;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    .header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 2rem;
    }
    h1 {
      font-size: 2rem;
      color: #1e293b;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .settings-link {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: #64748b;
      text-decoration: none;
      font-size: 0.875rem;
      padding: 0.5rem 1rem;
      border-radius: 8px;
      transition: all 0.2s;
    }
    .settings-link:hover {
      background: #f1f5f9;
      color: #1e293b;
    }
    .logo {
      width: 40px;
      height: 40px;
      background: #7FE4C1;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1.5rem;
    }
    .topology-card {
      background: white;
      border-radius: 12px;
      padding: 1.5rem;
      text-decoration: none;
      color: inherit;
      border: 1px solid #e2e8f0;
      transition: all 0.2s;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .topology-card:hover {
      border-color: #7FE4C1;
      box-shadow: 0 4px 12px rgba(127,228,193,0.2);
      transform: translateY(-2px);
    }
    .topology-card h2 {
      font-size: 1.25rem;
      color: #1e293b;
      margin-bottom: 0.5rem;
    }
    .topology-card p {
      font-size: 0.875rem;
      color: #64748b;
    }
    .empty {
      text-align: center;
      color: #64748b;
      padding: 3rem;
    }
    .empty-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header-row">
      <h1>
        <span class="logo">
          <svg viewBox="0 0 1024 1024" width="24" height="24" fill="none">
            <g transform="translate(90,40) scale(1.25)">
              <path fill="#1F2328" d="M380 340H450V505H700V555H510V645H450V645H380Z"/>
            </g>
          </svg>
        </span>
        Shumoku
      </h1>
      <a href="/settings" class="settings-link">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
        Settings
      </a>
    </div>
    <div class="grid">
      ${
        items ||
        `<div class="empty">
        <div class="empty-icon">🔌</div>
        <p>No topologies configured yet.</p>
        <p>Add topology files to /data/topologies/ to get started.</p>
      </div>`
      }
    </div>
  </div>
</body>
</html>`
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  private renderSettingsPage(): string {
    const zabbixConfig = this.config.zabbix
    const weathermapConfig = this.config.weathermap
    const topologies = this.topologyManager.listTopologies()

    const thresholdRows = weathermapConfig?.thresholds
      ?.map(
        (t) => `
        <tr>
          <td>${t.value}%</td>
          <td><span class="color-swatch" style="background: ${t.color}"></span> ${t.color}</td>
        </tr>
      `,
      )
      .join('') || '<tr><td colspan="2">Default thresholds</td></tr>'

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Settings - Shumoku</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: #f8fafc;
      min-height: 100vh;
      color: #1e293b;
    }
    .header {
      background: white;
      border-bottom: 1px solid #e2e8f0;
      padding: 1rem 2rem;
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .header a {
      color: #64748b;
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .header a:hover { color: #1e293b; }
    .header h1 {
      font-size: 1.25rem;
      font-weight: 600;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
    }
    .section {
      background: white;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      margin-bottom: 1.5rem;
      overflow: hidden;
    }
    .section-header {
      padding: 1rem 1.5rem;
      border-bottom: 1px solid #e2e8f0;
      background: #f8fafc;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .section-header h2 {
      font-size: 1rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .section-header .badge {
      font-size: 0.75rem;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      background: #e2e8f0;
      color: #64748b;
    }
    .section-header .badge.readonly {
      background: #fef3c7;
      color: #92400e;
    }
    .section-content {
      padding: 1.5rem;
    }
    .config-row {
      display: flex;
      justify-content: space-between;
      padding: 0.75rem 0;
      border-bottom: 1px solid #f1f5f9;
    }
    .config-row:last-child { border-bottom: none; }
    .config-label {
      color: #64748b;
      font-size: 0.875rem;
    }
    .config-value {
      font-weight: 500;
      font-size: 0.875rem;
    }
    .config-value.success { color: #16a34a; }
    .config-value.warning { color: #ca8a04; }
    .config-value.muted { color: #94a3b8; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
    }
    th, td {
      padding: 0.75rem;
      text-align: left;
      border-bottom: 1px solid #f1f5f9;
    }
    th { color: #64748b; font-weight: 500; }
    .color-swatch {
      display: inline-block;
      width: 16px;
      height: 16px;
      border-radius: 4px;
      vertical-align: middle;
      margin-right: 0.5rem;
      border: 1px solid rgba(0,0,0,0.1);
    }
    .form-group {
      margin-bottom: 1rem;
    }
    .form-group:last-child { margin-bottom: 0; }
    .form-group label {
      display: block;
      font-size: 0.875rem;
      color: #64748b;
      margin-bottom: 0.5rem;
    }
    .form-group select, .form-group input {
      width: 100%;
      padding: 0.5rem 0.75rem;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      font-size: 0.875rem;
      background: white;
    }
    .form-group select:focus, .form-group input:focus {
      outline: none;
      border-color: #7FE4C1;
      box-shadow: 0 0 0 3px rgba(127,228,193,0.2);
    }
    .toggle-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 0;
      border-bottom: 1px solid #f1f5f9;
    }
    .toggle-row:last-child { border-bottom: none; }
    .toggle {
      position: relative;
      width: 44px;
      height: 24px;
    }
    .toggle input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    .toggle-slider {
      position: absolute;
      cursor: pointer;
      top: 0; left: 0; right: 0; bottom: 0;
      background: #cbd5e1;
      border-radius: 24px;
      transition: 0.2s;
    }
    .toggle-slider:before {
      position: absolute;
      content: "";
      height: 18px;
      width: 18px;
      left: 3px;
      bottom: 3px;
      background: white;
      border-radius: 50%;
      transition: 0.2s;
    }
    .toggle input:checked + .toggle-slider {
      background: #7FE4C1;
    }
    .toggle input:checked + .toggle-slider:before {
      transform: translateX(20px);
    }
    .btn {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 6px;
      font-size: 0.875rem;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-primary {
      background: #7FE4C1;
      color: #1e293b;
    }
    .btn-primary:hover {
      background: #5fd3a8;
    }
    .save-notice {
      font-size: 0.75rem;
      color: #64748b;
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid #f1f5f9;
    }
  </style>
</head>
<body>
  <div class="header">
    <a href="/">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
      Back
    </a>
    <h1>Settings</h1>
  </div>

  <div class="container">
    <!-- Server Settings (Read-only) -->
    <div class="section">
      <div class="section-header">
        <h2>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="3" width="20" height="14" rx="2"/>
            <path d="M8 21h8M12 17v4"/>
          </svg>
          Server
        </h2>
        <span class="badge readonly">Read-only</span>
      </div>
      <div class="section-content">
        <div class="config-row">
          <span class="config-label">Host</span>
          <span class="config-value">${this.config.server.host}</span>
        </div>
        <div class="config-row">
          <span class="config-label">Port</span>
          <span class="config-value">${this.config.server.port}</span>
        </div>
        <div class="config-row">
          <span class="config-label">Topologies</span>
          <span class="config-value">${topologies.length} loaded</span>
        </div>
      </div>
    </div>

    <!-- Zabbix Settings (Read-only) -->
    <div class="section">
      <div class="section-header">
        <h2>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 20V10M18 20V4M6 20v-4"/>
          </svg>
          Zabbix Integration
        </h2>
        <span class="badge readonly">Read-only</span>
      </div>
      <div class="section-content">
        ${
          zabbixConfig
            ? `
        <div class="config-row">
          <span class="config-label">Status</span>
          <span class="config-value success">Connected</span>
        </div>
        <div class="config-row">
          <span class="config-label">URL</span>
          <span class="config-value">${this.escapeHtml(zabbixConfig.url || '-')}</span>
        </div>
        <div class="config-row">
          <span class="config-label">Poll Interval</span>
          <span class="config-value">${(zabbixConfig.pollInterval || 30000) / 1000}s</span>
        </div>
        `
            : `
        <div class="config-row">
          <span class="config-label">Status</span>
          <span class="config-value warning">Not configured (using mock data)</span>
        </div>
        `
        }
      </div>
    </div>

    <!-- Weathermap Thresholds (Read-only) -->
    <div class="section">
      <div class="section-header">
        <h2>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 6v6l4 2"/>
          </svg>
          Weathermap Thresholds
        </h2>
        <span class="badge readonly">Read-only</span>
      </div>
      <div class="section-content">
        <table>
          <thead>
            <tr>
              <th>Utilization</th>
              <th>Color</th>
            </tr>
          </thead>
          <tbody>
            ${thresholdRows}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Display Settings (Editable) -->
    <div class="section">
      <div class="section-header">
        <h2>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          Display Settings
        </h2>
      </div>
      <div class="section-content">
        <div class="form-group">
          <label for="theme">Theme</label>
          <select id="theme">
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
        <div class="form-group">
          <label for="updateInterval">Update Interval</label>
          <select id="updateInterval">
            <option value="5000">5 seconds</option>
            <option value="10000">10 seconds</option>
            <option value="30000" selected>30 seconds</option>
            <option value="60000">1 minute</option>
            <option value="300000">5 minutes</option>
          </select>
        </div>
        <div class="toggle-row">
          <span class="config-label">Animation</span>
          <label class="toggle">
            <input type="checkbox" id="animation" checked>
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="toggle-row">
          <span class="config-label">Show Tooltips</span>
          <label class="toggle">
            <input type="checkbox" id="tooltips" checked>
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="save-notice">
          Changes are saved automatically to your browser.
        </div>
      </div>
    </div>
  </div>

  <script>
    // Load settings from localStorage
    const settings = JSON.parse(localStorage.getItem('shumoku-settings') || '{}')

    // Apply saved settings
    if (settings.theme) document.getElementById('theme').value = settings.theme
    if (settings.updateInterval) document.getElementById('updateInterval').value = settings.updateInterval
    if (settings.animation !== undefined) document.getElementById('animation').checked = settings.animation
    if (settings.tooltips !== undefined) document.getElementById('tooltips').checked = settings.tooltips

    // Save on change
    function saveSettings() {
      const newSettings = {
        theme: document.getElementById('theme').value,
        updateInterval: parseInt(document.getElementById('updateInterval').value),
        animation: document.getElementById('animation').checked,
        tooltips: document.getElementById('tooltips').checked,
      }
      localStorage.setItem('shumoku-settings', JSON.stringify(newSettings))
    }

    document.getElementById('theme').addEventListener('change', saveSettings)
    document.getElementById('updateInterval').addEventListener('change', saveSettings)
    document.getElementById('animation').addEventListener('change', saveSettings)
    document.getElementById('tooltips').addEventListener('change', saveSettings)
  </script>
</body>
</html>`
  }

  /**
   * Handle WebSocket connection open
   */
  private handleWebSocketOpen(ws: WSContext): void {
    const state: ClientState = {
      interval: 30000,
    }
    this.clients.set(ws, state)

    console.log(`[WebSocket] Client connected (total: ${this.clients.size})`)
  }

  /**
   * Handle WebSocket connection close
   */
  private handleWebSocketClose(ws: WSContext): void {
    this.clients.delete(ws)
    console.log(`[WebSocket] Client disconnected (total: ${this.clients.size})`)
  }

  private handleClientMessage(ws: WSContext, data: string): void {
    try {
      const msg = JSON.parse(data) as ClientMessage
      const state = this.clients.get(ws)
      if (!state) return

      switch (msg.type) {
        case 'subscribe':
          state.subscribedTopology = msg.topology
          console.log(`[WebSocket] Client subscribed to: ${msg.topology}`)
          // Send initial metrics immediately
          this.sendMetricsToClient(ws, state)
          break

        case 'setInterval':
          state.interval = Math.max(5000, Math.min(300000, msg.interval))
          console.log(`[WebSocket] Client set interval: ${state.interval}ms`)
          break

        case 'filter':
          state.filter = {
            nodes: msg.nodes ? new Set(msg.nodes) : undefined,
            links: msg.links ? new Set(msg.links) : undefined,
          }
          break
      }
    } catch (err) {
      console.error('[WebSocket] Invalid message:', err)
    }
  }

  private sendMetricsToClient(ws: WSContext, state: ClientState): void {
    if (!state.subscribedTopology) return

    // Try legacy TopologyManager first (by name)
    const instance = this.topologyManager.getTopology(state.subscribedTopology)

    // If not found, try DB topology (by ID)
    let metrics: MetricsData | undefined
    if (instance) {
      metrics = instance.metrics
    } else {
      metrics = this.dbTopologyMetrics.get(state.subscribedTopology)
    }

    if (!metrics) return

    // Apply filter if set
    if (state.filter) {
      const filteredNodes: Record<string, (typeof metrics.nodes)[string]> = {}
      const filteredLinks: Record<string, (typeof metrics.links)[string]> = {}

      if (state.filter.nodes) {
        for (const id of state.filter.nodes) {
          if (metrics.nodes[id]) {
            filteredNodes[id] = metrics.nodes[id]
          }
        }
      } else {
        Object.assign(filteredNodes, metrics.nodes)
      }

      if (state.filter.links) {
        for (const id of state.filter.links) {
          if (metrics.links[id]) {
            filteredLinks[id] = metrics.links[id]
          }
        }
      } else {
        Object.assign(filteredLinks, metrics.links)
      }

      metrics = {
        nodes: filteredNodes,
        links: filteredLinks,
        timestamp: metrics.timestamp,
      }
    }

    const message: MetricsMessage = {
      type: 'metrics',
      data: metrics,
    }

    try {
      ws.send(JSON.stringify(message))
    } catch (err) {
      console.error('[WebSocket] Failed to send metrics:', err)
    }
  }

  /**
   * Broadcast metrics to all subscribed clients
   */
  private broadcastMetrics(): void {
    for (const [ws, state] of this.clients) {
      if (state.subscribedTopology) {
        this.sendMetricsToClient(ws, state)
      }
    }
  }

  /**
   * Start polling metrics and broadcasting
   */
  private startMetricsPolling(): void {
    // Initial poll
    this.updateAllMetrics()

    // Default poll interval (can be configured)
    const interval = this.config.zabbix?.pollInterval || 30000
    this.pollInterval = setInterval(() => {
      this.updateAllMetrics()
      this.broadcastMetrics()
    }, interval)
  }

  private updateAllMetrics(): void {
    // Update legacy file-based topologies
    for (const name of this.topologyManager.listTopologies()) {
      const instance = this.topologyManager.getTopology(name)
      if (instance) {
        instance.metrics = this.metricsProvider.generateMetrics(instance.graph)
      }
    }

    // Update DB topologies
    if (this.topologyService) {
      this.updateDbTopologyMetrics()
    }
  }

  private async updateDbTopologyMetrics(): Promise<void> {
    if (!this.topologyService) return

    for (const topo of this.topologyService.list()) {
      try {
        const parsed = await this.topologyService.getParsed(topo.id)
        if (parsed) {
          const metrics = this.metricsProvider.generateMetrics(parsed.graph)
          this.dbTopologyMetrics.set(topo.id, metrics)
        }
      } catch (err) {
        // Skip topologies that fail to parse
      }
    }
  }

  /**
   * Setup routes that require database (called after initDatabase)
   */
  private setupApiRoutes(): void {
    // Mount new API router (v2 - database-backed)
    this.app.route('/api', createApiRouter())
  }

  /**
   * Initialize and load topologies
   */
  async initialize(): Promise<void> {
    // Initialize database
    initDatabase(this.config.server.dataDir)

    // Setup API routes that depend on database
    this.setupApiRoutes()

    // Setup static file serving (must be after API routes for correct priority)
    this.setupStaticFileServing()

    // Initialize topology service (database-backed)
    this.topologyService = new TopologyService()
    await this.topologyService.initializeSample()

    // Load legacy file-based topologies (backward compatibility)
    await this.topologyManager.loadAll()
    console.log(`[Server] Loaded ${this.topologyManager.listTopologies().length} file-based topologies`)
    console.log(`[Server] Database has ${this.topologyService.list().length} topologies`)
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    // Setup WebSocket BEFORE initialize (which sets up static file catch-all)
    this.setupWebSocket()

    await this.initialize()
    this.startMetricsPolling()

    this.httpServer = serve(
      {
        fetch: this.app.fetch,
        port: this.config.server.port,
        hostname: this.config.server.host,
      },
      (info) => {
        console.log(`[Server] Running at http://${info.address}:${info.port}`)
      },
    )

    // Inject WebSocket handler
    if (this.wsUpgradeHandler) {
      this.wsUpgradeHandler(this.httpServer)
    }
  }

  /**
   * Stop the server
   */
  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }

    // Close all WebSocket connections
    for (const ws of this.clients.keys()) {
      try {
        ws.close()
      } catch {
        // Ignore
      }
    }
    this.clients.clear()

    // Close HTTP server
    if (this.httpServer) {
      this.httpServer.close()
      this.httpServer = null
    }

    // Close database connection
    closeDatabase()
  }
}
