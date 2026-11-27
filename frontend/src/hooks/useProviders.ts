/**
 * Providers, listings and categories around the current coordinate.
 */

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

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
    placeholderData: keepPreviousData,
  })
}

/** All providers across the platform for map transparency without radius filtering. */
export function useMapAllProviders() {
  const coordinates = useLocationStore((state) => state.coordinates)
  return useQuery({
    queryKey: ['providers', 'map-all', coordinates.latitude, coordinates.longitude],
    queryFn: () => providerService.nearby(coordinates, 0, false, 100),
    placeholderData: keepPreviousData,
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
    staleTime: 5 * 60 * 1000,
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
    placeholderData: keepPreviousData,
  })
}

/** One service listing. */
export function useListing(id: string | undefined) {
  return useQuery({
    queryKey: ['services', 'detail', id],
    queryFn: () => providerService.listing(id as string),
    enabled: Boolean(id),
    placeholderData: keepPreviousData,
  })
}

/** The caller's published service listings. */
export function useMyListings(enabled = true) {
  return useQuery({
    queryKey: ['services', 'mine'],
    queryFn: () => providerService.myListings(),
    enabled,
  })
}

/** Create a new service listing. */
export function useCreateListing() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Parameters<typeof providerService.createListing>[0]) =>
      providerService.createListing(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['services', 'mine'] })
      void queryClient.invalidateQueries({ queryKey: ['providers'] })
      void queryClient.invalidateQueries({ queryKey: ['listings'] })
    },
  })
}

/** Prefetch nearby providers/services. */
export function usePrefetchServices() {
  const queryClient = useQueryClient()
  const coordinates = useLocationStore((state) => state.coordinates)
  const radiusKm = useLocationStore((state) => state.radiusKm)
  return () => {
    void queryClient.prefetchQuery({
      queryKey: providerKeys.nearby(coordinates, radiusKm, false),
      queryFn: () => providerService.nearby(coordinates, radiusKm, false, 24),
      staleTime: 45_000,
    })
  }
}

/** Prefetch a single service listing by id. */
export function usePrefetchService() {
  const queryClient = useQueryClient()
  return (id: string) => {
    void queryClient.prefetchQuery({
      queryKey: ['services', 'detail', id],
      queryFn: () => providerService.listing(id),
      staleTime: 45_000,
    })
  }
}
