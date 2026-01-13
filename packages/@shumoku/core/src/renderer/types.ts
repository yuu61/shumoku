/**
 * Renderer Types
 * Shared types for SVG and interactive renderers
 */

/**
 * Render mode for SVG output
 * - 'static': Pure SVG without interactive data attributes (default)
 * - 'interactive': SVG with data attributes for runtime interactivity
 */
export type RenderMode = 'static' | 'interactive'

/**
 * Options for data attributes in interactive mode
 */
export interface DataAttributeOptions {
  /** Include device data attributes (type, vendor, model, etc.) */
  device?: boolean
  /** Include link data attributes (bandwidth, vlan, endpoints) */
  link?: boolean
  /** Include full metadata as JSON in data-*-json attributes */
  metadata?: boolean
}

/**
 * Device information extracted from data attributes
 * Used by interactive runtime
 */
export interface DeviceInfo {
  id: string
  label: string | string[]
  type?: string
  vendor?: string
  model?: string
  service?: string
  resource?: string
  metadata?: Record<string, unknown>
  ports?: PortInfo[]
}

/**
 * Port information for device modals
 */
export interface PortInfo {
  id: string
  label: string
  deviceId: string
  connectedTo?: {
    device: string
    port?: string
  }
}

/**
 * Link endpoint information
 */
export interface EndpointInfo {
  device: string
  port?: string
  ip?: string
}

/**
 * Link information extracted from data attributes
 * Used by interactive runtime
 */
export interface LinkInfo {
  id: string
  from: EndpointInfo
  to: EndpointInfo
  bandwidth?: string
  vlan?: number[]
  redundancy?: string
  label?: string | string[]
}
