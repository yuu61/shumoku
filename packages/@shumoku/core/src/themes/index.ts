/**
 * Theme system exports
 */

export { darkTheme } from './dark.js'
export { modernTheme } from './modern.js'
export * from './types.js'
export {
  applyThemeToCSS,
  createTheme,
  getThemeFromCSS,
  mergeTheme,
} from './utils.js'

import { darkTheme } from './dark.js'
// Default themes map
import { modernTheme } from './modern.js'

export const themes = {
  modern: modernTheme,
  dark: darkTheme,
} as const

export type ThemeName = keyof typeof themes
