/**
 * Device Handler
 */

import type { DeviceInfo, PortInfo } from '../types.js'
import { parseDataJson } from '../utils/dom.js'

/**
 * Extract device info from SVG element
 */
export function extractDeviceInfo(element: Element): DeviceInfo | null {
  // Try to get from JSON data attribute first
  const jsonData = parseDataJson<DeviceInfo>(element, 'data-device-json')
  if (jsonData) {
    return jsonData
  }

  // Fall back to individual attributes
  const id = element.getAttribute('data-id')
  if (!id) return null

  return {
    id,
    label: id, // Default to id if no label
    type: element.getAttribute('data-device-type') ?? undefined,
    vendor: element.getAttribute('data-device-vendor') ?? undefined,
    model: element.getAttribute('data-device-model') ?? undefined,
    service: element.getAttribute('data-device-service') ?? undefined,
    resource: element.getAttribute('data-device-resource') ?? undefined,
  }
}

/**
 * Extract ports for a device from SVG
 */
export function extractDevicePorts(
  svgRoot: SVGElement,
  deviceId: string,
  links: Map<string, { from: string; to: string; fromPort?: string; toPort?: string }>,
): PortInfo[] {
  const ports: PortInfo[] = []

  // Find all ports belonging to this device
  const portElements = svgRoot.querySelectorAll(`[data-port-device="${deviceId}"]`)

  for (const portEl of portElements) {
    const portId = portEl.getAttribute('data-port')
    if (!portId) continue

    const port: PortInfo = {
      id: portId,
      label: portId,
      deviceId,
    }

    // Find connected device via links
    for (const [, link] of links) {
      if (link.from === deviceId && link.fromPort === portId) {
        port.connectedTo = {
          device: link.to,
          port: link.toPort,
        }
        break
      }
      if (link.to === deviceId && link.toPort === portId) {
        port.connectedTo = {
          device: link.from,
          port: link.fromPort,
        }
        break
      }
    }

    ports.push(port)
  }

  return ports
}

/**
 * Find device element by ID
 */
export function findDeviceElement(svgRoot: SVGElement, deviceId: string): Element | null {
  // Try node-bg first (has the data attributes)
  return (
    svgRoot.querySelector(`.node-bg[data-id="${deviceId}"]`) ||
    svgRoot.querySelector(`.node-fg[data-id="${deviceId}"]`)
  )
}
