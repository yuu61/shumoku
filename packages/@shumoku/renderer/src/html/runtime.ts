/**
 * Interactive Runtime - Mobile-first pan/zoom with tap tooltips and spotlight effect
 * Google Maps style touch: 1 finger = page scroll (in HTML) / pan (here), 2 fingers = pinch zoom
 */

import type { InteractiveInstance, InteractiveOptions } from '../types.js'

// ============================================
// Tooltip
// ============================================

let tooltip: HTMLDivElement | null = null

function getTooltip(): HTMLDivElement {
  if (!tooltip) {
    tooltip = document.createElement('div')
    tooltip.style.cssText = `
      position: fixed;
      z-index: 10000;
      padding: 8px 12px;
      background: rgba(30, 41, 59, 0.95);
      color: #fff;
      font-size: 13px;
      line-height: 1.4;
      border-radius: 6px;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.15s;
      font-family: system-ui, -apple-system, sans-serif;
      max-width: 280px;
      white-space: pre-line;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `
    document.body.appendChild(tooltip)
  }
  return tooltip
}

function showTooltip(text: string, x: number, y: number): void {
  const t = getTooltip()
  t.textContent = text
  t.style.opacity = '1'

  requestAnimationFrame(() => {
    const rect = t.getBoundingClientRect()
    const pad = 12
    let left = x + pad
    let top = y - rect.height - pad

    if (left + rect.width > window.innerWidth - pad) {
      left = x - rect.width - pad
    }
    if (top < pad) {
      top = y + pad
    }

    t.style.left = `${Math.max(pad, left)}px`
    t.style.top = `${Math.max(pad, top)}px`
  })
}

function hideTooltip(): void {
  if (tooltip) {
    tooltip.style.opacity = '0'
  }
}

// ============================================
// Spotlight / Overlay Effect
// ============================================

let overlay: HTMLDivElement | null = null
let highlightContainer: HTMLDivElement | null = null
let currentHighlight: Element | null = null
let currentMiniSvg: SVGSVGElement | null = null

function getOverlay(): HTMLDivElement {
  if (!overlay) {
    overlay = document.createElement('div')
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.15s ease;
      z-index: 9998;
    `
    document.body.appendChild(overlay)
  }
  return overlay
}

function getHighlightContainer(): HTMLDivElement {
  if (!highlightContainer) {
    highlightContainer = document.createElement('div')
    highlightContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      pointer-events: none;
      z-index: 9999;
    `
    document.body.appendChild(highlightContainer)
  }
  return highlightContainer
}

function updateHighlightPosition(): void {
  if (!currentHighlight || !currentMiniSvg) return

  if (!document.contains(currentHighlight)) {
    highlightElement(null)
    return
  }

  const svg = currentHighlight.closest('svg') as SVGSVGElement | null
  if (!svg) return

  const rect = svg.getBoundingClientRect()
  const viewBox = svg.getAttribute('viewBox')
  if (viewBox) {
    currentMiniSvg.setAttribute('viewBox', viewBox)
  }

  currentMiniSvg.style.left = `${rect.left}px`
  currentMiniSvg.style.top = `${rect.top}px`
  currentMiniSvg.style.width = `${rect.width}px`
  currentMiniSvg.style.height = `${rect.height}px`
}

function highlightElement(el: Element | null): void {
  if (el === currentHighlight) return

  if (currentHighlight) {
    currentHighlight.classList.remove('shumoku-highlight')
  }

  const container = getHighlightContainer()
  container.innerHTML = ''
  currentMiniSvg = null
  currentHighlight = el

  const ov = getOverlay()

  if (el) {
    el.classList.add('shumoku-highlight')

    const svg = el.closest('svg') as SVGSVGElement | null
    if (svg) {
      const viewBox = svg.getAttribute('viewBox')
      if (viewBox) {
        const clone = el.cloneNode(true) as Element
        clone.classList.remove('shumoku-highlight')

        const miniSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        miniSvg.setAttribute('viewBox', viewBox)
        miniSvg.style.cssText = `
          position: absolute;
          overflow: visible;
          filter: drop-shadow(0 0 4px #fff) drop-shadow(0 0 8px #fff) drop-shadow(0 0 12px rgba(100, 150, 255, 0.8));
        `

        const defs = svg.querySelector('defs')
        if (defs) {
          miniSvg.appendChild(defs.cloneNode(true))
        }

        miniSvg.appendChild(clone)
        container.appendChild(miniSvg)
        currentMiniSvg = miniSvg

        updateHighlightPosition()
      }
    }

    ov.style.opacity = '1'
  } else {
    ov.style.opacity = '0'
  }
}

// ============================================
// Tooltip Info Extraction
// ============================================

interface TooltipInfo {
  text: string
  element: Element
}

function getTooltipInfo(el: Element): TooltipInfo | null {
  const port = el.closest('.port[data-port]')
  if (port) {
    const portId = port.getAttribute('data-port') || ''
    const deviceId = port.getAttribute('data-port-device') || ''
    return { text: `${deviceId}:${portId}`, element: port }
  }

  const linkGroup = el.closest('.link-group[data-link-id]')
  if (linkGroup) {
    const from = linkGroup.getAttribute('data-link-from') || ''
    const to = linkGroup.getAttribute('data-link-to') || ''
    const bw = linkGroup.getAttribute('data-link-bandwidth')
    const vlan = linkGroup.getAttribute('data-link-vlan')

    let text = `${from} ↔ ${to}`
    if (bw) text += `\n${bw}`
    if (vlan) text += `\nVLAN: ${vlan}`
    return { text, element: linkGroup }
  }

  const node = el.closest('.node[data-id]')
  if (node) {
    const json = node.getAttribute('data-device-json')
    if (json) {
      try {
        const data = JSON.parse(json)
        const lines: string[] = []
        if (data.label) lines.push(Array.isArray(data.label) ? data.label.join(' ') : data.label)
        if (data.type) lines.push(`Type: ${data.type}`)
        if (data.vendor) lines.push(`Vendor: ${data.vendor}`)
        if (data.model) lines.push(`Model: ${data.model}`)
        return { text: lines.join('\n'), element: node }
      } catch {
        // fallthrough
      }
    }
    return { text: node.getAttribute('data-id') || '', element: node }
  }

  return null
}

// ============================================
// ViewBox Utilities
// ============================================

interface ViewBox {
  x: number
  y: number
  width: number
  height: number
}

function parseViewBox(svg: SVGSVGElement): ViewBox | null {
  const vb = svg.getAttribute('viewBox')
  if (!vb) return null
  const parts = vb.split(/\s+|,/).map(Number)
  if (parts.length !== 4 || parts.some(Number.isNaN)) return null
  return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] }
}

function setViewBox(svg: SVGSVGElement, vb: ViewBox): void {
  svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.width} ${vb.height}`)
  // Update highlight position when viewBox changes
  updateHighlightPosition()
}

// ============================================
// Main Interactive Runtime
// ============================================

export function initInteractive(options: InteractiveOptions): InteractiveInstance {
  const target =
    typeof options.target === 'string' ? document.querySelector(options.target) : options.target

  if (!target) throw new Error('Target not found')

  const svg = target.closest('svg') || target.querySelector('svg') || (target as SVGSVGElement)
  if (!(svg instanceof SVGSVGElement)) throw new Error('SVG element not found')

  const panZoomEnabled = options.panZoom?.enabled ?? true
  const minScale = options.panZoom?.minScale ?? 0.1
  const maxScale = options.panZoom?.maxScale ?? 10
  const ZOOM_FACTOR = 1.2

  let originalViewBox: ViewBox | null = parseViewBox(svg)
  if (!originalViewBox) {
    const bbox = svg.getBBox()
    originalViewBox = { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height }
    setViewBox(svg, originalViewBox)
  }

  let tooltipActive = false

  const mouseDrag = {
    active: false,
    startX: 0,
    startY: 0,
    startViewBox: null as ViewBox | null,
  }

  let pinchState: {
    initialDist: number
    startViewBox: ViewBox
    centerX: number
    centerY: number
  } | null = null

  const getScale = (): number => {
    if (!originalViewBox) return 1
    const current = parseViewBox(svg)
    if (!current) return 1
    return originalViewBox.width / current.width
  }

  const resetView = () => {
    if (originalViewBox) {
      setViewBox(svg, originalViewBox)
    }
  }

  // ============================================
  // Touch Events (Mobile: 2-finger for pan/zoom)
  // ============================================

  const getTouchDistance = (touches: TouchList): number => {
    if (touches.length < 2) return 0
    const dx = touches[1].clientX - touches[0].clientX
    const dy = touches[1].clientY - touches[0].clientY
    return Math.hypot(dx, dy)
  }

  const getTouchCenter = (touches: TouchList): { x: number; y: number } => {
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    }
  }

  const handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length >= 2 && panZoomEnabled) {
      e.preventDefault()
      const dist = getTouchDistance(e.touches)
      const center = getTouchCenter(e.touches)
      const vb = parseViewBox(svg)
      if (vb) {
        const rect = svg.getBoundingClientRect()
        pinchState = {
          initialDist: dist,
          startViewBox: { ...vb },
          centerX: vb.x + vb.width * ((center.x - rect.left) / rect.width),
          centerY: vb.y + vb.height * ((center.y - rect.top) / rect.height),
        }
      }
      if (tooltipActive) {
        hideTooltip()
        highlightElement(null)
        tooltipActive = false
      }
    }
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (e.touches.length >= 2 && pinchState && panZoomEnabled) {
      e.preventDefault()

      const dist = getTouchDistance(e.touches)
      const center = getTouchCenter(e.touches)

      if (dist === 0 || pinchState.initialDist === 0) return

      const scale = dist / pinchState.initialDist
      const newWidth = pinchState.startViewBox.width / scale
      const newHeight = pinchState.startViewBox.height / scale

      if (!originalViewBox) return
      const newScale = originalViewBox.width / newWidth
      if (newScale < minScale || newScale > maxScale) return

      const rect = svg.getBoundingClientRect()
      const mx = (center.x - rect.left) / rect.width
      const my = (center.y - rect.top) / rect.height

      setViewBox(svg, {
        x: pinchState.centerX - newWidth * mx,
        y: pinchState.centerY - newHeight * my,
        width: newWidth,
        height: newHeight,
      })
    }
  }

  const handleTouchEnd = (e: TouchEvent) => {
    if (e.touches.length < 2) {
      pinchState = null
    }
  }

  // ============================================
  // Mouse Events (Desktop)
  // ============================================

  const handleMouseDown = (e: MouseEvent) => {
    if (e.button !== 0 || !panZoomEnabled) return

    const vb = parseViewBox(svg)
    if (!vb) return

    mouseDrag.active = true
    mouseDrag.startX = e.clientX
    mouseDrag.startY = e.clientY
    mouseDrag.startViewBox = { ...vb }
    svg.style.cursor = 'grabbing'

    if (tooltipActive) {
      hideTooltip()
      highlightElement(null)
      tooltipActive = false
    }
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (mouseDrag.active && mouseDrag.startViewBox && panZoomEnabled) {
      const dx = e.clientX - mouseDrag.startX
      const dy = e.clientY - mouseDrag.startY
      const rect = svg.getBoundingClientRect()
      const scaleX = mouseDrag.startViewBox.width / rect.width
      const scaleY = mouseDrag.startViewBox.height / rect.height

      setViewBox(svg, {
        x: mouseDrag.startViewBox.x - dx * scaleX,
        y: mouseDrag.startViewBox.y - dy * scaleY,
        width: mouseDrag.startViewBox.width,
        height: mouseDrag.startViewBox.height,
      })
    } else if (!mouseDrag.active) {
      // Hover: show tooltip and highlight
      const info = getTooltipInfo(e.target as Element)
      if (info) {
        showTooltip(info.text, e.clientX, e.clientY)
        highlightElement(info.element)
      } else {
        hideTooltip()
        highlightElement(null)
      }
    }
  }

  const handleMouseUp = () => {
    mouseDrag.active = false
    mouseDrag.startViewBox = null
    svg.style.cursor = ''
  }

  const handleMouseLeave = () => {
    if (!mouseDrag.active && !tooltipActive) {
      hideTooltip()
      highlightElement(null)
    }
  }

  const handleWheel = (e: WheelEvent) => {
    if (!panZoomEnabled) return
    e.preventDefault()

    const vb = parseViewBox(svg)
    if (!vb || !originalViewBox) return

    const rect = svg.getBoundingClientRect()
    const mouseX = vb.x + vb.width * ((e.clientX - rect.left) / rect.width)
    const mouseY = vb.y + vb.height * ((e.clientY - rect.top) / rect.height)

    const zoomFactor = e.deltaY > 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR
    const newWidth = vb.width * zoomFactor
    const newHeight = vb.height * zoomFactor

    const newScale = originalViewBox.width / newWidth
    if (newScale < minScale || newScale > maxScale) return

    const xRatio = (e.clientX - rect.left) / rect.width
    const yRatio = (e.clientY - rect.top) / rect.height

    setViewBox(svg, {
      x: mouseX - newWidth * xRatio,
      y: mouseY - newHeight * yRatio,
      width: newWidth,
      height: newHeight,
    })
  }

  // ============================================
  // Tap for tooltip (touch devices)
  // ============================================

  let tapStart: { x: number; y: number; time: number } | null = null

  const handleTouchStartForTap = (e: TouchEvent) => {
    if (e.touches.length === 1) {
      tapStart = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now(),
      }
    } else {
      tapStart = null
    }
  }

  const handleTouchEndForTap = (e: TouchEvent) => {
    if (!tapStart || e.touches.length > 0) {
      tapStart = null
      return
    }

    const touch = e.changedTouches[0]
    const dx = touch.clientX - tapStart.x
    const dy = touch.clientY - tapStart.y
    const dt = Date.now() - tapStart.time

    if (Math.hypot(dx, dy) < 10 && dt < 300) {
      const targetEl = document.elementFromPoint(touch.clientX, touch.clientY)
      if (targetEl) {
        const info = getTooltipInfo(targetEl)
        if (info) {
          showTooltip(info.text, touch.clientX, touch.clientY)
          highlightElement(info.element)
          tooltipActive = true
        } else if (tooltipActive) {
          hideTooltip()
          highlightElement(null)
          tooltipActive = false
        }
      }
    }

    tapStart = null
  }

  // ============================================
  // Track viewBox changes for smooth highlight during pan/zoom
  // ============================================

  let rafId: number | null = null
  let lastViewBox = ''

  const trackViewBox = () => {
    if (currentHighlight) {
      const viewBox = svg.getAttribute('viewBox') || ''
      if (viewBox !== lastViewBox) {
        lastViewBox = viewBox
        updateHighlightPosition()
      }
    }
    rafId = requestAnimationFrame(trackViewBox)
  }

  const handlePositionUpdate = () => {
    updateHighlightPosition()
  }

  // Start tracking
  rafId = requestAnimationFrame(trackViewBox)

  // ============================================
  // Setup Event Listeners
  // ============================================

  svg.addEventListener('touchstart', handleTouchStart, { passive: false })
  svg.addEventListener('touchmove', handleTouchMove, { passive: false })
  svg.addEventListener('touchend', handleTouchEnd)
  svg.addEventListener('touchcancel', handleTouchEnd)

  svg.addEventListener('touchstart', handleTouchStartForTap, { passive: true })
  svg.addEventListener('touchend', handleTouchEndForTap)

  svg.addEventListener('mousedown', handleMouseDown)
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
  svg.addEventListener('mouseleave', handleMouseLeave)
  svg.addEventListener('wheel', handleWheel, { passive: false })

  // Listen for scroll/resize to update highlight position
  window.addEventListener('scroll', handlePositionUpdate, true)
  window.addEventListener('resize', handlePositionUpdate)

  return {
    destroy: () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      svg.removeEventListener('touchstart', handleTouchStart)
      svg.removeEventListener('touchmove', handleTouchMove)
      svg.removeEventListener('touchend', handleTouchEnd)
      svg.removeEventListener('touchcancel', handleTouchEnd)
      svg.removeEventListener('touchstart', handleTouchStartForTap)
      svg.removeEventListener('touchend', handleTouchEndForTap)
      svg.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      svg.removeEventListener('mouseleave', handleMouseLeave)
      svg.removeEventListener('wheel', handleWheel)
      window.removeEventListener('scroll', handlePositionUpdate, true)
      window.removeEventListener('resize', handlePositionUpdate)
      if (tooltip) {
        tooltip.remove()
        tooltip = null
      }
      if (overlay) {
        overlay.remove()
        overlay = null
      }
      if (highlightContainer) {
        highlightContainer.remove()
        highlightContainer = null
      }
      currentHighlight = null
      currentMiniSvg = null
    },
    showDeviceModal: () => {},
    hideModal: () => {},
    showLinkTooltip: () => {},
    hideTooltip: () => {
      hideTooltip()
      highlightElement(null)
      tooltipActive = false
    },
    resetView,
    getScale,
  }
}
