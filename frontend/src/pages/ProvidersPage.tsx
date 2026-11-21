/**
 * Providers near you: the map on one side, the cards on the other, sharing one query.
 */

import { useMemo, useState } from 'react'

import { EmptyState } from '@/components/EmptyState'
import { NeighborhoodMap, type MapPoint } from '@/components/map/NeighborhoodMap'
import { ProviderCard } from '@/components/ProviderCard'
import { Button } from '@/components/ui/button'
import { CardSkeletonList } from '@/components/ui/skeleton'
import { useNearbyProviders } from '@/hooks/useProviders'
import { RADIUS_CHOICES, useLocationStore } from '@/store/locationStore'

export function ProvidersPage() {
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const coordinates = useLocationStore((state) => state.coordinates)
  const radiusKm = useLocationStore((state) => state.radiusKm)
  const setRadiusKm = useLocationStore((state) => state.setRadiusKm)
  const source = useLocationStore((state) => state.source)
  const requestDeviceLocation = useLocationStore((state) => state.requestDeviceLocation)
  const providers = useNearbyProviders(verifiedOnly)

  const points = useMemo<MapPoint[]>(
    () =>
      (providers.data ?? []).map((provider) => ({
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
    [providers.data, coordinates.latitude, coordinates.longitude],
  )

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Providers nearby</h1>
          <p className="mt-1 text-sm text-muted">
            Nearest first. A verified provider ranks as if slightly closer, but the distance shown
            is always the real one.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            intent={verifiedOnly ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setVerifiedOnly((on) => !on)}
            aria-pressed={verifiedOnly}
          >
            Verified humans only
          </Button>
          <Button intent="secondary" size="sm" onClick={() => void requestDeviceLocation()}>
            Use my location
          </Button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">Radius</span>
        {RADIUS_CHOICES.map((choice) => (
          <button
            key={choice}
            onClick={() => setRadiusKm(choice)}
            aria-pressed={radiusKm === choice}
            className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors duration-200 ease-house ${
              radiusKm === choice ? 'bg-sunken text-ink' : 'text-muted hover:text-ink'
            }`}
          >
            {choice === 0 ? 'Any' : choice < 1 ? `${choice * 1000} m` : `${choice} km`}
          </button>
        ))}
        {source === 'demo' ? (
          <span className="ml-1 text-xs text-muted">Demo neighbourhood, Yaba, Lagos</span>
        ) : null}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        <div className="min-w-0 lg:sticky lg:top-20 lg:self-start">
          <NeighborhoodMap
            center={coordinates}
            radiusKm={radiusKm}
            points={points}
            loading={providers.isLoading}
            height={420}
          />
        </div>

        <div className="min-w-0">
          {providers.isLoading ? (
            <CardSkeletonList count={4} />
          ) : providers.isError ? (
            <EmptyState
              title="We could not load the providers"
              body="Nothing was changed. Check your connection, then try again."
              action={
                <Button intent="secondary" onClick={() => void providers.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : (providers.data ?? []).length === 0 ? (
            <EmptyState
              title={verifiedOnly ? 'No verified providers in range' : 'No providers in range yet'}
              body={
                verifiedOnly
                  ? 'Widen the radius, or turn the filter off to see everyone. A provider without a proof is still a provider.'
                  : 'Widen the radius and try again. If you offer work, publish a listing so clients can find you.'
              }
              action={
                <Button intent="secondary" onClick={() => setRadiusKm(0)}>
                  Show anyone nearby
                </Button>
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {(providers.data ?? []).map((provider) => (
                <ProviderCard key={provider.id} provider={provider} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
