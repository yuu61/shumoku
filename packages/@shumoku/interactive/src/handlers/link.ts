/**
 * Link Handler
 */

import type { LinkInfo } from '../types.js'
import { parseDataJson } from '../utils/dom.js'

/**
 * Extract link info from SVG element
 */
export function extractLinkInfo(element: Element): LinkInfo | null {
  // Try to get from JSON data attribute first
  const jsonData = parseDataJson<LinkInfo>(element, 'data-link-json')
  if (jsonData) {
    return jsonData
  }

  // Fall back to individual attributes
  const id = element.getAttribute('data-link-id')
  if (!id) return null

  // Parse from/to endpoints
  const fromStr = element.getAttribute('data-link-from') ?? ''
  const toStr = element.getAttribute('data-link-to') ?? ''

  const [fromDevice, fromPort] = fromStr.split(':')
  const [toDevice, toPort] = toStr.split(':')

  // Parse VLANs
  const vlanStr = element.getAttribute('data-link-vlan')
  const vlan = vlanStr
    ? vlanStr
        .split(',')
        .map(Number)
        .filter((n) => !Number.isNaN(n))
    : undefined

  return {
    id,
    from: {
      device: fromDevice || '',
      port: fromPort,
    },
    to: {
      device: toDevice || '',
      port: toPort,
    },
    bandwidth: element.getAttribute('data-link-bandwidth') ?? undefined,
    vlan,
    redundancy: element.getAttribute('data-link-redundancy') ?? undefined,
  }
}

/**
 * Find link element by ID
 */
export function findLinkElement(svgRoot: SVGElement, linkId: string): Element | null {
  return svgRoot.querySelector(`.link-group[data-link-id="${linkId}"]`)
}

/**
 * Build link map from SVG for port connection lookup
 */
export function buildLinkMap(
  svgRoot: SVGElement,
): Map<string, { from: string; to: string; fromPort?: string; toPort?: string }> {
  const links = new Map<string, { from: string; to: string; fromPort?: string; toPort?: string }>()

  const linkElements = svgRoot.querySelectorAll('.link-group[data-link-id]')

  for (const linkEl of linkElements) {
    const linkInfo = extractLinkInfo(linkEl)
    if (linkInfo) {
      links.set(linkInfo.id, {
        from: linkInfo.from.device,
        to: linkInfo.to.device,
        fromPort: linkInfo.from.port,
        toPort: linkInfo.to.port,
      })
    }
  }

  return links
}
