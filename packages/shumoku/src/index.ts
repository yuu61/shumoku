// Re-export everything from core
export * from '@shumoku/core'

// Re-export parser
export * from '@shumoku/parser-yaml'

// Import icons for side effects (auto-registration)
// Note: Icon types are already exported from @shumoku/core
import '@shumoku/icons'

// Re-export only the vendorIconSets from icons (not conflicting exports)
export { vendorIconSets } from '@shumoku/icons'
