/**
 * @shumoku/renderer - SVG and HTML renderers for network diagrams
 */

// Namespace exports
import * as svg from './svg.js'
import * as html from './html/index.js'

export { svg, html }

// Types
export type {
  DataAttributeOptions,
  DeviceInfo,
  EndpointInfo,
  HTMLRendererOptions,
  InteractiveInstance,
  InteractiveOptions,
  LinkInfo,
  PortInfo,
  RenderMode,
} from './types.js'
