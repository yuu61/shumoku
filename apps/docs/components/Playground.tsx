'use client'

import { useState } from 'react'
import type { NetworkGraph, LayoutResult } from '@shumoku/core/models'
import { HierarchicalLayout } from '@shumoku/core/layout'
import { SVGRenderer } from '@shumoku/core/renderer'
import { parser } from '@shumoku/parser-yaml'
import { NetworkSVG } from './NetworkSVG'
import { enterpriseNetwork, simpleNetwork } from '@/lib/sampleNetworks'

export function Playground() {
  const [yamlContent, setYamlContent] = useState<string>(enterpriseNetwork)
  const [layoutResult, setLayoutResult] = useState<LayoutResult | null>(null)
  const [svgContent, setSvgContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isRendering, setIsRendering] = useState(false)

  const handleParseAndRender = async () => {
    setIsRendering(true)
    try {
      const result = parser.parse(yamlContent)

      if (result.warnings && result.warnings.length > 0) {
        const errors = result.warnings.filter((w) => w.severity === 'error')
        if (errors.length > 0) {
          setError(`Parse errors: ${errors.map((e) => e.message).join(', ')}`)
          setLayoutResult(null)
          setSvgContent(null)
          setIsRendering(false)
          return
        }
      }

      const layout = new HierarchicalLayout()
      const layoutRes = await layout.layoutAsync(result.graph)
      setLayoutResult(layoutRes)

      const renderer = new SVGRenderer()
      const svg = renderer.render(result.graph, layoutRes)
      setSvgContent(svg)
      setError(null)
    } catch (e) {
      setError(`Error: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setIsRendering(false)
    }
  }

  const handleExportSVG = () => {
    if (!svgContent) return
    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `network-diagram-${new Date().toISOString().slice(0, 10)}.svg`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleOpenSVG = () => {
    if (!svgContent) return
    const win = window.open('', '_blank')
    if (win) {
      win.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Network Diagram</title>
            <style>
              body { margin: 0; background: #f0f4f8; padding: 20px; min-height: 100vh; }
              .container { background: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); display: inline-block; padding: 20px; }
            </style>
          </head>
          <body>
            <div class="container">${svgContent}</div>
          </body>
        </html>
      `)
      win.document.close()
    }
  }

  return (
    <div className="not-prose">
      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center gap-4 rounded-lg border bg-fd-card p-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Sample:</label>
          <select
            className="rounded-md border border-fd-border bg-fd-background px-3 py-1.5 text-sm"
            onChange={(e) => {
              if (e.target.value === 'enterprise') setYamlContent(enterpriseNetwork)
              else if (e.target.value === 'simple') setYamlContent(simpleNetwork)
            }}
          >
            <option value="enterprise">Enterprise Network</option>
            <option value="simple">Simple Network</option>
          </select>
        </div>

        <button
          onClick={handleParseAndRender}
          disabled={isRendering}
          className="rounded-md bg-fd-primary px-4 py-1.5 text-sm font-medium text-fd-primary-foreground hover:bg-fd-primary/90 disabled:opacity-50"
        >
          {isRendering ? 'Rendering...' : 'Render'}
        </button>

        <button
          onClick={handleOpenSVG}
          disabled={!svgContent}
          className="rounded-md bg-fd-secondary px-4 py-1.5 text-sm font-medium text-fd-secondary-foreground hover:bg-fd-secondary/90 disabled:opacity-50"
        >
          Open SVG
        </button>

        <button
          onClick={handleExportSVG}
          disabled={!svgContent}
          className="rounded-md bg-fd-secondary px-4 py-1.5 text-sm font-medium text-fd-secondary-foreground hover:bg-fd-secondary/90 disabled:opacity-50"
        >
          Download SVG
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Content */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* YAML Editor */}
        <div className="flex flex-col overflow-hidden rounded-lg border">
          <div className="border-b bg-fd-muted px-4 py-2">
            <h3 className="text-sm font-medium">YAML</h3>
          </div>
          <textarea
            value={yamlContent}
            onChange={(e) => setYamlContent(e.target.value)}
            className="min-h-[500px] flex-1 resize-none bg-fd-background p-4 font-mono text-sm focus:outline-none"
            spellCheck={false}
          />
        </div>

        {/* Preview */}
        <div className="flex flex-col overflow-hidden rounded-lg border">
          <div className="border-b bg-fd-muted px-4 py-2">
            <h3 className="text-sm font-medium">Preview</h3>
          </div>
          <div className="min-h-[500px] flex-1 p-4">
            <NetworkSVG
              layout={layoutResult}
              svgContent={svgContent}
              onNodeClick={(nodeId) => console.log('Node clicked:', nodeId)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
