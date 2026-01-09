/**
 * NetBox to Shumoku NetworkGraph Converter
 */

import type {
  NetworkGraph,
  Node,
  Link,
  Subgraph,
  DeviceType,
  LinkEndpoint,
} from '@shumoku/core/models'
import type {
  NetBoxDeviceResponse,
  NetBoxInterfaceResponse,
  NetBoxCableResponse,
  NetBoxTag,
  ConverterOptions,
  TagMapping,
  DeviceData,
  ConnectionData,
} from './types.js'
import {
  DEFAULT_TAG_MAPPING,
  TAG_PRIORITY,
  CABLE_COLORS,
} from './types.js'

/**
 * Subgraph style colors by level
 */
const SUBGRAPH_STYLES: Record<number, { fill: string; stroke: string }> = {
  0: { fill: '#E3F2FD', stroke: '#1565C0' },  // OCX - Blue
  1: { fill: '#E8F5E9', stroke: '#2E7D32' },  // ONU - Green
  2: { fill: '#FFF3E0', stroke: '#E65100' },  // Router - Orange
  3: { fill: '#FFF8E1', stroke: '#F9A825' },  // Core Switch - Yellow
  4: { fill: '#F3E5F5', stroke: '#7B1FA2' },  // Edge Switch - Purple
  5: { fill: '#FFEBEE', stroke: '#C62828' },  // Server/AP - Red
  6: { fill: '#ECEFF1', stroke: '#546E7A' },  // Console - Gray
}

/**
 * Convert NetBox data to Shumoku NetworkGraph
 */
export function convertToNetworkGraph(
  deviceResp: NetBoxDeviceResponse,
  interfaceResp: NetBoxInterfaceResponse,
  cableResp: NetBoxCableResponse,
  options: ConverterOptions = {}
): NetworkGraph {
  const tagMapping = { ...DEFAULT_TAG_MAPPING, ...options.tagMapping }
  const groupByTag = options.groupByTag ?? true
  const showPorts = options.showPorts ?? true
  const colorByCableType = options.colorByCableType ?? true

  // 1. Build device tag map and info map
  const deviceTagMap = new Map<string, string>()
  const deviceInfoMap = new Map<string, { model?: string; manufacturer?: string; ip?: string }>()
  for (const device of deviceResp.results) {
    deviceTagMap.set(device.name, resolvePrimaryTag(device.tags))
    deviceInfoMap.set(device.name, {
      model: device.device_type?.model,
      manufacturer: device.device_type?.manufacturer?.name,
      ip: device.primary_ip4?.address?.split('/')[0] ?? device.primary_ip6?.address?.split('/')[0],
    })
  }

  // 2. Build port VLAN map
  const portVlanMap = new Map<string, Map<string, number[]>>()
  for (const iface of interfaceResp.results) {
    const devName = iface.device.name
    const portName = iface.name

    if (!portVlanMap.has(devName)) {
      portVlanMap.set(devName, new Map())
    }

    const vlans = new Set<number>()
    if (iface.untagged_vlan?.vid) {
      vlans.add(iface.untagged_vlan.vid)
    }
    for (const tv of iface.tagged_vlans) {
      vlans.add(tv.vid)
    }

    portVlanMap.get(devName)!.set(portName, Array.from(vlans))
  }

  // 3. Build devices and connections from cables
  const devices = new Map<string, DeviceData>()
  const connections: ConnectionData[] = []

  for (const cable of cableResp.results) {
    if (cable.a_terminations.length === 0 || cable.b_terminations.length === 0) {
      continue
    }

    const termA = cable.a_terminations[0].object
    const termB = cable.b_terminations[0].object

    const nameA = termA.device.name
    const nameB = termB.device.name
    const tagA = deviceTagMap.get(nameA) ?? 'other'
    const tagB = deviceTagMap.get(nameB) ?? 'other'

    // Register devices
    const infoA = deviceInfoMap.get(nameA)
    const infoB = deviceInfoMap.get(nameB)
    registerDevice(devices, nameA, tagA, termA.name, portVlanMap.get(nameA)?.get(termA.name) ?? [], infoA)
    registerDevice(devices, nameB, tagB, termB.name, portVlanMap.get(nameB)?.get(termB.name) ?? [], infoB)

    const levelA = getLevelByTag(tagA, tagMapping)
    const levelB = getLevelByTag(tagB, tagMapping)

    // Normalize direction: lower level -> higher level
    let conn: ConnectionData
    if (levelA <= levelB) {
      conn = {
        srcDev: nameA,
        srcPort: termA.name,
        srcLevel: levelA,
        dstDev: nameB,
        dstPort: termB.name,
        dstLevel: levelB,
        dstTag: tagB,
        cableType: cable.type,
      }
    } else {
      conn = {
        srcDev: nameB,
        srcPort: termB.name,
        srcLevel: levelB,
        dstDev: nameA,
        dstPort: termA.name,
        dstLevel: levelA,
        dstTag: tagA,
        cableType: cable.type,
      }
    }
    connections.push(conn)
  }

  // 4. Build NetworkGraph
  const subgraphs: Subgraph[] = groupByTag
    ? buildSubgraphs(devices, tagMapping)
    : []

  const nodes: Node[] = buildNodes(devices, tagMapping, groupByTag)
  const links: Link[] = buildLinks(connections, showPorts, colorByCableType)

  return {
    version: '1.0.0',
    name: 'Network Topology',
    description: 'Generated from NetBox',
    nodes,
    links,
    subgraphs: subgraphs.length > 0 ? subgraphs : undefined,
    settings: {
      direction: 'TB',
      theme: options.theme ?? 'light',
    },
  }
}

/**
 * Resolve primary tag from tags list based on priority
 */
function resolvePrimaryTag(tags: NetBoxTag[]): string {
  const tagSet = new Set(tags.map(t => t.slug))

  for (const priority of TAG_PRIORITY) {
    if (tagSet.has(priority)) {
      return priority
    }
  }

  if (tags.length > 0) {
    return tags[0].slug
  }

  return 'other'
}

/**
 * Get hierarchy level by tag
 */
function getLevelByTag(tag: string, mapping: Record<string, TagMapping>): number {
  return mapping[tag]?.level ?? 99
}

/**
 * Register a device in the devices map
 */
function registerDevice(
  devices: Map<string, DeviceData>,
  name: string,
  tag: string,
  port: string,
  vlans: number[],
  info?: { model?: string; manufacturer?: string; ip?: string }
): void {
  if (!devices.has(name)) {
    devices.set(name, {
      name,
      primaryTag: tag,
      ports: new Set(),
      portVlans: new Map(),
      model: info?.model,
      manufacturer: info?.manufacturer,
      ip: info?.ip,
    })
  }

  const device = devices.get(name)!
  device.ports.add(port)
  device.portVlans.set(port, vlans)
}

/**
 * Build subgraphs from devices grouped by tag
 */
function buildSubgraphs(
  devices: Map<string, DeviceData>,
  mapping: Record<string, TagMapping>
): Subgraph[] {
  const tagDevices = new Map<string, DeviceData[]>()

  for (const device of devices.values()) {
    const tag = device.primaryTag
    if (!tagDevices.has(tag)) {
      tagDevices.set(tag, [])
    }
    tagDevices.get(tag)!.push(device)
  }

  const subgraphs: Subgraph[] = []

  for (const [tag, devs] of tagDevices) {
    if (devs.length === 0) continue

    const tagConfig = mapping[tag]
    const level = tagConfig?.level ?? 99
    const label = tagConfig?.subgraph ?? tag

    const style = SUBGRAPH_STYLES[level] ?? { fill: '#F5F5F5', stroke: '#9E9E9E' }

    subgraphs.push({
      id: `subgraph-${tag}`,
      label,
      style: {
        fill: style.fill,
        stroke: style.stroke,
        strokeWidth: 2,
      },
    })
  }

  // Sort by level
  return subgraphs.sort((a, b) => {
    const tagA = a.id.replace('subgraph-', '')
    const tagB = b.id.replace('subgraph-', '')
    const levelA = mapping[tagA]?.level ?? 99
    const levelB = mapping[tagB]?.level ?? 99
    return levelA - levelB
  })
}

/**
 * Build nodes from devices
 */
function buildNodes(
  devices: Map<string, DeviceData>,
  mapping: Record<string, TagMapping>,
  groupByTag: boolean
): Node[] {
  const nodes: Node[] = []

  for (const device of devices.values()) {
    const tagConfig = mapping[device.primaryTag]
    const deviceType = tagConfig?.type ?? 'generic'

    // Build label lines
    const labelLines: string[] = [`<b>${device.name}</b>`]

    // Add model info if available
    if (device.model) {
      labelLines.push(device.model)
    }

    // Add IP if available
    if (device.ip) {
      labelLines.push(device.ip)
    }

    const node: Node = {
      id: device.name,
      label: labelLines,
      shape: 'rounded',
      type: deviceType as DeviceType,
      rank: tagConfig?.level,
    }

    if (groupByTag) {
      node.parent = `subgraph-${device.primaryTag}`
    }

    nodes.push(node)
  }

  return nodes
}

/**
 * Build links from connections
 */
function buildLinks(
  connections: ConnectionData[],
  showPorts: boolean,
  colorByCableType: boolean
): Link[] {
  return connections.map((conn, index) => {
    const from: LinkEndpoint = {
      node: conn.srcDev,
    }
    const to: LinkEndpoint = {
      node: conn.dstDev,
    }

    if (showPorts) {
      from.port = conn.srcPort
      to.port = conn.dstPort
    }

    const link: Link = {
      id: `link-${index}`,
      from,
      to,
      arrow: 'none',
    }

    if (colorByCableType && conn.cableType) {
      const color = CABLE_COLORS[conn.cableType]
      if (color) {
        link.style = { stroke: color }
      }
    }

    return link
  })
}

/**
 * Generate YAML string from NetworkGraph
 */
export function toYaml(graph: NetworkGraph): string {
  const lines: string[] = []

  lines.push(`name: "${graph.name ?? 'Network Topology'}"`)
  if (graph.description) {
    lines.push(`description: "${graph.description}"`)
  }
  lines.push('')

  // Settings
  if (graph.settings) {
    lines.push('settings:')
    if (graph.settings.direction) {
      lines.push(`  direction: ${graph.settings.direction}`)
    }
    if (graph.settings.theme) {
      lines.push(`  theme: ${graph.settings.theme}`)
    }
    lines.push('')
  }

  // Subgraphs
  if (graph.subgraphs && graph.subgraphs.length > 0) {
    lines.push('subgraphs:')
    for (const sg of graph.subgraphs) {
      lines.push(`  - id: ${sg.id}`)
      lines.push(`    label: "${sg.label}"`)
      if (sg.style) {
        lines.push('    style:')
        if (sg.style.fill) lines.push(`      fill: "${sg.style.fill}"`)
        if (sg.style.stroke) lines.push(`      stroke: "${sg.style.stroke}"`)
        if (sg.style.strokeWidth) lines.push(`      strokeWidth: ${sg.style.strokeWidth}`)
      }
    }
    lines.push('')
  }

  // Nodes
  lines.push('nodes:')
  for (const node of graph.nodes) {
    lines.push(`  - id: ${node.id}`)

    if (Array.isArray(node.label)) {
      lines.push('    label:')
      for (const line of node.label) {
        lines.push(`      - "${line}"`)
      }
    } else {
      lines.push(`    label: "${node.label}"`)
    }

    if (node.type) {
      lines.push(`    type: ${node.type}`)
    }
    if (node.parent) {
      lines.push(`    parent: ${node.parent}`)
    }
    if (node.rank !== undefined) {
      lines.push(`    rank: ${node.rank}`)
    }
  }
  lines.push('')

  // Links
  lines.push('links:')
  for (const link of graph.links) {
    const from = typeof link.from === 'string' ? link.from : link.from.node
    const to = typeof link.to === 'string' ? link.to : link.to.node
    const fromPort = typeof link.from === 'object' ? link.from.port : undefined
    const toPort = typeof link.to === 'object' ? link.to.port : undefined

    if (fromPort || toPort) {
      lines.push('  - from:')
      lines.push(`      node: ${from}`)
      if (fromPort) lines.push(`      port: ${fromPort}`)
      lines.push('    to:')
      lines.push(`      node: ${to}`)
      if (toPort) lines.push(`      port: ${toPort}`)
    } else {
      lines.push(`  - from: ${from}`)
      lines.push(`    to: ${to}`)
    }

    if (link.style?.stroke) {
      lines.push('    style:')
      lines.push(`      stroke: "${link.style.stroke}"`)
    }
  }

  return lines.join('\n')
}
