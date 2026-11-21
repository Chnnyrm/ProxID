/**
 * Theme state: one stored choice, with the operating system preference as the fallback.
 *
 * The initial value is read from the document, which the inline script in index.html has
 * already set before first paint. Reading it there rather than computing it again is
 * what keeps the store and the pixels in agreement.
 */

import { create } from 'zustand'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'proxid-theme'

function currentTheme(): Theme {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

function apply(theme: Theme): void {
  document.documentElement.dataset.theme = theme
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.style.colorScheme = theme
}

interface ThemeState {
  theme: Theme
  /** True when the person chose explicitly, which stops the OS preference overriding it. */
  isExplicit: boolean
  setTheme: (theme: Theme) => void
  toggle: () => void
  /** Follow the OS unless a choice was stored. Called once on mount. */
  followSystemUntilChosen: () => () => void
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: currentTheme(),
  isExplicit: typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY) !== null,

  setTheme: (theme) => {
    apply(theme)
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // Storage can be unavailable in a private window. The theme still applies for
      // this visit, which is better than failing the toggle.
    }
    set({ theme, isExplicit: true })
  },

  toggle: () => {
    get().setTheme(get().theme === 'dark' ? 'light' : 'dark')
  },

  followSystemUntilChosen: () => {
    if (typeof window === 'undefined' || !window.matchMedia) return () => undefined
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const listener = (event: MediaQueryListEvent) => {
      if (get().isExplicit) return
      const next: Theme = event.matches ? 'dark' : 'light'
      apply(next)
      set({ theme: next })
    }
    query.addEventListener('change', listener)
    return () => query.removeEventListener('change', listener)
  },
}))
