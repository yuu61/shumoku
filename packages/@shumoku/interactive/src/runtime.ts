/**
 * Interactive Runtime - Simple hover tooltip
 */

import type { InteractiveInstance, InteractiveOptions } from './types.js'

let tooltip: HTMLDivElement | null = null

function getTooltip(): HTMLDivElement {
  if (!tooltip) {
    tooltip = document.createElement('div')
    tooltip.style.cssText = `
      position: fixed;
      z-index: 10000;
      padding: 6px 10px;
      background: #1e293b;
      color: #fff;
      font-size: 12px;
      border-radius: 4px;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.15s;
      font-family: system-ui, sans-serif;
      max-width: 300px;
      white-space: pre-line;
    `
    document.body.appendChild(tooltip)
  }
  return tooltip
}

function showTooltip(text: string, x: number, y: number): void {
  const t = getTooltip()
  t.textContent = text
  t.style.left = `${x + 12}px`
  t.style.top = `${y + 12}px`
  t.style.opacity = '1'
}

function hideTooltip(): void {
  if (tooltip) {
    tooltip.style.opacity = '0'
  }
}

function getTooltipText(el: Element): string | null {
  // Port tooltip (check first - ports are inside nodes)
  // Matches .port, .port-label, .port-label-bg with data-port attribute
  const port = el.closest('[data-port]')
  if (port) {
    const portId = port.getAttribute('data-port') || ''
    const deviceId = port.getAttribute('data-port-device') || ''
    return `${deviceId}:${portId}`
  }

  // Link tooltip
  const linkGroup = el.closest('.link-group[data-link-id]')
  if (linkGroup) {
    const from = linkGroup.getAttribute('data-link-from') || ''
    const to = linkGroup.getAttribute('data-link-to') || ''
    const bw = linkGroup.getAttribute('data-link-bandwidth')
    const vlan = linkGroup.getAttribute('data-link-vlan')

    let text = `${from} ↔ ${to}`
    if (bw) text += `\n${bw}`
    if (vlan) text += `\nVLAN: ${vlan}`
    return text
  }

  // Device tooltip (single label only)
  const node = el.closest('.node-bg[data-id], .node-fg[data-id]')
  if (node) {
    const json = node.getAttribute('data-device-json')
    if (json) {
      try {
        const data = JSON.parse(json)
        return data.label || data.id
      } catch {
        return node.getAttribute('data-id')
      }
    }
    return node.getAttribute('data-id')
  }

  return null
}

export function initInteractive(options: InteractiveOptions): InteractiveInstance {
  const target = typeof options.target === 'string'
    ? document.querySelector(options.target)
    : options.target

  if (!target) throw new Error('Target not found')

  const handleMove = (e: Event) => {
    const me = e as MouseEvent
    const text = getTooltipText(me.target as Element)
    if (text) {
      showTooltip(text, me.clientX, me.clientY)
    } else {
      hideTooltip()
    }
  }

  const handleLeave = () => hideTooltip()

  target.addEventListener('mousemove', handleMove)
  target.addEventListener('mouseleave', handleLeave)

  return {
    destroy: () => {
      target.removeEventListener('mousemove', handleMove)
      target.removeEventListener('mouseleave', handleLeave)
      if (tooltip) {
        tooltip.remove()
        tooltip = null
      }
    },
    showDeviceModal: () => {},
    hideModal: () => {},
    showLinkTooltip: () => {},
    hideTooltip,
  }
}
