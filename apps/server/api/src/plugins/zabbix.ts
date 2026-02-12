/**
 * Zabbix Data Source Plugin
 *
 * Provides metrics, hosts, and auto-mapping capabilities.
 * Delegates Zabbix API communication to ZabbixClient.
 */

import type { NetworkGraph } from '@shumoku/core'
import { DEFAULT_CAPACITY } from '../bandwidth.js'
import type { MetricsData, ZabbixHost, ZabbixMapping } from '../types.js'
import { ZabbixClient } from '../zabbix/client.js'
import {
  type Alert,
  type AlertQueryOptions,
  type AlertSeverity,
  type AlertsCapable,
  type AutoMappingCapable,
  addHttpWarning,
  type ConnectionResult,
  type DataSourceCapability,
  type DataSourcePlugin,
  type Host,
  type HostItem,
  type HostsCapable,
  type MappingHint,
  type MetricsCapable,
  type ZabbixPluginConfig,
} from './types.js'

export class ZabbixPlugin
  implements DataSourcePlugin, MetricsCapable, HostsCapable, AutoMappingCapable, AlertsCapable
{
  readonly type = 'zabbix'
  readonly displayName = 'Zabbix'
  readonly capabilities: readonly DataSourceCapability[] = [
    'metrics',
    'hosts',
    'auto-mapping',
    'alerts',
  ]

  private config: ZabbixPluginConfig | null = null
  private client: ZabbixClient | null = null

  initialize(config: unknown): void {
    this.config = config as ZabbixPluginConfig
    this.client = new ZabbixClient(this.config)
  }

  dispose(): void {
    this.config = null
    this.client = null
  }

  private requireClient(): ZabbixClient {
    if (!this.client) {
      throw new Error('Plugin not initialized')
    }
    return this.client
  }

  // ============================================
  // Base Plugin Methods
  // ============================================

  async testConnection(): Promise<ConnectionResult> {
    if (!this.config) {
      return { success: false, message: 'Plugin not initialized' }
    }

    try {
      const version = await this.requireClient().getApiVersion()
      return addHttpWarning(this.config.url, {
        success: true,
        message: `Connected to Zabbix ${version}`,
        version,
      })
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Connection failed',
      }
    }
  }

  // ============================================
  // MetricsCapable Implementation
  // ============================================

  async pollMetrics(mapping: ZabbixMapping): Promise<MetricsData> {
    const client = this.requireClient()
    const metrics: MetricsData = {
      nodes: {},
      links: {},
      timestamp: Date.now(),
    }

    // Poll node metrics
    for (const [nodeId, nodeMapping] of Object.entries(mapping.nodes || {})) {
      if (nodeMapping.hostId) {
        try {
          const isAvailable = await client.getHostAvailability(nodeMapping.hostId)
          metrics.nodes[nodeId] = {
            status: isAvailable ? 'up' : 'down',
            lastSeen: isAvailable ? Date.now() : undefined,
          }
        } catch {
          metrics.nodes[nodeId] = { status: 'unknown' }
        }
      } else {
        metrics.nodes[nodeId] = { status: 'unknown' }
      }
    }

    // Poll link metrics
    for (const [linkId, linkMapping] of Object.entries(mapping.links || {})) {
      if (linkMapping.in || linkMapping.out) {
        try {
          const itemIds = [linkMapping.in, linkMapping.out].filter(Boolean) as string[]
          const items = await client.getItemsByIds(itemIds)

          let inBps = 0
          let outBps = 0

          for (const item of items) {
            const value = Number.parseFloat(item.lastvalue) || 0
            if (item.itemid === linkMapping.in) {
              inBps = value
            } else if (item.itemid === linkMapping.out) {
              outBps = value
            }
          }

          const capacity = linkMapping.capacity || DEFAULT_CAPACITY
          const inUtil = (inBps / capacity) * 100
          const outUtil = (outBps / capacity) * 100
          const maxUtil = Math.max(inUtil, outUtil)

          metrics.links[linkId] = {
            status: maxUtil > 0 ? 'up' : 'unknown',
            utilization: Math.ceil(maxUtil),
            inUtilization: Math.ceil(inUtil),
            outUtilization: Math.ceil(outUtil),
            inBps,
            outBps,
          }
        } catch {
          metrics.links[linkId] = { status: 'unknown' }
        }
      } else {
        metrics.links[linkId] = { status: 'unknown' }
      }
    }

    return metrics
  }

  // ============================================
  // HostsCapable Implementation
  // ============================================

  async getHosts(): Promise<Host[]> {
    const zabbixHosts = await this.requireClient().getHosts()
    return zabbixHosts.map((h) => this.toHost(h))
  }

  async getHostItems(hostId: string): Promise<HostItem[]> {
    const items = await this.requireClient().getHostItems(hostId, undefined, ['units'])
    return items.map((item) => this.toHostItem(item))
  }

  async searchHosts(query: string): Promise<Host[]> {
    const zabbixHosts = await this.requireClient().searchHosts(query)
    return zabbixHosts.map((h) => this.toHost(h))
  }

  // ============================================
  // AutoMappingCapable Implementation
  // ============================================

  async getMappingHints(graph: NetworkGraph): Promise<MappingHint[]> {
    const hints: MappingHint[] = []
    const allHosts = await this.getHosts()

    for (const node of graph.nodes) {
      const labelToTry = Array.isArray(node.label) ? node.label[0] : node.label
      const namesToTry = [node.id, labelToTry].filter(Boolean) as string[]

      let bestMatch: Host | null = null
      let bestConfidence = 0

      for (const name of namesToTry) {
        const normalizedName = name.toLowerCase().replace(/[^a-z0-9]/g, '')

        for (const host of allHosts) {
          const normalizedHostName = host.name.toLowerCase().replace(/[^a-z0-9]/g, '')
          const normalizedDisplayName =
            host.displayName?.toLowerCase().replace(/[^a-z0-9]/g, '') || ''

          // Exact match
          if (normalizedHostName === normalizedName || normalizedDisplayName === normalizedName) {
            bestMatch = host
            bestConfidence = 1.0
            break
          }

          // Partial match
          if (
            normalizedHostName.includes(normalizedName) ||
            normalizedName.includes(normalizedHostName)
          ) {
            const confidence = 0.7
            if (confidence > bestConfidence) {
              bestMatch = host
              bestConfidence = confidence
            }
          }
        }

        if (bestConfidence === 1.0) break
      }

      hints.push({
        nodeId: node.id,
        suggestedHostId: bestMatch?.id,
        suggestedHostName: bestMatch?.name,
        confidence: bestConfidence,
      })
    }

    return hints
  }

  // ============================================
  // AlertsCapable Implementation
  // ============================================

  async getAlerts(options?: AlertQueryOptions): Promise<Alert[]> {
    const client = this.requireClient()

    // Zabbix severity mapping (Zabbix uses 0-5, we need to filter and map)
    const severityFilter = this.getSeverityFilter(options?.minSeverity)

    const timeFrom = Math.floor((Date.now() - (options?.timeRange || 3600) * 1000) / 1000)

    interface ZabbixProblem {
      eventid: string
      objectid: string
      name: string
      severity: string
      clock: string
      r_clock: string
      hosts?: Array<{ hostid: string; host: string; name: string }>
    }

    const params: Record<string, unknown> = {
      output: ['eventid', 'objectid', 'name', 'severity', 'clock', 'r_clock'],
      selectHosts: ['hostid', 'host', 'name'],
      recent: true,
      time_from: timeFrom,
      sortfield: ['clock'],
      sortorder: 'DESC',
    }

    // Filter by severity
    if (severityFilter.length > 0) {
      params.severities = severityFilter
    }

    // Filter by host IDs
    if (options?.hostIds && options.hostIds.length > 0) {
      params.hostids = options.hostIds
    }

    const problems = await client.apiRequest<ZabbixProblem[]>('problem.get', params)

    const alerts: Alert[] = problems.map((p) => ({
      id: p.eventid,
      severity: this.mapZabbixSeverity(p.severity),
      title: p.name,
      host: p.hosts?.[0]?.host,
      hostId: p.hosts?.[0]?.hostid,
      startTime: Number.parseInt(p.clock, 10) * 1000,
      endTime: p.r_clock && p.r_clock !== '0' ? Number.parseInt(p.r_clock, 10) * 1000 : undefined,
      status: p.r_clock && p.r_clock !== '0' ? 'resolved' : 'active',
      source: 'zabbix' as const,
      url: this.config
        ? `${this.config.url.replace(/\/$/, '')}/tr_events.php?triggerid=${p.objectid}&eventid=${p.eventid}`
        : undefined,
    }))

    // Filter active only if requested
    if (options?.activeOnly) {
      return alerts.filter((a) => a.status === 'active')
    }

    return alerts
  }

  // ============================================
  // Private Helpers
  // ============================================

  private toHost(h: ZabbixHost): Host {
    return {
      id: h.hostid,
      name: h.host,
      displayName: h.name,
      status: h.status === '0' ? 'up' : 'down',
    }
  }

  private toHostItem(item: {
    itemid: string
    hostid: string
    name: string
    key_: string
    lastvalue: string
    units?: string
  }): HostItem {
    return {
      id: item.itemid,
      hostId: item.hostid,
      name: item.name,
      key: item.key_,
      lastValue: item.lastvalue,
      unit: item.units,
    }
  }

  private mapZabbixSeverity(severity: string): AlertSeverity {
    const severityMap: Record<string, AlertSeverity> = {
      '0': 'information', // Not classified
      '1': 'information', // Information
      '2': 'warning', // Warning
      '3': 'average', // Average
      '4': 'high', // High
      '5': 'disaster', // Disaster
    }
    return severityMap[severity] || 'information'
  }

  private getSeverityFilter(minSeverity?: AlertSeverity): number[] {
    if (!minSeverity) return []

    const severityOrder: AlertSeverity[] = ['information', 'warning', 'average', 'high', 'disaster']

    // Map our severity to Zabbix numeric values
    const severityToZabbix: Record<AlertSeverity, number[]> = {
      information: [0, 1],
      warning: [2],
      average: [3],
      high: [4],
      disaster: [5],
      ok: [],
    }

    const minIndex = severityOrder.indexOf(minSeverity)
    if (minIndex === -1) return []

    const result: number[] = []
    for (let i = minIndex; i < severityOrder.length; i++) {
      result.push(...severityToZabbix[severityOrder[i]!])
    }
    return result
  }
}
