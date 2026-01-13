/**
 * DOM Utilities
 */

/**
 * Get SVG element from selector or element
 */
export function getSvgElement(target: SVGElement | string): SVGElement | null {
  if (typeof target === 'string') {
    return document.querySelector<SVGElement>(target)
  }
  return target
}

/**
 * Create a DOM element with attributes and content
 */
export function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Record<string, string>,
  content?: string | HTMLElement | HTMLElement[],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)

  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      el.setAttribute(key, value)
    }
  }

  if (content) {
    if (typeof content === 'string') {
      el.innerHTML = content
    } else if (Array.isArray(content)) {
      el.append(...content)
    } else {
      el.appendChild(content)
    }
  }

  return el
}

/**
 * Find closest ancestor with a given class
 */
export function findClosest(element: Element, selector: string): Element | null {
  return element.closest(selector)
}

/**
 * Get data attributes from an element
 */
export function getDataAttributes(element: Element): Record<string, string> {
  const data: Record<string, string> = {}
  for (const attr of element.attributes) {
    if (attr.name.startsWith('data-')) {
      const key = attr.name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
      data[key] = attr.value
    }
  }
  return data
}

/**
 * Parse JSON from a data attribute safely
 */
export function parseDataJson<T>(element: Element, attrName: string): T | null {
  const value = element.getAttribute(attrName)
  if (!value) return null

  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}
