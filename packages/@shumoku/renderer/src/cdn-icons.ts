/**
 * CDN Icon Utilities
 * Generates CDN URLs for vendor icons
 */

/** CDN configuration */
export interface CDNConfig {
  /** CDN base URL */
  baseUrl: string
  /** API version (e.g., 'v1') */
  version: string
  /** Timeout for fetch in milliseconds */
  timeout?: number
}

/** Default CDN configuration */
export const DEFAULT_CDN_CONFIG: CDNConfig = {
  baseUrl: 'https://icons.shumoku.packof.me',
  version: 'v1',
  timeout: 3000,
}

/** Vendors that have SVG icons */
const SVG_VENDORS = new Set(['aruba', 'aws'])

/** Vendors that have PNG icons */
const PNG_VENDORS = new Set(['juniper', 'yamaha'])

/**
 * Normalize model name for CDN URL
 * - lowercase
 * - replace slashes with hyphens (for AWS service/resource keys like ec2/instance -> ec2-instance)
 */
function normalizeModel(model: string): string {
  return model.toLowerCase().replace(/\//g, '-')
}

/**
 * Get icon file extension for a vendor
 */
export function getIconExtension(vendor: string): 'svg' | 'png' {
  const v = vendor.toLowerCase()
  if (SVG_VENDORS.has(v)) return 'svg'
  if (PNG_VENDORS.has(v)) return 'png'
  // Default to png for unknown vendors
  return 'png'
}

/**
 * Generate CDN URL for a vendor icon
 */
export function getCDNIconUrl(
  vendor: string,
  model: string,
  config: CDNConfig = DEFAULT_CDN_CONFIG,
): string {
  const v = vendor.toLowerCase()
  const m = normalizeModel(model)
  const ext = getIconExtension(v)
  return `${config.baseUrl}/${config.version}/${v}/${m}.${ext}`
}

/**
 * Check if a vendor has CDN icons
 */
export function hasCDNIcons(vendor: string): boolean {
  const v = vendor.toLowerCase()
  return SVG_VENDORS.has(v) || PNG_VENDORS.has(v)
}

/** In-memory cache for fetched icons */
const iconCache = new Map<string, string | null>()

/** Cache for 404 URLs (to avoid repeated fetches) */
const notFoundCache = new Set<string>()

/**
 * Fetch icon from CDN with timeout and caching
 * Returns base64 data URL or null if fetch failed
 */
export async function fetchCDNIcon(
  url: string,
  timeout: number = 3000,
): Promise<string | null> {
  // Check cache
  if (iconCache.has(url)) {
    return iconCache.get(url) ?? null
  }

  // Check 404 cache
  if (notFoundCache.has(url)) {
    return null
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)

    if (!response.ok) {
      if (response.status === 404) {
        notFoundCache.add(url)
      }
      iconCache.set(url, null)
      return null
    }

    const contentType = response.headers.get('content-type') || 'image/png'
    const arrayBuffer = await response.arrayBuffer()
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''),
    )
    const dataUrl = `data:${contentType};base64,${base64}`

    iconCache.set(url, dataUrl)
    return dataUrl
  } catch (error) {
    // Timeout or network error
    iconCache.set(url, null)
    return null
  }
}

/**
 * Clear icon cache
 */
export function clearIconCache(): void {
  iconCache.clear()
  notFoundCache.clear()
}
