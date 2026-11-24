/**
 * Providers near you: the map on one side, the cards on the other, sharing one query.
 * Matches Gigr's provider discovery pattern with text search, radius filters, and verified badge filters.
 */

import { MapPin, Search, ShieldCheck, Sparkles, X } from 'lucide-react'
import { useMemo, useState } from 'react'

import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { NeighborhoodMap, type MapPoint } from '@/components/map/NeighborhoodMap'
import { ProviderCard } from '@/components/ProviderCard'
import { Button } from '@/components/ui/button'
import { CardSkeletonList } from '@/components/ui/skeleton'
import { useNearbyProviders, useProviderSearch } from '@/hooks/useProviders'
import { RADIUS_CHOICES, useLocationStore } from '@/store/locationStore'

export function ProvidersPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [isLocating, setIsLocating] = useState(false)

  const coordinates = useLocationStore((state) => state.coordinates)
  const radiusKm = useLocationStore((state) => state.radiusKm)
  const setRadiusKm = useLocationStore((state) => state.setRadiusKm)
  const source = useLocationStore((state) => state.source)
  const requestDeviceLocation = useLocationStore((state) => state.requestDeviceLocation)

  const nearbyQuery = useNearbyProviders(verifiedOnly)
  const textQuery = useProviderSearch(searchQuery)

  const isSearching = searchQuery.trim().length >= 2
  const activeQuery = isSearching ? textQuery : nearbyQuery

  const rawList = activeQuery.data ?? []
  const providersList = useMemo(() => {
    if (isSearching && verifiedOnly) {
      return rawList.filter((p) => p.concordium_verified)
    }
    return rawList
  }, [rawList, isSearching, verifiedOnly])

  const points = useMemo<MapPoint[]>(
    () =>
      providersList.map((provider) => ({
        id: provider.id,
        kind: 'provider',
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        title: provider.display_name,
        subtitle: provider.services[0]?.title ?? null,
        price: provider.services[0]?.price ?? null,
        distanceKm: provider.distance_km,
        verified: provider.concordium_verified,
        isDemo: provider.is_demo,
      })),
    [providersList, coordinates.latitude, coordinates.longitude],
  )

  const handleGetLocation = async () => {
    setIsLocating(true)
    try {
      await requestDeviceLocation()
    } finally {
      setIsLocating(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Header section */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Verified Providers</h1>
          <p className="mt-1 text-sm text-muted">
            Nearest first. A verified human identity earns trust before the first message.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            intent={verifiedOnly ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setVerifiedOnly((on) => !on)}
            aria-pressed={verifiedOnly}
            className="transition-all duration-150"
          >
            <ShieldCheck size={14} className="mr-1" aria-hidden="true" />
            {verifiedOnly ? 'Showing verified humans' : 'Verified humans only'}
          </Button>
          <Button
            intent="secondary"
            size="sm"
            loading={isLocating}
            loadingLabel="Locating..."
            onClick={() => void handleGetLocation()}
          >
            <MapPin size={14} className="mr-1" aria-hidden="true" />
            Use my location
          </Button>
        </div>
      </div>

      {/* Filter bar: Search + Radius */}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-y border-line py-3">
        {/* Search input */}
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search providers by name, skill or trade..."
            className="w-full rounded-xl border border-line bg-surface pl-9 pr-8 py-1.5 text-sm text-ink placeholder:text-muted focus:border-structural focus:outline-none focus:ring-1 focus:ring-structural transition-colors duration-150"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink p-0.5 rounded-full"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Radius selector */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted mr-1">Radius:</span>
          {RADIUS_CHOICES.map((choice) => (
            <button
              key={choice}
              type="button"
              onClick={() => setRadiusKm(choice)}
              aria-pressed={radiusKm === choice}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                radiusKm === choice
                  ? 'border border-structural bg-accent text-accent-ink shadow-sm'
                  : 'border border-line bg-surface text-ink hover:bg-sunken'
              }`}
            >
              {choice === 0 ? 'Any distance' : choice < 1 ? `${choice * 1000} m` : `${choice} km`}
            </button>
          ))}
          {source === 'demo' ? (
            <span className="ml-1 text-xs text-muted">(Demo: Lagos)</span>
          ) : null}
        </div>
      </div>

      {/* Main Content: Map + Grid */}
      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.15fr]">
        <div className="min-w-0 lg:sticky lg:top-20 lg:self-start">
          <NeighborhoodMap
            center={coordinates}
            radiusKm={radiusKm}
            points={points}
            loading={activeQuery.isLoading}
            height={420}
          />
        </div>

        <div className="min-w-0">
          {activeQuery.isLoading ? (
            <CardSkeletonList count={4} />
          ) : activeQuery.isError ? (
            <ErrorState
              title="We could not load the providers"
              message="Check your network connection and try again. Nothing was changed."
              onRetry={() => void activeQuery.refetch()}
            />
          ) : providersList.length === 0 ? (
            <EmptyState
              icon={<Sparkles size={20} />}
              title={
                isSearching
                  ? `No providers found matching "${searchQuery}"`
                  : verifiedOnly
                    ? 'No verified providers in this radius'
                    : 'No providers in range yet'
              }
              description={
                isSearching
                  ? 'Try searching with different keywords, or clear the search query to see everyone nearby.'
                  : verifiedOnly
                    ? 'Widen your distance radius, or turn off the verified-only filter to see all providers.'
                    : 'Widen the radius filter above to discover providers further away, or post a job.'
              }
              actionLabel={isSearching ? 'Clear search' : radiusKm !== 0 ? 'Show anyone nearby' : undefined}
              onAction={
                isSearching
                  ? () => setSearchQuery('')
                  : radiusKm !== 0
                    ? () => setRadiusKm(0)
                    : undefined
              }
            />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-muted pb-1">
                <span>Showing {providersList.length} provider{providersList.length === 1 ? '' : 's'}</span>
                {isSearching && <span>Keyword: &quot;{searchQuery}&quot;</span>}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {providersList.map((provider) => (
                  <ProviderCard key={provider.id} provider={provider} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
