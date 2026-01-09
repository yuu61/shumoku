/**
 * NetBox API Types
 * Based on NetBox REST API responses
 */

// ============================================
// NetBox API Response Types
// ============================================

export interface NetBoxTag {
  slug: string
  name: string
}

export interface NetBoxDeviceType {
  model: string
  manufacturer?: {
    name: string
    slug: string
  }
}

export interface NetBoxDevice {
  name: string
  tags: NetBoxTag[]
  device_type?: NetBoxDeviceType
  primary_ip4?: {
    address: string
  }
  primary_ip6?: {
    address: string
  }
  serial?: string
  role?: {
    name: string
    slug: string
  }
}

export interface NetBoxDeviceResponse {
  count: number
  next: string | null
  previous: string | null
  results: NetBoxDevice[]
}

export interface NetBoxVlan {
  vid: number
  name: string
}

export interface NetBoxInterface {
  name: string
  device: {
    name: string
  }
  untagged_vlan: NetBoxVlan | null
  tagged_vlans: NetBoxVlan[]
}

export interface NetBoxInterfaceResponse {
  count: number
  next: string | null
  previous: string | null
  results: NetBoxInterface[]
}

export interface NetBoxTermination {
  object: {
    name: string
    device: {
      name: string
    }
  }
}

export interface NetBoxCable {
  type: string
  a_terminations: NetBoxTermination[]
  b_terminations: NetBoxTermination[]
}

export interface NetBoxCableResponse {
  count: number
  next: string | null
  previous: string | null
  results: NetBoxCable[]
}

// ============================================
// Tag Mapping Configuration
// ============================================

export interface TagMapping {
  type: 'router' | 'l3-switch' | 'l2-switch' | 'server' | 'access-point' | 'generic'
  level: number
  subgraph: string
}

/**
 * Default tag to device type/level mapping
 * Based on network-topology hierarchy
 */
export const DEFAULT_TAG_MAPPING: Record<string, TagMapping> = {
  'ocx': { type: 'l3-switch', level: 0, subgraph: 'OCX' },
  'onu': { type: 'router', level: 1, subgraph: 'ONU' },
  'router': { type: 'router', level: 2, subgraph: 'Router' },
  'core-switch': { type: 'l3-switch', level: 3, subgraph: 'Core Switch' },
  'edge-switch': { type: 'l2-switch', level: 4, subgraph: 'Edge Switch' },
  'server': { type: 'server', level: 5, subgraph: 'Server' },
  'ap': { type: 'access-point', level: 5, subgraph: 'AP' },
  'console-server': { type: 'server', level: 6, subgraph: 'Console Server' },
}

/**
 * Tag priority order for resolving primary tag
 */
export const TAG_PRIORITY = [
  'ocx',
  'onu',
  'router',
  'core-switch',
  'edge-switch',
  'server',
  'console-server',
  'ap',
]

// ============================================
// Cable Type Colors
// ============================================

/**
 * Cable type to color mapping
 * Based on fiber/copper standards
 */
export const CABLE_COLORS: Record<string, string> = {
  'mmf-om3': '#00BCD4',  // Cyan - OM3 multimode
  'mmf-om4': '#2196F3',  // Blue - OM4 multimode
  'smf-os2': '#FFEB3B',  // Yellow - OS2 singlemode
  'cat6a': '#E91E63',    // Pink - Cat6a copper
  'cat6': '#9C27B0',     // Purple - Cat6 copper
  'cat5e': '#FF9800',    // Orange - Cat5e copper
  'dac': '#607D8B',      // Blue Gray - Direct attach
}

// ============================================
// VLAN Colors (for visual distinction)
// ============================================

/**
 * Generate a color for a VLAN ID
 * Uses HSL color space for visual variety
 */
export function getVlanColor(vid: number): string {
  const hue = (vid * 137) % 360  // Golden angle for distribution
  return `hsl(${hue}, 70%, 50%)`
}

// ============================================
// Internal Data Structures
// ============================================

export interface DeviceData {
  name: string
  primaryTag: string
  ports: Set<string>
  portVlans: Map<string, number[]>
  model?: string
  manufacturer?: string
  ip?: string
}

export interface ConnectionData {
  srcDev: string
  srcPort: string
  srcLevel: number
  dstDev: string
  dstPort: string
  dstLevel: number
  dstTag: string
  cableType: string
}

// ============================================
// Converter Options
// ============================================

export interface ConverterOptions {
  /**
   * Custom tag mapping (merged with defaults)
   */
  tagMapping?: Record<string, TagMapping>

  /**
   * Theme for generated diagram
   */
  theme?: 'light' | 'dark'

  /**
   * Show port names on links
   */
  showPorts?: boolean

  /**
   * Show VLAN information on links
   */
  showVlans?: boolean

  /**
   * Color links by cable type
   */
  colorByCableType?: boolean

  /**
   * Group devices by tag into subgraphs
   */
  groupByTag?: boolean
}

// ============================================
// Client Options
// ============================================

export interface NetBoxClientOptions {
  /**
   * NetBox API URL (e.g., "https://netbox.example.com")
   */
  url: string

  /**
   * NetBox API token
   */
  token: string

  /**
   * Request timeout in milliseconds (default: 30000)
   */
  timeout?: number
}
