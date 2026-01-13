import { describe, expect, it } from 'vitest'
import { darkTheme, HierarchicalLayout, modernTheme, version } from './index.js'
import type { NetworkGraph } from './models/index.js'

describe('@shumoku/core', () => {
  describe('exports', () => {
    it('should export version', () => {
      expect(version).toBeDefined()
    })

    it('should export HierarchicalLayout', () => {
      expect(HierarchicalLayout).toBeDefined()
    })

    it('should export themes', () => {
      expect(modernTheme).toBeDefined()
      expect(darkTheme).toBeDefined()
    })
  })

  describe('HierarchicalLayout', () => {
    it('should create instance', () => {
      const engine = new HierarchicalLayout()
      expect(engine).toBeInstanceOf(HierarchicalLayout)
    })

    it('should layout empty graph', async () => {
      const engine = new HierarchicalLayout()
      const graph: NetworkGraph = {
        nodes: [],
        links: [],
      }
      const result = await engine.layout(graph)
      expect(result).toBeDefined()
      expect(result.nodes).toBeDefined()
      expect(result.links).toBeDefined()
    })

    it('should layout graph with nodes only', async () => {
      const engine = new HierarchicalLayout()
      const graph: NetworkGraph = {
        nodes: [
          { id: 'router1', label: 'Router 1', type: 'router' },
          { id: 'switch1', label: 'Switch 1', type: 'l2-switch' },
        ],
        links: [],
      }
      const result = await engine.layout(graph)
      expect(result.nodes.size).toBe(2)
    })
  })

  describe('themes', () => {
    it('should have modernTheme with required properties', () => {
      expect(modernTheme.name).toBeDefined()
      expect(modernTheme.colors).toBeDefined()
      expect(modernTheme.colors.background).toBeDefined()
    })

    it('should have darkTheme with required properties', () => {
      expect(darkTheme.name).toBeDefined()
      expect(darkTheme.colors).toBeDefined()
      expect(darkTheme.colors.background).toBeDefined()
    })
  })
})
