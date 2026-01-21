/**
 * Frontend type definitions
 */

export type DataSourceType = 'zabbix'

export interface DataSource {
  id: string
  name: string
  type: DataSourceType
  url: string
  token?: string
  pollInterval: number
  createdAt: number
  updatedAt: number
}

export interface DataSourceInput {
  name: string
  type?: DataSourceType
  url: string
  token?: string
  pollInterval?: number
}

export interface Topology {
  id: string
  name: string
  yamlContent: string
  dataSourceId?: string
  mappingJson?: string
  createdAt: number
  updatedAt: number
}

export interface TopologyInput {
  name: string
  yamlContent: string
  dataSourceId?: string
  mappingJson?: string
}

export interface ZabbixMapping {
  nodes: Record<
    string,
    {
      hostId?: string
      hostName?: string
    }
  >
  links: Record<
    string,
    {
      in?: string
      out?: string
      interface?: string
      capacity?: number
    }
  >
}

export interface ConnectionTestResult {
  success: boolean
  message: string
  version?: string
}

export interface ApiError {
  error: string
}

// Render Context types
export interface Position {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

export interface ViewBox {
  x: number
  y: number
  width: number
  height: number
}

export interface NodePortContext {
  id: string
  label: string
  position: Position
  size: Size
  side: 'top' | 'bottom' | 'left' | 'right'
}

export interface NodeContext {
  id: string
  label: string | string[]
  position: Position
  size: Size
  shape: string
  type?: string
  vendor?: string
  model?: string
  service?: string
  resource?: string
  ports: NodePortContext[]
  metadata?: Record<string, unknown>
}

export interface EdgeEndpoint {
  nodeId: string
  port?: string
  ip?: string
}

export interface EdgeContext {
  id: string
  from: EdgeEndpoint
  to: EdgeEndpoint
  path: string
  points: Position[]
  bandwidth?: string
  vlan?: number[]
  redundancy?: string
  label?: string | string[]
  metadata?: Record<string, unknown>
}

export interface SubgraphContext {
  id: string
  label: string
  bounds: ViewBox
  vendor?: string
  service?: string
  model?: string
  resource?: string
  hasSheet: boolean
  sheetId?: string
}

export interface NodeStyleContext {
  fill: string
  stroke: string
  strokeWidth: number
  textColor: string
  secondaryTextColor: string
}

export interface EdgeAnimationStyle {
  name: string
  duration: string
  timingFunction: string
  iterationCount: string
}

export interface EdgeStyleContext {
  stroke: string
  strokeWidth: number
  strokeDasharray: string
  lineCount: number
  animation?: EdgeAnimationStyle
}

export interface SubgraphStyleContext {
  fill: string
  stroke: string
  strokeWidth: number
  labelColor: string
}

export interface MetricsData {
  nodes: Record<string, { status: 'up' | 'down' | 'unknown' }>
  links: Record<string, { status: 'up' | 'down' | 'unknown'; utilization?: number }>
  timestamp: number
}

export interface TopologyContext {
  id: string
  name: string
  nodes: NodeContext[]
  edges: EdgeContext[]
  subgraphs: SubgraphContext[]
  viewBox: ViewBox
  theme: 'light' | 'dark'
  nodeStyles: Record<string, NodeStyleContext>
  edgeStyles: Record<string, EdgeStyleContext>
  subgraphStyles: Record<string, SubgraphStyleContext>
  cssVariables: Record<string, string>
  animationCSS: string
  metrics: MetricsData
  dataSourceId?: string
  mapping?: ZabbixMapping
}
