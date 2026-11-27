/**
 * Provider and listing discovery.
 */

import { api, query } from '@/lib/api'
import type { CategoriesResponse, ListingsResponse, ProvidersResponse } from '@/lib/contracts'
import type { Coordinates } from '@/lib/contracts'
import type { ServiceListing } from '@/types/api'

export const providerService = {
  /** Providers around a point, nearest first. */
  nearby: (coords: Coordinates, radiusKm: number, verifiedOnly = false, limit = 24) =>
    api.get<ProvidersResponse>(
      `/users/providers/nearby${query({
        latitude: coords.latitude,
        longitude: coords.longitude,
        radius_km: radiusKm,
        verified_only: verifiedOnly,
        limit,
      })}`,
    ),

  /** Providers matching a word, for someone who has not shared a location. */
  search: (q: string) => api.get<ProvidersResponse>(`/users/providers/search${query({ q })}`),

  /** Listings around a point, nearest first. */
  listingsNearby: (coords: Coordinates, radiusKm: number, verifiedOnly = false, limit = 24) =>
    api.get<ListingsResponse>(
      `/services/search/nearby${query({
        latitude: coords.latitude,
        longitude: coords.longitude,
        radius_km: radiusKm,
        verified_only: verifiedOnly,
        limit,
      })}`,
    ),

  /** Listings matching a word. */
  listingsSearch: (q: string) => api.get<ListingsResponse>(`/services/search/text${query({ q })}`),

  /** The categories the marketplace shares. */
  categories: () => api.get<CategoriesResponse>('/categories'),

  /** One listing. */
  listing: (id: string) => api.get<ServiceListing>(`/services/${id}`),

  /** The map's tile template and attribution, from configuration. */
  mapConfig: () => api.get<{ tile_url: string; attribution: string }>('/location/map-config'),

  /** The caller's published service listings. */
  myListings: () => api.get<ListingsResponse>('/services/mine'),

  /** Publish a new service listing. */
  createListing: (data: {
    category_id?: string | null
    title: string
    description?: string | null
    price?: number | null
    latitude: number
    longitude: number
    radius_km: number
    image_url?: string | null
    image_urls?: string[]
  }) => api.post<ServiceListing>('/services', data),
}
