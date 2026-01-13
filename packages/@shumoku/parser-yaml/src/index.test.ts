import { describe, expect, it } from 'vitest'
import { parser, YamlParser } from './index.js'

describe('@shumoku/parser-yaml', () => {
  describe('exports', () => {
    it('should export parser instance', () => {
      expect(parser).toBeDefined()
      expect(parser).toBeInstanceOf(YamlParser)
    })

    it('should export YamlParser class', () => {
      expect(YamlParser).toBeDefined()
    })
  })

  describe('YamlParser', () => {
    it('should create instance', () => {
      const p = new YamlParser()
      expect(p).toBeInstanceOf(YamlParser)
    })

    it('should parse empty yaml', () => {
      const result = parser.parse('')
      expect(result.graph).toBeDefined()
      expect(result.graph.nodes).toEqual([])
      expect(result.graph.links).toEqual([])
    })

    it('should parse simple network', () => {
      const yaml = `
nodes:
  - id: router1
    label: Router 1
    type: router
  - id: switch1
    label: Switch 1
    type: l2-switch
links:
  - from: router1
    to: switch1
`
      const result = parser.parse(yaml)
      expect(result.graph.nodes).toHaveLength(2)
      expect(result.graph.links).toHaveLength(1)
    })

    it('should parse node with type alias', () => {
      const yaml = `
nodes:
  - id: fw1
    label: Firewall 1
    type: firewall
`
      const result = parser.parse(yaml)
      expect(result.graph.nodes).toHaveLength(1)
      expect(result.graph.nodes[0].type).toBe('firewall')
    })

    it('should parse link with bandwidth', () => {
      const yaml = `
nodes:
  - id: a
    label: A
  - id: b
    label: B
links:
  - from: a
    to: b
    bandwidth: 10G
`
      const result = parser.parse(yaml)
      expect(result.graph.links[0].bandwidth).toBe('10G')
    })

    it('should parse subgraphs', () => {
      const yaml = `
nodes:
  - id: server1
    label: Server
subgraphs:
  - id: dc1
    label: Data Center 1
    nodes: [server1]
`
      const result = parser.parse(yaml)
      expect(result.graph.subgraphs).toBeDefined()
      expect(result.graph.subgraphs).toHaveLength(1)
      expect(result.graph.subgraphs![0].id).toBe('dc1')
    })

    it('should handle parse errors gracefully', () => {
      const yaml = `invalid: [unclosed`
      const result = parser.parse(yaml)
      expect(result.warnings).toBeDefined()
      expect(result.warnings!.length).toBeGreaterThan(0)
    })
  })
})
