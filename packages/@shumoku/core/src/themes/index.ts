/**
 * Theme system exports
 */

export * from './types.js'
export { modernTheme } from './modern.js'
export { darkTheme } from './dark.js'
export {
  mergeTheme,
  createTheme,
  applyThemeToCSS,
  getThemeFromCSS
} from './utils.js'

// Default themes map
import { modernTheme } from './modern.js'
import { darkTheme } from './dark.js'

export const themes = {
  modern: modernTheme,
  dark: darkTheme,
} as const

export type ThemeName = keyof typeof themes