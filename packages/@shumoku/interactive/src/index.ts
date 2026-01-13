/**
 * @shumoku/interactive
 * Interactive runtime for Shumoku network diagrams
 */

// Components (for advanced usage)
export {
  destroyBottomSheet,
  destroyModal,
  destroyTooltip,
  hideBottomSheet,
  hideModal,
  hideTooltip,
  isBottomSheetOpen,
  isModalOpen,
  showBottomSheet,
  showModal,
  showTooltip,
} from './components/index.js'
// Handlers (for advanced usage)
export {
  buildLinkMap,
  extractDeviceInfo,
  extractDevicePorts,
  extractLinkInfo,
  extractPortInfo,
  findDeviceElement,
  findLinkElement,
  findPortElement,
} from './handlers/index.js'
// Main API
export { initInteractive } from './runtime.js'
// Types
export type {
  DeviceInfo,
  EndpointInfo,
  InteractiveInstance,
  InteractiveOptions,
  InteractiveTheme,
  LinkInfo,
  ModalOptions,
  PortInfo,
  TooltipOptions,
} from './types.js'

// Utils (for advanced usage)
export { createElement, escapeHtml, getSvgElement } from './utils/dom.js'
export {
  calculatePopupPosition,
  getElementCenter,
  getElementViewportPosition,
} from './utils/position.js'
export { getPointerPosition, isMobileDevice, isTouchDevice } from './utils/touch.js'
