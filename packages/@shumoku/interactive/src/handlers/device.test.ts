/**
 * Device Handler Tests
 */

import { describe, expect, it } from 'vitest'
import { extractDeviceInfo } from './device.js'

// Mock DOM element
function createMockElement(attributes: Record<string, string>): Element {
  const el = document.createElement('g')
  for (const [key, value] of Object.entries(attributes)) {
    el.setAttribute(key, value)
  }
  return el
}

describe('extractDeviceInfo', () => {
  it('should extract device info from JSON data attribute', () => {
    const deviceJson = JSON.stringify({
      id: 'router1',
      label: 'Core Router',
      type: 'router',
      vendor: 'cisco',
      model: 'catalyst-9300',
    })

    const element = createMockElement({
      'data-id': 'router1',
      'data-device-json': deviceJson,
    })

    const result = extractDeviceInfo(element)

    expect(result).toEqual({
      id: 'router1',
      label: 'Core Router',
      type: 'router',
      vendor: 'cisco',
      model: 'catalyst-9300',
    })
  })

  it('should extract device info from individual attributes', () => {
    const element = createMockElement({
      'data-id': 'switch1',
      'data-device-type': 'l2-switch',
      'data-device-vendor': 'juniper',
      'data-device-model': 'ex4400',
    })

    const result = extractDeviceInfo(element)

    expect(result).toEqual({
      id: 'switch1',
      label: 'switch1',
      type: 'l2-switch',
      vendor: 'juniper',
      model: 'ex4400',
      service: undefined,
      resource: undefined,
    })
  })

  it('should return null if no data-id', () => {
    const element = createMockElement({
      'data-device-type': 'router',
    })

    const result = extractDeviceInfo(element)

    expect(result).toBeNull()
  })
})
