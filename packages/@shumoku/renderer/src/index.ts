/**
 * @shumoku/renderer - SVG and HTML renderers for network diagrams
 * Browser entry point (PNG throws error)
 */

import * as html from './html/index.js'
import * as png from './png.browser.js'
import * as svg from './svg.js'

export { svg, html, png }

// CDN icon utilities
export {
  clearIconCache,
  DEFAULT_CDN_CONFIG,
  fetchCDNIcon,
  fetchImageDimensions,
  getCDNIconUrl,
  getIconExtension,
  hasCDNIcons,
  resolveAllIconDimensions,
  resolveIconDimensions,
  resolveIconDimensionsForGraph,
} from './cdn-icons.js'
export type { CDNConfig, IconDimensions, ResolvedIconDimensions } from './cdn-icons.js'

// Re-export SheetData for hierarchical rendering
export type { SheetData } from './html/index.js'
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
