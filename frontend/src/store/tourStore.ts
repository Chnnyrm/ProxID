/**
 * tourStore.ts - Global state for onboarding tours and demo story.
 * Pure ASCII only.
 */

import { create } from 'zustand'

interface TourState {
  isTourActive: boolean
  tourType: 'quick' | 'story' | null
  storyScene: number
  setTourActive: (active: boolean, type?: 'quick' | 'story' | null) => void
  setStoryScene: (scene: number) => void
}

const STORAGE_KEY = 'proxid_story_scene'

const getInitialScene = (): number => {
  if (typeof window === 'undefined') return 0
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved !== null) {
    const parsed = parseInt(saved, 10)
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 7) return parsed
  }
  return 0
}

export const useTourStore = create<TourState>((set) => ({
  isTourActive: false,
  tourType: null,
  storyScene: getInitialScene(),

  setTourActive: (active, type = null) => {
    if (typeof document !== 'undefined') {
      if (active) {
        document.documentElement.dataset.tourActive = 'true'
      } else {
        delete document.documentElement.dataset.tourActive
      }
    }
    set({ isTourActive: active, tourType: active ? type : null })
  },

  setStoryScene: (scene) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, scene.toString())
    }
    set({ storyScene: scene })
  },
}))
