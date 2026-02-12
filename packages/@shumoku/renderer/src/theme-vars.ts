/**
 * Generate CSS variable definitions for a theme
 */

import type { SurfaceToken, Theme } from '@shumoku/core'

export function generateThemeVars(theme: Theme): string {
  const rc = theme.colors
  const defaultSurface = rc.surfaces['surface-1']
  const portFill = theme.variant === 'dark' ? '#64748b' : '#334155'
  const portStroke = theme.variant === 'dark' ? '#94a3b8' : '#0f172a'
  const portLabelBg = theme.variant === 'dark' ? '#0f172a' : '#0f172a'
  const surfaceTokens: SurfaceToken[] = [
    'surface-1',
    'surface-2',
    'surface-3',
    'accent-blue',
    'accent-green',
    'accent-red',
    'accent-amber',
    'accent-purple',
  ]

  const lines = [
    `--shumoku-bg: ${rc.background};`,
    `--shumoku-surface: ${defaultSurface.fill};`,
    `--shumoku-text: ${rc.text};`,
    `--shumoku-text-secondary: ${rc.textSecondary};`,
    `--shumoku-border: ${defaultSurface.stroke};`,
    `--shumoku-node-fill: ${rc.surface};`,
    `--shumoku-node-stroke: ${rc.textSecondary};`,
    `--shumoku-link-stroke: ${rc.textSecondary};`,
    `--shumoku-subgraph-label: ${defaultSurface.text};`,
    `--shumoku-port-fill: ${portFill};`,
    `--shumoku-port-stroke: ${portStroke};`,
    `--shumoku-port-label-bg: ${portLabelBg};`,
    `--shumoku-port-label-color: #ffffff;`,
    `--shumoku-endpoint-label-bg: ${rc.background};`,
    `--shumoku-endpoint-label-stroke: ${defaultSurface.stroke};`,
  ]

  for (const t of surfaceTokens) {
    const s = rc.surfaces[t]
    lines.push(`--shumoku-${t}-fill: ${s.fill};`)
    lines.push(`--shumoku-${t}-stroke: ${s.stroke};`)
    lines.push(`--shumoku-${t}-text: ${s.text};`)
  }

  return lines.map((l) => `  ${l}`).join('\n')
}
