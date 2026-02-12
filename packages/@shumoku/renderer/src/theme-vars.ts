/**
 * Generate CSS variable definitions for a theme
 */

import type { SurfaceToken, Theme } from '@shumoku/core'

/** Ordered list of surface tokens used for theme CSS variable generation */
export const SURFACE_COLOR_TOKENS: SurfaceToken[] = [
  'surface-1',
  'surface-2',
  'surface-3',
  'accent-blue',
  'accent-green',
  'accent-red',
  'accent-amber',
  'accent-purple',
]

/** Port color palette, keyed by theme variant */
export const PORT_COLORS = {
  dark: {
    fill: '#64748b',
    stroke: '#94a3b8',
    labelBg: '#0f172a',
  },
  light: {
    fill: '#334155',
    stroke: '#0f172a',
    labelBg: '#0f172a',
  },
} as const

export function generateThemeVars(theme: Theme): string {
  const rc = theme.colors
  const defaultSurface = rc.surfaces['surface-1']
  const portColors = theme.variant === 'dark' ? PORT_COLORS.dark : PORT_COLORS.light
  const portFill = portColors.fill
  const portStroke = portColors.stroke
  const portLabelBg = portColors.labelBg
  const surfaceTokens = SURFACE_COLOR_TOKENS

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
