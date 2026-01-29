/**
 * Theme Setting Store
 * Single source of truth for theme. Syncs to localStorage and DOM.
 * Supports 'light', 'dark', and 'system' (follows OS preference).
 */

import { writable } from 'svelte/store'
import { browser } from '$app/environment'

export type ThemeValue = 'light' | 'dark' | 'system'

const SETTINGS_KEY = 'shumoku-settings'

function loadTheme(): ThemeValue {
  if (!browser) return 'system'
  try {
    const stored = localStorage.getItem(SETTINGS_KEY)
    if (stored) {
      const value = JSON.parse(stored).theme
      if (value === 'light' || value === 'dark' || value === 'system') return value
    }
  } catch {}
  return 'system'
}

function resolveTheme(value: ThemeValue): 'light' | 'dark' {
  if (value !== 'system') return value
  if (!browser) return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(value: ThemeValue) {
  if (!browser) return
  const resolved = resolveTheme(value)
  document.documentElement.classList.toggle('dark', resolved === 'dark')
}

function persist(value: ThemeValue) {
  if (!browser) return
  try {
    const stored = localStorage.getItem(SETTINGS_KEY)
    const settings = stored ? JSON.parse(stored) : {}
    settings.theme = value
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {}
}

const initial = loadTheme()

// Resolved theme: the actually applied 'light' | 'dark'
const _resolved = writable<'light' | 'dark'>(resolveTheme(initial))
export const resolvedTheme = { subscribe: _resolved.subscribe }

function updateResolved(setting: ThemeValue) {
  _resolved.set(resolveTheme(setting))
}

function createThemeSettingStore() {
  const { subscribe, set: _set } = writable<ThemeValue>(initial)

  // Apply initial theme
  if (browser) applyTheme(initial)

  // Listen for OS theme changes (only matters when setting is 'system')
  if (browser) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (loadTheme() === 'system') {
        applyTheme('system')
        updateResolved('system')
      }
    })
  }

  return {
    subscribe,
    set(value: ThemeValue) {
      _set(value)
      applyTheme(value)
      persist(value)
      updateResolved(value)
    },
    /** Header toggle: light ↔ dark (explicit override, exits system mode) */
    toggle() {
      const resolved = resolveTheme(loadTheme())
      this.set(resolved === 'light' ? 'dark' : 'light')
    },
  }
}

export const themeSetting = createThemeSettingStore()
