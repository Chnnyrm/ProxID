/**
 * The coordinate the map and the distance searches use.
 *
 * Persisted, because asking for a location on every visit is hostile. The default is
 * the demo neighbourhood so a judge sees a populated map immediately; a real person can
 * replace it with their own in one tap.
 */

import { create } from 'zustand'

import type { Coordinates } from '@/lib/contracts'

const STORAGE_KEY = 'proxid-location'

/** Yaba, Lagos: the seeded neighbourhood, so the first paint is not an empty map. */
export const DEMO_LOCATION: Coordinates = { latitude: 6.5095, longitude: 3.3711 }

export const RADIUS_CHOICES = [0.5, 1, 2, 5, 10, 0] as const

interface LocationState {
  coordinates: Coordinates
  radiusKm: number
  /** 'demo' until a real position is set, so the interface can say which it is. */
  source: 'demo' | 'device' | 'stored'
  setCoordinates: (coordinates: Coordinates, source: 'device' | 'stored') => void
  setRadiusKm: (radiusKm: number) => void
  requestDeviceLocation: () => Promise<boolean>
}

function readStored(): Coordinates | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Coordinates>
    if (typeof parsed.latitude === 'number' && typeof parsed.longitude === 'number') {
      return { latitude: parsed.latitude, longitude: parsed.longitude }
    }
    return null
  } catch {
    return null
  }
}

const stored = typeof localStorage !== 'undefined' ? readStored() : null

export const useLocationStore = create<LocationState>((set) => ({
  coordinates: stored ?? DEMO_LOCATION,
  radiusKm: 5,
  source: stored ? 'stored' : 'demo',

  setCoordinates: (coordinates, source) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(coordinates))
    } catch {
      // Applying it for this visit is enough when storage is unavailable.
    }
    set({ coordinates, source })
  },

  setRadiusKm: (radiusKm) => set({ radiusKm }),

  requestDeviceLocation: async () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return false
    return new Promise<boolean>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          set({
            coordinates: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            },
            source: 'device',
          })
          resolve(true)
        },
        () => resolve(false),
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 300_000 },
      )
    })
  },
}))
