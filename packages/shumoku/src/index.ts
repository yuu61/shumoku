// Re-export everything from core
export * from '@shumoku/core'

// Re-export parser
export * from '@shumoku/parser-yaml'

// Optional: Try to load and register vendor icons if available
try {
  const icons = await import('@shumoku/icons')
  icons.registerAllIcons()
} catch {
  // @shumoku/icons is optional, ignore if not installed
}
