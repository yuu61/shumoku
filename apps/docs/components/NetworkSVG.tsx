'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { LayoutResult } from '@shumoku/core/models'

interface NetworkSVGProps {
  layout: LayoutResult | null
  svgContent: string | null
  onNodeClick?: (nodeId: string) => void
}

export function NetworkSVG({
  layout,
  svgContent,
  onNodeClick,
}: NetworkSVGProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  const resetView = useCallback(() => {
    if (!layout || !containerRef.current) return

    const container = containerRef.current
    const containerWidth = container.clientWidth
    const containerHeight = container.clientHeight

    const svgWidth = layout.bounds.width
    const svgHeight = layout.bounds.height

    if (svgWidth === 0 || svgHeight === 0) {
      setScale(1)
      setPosition({ x: 0, y: 0 })
      return
    }

    const scaleX = containerWidth / svgWidth
    const scaleY = containerHeight / svgHeight
    const fitScale = Math.min(scaleX, scaleY) * 0.8

    const centerX = (containerWidth - svgWidth * fitScale) / 2
    const centerY = (containerHeight - svgHeight * fitScale) / 2

    setScale(fitScale)
    setPosition({ x: centerX, y: centerY })
  }, [layout])

  useEffect(() => {
    if (svgContent && layout && containerRef.current) {
      const container = containerRef.current
      const containerWidth = container.clientWidth
      const containerHeight = container.clientHeight

      const svgWidth = layout.bounds.width
      const svgHeight = layout.bounds.height

      if (svgWidth > 0 && svgHeight > 0) {
        const scaleX = containerWidth / svgWidth
        const scaleY = containerHeight / svgHeight
        const fitScale = Math.min(scaleX, scaleY) * 0.8

        const centerX = (containerWidth - svgWidth * fitScale) / 2
        const centerY = (containerHeight - svgHeight * fitScale) / 2

        setScale(fitScale)
        setPosition({ x: centerX, y: centerY })
      }
    }
  }, [svgContent, layout])

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault()

      const container = containerRef.current
      if (!container) return

      const rect = container.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9
      const newScale = Math.min(Math.max(0.1, scale * zoomFactor), 5)

      const scaleChange = newScale / scale
      const newX = mouseX - (mouseX - position.x) * scaleChange
      const newY = mouseY - (mouseY - position.y) * scaleChange

      setScale(newScale)
      setPosition({ x: newX, y: newY })
    },
    [scale, position],
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      container.removeEventListener('wheel', handleWheel)
    }
  }, [handleWheel])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return
      setIsDragging(true)
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      })
    },
    [position],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      })
    },
    [isDragging, dragStart],
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const zoomIn = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const centerX = container.clientWidth / 2
    const centerY = container.clientHeight / 2
    const newScale = Math.min(scale * 1.2, 5)
    const scaleChange = newScale / scale

    setScale(newScale)
    setPosition({
      x: centerX - (centerX - position.x) * scaleChange,
      y: centerY - (centerY - position.y) * scaleChange,
    })
  }, [scale, position])

  const zoomOut = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const centerX = container.clientWidth / 2
    const centerY = container.clientHeight / 2
    const newScale = Math.max(scale / 1.2, 0.1)
    const scaleChange = newScale / scale

    setScale(newScale)
    setPosition({
      x: centerX - (centerX - position.x) * scaleChange,
      y: centerY - (centerY - position.y) * scaleChange,
    })
  }, [scale, position])

  useEffect(() => {
    const content = contentRef.current
    if (!content || !onNodeClick) return

    const handleClick = (e: MouseEvent) => {
      const target = e.target as Element
      const nodeGroup = target.closest('.node')
      if (nodeGroup) {
        const nodeId = nodeGroup.getAttribute('data-id')
        if (nodeId) {
          onNodeClick(nodeId)
        }
      }
    }

    content.addEventListener('click', handleClick)
    return () => {
      content.removeEventListener('click', handleClick)
    }
  }, [onNodeClick])

  if (!svgContent) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border-2 border-dashed border-fd-border bg-fd-muted/30">
        <p className="text-fd-muted-foreground">Click "Render" to generate diagram</p>
      </div>
    )
  }

  return (
    <div className="relative h-full w-full">
      <div className="absolute right-4 top-4 z-10 flex items-center gap-2 rounded-lg bg-fd-background/80 p-2 shadow-md backdrop-blur">
        <button
          onClick={zoomIn}
          className="flex h-8 w-8 items-center justify-center rounded bg-fd-primary text-fd-primary-foreground hover:bg-fd-primary/90"
          title="Zoom In"
        >
          +
        </button>
        <span className="min-w-[50px] text-center text-sm">{Math.round(scale * 100)}%</span>
        <button
          onClick={zoomOut}
          className="flex h-8 w-8 items-center justify-center rounded bg-fd-primary text-fd-primary-foreground hover:bg-fd-primary/90"
          title="Zoom Out"
        >
          -
        </button>
        <button
          onClick={resetView}
          className="flex h-8 w-8 items-center justify-center rounded bg-fd-secondary text-fd-secondary-foreground hover:bg-fd-secondary/90"
          title="Reset View"
        >
          ⟲
        </button>
      </div>

      <div
        ref={containerRef}
        className="h-full w-full overflow-hidden rounded-lg border border-fd-border bg-white"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <div
          ref={contentRef}
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: '0 0',
          }}
          dangerouslySetInnerHTML={{ __html: svgContent }}
        />
      </div>
    </div>
  )
}
