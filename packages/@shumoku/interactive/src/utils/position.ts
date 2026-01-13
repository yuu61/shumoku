/**
 * Position Utilities
 */

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Calculate best position for a popup element
 * Ensures the popup stays within viewport bounds
 */
export function calculatePopupPosition(
  anchorX: number,
  anchorY: number,
  popupWidth: number,
  popupHeight: number,
  padding = 8,
): { x: number; y: number; placement: 'top' | 'bottom' | 'left' | 'right' } {
  const viewport = {
    width: window.innerWidth,
    height: window.innerHeight,
  }

  // Default to bottom placement
  let x = anchorX - popupWidth / 2
  let y = anchorY + padding
  let placement: 'top' | 'bottom' | 'left' | 'right' = 'bottom'

  // Check if popup would overflow right
  if (x + popupWidth > viewport.width - padding) {
    x = viewport.width - popupWidth - padding
  }

  // Check if popup would overflow left
  if (x < padding) {
    x = padding
  }

  // Check if popup would overflow bottom
  if (y + popupHeight > viewport.height - padding) {
    // Try placing above
    y = anchorY - popupHeight - padding
    placement = 'top'

    // If still overflows, just position at top of viewport
    if (y < padding) {
      y = padding
    }
  }

  return { x, y, placement }
}

/**
 * Get element's position relative to viewport
 */
export function getElementViewportPosition(element: Element): Rect {
  const rect = element.getBoundingClientRect()
  return {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height,
  }
}

/**
 * Get center point of an element
 */
export function getElementCenter(element: Element): { x: number; y: number } {
  const rect = element.getBoundingClientRect()
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  }
}
