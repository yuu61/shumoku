/**
 * Bottom Sheet Component (Mobile-optimized modal)
 */

import type { DeviceInfo, PortInfo } from '../types.js'
import { createElement, escapeHtml } from '../utils/dom.js'

const SHEET_CLASS = 'shumoku-bottom-sheet'
const BACKDROP_CLASS = 'shumoku-bottom-sheet-backdrop'

let sheetElement: HTMLElement | null = null
let backdropElement: HTMLElement | null = null
let startY = 0
let currentY = 0
let isDragging = false

/**
 * Create bottom sheet elements if they don't exist
 */
function ensureSheetElements(): { sheet: HTMLElement; backdrop: HTMLElement } {
  if (!backdropElement) {
    backdropElement = createElement('div', {
      class: BACKDROP_CLASS,
    })
    backdropElement.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 10000;
      background: rgba(0, 0, 0, 0.4);
      opacity: 0;
      transition: opacity 0.2s ease;
      pointer-events: none;
    `
    document.body.appendChild(backdropElement)
  }

  if (!sheetElement) {
    sheetElement = createElement('div', {
      class: SHEET_CLASS,
      role: 'dialog',
      'aria-modal': 'true',
    })
    sheetElement.style.cssText = `
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 10001;
      max-height: 80vh;
      overflow: hidden;
      border-radius: 16px 16px 0 0;
      transform: translateY(100%);
      transition: transform 0.3s ease;
      background: var(--shumoku-surface, #ffffff);
      color: var(--shumoku-text, #1e293b);
      box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
      font-family: var(--shumoku-font, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
      pointer-events: none;
    `
    document.body.appendChild(sheetElement)
  }

  return { sheet: sheetElement, backdrop: backdropElement }
}

/**
 * Format device type for display
 */
function formatDeviceType(type?: string): string {
  if (!type) return 'Device'
  return type
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Default bottom sheet content for devices
 */
function defaultDeviceContent(device: DeviceInfo, ports?: PortInfo[]): string {
  const label = Array.isArray(device.label) ? device.label.join(' ') : device.label
  const parts: string[] = []

  // Drag handle
  parts.push(`
    <div class="shumoku-sheet-handle" style="padding: 12px; text-align: center; cursor: grab;">
      <div style="width: 36px; height: 4px; background: var(--shumoku-border, #e2e8f0); border-radius: 2px; margin: 0 auto;"></div>
    </div>
  `)

  // Header
  parts.push(`
    <div style="padding: 8px 20px 16px; border-bottom: 1px solid var(--shumoku-border, #e2e8f0);">
      <div style="font-size: 20px; font-weight: 600; margin-bottom: 4px;">${escapeHtml(label)}</div>
      <div style="font-size: 14px; color: var(--shumoku-text-secondary, #64748b);">${formatDeviceType(device.type)}</div>
    </div>
  `)

  // Scrollable content
  parts.push('<div style="overflow-y: auto; max-height: calc(80vh - 120px);">')

  // Details section
  const details: string[] = []
  if (device.vendor) {
    details.push(`<div style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--shumoku-border, #e2e8f0);">
      <span style="color: var(--shumoku-text-secondary, #64748b);">Vendor</span>
      <span>${escapeHtml(device.vendor)}</span>
    </div>`)
  }
  if (device.model) {
    details.push(`<div style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--shumoku-border, #e2e8f0);">
      <span style="color: var(--shumoku-text-secondary, #64748b);">Model</span>
      <span>${escapeHtml(device.model)}</span>
    </div>`)
  }
  if (device.service) {
    details.push(`<div style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--shumoku-border, #e2e8f0);">
      <span style="color: var(--shumoku-text-secondary, #64748b);">Service</span>
      <span>${escapeHtml(device.service)}</span>
    </div>`)
  }

  if (details.length > 0) {
    parts.push(`<div style="padding: 0 20px;">${details.join('')}</div>`)
  }

  // Ports section
  if (ports && ports.length > 0) {
    parts.push(`
      <div style="padding: 16px 20px;">
        <div style="font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--shumoku-text-secondary, #64748b); margin-bottom: 12px;">Ports (${ports.length})</div>
    `)

    for (const port of ports) {
      const connectedStr = port.connectedTo
        ? `<div style="font-size: 12px; color: var(--shumoku-text-secondary, #64748b);">→ ${escapeHtml(port.connectedTo.device)}${port.connectedTo.port ? `:${escapeHtml(port.connectedTo.port)}` : ''}</div>`
        : '<div style="font-size: 12px; color: var(--shumoku-text-secondary, #64748b);">Not connected</div>'

      parts.push(`
        <div style="padding: 10px 12px; margin-bottom: 8px; background: var(--shumoku-bg, #f8fafc); border-radius: 8px;">
          <div style="font-family: monospace; font-size: 13px; margin-bottom: 2px;">${escapeHtml(port.label)}</div>
          ${connectedStr}
        </div>
      `)
    }

    parts.push('</div>')
  }

  parts.push('</div>') // Close scrollable content

  return parts.join('')
}

/**
 * Setup drag-to-dismiss gesture
 */
function setupDragHandlers(sheet: HTMLElement, _backdrop: HTMLElement): void {
  const handle = sheet.querySelector('.shumoku-sheet-handle')
  if (!handle) return

  const onTouchStart = (e: TouchEvent) => {
    isDragging = true
    startY = e.touches[0].clientY
    currentY = 0
    sheet.style.transition = 'none'
  }

  const onTouchMove = (e: TouchEvent) => {
    if (!isDragging) return
    currentY = e.touches[0].clientY - startY
    if (currentY > 0) {
      sheet.style.transform = `translateY(${currentY}px)`
    }
  }

  const onTouchEnd = () => {
    if (!isDragging) return
    isDragging = false
    sheet.style.transition = 'transform 0.3s ease'

    // If dragged more than 100px down, close the sheet
    if (currentY > 100) {
      hideBottomSheet()
    } else {
      sheet.style.transform = 'translateY(0)'
    }
  }

  handle.addEventListener('touchstart', onTouchStart as EventListener)
  document.addEventListener('touchmove', onTouchMove as EventListener)
  document.addEventListener('touchend', onTouchEnd)
}

/**
 * Show bottom sheet for device
 */
export function showBottomSheet(
  device: DeviceInfo,
  ports?: PortInfo[],
  customTemplate?: (device: DeviceInfo) => string | HTMLElement,
): void {
  const { sheet, backdrop } = ensureSheetElements()

  // Set content
  if (customTemplate) {
    const content = customTemplate(device)
    if (typeof content === 'string') {
      sheet.innerHTML = content
    } else {
      sheet.innerHTML = ''
      sheet.appendChild(content)
    }
  } else {
    sheet.innerHTML = defaultDeviceContent(device, ports)
  }

  // Setup drag handlers
  setupDragHandlers(sheet, backdrop)

  // Setup backdrop click handler
  backdrop.onclick = hideBottomSheet

  // Show with animation
  requestAnimationFrame(() => {
    backdrop.style.opacity = '1'
    backdrop.style.pointerEvents = 'auto'
    sheet.style.transform = 'translateY(0)'
    sheet.style.pointerEvents = 'auto'
  })
}

/**
 * Hide bottom sheet
 */
export function hideBottomSheet(): void {
  if (!sheetElement || !backdropElement) return

  backdropElement.style.opacity = '0'
  backdropElement.style.pointerEvents = 'none'
  sheetElement.style.transform = 'translateY(100%)'
  sheetElement.style.pointerEvents = 'none'
}

/**
 * Check if bottom sheet is currently open
 */
export function isBottomSheetOpen(): boolean {
  return sheetElement?.style.transform === 'translateY(0)'
}

/**
 * Destroy bottom sheet elements
 */
export function destroyBottomSheet(): void {
  if (sheetElement) {
    sheetElement.remove()
    sheetElement = null
  }
  if (backdropElement) {
    backdropElement.remove()
    backdropElement = null
  }
}
