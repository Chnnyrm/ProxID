/**
 * Providers, listings and categories around the current coordinate.
 */

import { useQuery } from '@tanstack/react-query'

import type { Coordinates } from '@/lib/contracts'
import { providerService } from '@/services/providerService'
import { useLocationStore } from '@/store/locationStore'

export const providerKeys = {
  nearby: (coords: Coordinates, radiusKm: number, verifiedOnly: boolean) =>
    ['providers', 'nearby', coords.latitude, coords.longitude, radiusKm, verifiedOnly] as const,
  search: (q: string) => ['providers', 'search', q] as const,
  categories: ['categories'] as const,
  mapConfig: ['map', 'config'] as const,
}

/** Providers near the current coordinate. */
export function useNearbyProviders(verifiedOnly = false) {
  const coordinates = useLocationStore((state) => state.coordinates)
  const radiusKm = useLocationStore((state) => state.radiusKm)
  return useQuery({
    queryKey: providerKeys.nearby(coordinates, radiusKm, verifiedOnly),
    queryFn: () => providerService.nearby(coordinates, radiusKm, verifiedOnly, 24),
  })
}

/** Providers matching a word. */
export function useProviderSearch(query: string) {
  return useQuery({
    queryKey: providerKeys.search(query),
    queryFn: () => providerService.search(query),
    enabled: query.trim().length >= 2,
  })
}

/** The categories the marketplace shares. Rarely changes, so it is cached hard. */
export function useCategories() {
  return useQuery({
    queryKey: providerKeys.categories,
    queryFn: () => providerService.categories(),
    staleTime: 60 * 60 * 1000,
  })
}

/** The map's tile template, from configuration rather than a component literal. */
export function useMapConfig() {
  return useQuery({
    queryKey: providerKeys.mapConfig,
    queryFn: () => providerService.mapConfig(),
    staleTime: 24 * 60 * 60 * 1000,
  })
}

/** Listings near the current coordinate, for the map's service pins. */
export function useNearbyListings(verifiedOnly = false) {
  const coordinates = useLocationStore((state) => state.coordinates)
  const radiusKm = useLocationStore((state) => state.radiusKm)
  return useQuery({
    queryKey: ['listings', 'nearby', coordinates.latitude, coordinates.longitude, radiusKm, verifiedOnly],
    queryFn: () => providerService.listingsNearby(coordinates, radiusKm, verifiedOnly, 40),
  })
}
