/**
 * Weathermap — overlay-based in/out dual-path rendering for SVG link groups.
 *
 * Original SVG paths are hidden via opacity. Overlay paths are created on top
 * with `pointer-events: none` so they don't interfere with interactions.
 *
 * Each original path produces an in/out pair, each with two layers:
 *   1. Base line — solid stroke at reduced opacity showing utilization color
 *   2. Dot line  — small rounded dashes with CSS drop-shadow glow, animated along path
 */

// --- Types ---

interface LinkMetrics {
  status: string
  utilization?: number
  inUtilization?: number
  outUtilization?: number
  inBps?: number
  outBps?: number
}

interface DirectionLayer {
  base: SVGPathElement
  dots: SVGPathElement
}

/** N original paths × 2 directions = 2N overlay pairs. */
interface LinkOverlay {
  inLayers: DirectionLayer[]
  outLayers: DirectionLayer[]
}

// --- Constants ---

const SAMPLE_INTERVAL = 4
const MIN_SAMPLES = 30
const SVG_NS = 'http://www.w3.org/2000/svg'
const CSS_GLOW = 'drop-shadow(0 0 2px currentColor)'

const UTILIZATION_COLORS = [
  { max: 0, color: '#6b7280' },
  { max: 1, color: '#22c55e' },
  { max: 25, color: '#84cc16' },
  { max: 50, color: '#eab308' },
  { max: 75, color: '#f97316' },
  { max: 90, color: '#ef4444' },
  { max: 100, color: '#dc2626' },
]

// --- Helpers ---

export function getUtilizationColor(utilization: number): string {
  for (const t of UTILIZATION_COLORS) {
    if (utilization <= t.max) return t.color
  }
  return '#dc2626'
}

function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  return el
}

function allLayers(overlay: LinkOverlay): DirectionLayer[] {
  return [...overlay.inLayers, ...overlay.outLayers]
}

// --- Offset-path geometry ---

function createOffsetPathD(path: SVGPathElement, offset: number): string {
  const len = path.getTotalLength()
  if (len === 0) return path.getAttribute('d') || ''

  // Fast path: straight lines don't need sampling.
  const start = path.getPointAtLength(0)
  const end = path.getPointAtLength(len)
  const angle = Math.atan2(end.y - start.y, end.x - start.x)
  const nx = -Math.sin(angle) * offset
  const ny = Math.cos(angle) * offset

  const mid = path.getPointAtLength(len / 2)
  const deviation =
    Math.abs(mid.x - (start.x + end.x) / 2) + Math.abs(mid.y - (start.y + end.y) / 2)

  if (deviation < 1) {
    return (
      `M ${(start.x + nx).toFixed(2)} ${(start.y + ny).toFixed(2)}` +
      ` L ${(end.x + nx).toFixed(2)} ${(end.y + ny).toFixed(2)}`
    )
  }

  // Curved path: sample and offset along normals.
  const numSamples = Math.max(MIN_SAMPLES, Math.ceil(len / SAMPLE_INTERVAL))
  const points: string[] = []

  for (let i = 0; i <= numSamples; i++) {
    const t = (i / numSamples) * len
    const p = path.getPointAtLength(t)
    const dt = Math.min(1, len * 0.001)
    const p1 = path.getPointAtLength(Math.max(0, t - dt))
    const p2 = path.getPointAtLength(Math.min(len, t + dt))
    const a = Math.atan2(p2.y - p1.y, p2.x - p1.x)

    points.push(`${(p.x - Math.sin(a) * offset).toFixed(2)} ${(p.y + Math.cos(a) * offset).toFixed(2)}`)
  }

  return `M ${points[0]}` + points.slice(1).map((p) => ` L ${p}`).join('')
}

// --- WeathermapController ---

export class WeathermapController {
  private svg: SVGSVGElement
  private overlays = new Map<string, LinkOverlay>()
  private hiddenPaths = new Set<SVGPathElement>()

  constructor(svg: SVGSVGElement) {
    this.svg = svg
  }

  apply(links: Record<string, LinkMetrics> | undefined): void {
    for (const group of this.svg.querySelectorAll('g.link-group')) {
      const linkId = group.getAttribute('data-link-id') || ''
      const metrics = links?.[linkId]
      const origPaths = Array.from(
        group.querySelectorAll('path.link:not(.wm-overlay)'),
      ) as SVGPathElement[]
      if (origPaths.length === 0) continue

      for (const p of origPaths) {
        if (!this.hiddenPaths.has(p)) {
          p.style.opacity = '0'
          this.hiddenPaths.add(p)
        }
      }

      const overlay = this.ensureOverlay(linkId, group, origPaths)

      if (metrics?.status === 'down') {
        this.applyDown(overlay)
      } else {
        this.applyDirectional(overlay, metrics)
      }
    }
  }

  reset(): void {
    for (const overlay of this.overlays.values()) {
      for (const layer of allLayers(overlay)) {
        layer.base.remove()
        layer.dots.remove()
      }
    }
    this.overlays.clear()

    for (const path of this.hiddenPaths) path.style.opacity = ''
    this.hiddenPaths.clear()
  }

  destroy(): void {
    this.reset()
  }

  // --- Internals ---

  private ensureOverlay(linkId: string, group: Element, origPaths: SVGPathElement[]): LinkOverlay {
    const existing = this.overlays.get(linkId)
    if (existing) return existing

    const strokeWidth = Number(origPaths[0].getAttribute('stroke-width') || '2')
    const sw = String(strokeWidth)
    const offset = strokeWidth / 2
    const inLayers: DirectionLayer[] = []
    const outLayers: DirectionLayer[] = []

    for (const origPath of origPaths) {
      inLayers.push(this.createDirectionLayer(createOffsetPathD(origPath, offset), sw))
      outLayers.push(this.createDirectionLayer(createOffsetPathD(origPath, -offset), sw))
    }

    const overlay: LinkOverlay = { inLayers, outLayers }
    const layers = allLayers(overlay)
    for (const layer of layers) group.appendChild(layer.base)
    for (const layer of layers) group.appendChild(layer.dots)

    this.overlays.set(linkId, overlay)
    return overlay
  }

  private createDirectionLayer(d: string, strokeWidth: string): DirectionLayer {
    const common = { d, fill: 'none', 'stroke-linecap': 'round', 'stroke-width': strokeWidth }

    const base = svgEl('path', common)
    base.classList.add('wm-overlay')
    base.style.pointerEvents = 'none'
    base.style.opacity = '0.4'

    const dots = svgEl('path', {
      ...common,
      'stroke-width': String(Math.max(Number(strokeWidth), 3)),
    })
    dots.classList.add('wm-overlay')
    dots.style.pointerEvents = 'none'
    dots.style.filter = CSS_GLOW

    return { base, dots }
  }

  private applyDown(overlay: LinkOverlay): void {
    for (const layer of allLayers(overlay)) {
      this.setStroke(layer.base, '#ef4444')
      layer.base.style.opacity = '0.4'
      layer.base.style.strokeDasharray = '8 4'

      this.setStroke(layer.dots, '#ef4444')
      layer.dots.style.strokeDasharray = '8 4'
      layer.dots.style.opacity = '0.6'
      if (layer.dots.style.animation) layer.dots.style.animation = ''
    }
  }

  private applyDirectional(overlay: LinkOverlay, metrics?: LinkMetrics): void {
    const inUtil = metrics?.inUtilization ?? metrics?.utilization ?? 0
    const outUtil = metrics?.outUtilization ?? metrics?.utilization ?? 0
    const inBps = metrics?.inBps ?? 0
    const outBps = metrics?.outBps ?? 0

    for (const layer of overlay.inLayers) this.styleDirection(layer, inUtil, inBps, true)
    for (const layer of overlay.outLayers) this.styleDirection(layer, outUtil, outBps, false)
  }

  private styleDirection(layer: DirectionLayer, util: number, bps: number, isIn: boolean): void {
    const color = getUtilizationColor(util)

    this.setStroke(layer.base, color)
    layer.base.style.opacity = '0.4'
    if (layer.base.style.strokeDasharray) layer.base.style.strokeDasharray = ''

    this.setStroke(layer.dots, color)

    if (bps > 0) {
      const speed = Math.min(1, Math.log10(bps + 1) / 9)
      const duration = Math.max(0.3, 2 - speed * 1.5)
      const anim = isIn ? 'shumoku-edge-flow-out' : 'shumoku-edge-flow-in'
      const animValue = `${anim} ${duration.toFixed(2)}s linear infinite`

      layer.dots.style.opacity = '1'
      if (layer.dots.style.animation !== animValue) {
        layer.dots.style.strokeDasharray = '3 21'
        layer.dots.style.animation = animValue
      }
    } else {
      layer.dots.style.opacity = '0'
      if (layer.dots.style.animation) {
        layer.dots.style.strokeDasharray = ''
        layer.dots.style.animation = ''
      }
    }
  }

  private setStroke(el: SVGPathElement, color: string): void {
    if (el.getAttribute('stroke') !== color) el.setAttribute('stroke', color)
  }
}
