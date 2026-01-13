'use client'

import { useState } from 'react'
import type { LayoutResult } from 'shumoku'
import { HierarchicalLayout, parser, SVGRenderer } from 'shumoku'
import { INTERACTIVE_IIFE } from '@shumoku/interactive/iife-string'
import { cn } from '@/lib/cn'
import { enterpriseNetwork, simpleNetwork } from '@/lib/sampleNetworks'
import { InteractivePreview } from './InteractivePreview'

export default function PlaygroundClient() {
  const [yamlContent, setYamlContent] = useState<string>(enterpriseNetwork)
  const [_layoutResult, setLayoutResult] = useState<LayoutResult | null>(null)
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

      const renderer = new SVGRenderer({ renderMode: 'interactive' })
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

  const handleOpenViewer = () => {
    if (!svgContent) return
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Network Diagram</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #f5f5f5; min-height: 100vh; }
    .toolbar { display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; background: white; border-bottom: 1px solid #e5e5e5; }
    .toolbar-title { font-size: 14px; color: #666; }
    .toolbar-buttons { display: flex; gap: 4px; align-items: center; }
    .toolbar button { padding: 6px; border: none; background: none; cursor: pointer; border-radius: 4px; color: #666; }
    .toolbar button:hover { background: #f0f0f0; }
    .zoom-text { min-width: 50px; text-align: center; font-size: 13px; color: #666; }
    .container { position: relative; width: 100%; height: calc(100vh - 45px); overflow: hidden; cursor: grab; background: repeating-conic-gradient(#f8f8f8 0% 25%, transparent 0% 50%) 50% / 20px 20px; }
    .container.dragging { cursor: grabbing; }
    .container > svg { width: 100%; height: 100%; }
    .branding { position: absolute; bottom: 16px; right: 16px; display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: rgba(255,255,255,0.95); backdrop-filter: blur(8px); border: 1px solid rgba(0,0,0,0.1); border-radius: 8px; font-size: 13px; font-family: system-ui, sans-serif; color: #555; text-decoration: none; transition: all 0.2s; box-shadow: 0 2px 8px rgba(0,0,0,0.1); z-index: 100; }
    .branding:hover { color: #222; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
    .branding-icon { width: 16px; height: 16px; border-radius: 3px; flex-shrink: 0; }
  </style>
</head>
<body>
  <div class="toolbar">
    <span class="toolbar-title">Shumoku Diagram</span>
    <div class="toolbar-buttons">
      <button id="btn-out" title="Zoom Out"><svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-width="2" d="M20 12H4"/></svg></button>
      <span class="zoom-text" id="zoom">100%</span>
      <button id="btn-in" title="Zoom In"><svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg></button>
      <button id="btn-fit" title="Fit"><svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg></button>
      <button id="btn-reset" title="Reset"><svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg></button>
    </div>
  </div>
  <div class="container" id="container">
    ${svgContent}
    <a class="branding" href="https://shumoku.packof.me" target="_blank" rel="noopener">
      <svg class="branding-icon" viewBox="0 0 1024 1024" fill="none"><rect x="64" y="64" width="896" height="896" rx="200" fill="#7FE4C1"/><g transform="translate(90,40) scale(1.25)"><path fill="#1F2328" d="M380 340H450V505H700V555H510V645H450V645H380Z"/></g></svg>
      <span>Made with Shumoku</span>
    </a>
  </div>
  <script>${INTERACTIVE_IIFE}<\/script>
  <script>
    (function() {
      var svg = document.querySelector('#container > svg');
      var container = document.getElementById('container');
      if (!svg || !container) { console.error('SVG or container not found'); return; }

      var vb = { x: 0, y: 0, w: 0, h: 0 };
      var origVb = { x: 0, y: 0, w: 0, h: 0 };
      var drag = { active: false, x: 0, y: 0, vx: 0, vy: 0 };

      function init() {
        var w = parseFloat(svg.getAttribute('width')) || 800;
        var h = parseFloat(svg.getAttribute('height')) || 600;
        var existing = svg.getAttribute('viewBox');
        if (existing) {
          var p = existing.split(/\\s+|,/).map(Number);
          origVb = { x: p[0] || 0, y: p[1] || 0, w: p[2] || w, h: p[3] || h };
        } else {
          origVb = { x: 0, y: 0, w: w, h: h };
        }
        svg.removeAttribute('width');
        svg.removeAttribute('height');
        svg.style.width = '100%';
        svg.style.height = '100%';
        fitView();

        if (window.ShumokuInteractive) {
          window.ShumokuInteractive.initInteractive({ target: svg, modal: { enabled: true }, tooltip: { enabled: true } });
        }
      }

      function updateViewBox() {
        svg.setAttribute('viewBox', vb.x + ' ' + vb.y + ' ' + vb.w + ' ' + vb.h);
        document.getElementById('zoom').textContent = Math.round(origVb.w / vb.w * 100) + '%';
      }

      function fitView() {
        var cw = container.clientWidth || 800;
        var ch = container.clientHeight || 600;
        var scale = Math.min(cw / origVb.w, ch / origVb.h) * 0.9;
        vb.w = cw / scale;
        vb.h = ch / scale;
        vb.x = origVb.x + (origVb.w - vb.w) / 2;
        vb.y = origVb.y + (origVb.h - vb.h) / 2;
        updateViewBox();
      }

      function resetView() {
        vb.x = origVb.x; vb.y = origVb.y; vb.w = origVb.w; vb.h = origVb.h;
        updateViewBox();
      }

      function zoom(f) {
        var cx = vb.x + vb.w / 2, cy = vb.y + vb.h / 2;
        var nw = vb.w / f, nh = vb.h / f;
        var scale = origVb.w / nw;
        if (scale < 0.1 || scale > 10) return;
        vb.w = nw; vb.h = nh; vb.x = cx - nw / 2; vb.y = cy - nh / 2;
        updateViewBox();
      }

      document.getElementById('btn-in').addEventListener('click', function() { zoom(1.2); });
      document.getElementById('btn-out').addEventListener('click', function() { zoom(1/1.2); });
      document.getElementById('btn-fit').addEventListener('click', fitView);
      document.getElementById('btn-reset').addEventListener('click', resetView);

      container.addEventListener('wheel', function(e) {
        e.preventDefault();
        var rect = container.getBoundingClientRect();
        var mx = (e.clientX - rect.left) / rect.width;
        var my = (e.clientY - rect.top) / rect.height;
        var px = vb.x + vb.w * mx, py = vb.y + vb.h * my;
        var f = e.deltaY > 0 ? 1/1.2 : 1.2;
        var nw = vb.w / f, nh = vb.h / f;
        var scale = origVb.w / nw;
        if (scale < 0.1 || scale > 10) return;
        vb.w = nw; vb.h = nh; vb.x = px - nw * mx; vb.y = py - nh * my;
        updateViewBox();
      }, { passive: false });

      container.addEventListener('mousedown', function(e) {
        if (e.button === 0) {
          drag = { active: true, x: e.clientX, y: e.clientY, vx: vb.x, vy: vb.y };
          container.classList.add('dragging');
        }
      });

      document.addEventListener('mousemove', function(e) {
        if (!drag.active) return;
        var sx = vb.w / container.clientWidth;
        var sy = vb.h / container.clientHeight;
        vb.x = drag.vx - (e.clientX - drag.x) * sx;
        vb.y = drag.vy - (e.clientY - drag.y) * sy;
        updateViewBox();
      });

      document.addEventListener('mouseup', function() {
        drag.active = false;
        container.classList.remove('dragging');
      });

      init();
    })();
  <\/script>
</body>
</html>`;
    const win = window.open('', '_blank')
    if (win) {
      win.document.write(html)
      win.document.close()
    }
  }

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col">
      {/* Header */}
      <div
        className={cn(
          'flex items-center justify-between px-6 py-4',
          'border-b border-neutral-200 dark:border-neutral-700',
          'bg-white dark:bg-neutral-900',
        )}
      >
        <h1 className="text-xl font-semibold">Playground</h1>
        <div className="flex items-center gap-3">
          <select
            className={cn(
              'rounded px-3 py-2 text-sm',
              'border border-neutral-300 dark:border-neutral-600',
              'bg-white dark:bg-neutral-800',
              'focus:outline-none focus:ring-2 focus:ring-blue-500',
            )}
            onChange={(e) => {
              if (e.target.value === 'enterprise') setYamlContent(enterpriseNetwork)
              else if (e.target.value === 'simple') setYamlContent(simpleNetwork)
            }}
          >
            <option value="enterprise">Enterprise Network</option>
            <option value="simple">Simple Network</option>
          </select>

          <button
            onClick={handleParseAndRender}
            disabled={isRendering}
            className={cn(
              'rounded px-4 py-2 text-sm font-medium',
              'bg-blue-600 text-white',
              'hover:bg-blue-700 disabled:opacity-50',
            )}
          >
            {isRendering ? 'Rendering...' : 'Render'}
          </button>

          <button
            onClick={handleOpenViewer}
            disabled={!svgContent}
            className={cn(
              'rounded px-4 py-2 text-sm font-medium',
              'border border-neutral-300 dark:border-neutral-600',
              'bg-white dark:bg-neutral-800',
              'hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-50',
            )}
          >
            Open Viewer
          </button>

          <button
            onClick={handleExportSVG}
            disabled={!svgContent}
            className={cn(
              'rounded px-4 py-2 text-sm font-medium',
              'border border-neutral-300 dark:border-neutral-600',
              'bg-white dark:bg-neutral-800',
              'hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-50',
            )}
          >
            Download
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="border-b border-red-300 bg-red-100 px-6 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* YAML Editor */}
        <div
          className={cn(
            'flex w-1/2 flex-col',
            'border-r border-neutral-200 dark:border-neutral-700',
          )}
        >
          <div
            className={cn(
              'px-4 py-2',
              'border-b border-neutral-200 dark:border-neutral-700',
              'bg-neutral-50 dark:bg-neutral-800',
            )}
          >
            <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">YAML</span>
          </div>
          <textarea
            value={yamlContent}
            onChange={(e) => setYamlContent(e.target.value)}
            className={cn(
              'flex-1 resize-none p-4 font-mono text-sm',
              'bg-white dark:bg-neutral-900',
              'focus:outline-none',
            )}
            spellCheck={false}
          />
        </div>

        {/* Preview */}
        <InteractivePreview svgContent={svgContent} className="w-1/2" />
      </div>
    </div>
  )
}
