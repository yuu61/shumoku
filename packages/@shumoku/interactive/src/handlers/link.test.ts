/**
 * Link Handler Tests
 */

import { describe, expect, it } from 'vitest'
import { extractLinkInfo } from './link.js'

// Mock DOM element
function createMockElement(attributes: Record<string, string>): Element {
  const el = document.createElement('g')
  for (const [key, value] of Object.entries(attributes)) {
    el.setAttribute(key, value)
  }
  return el
}

describe('extractLinkInfo', () => {
  it('should extract link info from JSON data attribute', () => {
    const linkJson = JSON.stringify({
      id: 'link1',
      from: { device: 'router1', port: 'eth0', ip: '10.0.0.1/30' },
      to: { device: 'switch1', port: 'ge-0/0/1' },
      bandwidth: '10G',
      vlan: [10, 20],
    })

    const element = createMockElement({
      'data-link-id': 'link1',
      'data-link-json': linkJson,
    })

    const result = extractLinkInfo(element)

    expect(result).toEqual({
      id: 'link1',
      from: { device: 'router1', port: 'eth0', ip: '10.0.0.1/30' },
      to: { device: 'switch1', port: 'ge-0/0/1' },
      bandwidth: '10G',
      vlan: [10, 20],
    })
  })

  it('should extract link info from individual attributes', () => {
    const element = createMockElement({
      'data-link-id': 'link2',
      'data-link-from': 'router1:eth0',
      'data-link-to': 'switch1:ge-0/0/1',
      'data-link-bandwidth': '1G',
      'data-link-vlan': '10,20,30',
    })

    const result = extractLinkInfo(element)

    expect(result).toEqual({
      id: 'link2',
      from: { device: 'router1', port: 'eth0' },
      to: { device: 'switch1', port: 'ge-0/0/1' },
      bandwidth: '1G',
      vlan: [10, 20, 30],
      redundancy: undefined,
    })
  })

  it('should handle endpoints without ports', () => {
    const element = createMockElement({
      'data-link-id': 'link3',
      'data-link-from': 'router1',
      'data-link-to': 'cloud',
    })

    const result = extractLinkInfo(element)

    expect(result).toEqual({
      id: 'link3',
      from: { device: 'router1', port: undefined },
      to: { device: 'cloud', port: undefined },
      bandwidth: undefined,
      vlan: undefined,
      redundancy: undefined,
    })
  })

  it('should return null if no data-link-id', () => {
    const element = createMockElement({
      'data-link-from': 'router1:eth0',
    })

    const result = extractLinkInfo(element)

    expect(result).toBeNull()
  })
})
