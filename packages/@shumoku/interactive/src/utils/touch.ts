/**
 * Touch Utilities
 */

/**
 * Check if device supports touch events
 */
export function isTouchDevice(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0
}

/**
 * Check if device is likely a mobile device
 */
export function isMobileDevice(): boolean {
  return isTouchDevice() && window.innerWidth <= 768
}

/**
 * Unified pointer event position
 */
export interface PointerPosition {
  x: number
  y: number
  clientX: number
  clientY: number
}

/**
 * Get position from mouse or touch event
 */
export function getPointerPosition(event: MouseEvent | TouchEvent): PointerPosition | null {
  if ('touches' in event) {
    const touch = event.touches[0] || event.changedTouches[0]
    if (!touch) return null
    return {
      x: touch.pageX,
      y: touch.pageY,
      clientX: touch.clientX,
      clientY: touch.clientY,
    }
  }
  return {
    x: event.pageX,
    y: event.pageY,
    clientX: event.clientX,
    clientY: event.clientY,
  }
}
