/**
 * Port Handler
 */

import type { PortInfo } from '../types.js'

/**
 * Extract port info from SVG element
 */
export function extractPortInfo(element: Element): PortInfo | null {
  const portId = element.getAttribute('data-port')
  const deviceId = element.getAttribute('data-port-device')

  if (!portId) return null

  return {
    id: portId,
    label: portId,
    deviceId: deviceId ?? '',
  }
}

/**
 * Find port element
 */
export function findPortElement(
  svgRoot: SVGElement,
  deviceId: string,
  portId: string,
): Element | null {
  return svgRoot.querySelector(`[data-port-device="${deviceId}"][data-port="${portId}"]`)
}
