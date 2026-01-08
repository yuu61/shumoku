import { useEffect, useRef, useState } from 'react'
import * as PIXI from 'pixi.js'
import { Application } from 'pixi.js'
import type { NetworkGraph, LayoutResult, Theme, LayoutNode } from '@shumoku/core'
import { DeviceType } from '@shumoku/core'

interface NetworkCanvasProps {
  network: NetworkGraph | null
  layout: LayoutResult | null
  theme: Theme
  onNodeClick?: (nodeId: string) => void
  onNodeHover?: (nodeId: string | null) => void
  zoom?: number
}

// Convert hex color string to number
const colorToNumber = (color: string): number => {
  return parseInt(color.replace('#', ''), 16)
}

// Device type to shape mapping
const getDeviceShape = (type: DeviceType): 'rect' | 'circle' | 'hexagon' => {
  switch (type) {
    case DeviceType.Router:
    case DeviceType.Firewall:
      return 'rect'
    case DeviceType.Server:
    case DeviceType.VirtualMachine:
      return 'circle'
    default:
      return 'rect'
  }
}

export const NetworkCanvas: React.FC<NetworkCanvasProps> = ({
  network,
  layout,
  theme,
  onNodeClick,
  onNodeHover,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<Application | null>(null)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)

  // Initialize PixiJS application
  useEffect(() => {
    if (!containerRef.current) return

    let app: Application | null = null

    // Create PixiJS application using v8 API
    const initApp = async () => {
      app = new Application()

      await app.init({
        width: containerRef.current!.offsetWidth,
        height: containerRef.current!.offsetHeight,
        backgroundColor: colorToNumber(theme.colors.background),
        backgroundAlpha: 1,
        antialias: true,
        resolution: window.devicePixelRatio || 2,
        autoDensity: true,
        preserveDrawingBuffer: true, // 重要：描画バッファを保持
      })

      // Add canvas to container
      containerRef.current!.appendChild(app.canvas)
      appRef.current = app

      // グローバルに参照を保存（エクスポート用）
      ;(window as any).__PIXI_APP__ = app

      // Handle resize
      const handleResize = () => {
        if (containerRef.current && app) {
          app.renderer.resize(containerRef.current.offsetWidth, containerRef.current.offsetHeight)
        }
      }

      window.addEventListener('resize', handleResize)

      return () => {
        window.removeEventListener('resize', handleResize)
      }
    }

    const cleanupPromise = initApp()

    return () => {
      cleanupPromise.then((cleanup) => {
        cleanup?.()
        if (app) {
          app.destroy(true, { children: true, texture: true })
          appRef.current = null
        }
      })
    }
  }, [theme])

  // Render network
  useEffect(() => {
    const app = appRef.current
    if (!app || !network || !layout) return

    // Clear stage
    app.stage.removeChildren()

    // Create containers for different layers
    const locationContainer = new PIXI.Container()
    const moduleContainer = new PIXI.Container()
    const linkContainer = new PIXI.Container()
    const deviceContainer = new PIXI.Container()

    // 場所 → モジュール → リンク → デバイスの順で追加（リンクがデバイスの下に来るように）
    app.stage.addChild(locationContainer)
    app.stage.addChild(moduleContainer)
    app.stage.addChild(linkContainer)
    app.stage.addChild(deviceContainer)


    // Create a map of device positions from layout nodes
    const devicePositions = new Map<string, { x: number; y: number }>()
    const deviceNodes = new Map<string, LayoutNode>()

    // Handle Map format (location-based layout returns a Map)
    if (layout.nodes instanceof Map) {
      layout.nodes.forEach((layoutNode, nodeId) => {
        devicePositions.set(nodeId, {
          x: layoutNode.position.x,
          y: layoutNode.position.y,
        })
        deviceNodes.set(nodeId, layoutNode)
      })
    } else {
      // Handle array format if needed
      console.warn('Unexpected: layout.nodes is not a Map')
    }


    // Draw locations (use layout result, not network model)
    if (layout.locations) {
      layout.locations.forEach((layoutLocation) => {
        const graphics = new PIXI.Graphics()
        const { x, y, width, height } = layoutLocation.bounds

        // Location background
        const bgColor = layoutLocation.style?.backgroundColor || '#f0f4f8'
        const borderColor = layoutLocation.style?.borderColor || '#4a5568'
        const borderWidth = layoutLocation.style?.borderWidth || 2

        // PixiJS v8 API
        graphics.roundRect(x, y, width, height, 8)
        graphics.fill({ color: colorToNumber(bgColor), alpha: 0.3 })
        graphics.stroke({ width: borderWidth, color: colorToNumber(borderColor), alpha: 0.8 })

        locationContainer.addChild(graphics)

        // Location label
        const labelStyle = new PIXI.TextStyle({
          fontFamily: theme.typography.fontFamily.sans,
          fontSize: theme.dimensions.fontSize.large,
          fontWeight: String(theme.typography.fontWeight.bold) as PIXI.TextStyleFontWeight,
          fill: colorToNumber(borderColor),
        })

        const label = new PIXI.Text(layoutLocation.name, labelStyle)
        label.anchor.set(0.5, 0)
        label.x = x + width / 2
        label.y = y - 25

        locationContainer.addChild(label)
      })
    }

    // Draw modules
    if (network.modules && layout.modules) {
      network.modules.forEach((module) => {
        const layoutModule = layout.modules?.get(module.id)
        if (!layoutModule?.bounds) return

        const graphics = new PIXI.Graphics()
        const { x, y, width, height } = layoutModule.bounds
        const padding = 20

        // Module background (PixiJS v8 API)
        graphics.roundRect(
          x - padding,
          y - padding,
          width + padding * 2,
          height + padding * 2,
          theme.dimensions.radius.medium,
        )
        graphics.fill({ color: colorToNumber(theme.colors.surface), alpha: 0.5 })
        graphics.stroke({ width: 2, color: colorToNumber(theme.colors.grid), alpha: 0.8 })

        moduleContainer.addChild(graphics)

        // Module label
        const labelStyle = new PIXI.TextStyle({
          fontFamily: theme.typography.fontFamily.sans,
          fontSize: theme.dimensions.fontSize.large,
          fontWeight: String(theme.typography.fontWeight.semibold) as PIXI.TextStyleFontWeight,
          fill: colorToNumber(theme.colors.text),
        })

        const label = new PIXI.Text(module.name, labelStyle)
        label.x = x
        label.y = y - 30

        moduleContainer.addChild(label)
      })
    }

    // Draw location links (if available from layout)
    if (layout.links && network.locationLinks) {
      layout.links.forEach((layoutLink) => {
        if (layoutLink.metadata?.type === 'location-link') {
          const graphics = new PIXI.Graphics()

          const style = (layoutLink.metadata.style || {}) as any
          const lineColor = colorToNumber(style.color || '#2d3748')
          const lineWidth = style.strokeWidth || 4

          if (layoutLink.points && layoutLink.points.length > 1) {
            graphics.moveTo(layoutLink.points[0].x, layoutLink.points[0].y)
            for (let i = 1; i < layoutLink.points.length; i++) {
              graphics.lineTo(layoutLink.points[i].x, layoutLink.points[i].y)
            }
            graphics.stroke({ width: lineWidth, color: lineColor, alpha: 0.8 })
          }

          linkContainer.addChild(graphics)
        }
      })
    }

    // Draw links using edge points from layout
    layout.edges.forEach((layoutEdge, edgeId) => {
      const link = network.links.find((l) => l.id === edgeId)
      if (!link) {
        console.warn(`Renderer: No matching link for edge ${edgeId}`)
        return
      }

      const points = layoutEdge.points
      if (!points || points.length < 2) {
        console.warn(`Renderer: Edge ${edgeId} has no points or insufficient points:`, points)
        return
      }

      const graphics = new PIXI.Graphics()

      // Check if this is a cross-location link (set by layout engine)
      const isCrossLocation = (layoutEdge.data?.metadata as any)?.crossLocation === true

      // 線のスタイルを設定
      const baseWidth = link.bandwidth?.includes('40G')
        ? 5
        : link.bandwidth?.includes('10G')
          ? 4
          : link.bandwidth?.includes('1G')
            ? 3
            : 2

      if (isCrossLocation && points.length >= 5) {
        // Cross-location link with orthogonal routing
        // Points: [device, edge1, gap1, gap2, edge2, device] or similar

        // First segment: device to first edge point (internal)
        graphics.moveTo(points[0].x, points[0].y)
        graphics.lineTo(points[1].x, points[1].y)
        graphics.stroke({ width: baseWidth, color: 0x64748b, alpha: 0.6 })

        // Middle segments: through the gap (trunk, red)
        for (let i = 1; i < points.length - 2; i++) {
          graphics.moveTo(points[i].x, points[i].y)
          graphics.lineTo(points[i + 1].x, points[i + 1].y)
        }
        graphics.stroke({ width: baseWidth + 2, color: 0xdc2626, alpha: 1 })

        // Last segment: edge to device (internal)
        graphics.moveTo(points[points.length - 2].x, points[points.length - 2].y)
        graphics.lineTo(points[points.length - 1].x, points[points.length - 1].y)
        graphics.stroke({ width: baseWidth, color: 0x64748b, alpha: 0.6 })

        // Draw connector points at location boundaries
        graphics.circle(points[1].x, points[1].y, 5)
        graphics.circle(points[points.length - 2].x, points[points.length - 2].y, 5)
        graphics.fill(0xdc2626)
      } else if (isCrossLocation) {
        // Fallback for simpler cross-location paths
        graphics.moveTo(points[0].x, points[0].y)
        for (let i = 1; i < points.length; i++) {
          graphics.lineTo(points[i].x, points[i].y)
        }
        graphics.stroke({ width: baseWidth + 1, color: 0xdc2626, alpha: 0.8 })
      } else {
        // Internal link: curved bezier line
        const isCurved = (layoutEdge.data?.metadata as any)?.curved === true

        if (isCurved && points.length === 4) {
          // Cubic bezier curve: [start, ctrl1, ctrl2, end]
          graphics.moveTo(points[0].x, points[0].y)
          graphics.bezierCurveTo(
            points[1].x, points[1].y,  // control point 1
            points[2].x, points[2].y,  // control point 2
            points[3].x, points[3].y,  // end point
          )
        } else {
          // Fallback to straight lines
          graphics.moveTo(points[0].x, points[0].y)
          for (let i = 1; i < points.length; i++) {
            graphics.lineTo(points[i].x, points[i].y)
          }
        }
        graphics.stroke({ width: baseWidth, color: 0x64748b, alpha: 0.6 })
      }

      linkContainer.addChild(graphics)

      // Bandwidth label for cross-location links (on the trunk segment middle)
      if (isCrossLocation && link.bandwidth && points.length >= 5) {
        const labelStyle = new PIXI.TextStyle({
          fontFamily: theme.typography.fontFamily.mono,
          fontSize: theme.dimensions.fontSize.small,
          fill: 0xdc2626,
          fontWeight: 'bold',
        })

        // Find middle of trunk segment (points 2 and 3 for typical 6-point path)
        const midIndex = Math.floor(points.length / 2)
        const label = new PIXI.Text(link.bandwidth, labelStyle)
        label.x = (points[midIndex - 1].x + points[midIndex].x) / 2
        label.y = (points[midIndex - 1].y + points[midIndex].y) / 2
        label.anchor.set(0.5)

        const bg = new PIXI.Graphics()
        bg.roundRect(-25, -10, 50, 20, 4)
        bg.fill({ color: colorToNumber(theme.colors.background), alpha: 0.95 })
        bg.x = label.x
        bg.y = label.y

        linkContainer.addChild(bg)
        linkContainer.addChild(label)
      }
    })

    // Draw devices
    network.devices.forEach((device) => {
      const pos = devicePositions.get(device.id)
      if (!pos) return

      const container = new PIXI.Container()
      container.x = pos.x
      container.y = pos.y
      container.interactive = true
      container.cursor = 'pointer'

      const graphics = new PIXI.Graphics()
      const shape = getDeviceShape(device.type)
      // レイアウトノードからサイズを取得、なければデフォルトサイズを使用
      const layoutNode = deviceNodes.get(device.id)
      const size = layoutNode?.size || { width: 60, height: 60 }
      const deviceColor =
        theme.colors.devices[device.type] || theme.colors.modules.default || theme.colors.primary
      const isHovered = hoveredNode === device.id

      // Draw shadow if hovered (PixiJS v8 API)
      if (isHovered) {
        if (shape === 'rect') {
          graphics.rect(-size.width / 2 + 2, -size.height / 2 + 2, size.width, size.height)
        } else if (shape === 'circle') {
          graphics.circle(2, 2, size.width / 2)
        }
        graphics.fill({ color: 0x000000, alpha: 0.1 })
      }

      // Draw device shape (PixiJS v8 API)
      if (shape === 'rect') {
        graphics.rect(-size.width / 2, -size.height / 2, size.width, size.height)
      } else if (shape === 'circle') {
        graphics.circle(0, 0, size.width / 2)
      } else if (shape === 'hexagon') {
        const radius = size.width / 2
        const angle = Math.PI / 3
        graphics.moveTo(radius * Math.cos(0), radius * Math.sin(0))
        for (let i = 1; i <= 6; i++) {
          graphics.lineTo(radius * Math.cos(angle * i), radius * Math.sin(angle * i))
        }
        graphics.closePath()
      }

      graphics.fill(colorToNumber(deviceColor))
      graphics.stroke({
        width: theme.dimensions.lineWidth.normal,
        color: isHovered ? 0xffffff : colorToNumber(theme.colors.grid),
        alpha: isHovered ? 0.8 : 0.3,
      })
      container.addChild(graphics)

      // Device name label
      const labelStyle = new PIXI.TextStyle({
        fontFamily: theme.typography.fontFamily.sans,
        fontSize: 16,
        fill: colorToNumber(theme.colors.text),
        align: 'center',
        fontWeight: 'normal',
        dropShadow: false,
        letterSpacing: 0,
      })

      const label = new PIXI.Text(device.name, labelStyle)
      label.anchor.set(0.5)
      label.y = size.height / 2 + 10

      container.addChild(label)

      // IP address label (if available)
      if (device.metadata?.ip) {
        const ipStyle = new PIXI.TextStyle({
          fontFamily: theme.typography.fontFamily.mono,
          fontSize: 12,
          fill: colorToNumber(theme.colors.textSecondary),
          align: 'center',
          fontWeight: 'normal',
        })

        const ipLabel = new PIXI.Text(device.metadata.ip as string, ipStyle)
        ipLabel.anchor.set(0.5)
        ipLabel.y = size.height / 2 + 25

        container.addChild(ipLabel)
      }

      // VLAN label (if available)
      if (device.metadata?.vlan) {
        const vlanStyle = new PIXI.TextStyle({
          fontFamily: theme.typography.fontFamily.mono,
          fontSize: 10,
          fill: colorToNumber(theme.colors.textSecondary),
          align: 'center',
          fontWeight: 'normal',
        })

        const vlanLabel = new PIXI.Text(`VLAN: ${device.metadata.vlan}`, vlanStyle)
        vlanLabel.anchor.set(0.5)
        vlanLabel.y = size.height / 2 + 40

        container.addChild(vlanLabel)
      }

      // Add interactivity
      container.on('pointerover', () => {
        setHoveredNode(device.id)
        onNodeHover?.(device.id)
      })

      container.on('pointerout', () => {
        setHoveredNode(null)
        onNodeHover?.(null)
      })

      container.on('pointerdown', () => {
        onNodeClick?.(device.id)
      })

      deviceContainer.addChild(container)
    })

    // レイアウトの境界を使用してセンタリング
    if (layout.bounds) {
      const padding = 100
      const scaleX = (app.screen.width - padding * 2) / layout.bounds.width
      const scaleY = (app.screen.height - padding * 2) / layout.bounds.height
      const initialScale = Math.min(scaleX, scaleY, 1) // 初期スケールを調整

      app.stage.scale.set(initialScale)

      // 中央配置の改善
      const centerX = layout.bounds.x + layout.bounds.width / 2
      const centerY = layout.bounds.y + layout.bounds.height / 2

      app.stage.x = app.screen.width / 2 - centerX * initialScale
      app.stage.y = app.screen.height / 2 - centerY * initialScale

      // マウスホイールでズーム
      app.canvas.addEventListener('wheel', (e) => {
        e.preventDefault()
        const delta = e.deltaY * -0.001
        const newScale = Math.min(Math.max(0.1, app.stage.scale.x + delta), 5)

        // マウス位置を中心にズーム
        const mouseX = e.offsetX
        const mouseY = e.offsetY

        const worldPos = {
          x: (mouseX - app.stage.x) / app.stage.scale.x,
          y: (mouseY - app.stage.y) / app.stage.scale.y,
        }

        app.stage.scale.set(newScale)

        app.stage.x = mouseX - worldPos.x * newScale
        app.stage.y = mouseY - worldPos.y * newScale
      })

      // ドラッグでパン
      let isDragging = false
      let dragStart = { x: 0, y: 0 }
      let stageStart = { x: 0, y: 0 }

      app.canvas.addEventListener('mousedown', (e) => {
        if (e.button === 0) {
          // 左クリック
          isDragging = true
          dragStart = { x: e.clientX, y: e.clientY }
          stageStart = { x: app.stage.x, y: app.stage.y }
          app.canvas.style.cursor = 'grabbing'
        }
      })

      window.addEventListener('mousemove', (e) => {
        if (isDragging) {
          app.stage.x = stageStart.x + (e.clientX - dragStart.x)
          app.stage.y = stageStart.y + (e.clientY - dragStart.y)
        }
      })

      window.addEventListener('mouseup', () => {
        isDragging = false
        app.canvas.style.cursor = 'grab'
      })

      // カーソルスタイルの設定
      app.canvas.style.cursor = 'grab'
    }
  }, [network, layout, theme, hoveredNode, onNodeClick, onNodeHover])

  if (!network || !layout) {
    return (
      <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
        <div className="placeholder">
          <p>No network data to display</p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
      }}
    />
  )
}

export default NetworkCanvas
