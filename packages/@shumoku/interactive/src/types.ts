/**
 * Types for @shumoku/interactive
 */

import type { DeviceInfo, EndpointInfo, LinkInfo, PortInfo } from '@shumoku/core/renderer'

// Re-export types from core for convenience
export type { DeviceInfo, EndpointInfo, LinkInfo, PortInfo }

/**
 * Theme configuration for interactive components
 */
export interface InteractiveTheme {
  /** Background color */
  background: string
  /** Surface color (cards, modals) */
  surface: string
  /** Primary text color */
  text: string
  /** Secondary text color */
  textSecondary: string
  /** Border color */
  border: string
  /** Font family */
  fontFamily: string
  /** Modal backdrop color */
  modalBackdrop: string
  /** Shadow for elevated elements */
  shadow: string
}

/**
 * Options for modal component
 */
export interface ModalOptions {
  /** Enable modal on device click */
  enabled?: boolean
  /** Close when clicking backdrop */
  closeOnBackdrop?: boolean
  /** Custom template function for modal content */
  customTemplate?: (device: DeviceInfo) => string | HTMLElement
}

/**
 * Options for tooltip component
 */
export interface TooltipOptions {
  /** Enable tooltips */
  enabled?: boolean
  /** Delay before showing tooltip (ms) */
  delay?: number
  /** Custom template function for tooltip content */
  customTemplate?: (link: LinkInfo) => string | HTMLElement
}

/**
 * Options for initializing interactive features
 */
export interface InteractiveOptions {
  /** SVG element or selector */
  target: SVGElement | string
  /** Custom theme overrides */
  theme?: Partial<InteractiveTheme>
  /** Modal configuration */
  modal?: ModalOptions
  /** Tooltip configuration */
  tooltip?: TooltipOptions
  /** Use mobile-optimized UI (bottom sheet instead of modal) */
  useMobileUI?: boolean
  /** Callback when device is clicked. Return false to cancel default behavior. */
  onDeviceClick?: (device: DeviceInfo) => boolean | undefined
  /** Callback when link is hovered/tapped. Return false to cancel default behavior. */
  onLinkHover?: (link: LinkInfo) => boolean | undefined
  /** Callback when port is clicked. Return false to cancel default behavior. */
  onPortClick?: (port: PortInfo) => boolean | undefined
}

/**
 * Interactive runtime instance
 */
export interface InteractiveInstance {
  /** Destroy the instance and clean up event listeners */
  destroy: () => void
  /** Show modal for a device */
  showDeviceModal: (deviceId: string) => void
  /** Hide any open modal */
  hideModal: () => void
  /** Show tooltip for a link */
  showLinkTooltip: (linkId: string, x: number, y: number) => void
  /** Hide any open tooltip */
  hideTooltip: () => void
}
