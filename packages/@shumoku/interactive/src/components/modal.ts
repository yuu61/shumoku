/**
 * Modal Component
 */

import type { DeviceInfo, PortInfo } from '../types.js'
import { createElement, escapeHtml } from '../utils/dom.js'

const MODAL_CLASS = 'shumoku-modal'
const BACKDROP_CLASS = 'shumoku-modal-backdrop'

let modalElement: HTMLElement | null = null
let backdropElement: HTMLElement | null = null

/**
 * Create modal elements if they don't exist
 */
function ensureModalElements(): { modal: HTMLElement; backdrop: HTMLElement } {
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

  if (!modalElement) {
    modalElement = createElement('div', {
      class: MODAL_CLASS,
      role: 'dialog',
      'aria-modal': 'true',
    })
    modalElement.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) scale(0.95);
      z-index: 10001;
      min-width: 320px;
      max-width: 480px;
      max-height: 80vh;
      overflow-y: auto;
      border-radius: 12px;
      opacity: 0;
      transition: opacity 0.2s ease, transform 0.2s ease;
      background: var(--shumoku-surface, #ffffff);
      color: var(--shumoku-text, #1e293b);
      border: 1px solid var(--shumoku-border, #e2e8f0);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
      font-family: var(--shumoku-font, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
      pointer-events: none;
    `
    document.body.appendChild(modalElement)
  }

  return { modal: modalElement, backdrop: backdropElement }
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
 * Default modal content for devices
 */
function defaultDeviceContent(device: DeviceInfo, ports?: PortInfo[]): string {
  const label = Array.isArray(device.label) ? device.label.join(' ') : device.label
  const parts: string[] = []

  // Header
  parts.push(`
    <div style="padding: 16px 20px; border-bottom: 1px solid var(--shumoku-border, #e2e8f0);">
      <div style="font-size: 18px; font-weight: 600; margin-bottom: 4px;">${escapeHtml(label)}</div>
      <div style="font-size: 13px; color: var(--shumoku-text-secondary, #64748b);">${formatDeviceType(device.type)}</div>
    </div>
  `)

  // Details section
  const details: string[] = []
  if (device.vendor) {
    details.push(
      `<div><span style="color: var(--shumoku-text-secondary, #64748b);">Vendor:</span> ${escapeHtml(device.vendor)}</div>`,
    )
  }
  if (device.model) {
    details.push(
      `<div><span style="color: var(--shumoku-text-secondary, #64748b);">Model:</span> ${escapeHtml(device.model)}</div>`,
    )
  }
  if (device.service) {
    details.push(
      `<div><span style="color: var(--shumoku-text-secondary, #64748b);">Service:</span> ${escapeHtml(device.service)}</div>`,
    )
  }
  if (device.resource) {
    details.push(
      `<div><span style="color: var(--shumoku-text-secondary, #64748b);">Resource:</span> ${escapeHtml(device.resource)}</div>`,
    )
  }

  if (details.length > 0) {
    parts.push(`
      <div style="padding: 12px 20px; border-bottom: 1px solid var(--shumoku-border, #e2e8f0);">
        <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--shumoku-text-secondary, #64748b); margin-bottom: 8px;">Details</div>
        <div style="display: flex; flex-direction: column; gap: 4px; font-size: 13px;">
          ${details.join('')}
        </div>
      </div>
    `)
  }

  // Ports section
  if (ports && ports.length > 0) {
    const portRows = ports.map((port) => {
      const connectedStr = port.connectedTo
        ? `<span style="color: var(--shumoku-text-secondary, #64748b);"> → ${escapeHtml(port.connectedTo.device)}${port.connectedTo.port ? `:${escapeHtml(port.connectedTo.port)}` : ''}</span>`
        : ''
      return `<div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--shumoku-border, #e2e8f0);">
        <span style="font-family: monospace; font-size: 12px;">${escapeHtml(port.label)}</span>
        ${connectedStr}
      </div>`
    })

    parts.push(`
      <div style="padding: 12px 20px;">
        <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--shumoku-text-secondary, #64748b); margin-bottom: 8px;">Ports (${ports.length})</div>
        <div style="max-height: 200px; overflow-y: auto;">
          ${portRows.join('')}
        </div>
      </div>
    `)
  }

  // Close button
  parts.push(`
    <div style="padding: 12px 20px; border-top: 1px solid var(--shumoku-border, #e2e8f0); text-align: right;">
      <button class="shumoku-modal-close" style="
        padding: 8px 16px;
        border-radius: 6px;
        border: 1px solid var(--shumoku-border, #e2e8f0);
        background: var(--shumoku-surface, #ffffff);
        color: var(--shumoku-text, #1e293b);
        font-size: 13px;
        cursor: pointer;
        transition: background 0.15s ease;
      ">Close</button>
    </div>
  `)

  return parts.join('')
}

/**
 * Show modal for device
 */
export function showModal(
  device: DeviceInfo,
  ports?: PortInfo[],
  customTemplate?: (device: DeviceInfo) => string | HTMLElement,
  closeOnBackdrop = true,
): void {
  const { modal, backdrop } = ensureModalElements()

  // Set content
  if (customTemplate) {
    const content = customTemplate(device)
    if (typeof content === 'string') {
      modal.innerHTML = content
    } else {
      modal.innerHTML = ''
      modal.appendChild(content)
    }
  } else {
    modal.innerHTML = defaultDeviceContent(device, ports)
  }

  // Setup close button handler
  const closeBtn = modal.querySelector('.shumoku-modal-close')
  if (closeBtn) {
    closeBtn.addEventListener('click', hideModal)
  }

  // Setup backdrop click handler
  if (closeOnBackdrop) {
    backdrop.onclick = hideModal
  }

  // Setup escape key handler
  const escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      hideModal()
      document.removeEventListener('keydown', escHandler)
    }
  }
  document.addEventListener('keydown', escHandler)

  // Show with animation
  requestAnimationFrame(() => {
    backdrop.style.opacity = '1'
    backdrop.style.pointerEvents = 'auto'
    modal.style.opacity = '1'
    modal.style.transform = 'translate(-50%, -50%) scale(1)'
    modal.style.pointerEvents = 'auto'
  })

  // Focus management
  modal.setAttribute('tabindex', '-1')
  modal.focus()
}

/**
 * Hide modal
 */
export function hideModal(): void {
  if (!modalElement || !backdropElement) return

  backdropElement.style.opacity = '0'
  backdropElement.style.pointerEvents = 'none'
  modalElement.style.opacity = '0'
  modalElement.style.transform = 'translate(-50%, -50%) scale(0.95)'
  modalElement.style.pointerEvents = 'none'
}

/**
 * Check if modal is currently open
 */
export function isModalOpen(): boolean {
  return modalElement?.style.opacity === '1'
}

/**
 * Destroy modal elements
 */
export function destroyModal(): void {
  if (modalElement) {
    modalElement.remove()
    modalElement = null
  }
  if (backdropElement) {
    backdropElement.remove()
    backdropElement = null
  }
}
