/**
 * Tooltip Component
 */

import type { LinkInfo } from '../types.js'
import { createElement, escapeHtml } from '../utils/dom.js'
import { calculatePopupPosition } from '../utils/position.js'

const TOOLTIP_CLASS = 'shumoku-tooltip'

let tooltipElement: HTMLElement | null = null
let hideTimeout: ReturnType<typeof setTimeout> | null = null

/**
 * Create tooltip element if it doesn't exist
 */
function ensureTooltipElement(): HTMLElement {
  if (!tooltipElement) {
    tooltipElement = createElement('div', {
      class: TOOLTIP_CLASS,
      role: 'tooltip',
    })
    tooltipElement.style.cssText = `
      position: fixed;
      z-index: 10001;
      max-width: 300px;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      line-height: 1.4;
      pointer-events: none;
      opacity: 0;
      transform: translateY(4px);
      transition: opacity 0.15s ease, transform 0.15s ease;
      background: var(--shumoku-surface, #ffffff);
      color: var(--shumoku-text, #1e293b);
      border: 1px solid var(--shumoku-border, #e2e8f0);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      font-family: var(--shumoku-font, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
    `
    document.body.appendChild(tooltipElement)
  }
  return tooltipElement
}

/**
 * Default tooltip content for links
 */
function defaultLinkContent(link: LinkInfo): string {
  const parts: string[] = []

  // Connection info
  const fromStr = link.from.port
    ? `${escapeHtml(link.from.device)}:${escapeHtml(link.from.port)}`
    : escapeHtml(link.from.device)
  const toStr = link.to.port
    ? `${escapeHtml(link.to.device)}:${escapeHtml(link.to.port)}`
    : escapeHtml(link.to.device)

  parts.push(`<div style="font-weight: 600; margin-bottom: 4px;">${fromStr} - ${toStr}</div>`)

  // Details
  const details: string[] = []
  if (link.bandwidth) {
    details.push(`<span>Bandwidth: ${escapeHtml(link.bandwidth)}</span>`)
  }
  if (link.vlan && link.vlan.length > 0) {
    const vlanStr =
      link.vlan.length === 1 ? `VLAN ${link.vlan[0]}` : `VLANs: ${link.vlan.join(', ')}`
    details.push(`<span>${escapeHtml(vlanStr)}</span>`)
  }
  if (link.from.ip) {
    details.push(`<span>From IP: ${escapeHtml(link.from.ip)}</span>`)
  }
  if (link.to.ip) {
    details.push(`<span>To IP: ${escapeHtml(link.to.ip)}</span>`)
  }
  if (link.redundancy) {
    details.push(`<span>Redundancy: ${escapeHtml(link.redundancy.toUpperCase())}</span>`)
  }

  if (details.length > 0) {
    parts.push(
      `<div style="display: flex; flex-direction: column; gap: 2px; color: var(--shumoku-text-secondary, #64748b);">${details.join('')}</div>`,
    )
  }

  return parts.join('')
}

/**
 * Show tooltip at position
 */
export function showTooltip(
  link: LinkInfo,
  x: number,
  y: number,
  customTemplate?: (link: LinkInfo) => string | HTMLElement,
): void {
  if (hideTimeout) {
    clearTimeout(hideTimeout)
    hideTimeout = null
  }

  const tooltip = ensureTooltipElement()

  // Set content
  if (customTemplate) {
    const content = customTemplate(link)
    if (typeof content === 'string') {
      tooltip.innerHTML = content
    } else {
      tooltip.innerHTML = ''
      tooltip.appendChild(content)
    }
  } else {
    tooltip.innerHTML = defaultLinkContent(link)
  }

  // Position tooltip
  const { x: posX, y: posY } = calculatePopupPosition(
    x,
    y,
    tooltip.offsetWidth || 200,
    tooltip.offsetHeight || 100,
    12,
  )

  tooltip.style.left = `${posX}px`
  tooltip.style.top = `${posY}px`
  tooltip.style.opacity = '1'
  tooltip.style.transform = 'translateY(0)'
}

/**
 * Hide tooltip
 */
export function hideTooltip(delay = 0): void {
  if (!tooltipElement) return

  if (delay > 0) {
    hideTimeout = setTimeout(() => {
      if (tooltipElement) {
        tooltipElement.style.opacity = '0'
        tooltipElement.style.transform = 'translateY(4px)'
      }
    }, delay)
  } else {
    tooltipElement.style.opacity = '0'
    tooltipElement.style.transform = 'translateY(4px)'
  }
}

/**
 * Destroy tooltip element
 */
export function destroyTooltip(): void {
  if (hideTimeout) {
    clearTimeout(hideTimeout)
    hideTimeout = null
  }
  if (tooltipElement) {
    tooltipElement.remove()
    tooltipElement = null
  }
}
