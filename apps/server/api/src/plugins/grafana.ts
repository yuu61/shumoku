/**
 * Grafana Data Source Plugin
 *
 * Provides alerts capability via Grafana Alertmanager API.
 * Uses Service Account Token for authentication.
 */

import type {
  Alert,
  AlertQueryOptions,
  AlertSeverity,
  AlertsCapable,
  ConnectionResult,
  DataSourceCapability,
  DataSourcePlugin,
  GrafanaPluginConfig,
} from './types.js'

export class GrafanaPlugin implements DataSourcePlugin, AlertsCapable {
  readonly type = 'grafana'
  readonly displayName = 'Grafana'
  readonly capabilities: readonly DataSourceCapability[] = ['alerts']

  private config: GrafanaPluginConfig | null = null

  initialize(config: unknown): void {
    this.config = config as GrafanaPluginConfig
  }

  dispose(): void {
    this.config = null
  }

  async testConnection(): Promise<ConnectionResult> {
    try {
      const response = await this.fetch('/api/health')
      if (!response.ok) {
        return {
          success: false,
          message: `Grafana health check failed: ${response.status}`,
        }
      }

      const data = (await response.json()) as { version?: string; database?: string }
      return {
        success: true,
        message: `Connected to Grafana${data.version ? ` ${data.version}` : ''}`,
        version: data.version,
      }
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Connection failed',
      }
    }
  }

  // ============================================
  // AlertsCapable Implementation
  // ============================================

  async getAlerts(options?: AlertQueryOptions): Promise<Alert[]> {
    if (!this.config) {
      throw new Error('Plugin not initialized')
    }

    try {
      const response = await this.fetch('/api/alertmanager/grafana/api/v2/alerts')
      if (!response.ok) {
        console.error('[GrafanaPlugin] Alertmanager API error:', response.status)
        return []
      }

      interface GrafanaAlertmanagerAlert {
        fingerprint: string
        labels: Record<string, string>
        annotations?: Record<string, string>
        startsAt: string
        endsAt?: string
        status: { state: 'active' | 'suppressed' | 'unprocessed' }
        generatorURL?: string
      }

      const alertmanagerAlerts = (await response.json()) as GrafanaAlertmanagerAlert[]

      const now = Date.now()
      const timeRangeMs = (options?.timeRange || 3600) * 1000

      const alerts: Alert[] = alertmanagerAlerts
        .filter((a) => {
          const isActive = a.status.state === 'active'
          // Active alerts are always included; resolved alerts are filtered by timeRange
          if (!isActive) {
            if (options?.activeOnly) return false
            const startTime = new Date(a.startsAt).getTime()
            if (now - startTime > timeRangeMs) return false
          }
          return true
        })
        .map((a) => {
          const severity = this.mapSeverity(a.labels.severity)
          return {
            id: a.fingerprint,
            severity,
            title: a.labels.alertname || 'Unknown Alert',
            description: a.annotations?.description || a.annotations?.summary,
            host: a.labels.instance || a.labels.host,
            startTime: new Date(a.startsAt).getTime(),
            endTime: a.endsAt ? new Date(a.endsAt).getTime() : undefined,
            status: a.status.state === 'active' ? 'active' : 'resolved',
            source: 'grafana' as const,
            url: a.generatorURL,
            labels: this.filterLabels(a.labels),
          } satisfies Alert
        })

      if (options?.minSeverity) {
        const minOrder = this.getSeverityOrder(options.minSeverity)
        return alerts.filter((a) => this.getSeverityOrder(a.severity) >= minOrder)
      }

      return alerts
    } catch (err) {
      console.error('[GrafanaPlugin] Failed to fetch alerts:', err)
      return []
    }
  }

  // ============================================
  // Internal Methods
  // ============================================

  private async fetch(path: string): Promise<Response> {
    if (!this.config) {
      throw new Error('Plugin not initialized')
    }

    const url = this.config.url.replace(/\/$/, '') + path
    return fetch(url, {
      headers: {
        Authorization: `Bearer ${this.config.token}`,
      },
      signal: AbortSignal.timeout(5000),
    })
  }

  private filterLabels(labels: Record<string, string>): Record<string, string> {
    const filtered: Record<string, string> = {}
    for (const [key, value] of Object.entries(labels)) {
      // Skip internal Grafana labels
      if (key.startsWith('__')) continue
      filtered[key] = value
    }
    return filtered
  }

  private mapSeverity(severity?: string): AlertSeverity {
    if (!severity) return 'information'

    const severityLower = severity.toLowerCase()
    const severityMap: Record<string, AlertSeverity> = {
      critical: 'disaster',
      disaster: 'disaster',
      high: 'high',
      major: 'high',
      error: 'high',
      average: 'average',
      medium: 'average',
      warning: 'warning',
      warn: 'warning',
      minor: 'warning',
      low: 'information',
      info: 'information',
      information: 'information',
      none: 'ok',
      ok: 'ok',
    }

    return severityMap[severityLower] || 'information'
  }

  private getSeverityOrder(severity: AlertSeverity): number {
    const order: Record<AlertSeverity, number> = {
      ok: 0,
      information: 1,
      warning: 2,
      average: 3,
      high: 4,
      disaster: 5,
    }
    return order[severity] ?? 1
  }
}
