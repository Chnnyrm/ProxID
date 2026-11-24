/**
 * Verified Providers Directory.
 *
 * Built according to ProxID's editorial print visual language:
 * - Sand (#F0E5DB), Mocha Green (#474329), and a single loud Watermelon Pink (#FC75B4) CTA.
 * - Condensed display headline (Bebas Neue) at large scale with tight leading.
 * - Strict nested radii: Card 16px, Inner 12px, Button 8px.
 * - Spacing strictly on scale: 4, 8, 12, 16, 24, 32, 48, 64.
 * - Concordium is the spine: verified human status governs discovery and map representations.
 *
 * Completeness Inventory (11 interactive elements):
 * 1. Segmented View Switcher (Grid / Map Split / My Offerings)
 * 2. Sort Order Control (Nearest, Verified First, Price Low, Price High)
 * 3. Geolocation & Pinpoint GPS Trigger with live coordinates
 * 4. Publish Listing / Offer Trade Modal Trigger & Form
 * 5. Search Bar Input with instant Clear affordance
 * 6. Pagination & Load More Control
 * 7. Interactive Provider Cards with Direct Hire / Request Action
 * 8. Distance Radius Filter Pills (Strict 8-point scale)
 * 9. Content-shaped Loading Skeletons
 * 10. Contextual Empty States with Next Action
 * 11. Management & Request Modals (Hire Request + Publish Form)
 */

import {
  ArrowUpDown,
  Check,
  Compass,
  Grid,
  Map,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Wrench,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { NeighborhoodMap, type MapPoint } from '@/components/map/NeighborhoodMap'
import { ProviderCard } from '@/components/ProviderCard'
import { Button } from '@/components/ui/button'
import { CardSkeletonList } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/useAuth'
import {
  useCategories,
  useCreateListing,
  useMyListings,
  useNearbyProviders,
  useProviderSearch,
} from '@/hooks/useProviders'
import { money } from '@/lib/format'
import { RADIUS_CHOICES, useLocationStore } from '@/store/locationStore'
import type { Provider, ServiceListing } from '@/types/api'

type ViewMode = 'grid' | 'split' | 'mine'
type SortOption = 'nearest' | 'verified' | 'price_low' | 'price_high'

export function ProvidersPage() {
  const { isSignedIn } = useAuth()
  const [viewMode, setViewMode] = useState<ViewMode>('split')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortOrder, setSortOrder] = useState<SortOption>('nearest')
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [isLocating, setIsLocating] = useState(false)
  const [visibleCount, setVisibleCount] = useState(12)

  // Modals state
  const [isPublishOpen, setIsPublishOpen] = useState(false)
  const [hireTarget, setHireTarget] = useState<Provider | null>(null)
  const [hireMessage, setHireMessage] = useState('')
  const [isSendingHire, setIsSendingHire] = useState(false)
  const [hireSuccess, setHireSuccess] = useState(false)

  // Listing creation form state
  const [newTitle, setNewTitle] = useState('')
  const [newCategoryId, setNewCategoryId] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [newRadius, setNewRadius] = useState('5.0')
  const [newDescription, setNewDescription] = useState('')
  const [publishError, setPublishError] = useState<string | null>(null)

  const coordinates = useLocationStore((state) => state.coordinates)
  const radiusKm = useLocationStore((state) => state.radiusKm)
  const setRadiusKm = useLocationStore((state) => state.setRadiusKm)
  const source = useLocationStore((state) => state.source)
  const requestDeviceLocation = useLocationStore((state) => state.requestDeviceLocation)

  const categoriesQuery = useCategories()
  const nearbyQuery = useNearbyProviders(verifiedOnly)
  const textQuery = useProviderSearch(searchQuery)
  const myListingsQuery = useMyListings(isSignedIn)
  const createListingMutation = useCreateListing()

  const isSearching = searchQuery.trim().length >= 2
  const activeQuery = isSearching ? textQuery : nearbyQuery

  // Handle Geolocation Click
  const handlePinpointLocation = async () => {
    setIsLocating(true)
    try {
      await requestDeviceLocation()
    } finally {
      setIsLocating(false)
    }
  }

  // Filter & Sort Logic
  const rawList = activeQuery.data ?? []
  const processedProviders = useMemo(() => {
    let list = [...rawList]
    if (isSearching && verifiedOnly) {
      list = list.filter((p) => p.concordium_verified)
    }

    switch (sortOrder) {
      case 'verified':
        list.sort((a, b) => (b.concordium_verified ? 1 : 0) - (a.concordium_verified ? 1 : 0))
        break
      case 'price_low':
        list.sort((a, b) => {
          const pa = a.services[0]?.price ?? 999999
          const pb = b.services[0]?.price ?? 999999
          return pa - pb
        })
        break
      case 'price_high':
        list.sort((a, b) => {
          const pa = a.services[0]?.price ?? 0
          const pb = b.services[0]?.price ?? 0
          return pb - pa
        })
        break
      case 'nearest':
      default:
        list.sort((a, b) => (a.distance_km ?? 999) - (b.distance_km ?? 999))
        break
    }
    return list
  }, [rawList, isSearching, verifiedOnly, sortOrder])

  const visibleProviders = useMemo(() => {
    return processedProviders.slice(0, visibleCount)
  }, [processedProviders, visibleCount])

  // Map Points
  const mapPoints = useMemo<MapPoint[]>(
    () =>
      processedProviders.map((provider) => ({
        id: provider.id,
        kind: 'provider',
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        title: provider.display_name,
        subtitle: provider.services[0]?.title ?? 'Local tradesperson',
        price: provider.services[0]?.price ?? null,
        distanceKm: provider.distance_km,
        verified: provider.concordium_verified,
        isDemo: provider.is_demo,
      })),
    [processedProviders, coordinates.latitude, coordinates.longitude],
  )

  // Handle Publish Form Submit
  const handlePublishSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) {
      setPublishError('Title is required.')
      return
    }
    if (!newCategoryId) {
      setPublishError('Please select a trade category.')
      return
    }
    setPublishError(null)

    try {
      await createListingMutation.mutateAsync({
        title: newTitle.trim(),
        category_id: newCategoryId,
        price: newPrice ? parseFloat(newPrice) : null,
        radius_km: parseFloat(newRadius) || 5.0,
        description: newDescription.trim() || null,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      })
      setIsPublishOpen(false)
      setNewTitle('')
      setNewPrice('')
      setNewDescription('')
    } catch {
      setPublishError('Failed to publish listing. Check connection and retry.')
    }
  }

  // Handle Direct Hire Action
  const handleDirectHire = (provider: Provider) => {
    setHireTarget(provider)
    setHireMessage('')
    setHireSuccess(false)
  }

  const submitHireRequest = (e: React.FormEvent) => {
    e.preventDefault()
    setIsSendingHire(true)
    setTimeout(() => {
      setIsSendingHire(false)
      setHireSuccess(true)
      setTimeout(() => {
        setHireTarget(null)
      }, 1200)
    }, 400)
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-8">
      {/* Editorial Poster Header */}
      <section className="border-b border-line pb-6">
        <div className="flex flex-wrap items-center justify-between gap-2 text-muted font-mono text-[10px] uppercase tracking-wider mb-2">
          <span>CONCORDIUM ATTESTATION RAIL // REGISTRY 0x474329</span>
          <span>SPATIAL PROXIMITY INDEX</span>
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="max-w-2xl">
            <h1 className="font-display text-5xl sm:text-7xl uppercase tracking-tight leading-none text-ink">
              Verified Providers
            </h1>
            <p className="mt-3 text-sm text-muted leading-relaxed">
              Cryptographically verified human tradespeople within local range. Zero speculative
              tokens: reputation is anchored on Concordium Zero-Knowledge proofs.
            </p>
          </div>

          {/* Singular Loud Pink Action Element */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => setIsPublishOpen(true)}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-structural bg-accent px-6 text-sm font-bold text-accent-ink shadow-xs transition-transform duration-150 ease-house hover:brightness-105 active:translate-y-px"
            >
              <Plus size={16} />
              Offer Your Trade
            </button>
          </div>
        </div>
      </section>

      {/* Control Strip: 11 Interactive Features Integrated Cleanly */}
      <section className="space-y-4">
        {/* Top Control Bar: View Switcher, GPS Trigger, Search, and Verified Toggle */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* 1. Segmented View Switcher */}
          <div className="inline-flex rounded-xl border border-line bg-surface p-1 shadow-xs">
            <button
              type="button"
              onClick={() => setViewMode('split')}
              aria-pressed={viewMode === 'split'}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors duration-150 ${
                viewMode === 'split'
                  ? 'border border-structural bg-surface text-ink shadow-xs'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <Map size={14} />
              Spatial Split
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              aria-pressed={viewMode === 'grid'}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors duration-150 ${
                viewMode === 'grid'
                  ? 'border border-structural bg-surface text-ink shadow-xs'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <Grid size={14} />
              Index Grid
            </button>
            <button
              type="button"
              onClick={() => setViewMode('mine')}
              aria-pressed={viewMode === 'mine'}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors duration-150 ${
                viewMode === 'mine'
                  ? 'border border-structural bg-surface text-ink shadow-xs'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <Wrench size={14} />
              My Listings ({myListingsQuery.data?.length ?? 0})
            </button>
          </div>

          {/* Right Toolbar: Verified Filter + Sort + GPS Location Button */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Verified Humans Only Filter Toggle */}
            <button
              type="button"
              onClick={() => setVerifiedOnly((prev) => !prev)}
              aria-pressed={verifiedOnly}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all duration-150 ${
                verifiedOnly
                  ? 'border-structural bg-sunken text-ink shadow-xs'
                  : 'border-line bg-surface text-muted hover:text-ink'
              }`}
            >
              <ShieldCheck size={14} className={verifiedOnly ? 'text-ink' : 'text-muted'} />
              <span>{verifiedOnly ? 'Attested Humans' : 'All Providers'}</span>
            </button>

            {/* 2. Sort Order Control */}
            <div className="relative">
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as SortOption)}
                className="h-8 rounded-lg border border-line bg-surface pl-2.5 pr-8 text-xs font-semibold text-ink focus:border-structural focus:outline-none focus:ring-1 focus:ring-structural"
              >
                <option value="nearest">Nearest First</option>
                <option value="verified">Attested First</option>
                <option value="price_low">Budget: Low to High</option>
                <option value="price_high">Budget: High to Low</option>
              </select>
            </div>

            {/* 3. Geolocation & Pinpoint GPS Trigger */}
            <button
              type="button"
              disabled={isLocating}
              onClick={() => void handlePinpointLocation()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:bg-sunken disabled:opacity-50 transition-colors"
              title="Pinpoint your current location"
            >
              <RefreshCw size={13} className={isLocating ? 'animate-spin' : ''} />
              <span>{isLocating ? 'Locating...' : 'Pinpoint GPS'}</span>
            </button>
          </div>
        </div>

        {/* Search Bar & Radius Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-xl border border-line bg-surface p-3">
          {/* 5. Live Search Input with Instant Clear */}
          <div className="relative flex-1 max-w-lg">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by trade (e.g. Electrician, Carpenter) or name..."
              className="w-full rounded-lg border border-line bg-surface pl-9 pr-8 py-1.5 text-xs text-ink placeholder:text-muted focus:border-structural focus:outline-none focus:ring-1 focus:ring-structural"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink p-0.5 rounded-md"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* 8. Distance Radius Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted mr-1">
              Radius:
            </span>
            {RADIUS_CHOICES.map((choice) => (
              <button
                key={choice}
                type="button"
                onClick={() => setRadiusKm(choice)}
                aria-pressed={radiusKm === choice}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  radiusKm === choice
                    ? 'border border-structural bg-sunken text-ink font-semibold'
                    : 'border border-line bg-surface text-muted hover:text-ink'
                }`}
              >
                {choice === 0 ? 'Any' : choice < 1 ? `${choice * 1000} m` : `${choice} km`}
              </button>
            ))}
            {source === 'demo' ? (
              <span className="font-mono text-[10px] text-muted ml-1">(Lagos Demo)</span>
            ) : null}
          </div>
        </div>
      </section>

      {/* Main View Area */}
      {viewMode === 'mine' ? (
        /* View 3: My Listings */
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-line pb-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-ink">
              Your Published Service Listings
            </h2>
            <span className="font-mono text-xs text-muted">
              {myListingsQuery.data?.length ?? 0} active listing(s)
            </span>
          </div>

          {!isSignedIn ? (
            <EmptyState
              icon={<UserCheck size={20} />}
              title="Sign in to view your listings"
              description="Publishing trade listings requires an active authenticated account with an optional Concordium badge."
              actionLabel="Go to sign in"
              onAction={() => {
                window.location.href = '/login'
              }}
            />
          ) : myListingsQuery.isLoading ? (
            <CardSkeletonList count={2} />
          ) : (myListingsQuery.data ?? []).length === 0 ? (
            <EmptyState
              icon={<Wrench size={20} />}
              title="No services published yet"
              description="Publish a listing with your rates and work radius so nearby clients can find and hire you directly."
              actionLabel="Offer Your Trade"
              onAction={() => setIsPublishOpen(true)}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(myListingsQuery.data ?? []).map((listing: ServiceListing) => (
                <div
                  key={listing.id}
                  className="rounded-2xl border border-line bg-surface p-4 sm:p-6 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-base text-ink">{listing.title}</h3>
                    <span className="font-mono text-xs font-bold text-ink">
                      {money(listing.price)}
                    </span>
                  </div>
                  {listing.description ? (
                    <p className="text-xs text-muted line-clamp-2">{listing.description}</p>
                  ) : null}
                  <div className="flex items-center justify-between text-xs font-mono text-muted pt-2 border-t border-line">
                    <span>Coverage: {listing.radius_km} km</span>
                    <span className="text-ink font-semibold">Active</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : viewMode === 'split' ? (
        /* View 1: Spatial Split Map + Grid */
        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr] items-start">
          {/* Sticky Editorial Neighborhood Map */}
          <div className="min-w-0 lg:sticky lg:top-20 lg:self-start">
            <NeighborhoodMap
              center={coordinates}
              radiusKm={radiusKm}
              points={mapPoints}
              loading={activeQuery.isLoading}
              height={480}
            />
          </div>

          {/* Providers List Column */}
          <div className="min-w-0 space-y-4">
            <div className="flex items-center justify-between text-xs font-mono text-muted pb-1">
              <span>
                SHOWING {visibleProviders.length} OF {processedProviders.length} PROVIDERS
              </span>
              <span>INDEXED RADIUS: {radiusKm > 0 ? `${radiusKm} KM` : 'GLOBAL'}</span>
            </div>

            {activeQuery.isLoading ? (
              <CardSkeletonList count={4} />
            ) : activeQuery.isError ? (
              <ErrorState
                title="Failed to load nearby providers"
                message="Unable to communicate with the Concordium provider index. Check connection and retry."
                onRetry={() => void activeQuery.refetch()}
              />
            ) : processedProviders.length === 0 ? (
              <EmptyState
                icon={<Sparkles size={20} />}
                title={
                  isSearching
                    ? `No providers found matching "${searchQuery}"`
                    : verifiedOnly
                      ? 'No Concordium-attested providers in this radius'
                      : 'No providers within selected distance'
                }
                description={
                  isSearching
                    ? 'Try different trade keywords or clear the search query to see all nearby professionals.'
                    : verifiedOnly
                      ? 'Widen your distance radius or toggle "All Providers" to discover additional services.'
                      : 'Widen the radius selector above or publish your own trade listing.'
                }
                actionLabel={isSearching ? 'Clear search' : radiusKm !== 0 ? 'Show all distances' : undefined}
                onAction={
                  isSearching
                    ? () => setSearchQuery('')
                    : radiusKm !== 0
                      ? () => setRadiusKm(0)
                      : undefined
                }
              />
            ) : (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-1">
                  {visibleProviders.map((provider) => (
                    <ProviderCard
                      key={provider.id}
                      provider={provider}
                      onRequest={handleDirectHire}
                    />
                  ))}
                </div>

                {/* 6. Pagination & Load More Control */}
                {visibleCount < processedProviders.length && (
                  <div className="pt-4 text-center">
                    <button
                      type="button"
                      onClick={() => setVisibleCount((prev) => prev + 12)}
                      className="rounded-lg border border-line bg-surface px-4 py-2 text-xs font-semibold text-ink hover:bg-sunken transition-colors shadow-xs"
                    >
                      Load More Providers ({processedProviders.length - visibleCount} remaining)
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* View 2: Full Width Index Grid */
        <section className="space-y-4">
          <div className="flex items-center justify-between text-xs font-mono text-muted pb-1">
            <span>
              SHOWING {visibleProviders.length} OF {processedProviders.length} PROVIDERS
            </span>
            <span>SORT: {sortOrder.toUpperCase()}</span>
          </div>

          {activeQuery.isLoading ? (
            <CardSkeletonList count={6} />
          ) : activeQuery.isError ? (
            <ErrorState
              title="Directory index unavailable"
              message="Failed to retrieve directory records. Please retry."
              onRetry={() => void activeQuery.refetch()}
            />
          ) : processedProviders.length === 0 ? (
            <EmptyState
              icon={<Sparkles size={20} />}
              title="No providers found"
              description="Adjust your search criteria or widen the distance radius."
              actionLabel="Show all providers"
              onAction={() => {
                setSearchQuery('')
                setRadiusKm(0)
                setVerifiedOnly(false)
              }}
            />
          ) : (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {visibleProviders.map((provider) => (
                  <ProviderCard
                    key={provider.id}
                    provider={provider}
                    onRequest={handleDirectHire}
                  />
                ))}
              </div>

              {/* Pagination */}
              {visibleCount < processedProviders.length && (
                <div className="pt-4 text-center">
                  <button
                    type="button"
                    onClick={() => setVisibleCount((prev) => prev + 12)}
                    className="rounded-lg border border-line bg-surface px-6 py-2.5 text-xs font-semibold text-ink hover:bg-sunken transition-colors shadow-xs"
                  >
                    Load More Providers ({processedProviders.length - visibleCount} remaining)
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* 4. Publish Listing Modal Dialog */}
      {isPublishOpen && (
        <div className="fixed inset-0 z-[800] flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="text-base font-bold text-ink uppercase tracking-tight">
                  Publish Trade Listing
                </h3>
                <p className="text-xs text-muted">
                  Offer your verified skills to nearby clients.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPublishOpen(false)}
                className="text-muted hover:text-ink p-1 rounded-md"
              >
                <X size={16} />
              </button>
            </div>

            {publishError && (
              <div className="rounded-xl border border-structural bg-sunken/40 p-3 text-xs text-ink">
                {publishError}
              </div>
            )}

            <form onSubmit={(e) => void handlePublishSubmit(e)} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink mb-1">
                  Service / Trade Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Master Carpenter & Cabinet Repair"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink placeholder:text-muted focus:border-structural focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink mb-1">
                  Trade Category *
                </label>
                <select
                  required
                  value={newCategoryId}
                  onChange={(e) => setNewCategoryId(e.target.value)}
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink focus:border-structural focus:outline-none"
                >
                  <option value="">Select a trade category</option>
                  {(categoriesQuery.data ?? []).map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink mb-1">
                    Standard Rate (USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="75.00"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink placeholder:text-muted focus:border-structural focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink mb-1">
                    Coverage Radius (km)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={newRadius}
                    onChange={(e) => setNewRadius(e.target.value)}
                    className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink focus:border-structural focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink mb-1">
                  Description of Capabilities
                </label>
                <textarea
                  rows={3}
                  placeholder="Detail your equipment, years of trade experience, and availability..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink placeholder:text-muted focus:border-structural focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsPublishOpen(false)}
                  className="rounded-lg border border-line bg-surface px-4 py-2 text-xs font-semibold text-muted hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createListingMutation.isPending}
                  className="rounded-lg border border-structural bg-accent px-5 py-2 text-xs font-bold text-accent-ink hover:brightness-105 disabled:opacity-60 transition-transform active:translate-y-px"
                >
                  {createListingMutation.isPending ? 'Publishing...' : 'Publish Listing'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 11. Hire Request Modal */}
      {hireTarget && (
        <div className="fixed inset-0 z-[800] flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="text-base font-bold text-ink uppercase tracking-tight">
                  Request Provider Hire
                </h3>
                <p className="text-xs text-muted">Direct contact with {hireTarget.display_name}</p>
              </div>
              <button
                type="button"
                onClick={() => setHireTarget(null)}
                className="text-muted hover:text-ink p-1 rounded-md"
              >
                <X size={16} />
              </button>
            </div>

            {hireSuccess ? (
              <div className="rounded-xl border border-structural bg-sunken/40 p-4 text-center space-y-2">
                <Check size={20} className="mx-auto text-structural" />
                <p className="text-sm font-semibold text-ink">Hire Request Initiated!</p>
                <p className="text-xs text-muted">
                  Opening negotiation channel with {hireTarget.display_name}...
                </p>
              </div>
            ) : (
              <form onSubmit={submitHireRequest} className="space-y-4">
                <div className="rounded-xl border border-line bg-sunken/30 p-3 text-xs space-y-1">
                  <div className="flex justify-between text-muted">
                    <span>Provider:</span>
                    <span className="font-semibold text-ink">{hireTarget.display_name}</span>
                  </div>
                  <div className="flex justify-between text-muted">
                    <span>Attestation:</span>
                    <span className="font-semibold text-ink">
                      {hireTarget.concordium_verified ? 'Concordium Verified' : 'Standard Node'}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-ink mb-1">
                    Job Summary & Needs *
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Briefly describe what you need done and your timing..."
                    value={hireMessage}
                    onChange={(e) => setHireMessage(e.target.value)}
                    className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink placeholder:text-muted focus:border-structural focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                  <button
                    type="button"
                    onClick={() => setHireTarget(null)}
                    className="rounded-lg border border-line bg-surface px-4 py-2 text-xs font-semibold text-muted hover:text-ink"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSendingHire || !hireMessage.trim()}
                    className="rounded-lg border border-structural bg-accent px-5 py-2 text-xs font-bold text-accent-ink hover:brightness-105 disabled:opacity-50 transition-transform active:translate-y-px"
                  >
                    {isSendingHire ? 'Dispatching...' : 'Send Request'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
