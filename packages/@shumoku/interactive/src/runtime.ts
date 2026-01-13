/**
 * Interactive Runtime
 * Main entry point for interactive features
 */

import {
  destroyBottomSheet,
  destroyModal,
  destroyTooltip,
  hideBottomSheet,
  hideModal,
  hideTooltip,
  showBottomSheet,
  showModal,
  showTooltip,
} from './components/index.js'
import {
  buildLinkMap,
  extractDeviceInfo,
  extractDevicePorts,
  extractLinkInfo,
  findDeviceElement,
} from './handlers/index.js'
import type { InteractiveInstance, InteractiveOptions } from './types.js'
import { findClosest, getSvgElement } from './utils/dom.js'
import { getPointerPosition, isMobileDevice } from './utils/touch.js'

/**
 * Initialize interactive features on an SVG element
 */
export function initInteractive(options: InteractiveOptions): InteractiveInstance {
  const svgElement = getSvgElement(options.target)
  if (!svgElement) {
    throw new Error('SVG element not found')
  }

  // Determine if we should use mobile UI
  const useMobileUI = options.useMobileUI ?? isMobileDevice()

  // Build link map for port connections
  const linkMap = buildLinkMap(svgElement)

  // Default options
  const modalEnabled = options.modal?.enabled ?? true
  const tooltipEnabled = options.tooltip?.enabled ?? true
  const tooltipDelay = options.tooltip?.delay ?? 200

  // Tooltip state
  let tooltipTimeout: ReturnType<typeof setTimeout> | null = null
  let currentLinkElement: Element | null = null

  // Event handlers
  const handleDeviceClick = (event: Event) => {
    const target = event.target as Element
    const nodeElement =
      findClosest(target, '.node-bg[data-id]') || findClosest(target, '.node-fg[data-id]')

    if (!nodeElement) return

    const deviceInfo = extractDeviceInfo(nodeElement)
    if (!deviceInfo) return

    // Call user callback first
    if (options.onDeviceClick) {
      const result = options.onDeviceClick(deviceInfo)
      if (result === false) return // User cancelled
    }

    if (!modalEnabled) return

    // Extract ports for this device
    const ports = extractDevicePorts(svgElement, deviceInfo.id, linkMap)

    // Show modal or bottom sheet
    if (useMobileUI) {
      showBottomSheet(deviceInfo, ports, options.modal?.customTemplate)
    } else {
      showModal(deviceInfo, ports, options.modal?.customTemplate, options.modal?.closeOnBackdrop)
    }
  }

  const handleLinkMouseEnter = (event: Event) => {
    if (!tooltipEnabled) return

    const target = event.target as Element
    const linkElement = findClosest(target, '.link-group[data-link-id]')

    if (!linkElement) return
    currentLinkElement = linkElement

    const linkInfo = extractLinkInfo(linkElement)
    if (!linkInfo) return

    // Call user callback first
    if (options.onLinkHover) {
      const result = options.onLinkHover(linkInfo)
      if (result === false) return // User cancelled
    }

    // Get position
    const pos = getPointerPosition(event as MouseEvent)
    if (!pos) return

    // Show tooltip after delay
    tooltipTimeout = setTimeout(() => {
      showTooltip(linkInfo, pos.clientX, pos.clientY, options.tooltip?.customTemplate)
    }, tooltipDelay)
  }

  const handleLinkMouseLeave = () => {
    if (tooltipTimeout) {
      clearTimeout(tooltipTimeout)
      tooltipTimeout = null
    }
    currentLinkElement = null
    hideTooltip(100)
  }

  const handleLinkMouseMove = (event: Event) => {
    if (!currentLinkElement) return

    const linkInfo = extractLinkInfo(currentLinkElement)
    if (!linkInfo) return

    const pos = getPointerPosition(event as MouseEvent)
    if (!pos) return

    // Update tooltip position
    showTooltip(linkInfo, pos.clientX, pos.clientY, options.tooltip?.customTemplate)
  }

  // Touch handling for links (tap to show tooltip)
  const handleLinkTap = (event: Event) => {
    if (!tooltipEnabled) return

    const target = event.target as Element
    const linkElement = findClosest(target, '.link-group[data-link-id]')

    if (!linkElement) {
      hideTooltip()
      return
    }

    const linkInfo = extractLinkInfo(linkElement)
    if (!linkInfo) return

    // Call user callback first
    if (options.onLinkHover) {
      const result = options.onLinkHover(linkInfo)
      if (result === false) return
    }

    const touchEvent = event as TouchEvent
    const pos = getPointerPosition(touchEvent)
    if (!pos) return

    showTooltip(linkInfo, pos.clientX, pos.clientY, options.tooltip?.customTemplate)

    // Auto-hide after 3 seconds on mobile
    setTimeout(() => hideTooltip(), 3000)
  }

  // Attach event listeners using event delegation
  svgElement.addEventListener('click', handleDeviceClick)

  if (isMobileDevice()) {
    svgElement.addEventListener('touchstart', handleLinkTap, { passive: true })
  } else {
    svgElement.addEventListener('mouseenter', handleLinkMouseEnter, true)
    svgElement.addEventListener('mouseleave', handleLinkMouseLeave, true)
    svgElement.addEventListener('mousemove', handleLinkMouseMove, true)
  }

  // Return instance with cleanup method
  return {
    destroy: () => {
      svgElement.removeEventListener('click', handleDeviceClick)

      if (isMobileDevice()) {
        svgElement.removeEventListener('touchstart', handleLinkTap)
      } else {
        svgElement.removeEventListener('mouseenter', handleLinkMouseEnter, true)
        svgElement.removeEventListener('mouseleave', handleLinkMouseLeave, true)
        svgElement.removeEventListener('mousemove', handleLinkMouseMove, true)
      }

      destroyModal()
      destroyTooltip()
      destroyBottomSheet()
    },

    showDeviceModal: (deviceId: string) => {
      const element = findDeviceElement(svgElement, deviceId)
      if (!element) return

      const deviceInfo = extractDeviceInfo(element)
      if (!deviceInfo) return

      const ports = extractDevicePorts(svgElement, deviceId, linkMap)

      if (useMobileUI) {
        showBottomSheet(deviceInfo, ports, options.modal?.customTemplate)
      } else {
        showModal(deviceInfo, ports, options.modal?.customTemplate, options.modal?.closeOnBackdrop)
      }
    },

    hideModal: () => {
      hideModal()
      hideBottomSheet()
    },

    showLinkTooltip: (linkId: string, x: number, y: number) => {
      const element = svgElement.querySelector(`.link-group[data-link-id="${linkId}"]`)
      if (!element) return

      const linkInfo = extractLinkInfo(element)
      if (!linkInfo) return

      showTooltip(linkInfo, x, y, options.tooltip?.customTemplate)
    },

    hideTooltip,
  }
}
