/**
 * Plugins Module
 *
 * Data source plugin system for Shumoku.
 */

export { GrafanaPlugin } from './grafana.js'
export {
  type AddPluginResult,
  addPlugin,
  getAllPlugins,
  getConfigPath,
  getLoadedPlugins,
  getPluginManifest,
  getPluginsDir,
  installPluginFromUrl,
  installPluginFromZip,
  isBuiltinPlugin,
  isExternalPlugin,
  type LoadedPluginInfo,
  // Functions
  loadPluginsFromConfig,
  markBuiltinPlugins,
  // Types
  type PluginEntry,
  reloadPlugins,
  removePlugin,
  setPluginEnabled,
} from './loader.js'
export { NetBoxPlugin } from './netbox.js'
export { PrometheusPlugin } from './prometheus.js'
export * from './registry.js'
export * from './types.js'
export { ZabbixPlugin } from './zabbix.js'

import { GrafanaPlugin } from './grafana.js'
import { NetBoxPlugin } from './netbox.js'
import { PrometheusPlugin } from './prometheus.js'
// Register built-in plugins
import { pluginRegistry } from './registry.js'
import { ZabbixPlugin } from './zabbix.js'

export function registerBuiltinPlugins(): void {
  // Zabbix - metrics, hosts, auto-mapping, alerts
  pluginRegistry.register(
    'zabbix',
    'Zabbix',
    ['metrics', 'hosts', 'auto-mapping', 'alerts'],
    (config) => {
      const plugin = new ZabbixPlugin()
      plugin.initialize(config)
      return plugin
    },
  )

  // NetBox - topology, hosts
  pluginRegistry.register('netbox', 'NetBox', ['topology', 'hosts'], (config) => {
    const plugin = new NetBoxPlugin()
    plugin.initialize(config)
    return plugin
  })

  // Prometheus - metrics, hosts, alerts
  pluginRegistry.register('prometheus', 'Prometheus', ['metrics', 'hosts', 'alerts'], (config) => {
    const plugin = new PrometheusPlugin()
    plugin.initialize(config)
    return plugin
  })

  // Grafana - alerts
  pluginRegistry.register('grafana', 'Grafana', ['alerts'], (config) => {
    const plugin = new GrafanaPlugin()
    plugin.initialize(config)
    return plugin
  })

  console.log('[Plugins] Built-in plugins registered')
}
