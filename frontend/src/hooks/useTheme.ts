/**
 * Theme: read the current value, toggle it, and follow the OS until a choice is made.
 */

import { useEffect } from 'react'

import { useThemeStore } from '@/store/themeStore'

export function useTheme() {
  const theme = useThemeStore((state) => state.theme)
  const isExplicit = useThemeStore((state) => state.isExplicit)
  const toggle = useThemeStore((state) => state.toggle)
  const followSystemUntilChosen = useThemeStore((state) => state.followSystemUntilChosen)

  useEffect(() => followSystemUntilChosen(), [followSystemUntilChosen])

  return { theme, isExplicit, toggle, isDark: theme === 'dark' }
}
