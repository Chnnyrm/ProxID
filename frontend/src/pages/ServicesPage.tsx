/**
 * ServicesPage.tsx - Directory of individual service listings.
 *
 * Requirements:
 * - The unit of the list is a service listing, not a person.
 * - Filtered by radius by default: 5km, using device location with fallback to saved neighbourhood.
 * - Shows the radius in effect.
 * - Empty result offers a one-tap way to widen the radius.
 * - Header Map button navigates to /map?filter=services pre-filtered.
 * - Clean mobile minimalist cartoon language, zero prose, pure ASCII.
 */

import {
  Compass,
  Crosshair,
  Map as MapIcon,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Wrench,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { CategorySelect } from '@/components/CategorySelect'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { ImageMultiUpload } from '@/components/ImageMultiUpload'
import { ServiceCard } from '@/components/ServiceCard'
import { CardSkeleton } from '@/components/ui/skeleton'
import {
  useCategories,
  useCreateListing,
  useNearbyListings,
} from '@/hooks/useProviders'
import { useAuth } from '@/hooks/useAuth'
import { useLocationStore } from '@/store/locationStore'
import type { ServiceListing } from '@/types/api'

export function ServicesPage() {
  const { isSignedIn } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialCategory = searchParams.get('category') || 'all'
  const initialSearch = searchParams.get('q') || ''

  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory)
  const [searchQuery, setSearchQuery] = useState(initialSearch)
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [isPublishOpen, setIsPublishOpen] = useState(false)
  const [isLocating, setIsLocating] = useState(false)

  // Sync state if search params change
  useEffect(() => {
    const q = searchParams.get('q')
    if (q !== null) {
      setSearchQuery(q)
    }
    const cat = searchParams.get('category')
    if (cat !== null) {
      setSelectedCategory(cat)
    }
    if (searchParams.get('compose') === '1') {
      if (!isSignedIn) {
        window.dispatchEvent(
          new CustomEvent('proxid-require-auth', {
            detail: { action: 'offer a service' },
          })
        )
      } else {
        setIsPublishOpen(true)
      }
      searchParams.delete('compose')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams, isSignedIn])

  // Location and Radius
  const coordinates = useLocationStore((state) => state.coordinates)
  const radiusKm = useLocationStore((state) => state.radiusKm)
  const setRadiusKm = useLocationStore((state) => state.setRadiusKm)
  const requestDeviceLocation = useLocationStore((state) => state.requestDeviceLocation)

  // Fetch listings and categories
  const listingsQuery = useNearbyListings(verifiedOnly)
  const categoriesQuery = useCategories()
  const createListingMutation = useCreateListing()

  // Form state for publishing service
  const [pubTitle, setPubTitle] = useState('')
  const [pubDesc, setPubDesc] = useState('')
  const [pubPrice, setPubPrice] = useState('')
  const [pubCatId, setPubCatId] = useState('')
  const [pubImages, setPubImages] = useState<string[]>([])

  const handleNearbyToggle = async () => {
    setIsLocating(true)
    try {
      await requestDeviceLocation()
    } finally {
      setIsLocating(false)
    }
  }

  const handleWidenRadius = (newRadius: number) => {
    setRadiusKm(newRadius)
  }

  // Filter listings by search query and category
  const filteredListings = useMemo(() => {
    const raw = listingsQuery.data ?? []
    return raw.filter((s) => {
      if (selectedCategory !== 'all' && s.category_id !== selectedCategory) {
        return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const titleMatch = s.title.toLowerCase().includes(q)
        const descMatch = s.description?.toLowerCase().includes(q) ?? false
        const provMatch = s.provider_display_name?.toLowerCase().includes(q) ?? false
        if (!titleMatch && !descMatch && !provMatch) return false
      }
      return true
    })
  }, [listingsQuery.data, selectedCategory, searchQuery])

  const handlePublishSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pubTitle.trim() || !pubPrice) return
    const priceNum = parseFloat(pubPrice)
    if (isNaN(priceNum) || priceNum <= 0) return

    await createListingMutation.mutateAsync({
      title: pubTitle.trim(),
      description: pubDesc.trim() || undefined,
      price: priceNum,
      category_id: pubCatId || undefined,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      radius_km: radiusKm,
      image_urls: pubImages,
      image_url: pubImages[0] || undefined,
    })

    setPubTitle('')
    setPubDesc('')
    setPubPrice('')
    setPubCatId('')
    setPubImages([])
    setIsPublishOpen(false)
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:py-8 space-y-5">
      {/* 1. Header: 2 words heading, max 1 line secondary text */}
      <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-line pb-4">
        <div>
          <h1 className="font-display text-4xl sm:text-6xl uppercase tracking-tight leading-none text-ink">
            Local Services
          </h1>
          <p className="mt-1 text-xs text-muted">Attested trades within range</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Header Map Button navigating to /map?filter=services pre-filtered */}
          <Link
            to="/map?filter=services"
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-4 text-xs font-bold text-ink hover:bg-sunken transition-colors shadow-xs"
          >
            <MapIcon size={14} />
            <span>Map</span>
          </Link>

          <button
            type="button"
            onClick={() => {
              if (!isSignedIn) {
                window.dispatchEvent(
                  new CustomEvent('proxid-require-auth', {
                    detail: { action: 'offer a service' },
                  })
                )
                return
              }
              setIsPublishOpen(true)
            }}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-structural bg-ink px-4 text-xs font-bold text-page hover:opacity-90 transition-opacity active:translate-y-px shadow-xs"
          >
            <Plus size={14} />
            <span>Offer Service</span>
          </button>
        </div>
      </section>

      {/* 2. Radius in Effect & Geolocation Control */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-sunken/40 px-3.5 py-2">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-structural" />
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-ink">
            {radiusKm > 0 ? `${radiusKm} km radius in effect` : 'Global radius active'}
          </span>
          <span className="text-[11px] text-muted hidden sm:inline">
            // based on your active location
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick radius buttons */}
          <div className="flex items-center rounded-lg border border-line bg-surface p-0.5 text-[11px] font-mono">
            {[2, 5, 10, 20].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRadiusKm(r)}
                className={`rounded-md px-2 py-0.5 transition-colors ${
                  radiusKm === r
                    ? 'bg-ink font-bold text-page'
                    : 'text-muted hover:text-ink'
                }`}
              >
                {r}km
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleNearbyToggle}
            disabled={isLocating}
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-line bg-surface px-2.5 text-[11px] font-medium text-ink hover:bg-sunken transition-colors shadow-xs"
            title="Update to device location"
          >
            <Crosshair size={12} className={isLocating ? 'animate-spin' : ''} />
            <span>{isLocating ? 'Locating...' : 'Nearby'}</span>
          </button>
        </div>
      </div>

      {/* 3. Search and Category Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              selectedCategory === 'all'
                ? 'border-structural bg-ink text-page font-semibold'
                : 'border-line bg-surface text-ink hover:bg-sunken'
            }`}
          >
            All Services
          </button>
          {categoriesQuery.data?.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                selectedCategory === cat.id
                  ? 'border-structural bg-ink text-page font-semibold'
                  : 'border-line bg-surface text-ink hover:bg-sunken'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Search input + Verified filter */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative flex-1 sm:w-56">
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search trade or keyword..."
              className="w-full rounded-xl border border-line bg-surface py-1.5 pl-8 pr-7 text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-structural"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setVerifiedOnly((v) => !v)}
            className={`inline-flex h-8 items-center gap-1 rounded-xl border px-3 text-xs font-medium transition-colors ${
              verifiedOnly
                ? 'border-structural bg-ink text-page'
                : 'border-line bg-surface text-muted hover:text-ink'
            }`}
          >
            <span>Verified only</span>
          </button>
        </div>
      </div>

      {/* 4. Listings Grid / Skeletons / Empty State */}
      {listingsQuery.isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : listingsQuery.isError ? (
        <ErrorState
          title="Could not load services"
          message="Failed to retrieve nearby service listings."
          onRetry={() => void listingsQuery.refetch()}
        />
      ) : filteredListings.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface p-8 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-structural bg-page text-ink shadow-xs">
            <Wrench size={20} />
          </div>
          <div>
            <h3 className="font-display text-lg uppercase text-ink">
              No services found within {radiusKm} km
            </h3>
            <p className="mt-1 text-xs text-muted max-w-sm mx-auto">
              There are no service listings matching your active filters within this range.
            </p>
          </div>

          {/* One-tap way to widen radius */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => handleWidenRadius(15)}
              className="rounded-lg border border-structural bg-ink px-4 py-2 text-xs font-bold text-page hover:opacity-90 transition-opacity shadow-xs"
            >
              Widen radius to 15 km
            </button>
            <button
              type="button"
              onClick={() => handleWidenRadius(25)}
              className="rounded-lg border border-line bg-surface px-4 py-2 text-xs font-bold text-ink hover:bg-sunken transition-colors shadow-xs"
            >
              Expand to 25 km
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
          {filteredListings.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              onBook={() => {
                // Book service action opens room or job creation
              }}
            />
          ))}
        </div>
      )}

      {/* 5. Publish Service Listing Modal */}
      {isPublishOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl space-y-4 select-none">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h2 className="font-display text-xl uppercase tracking-tight text-ink">
                Offer Your Service
              </h2>
              <button
                type="button"
                onClick={() => setIsPublishOpen(false)}
                className="rounded-lg p-1 text-muted hover:text-ink"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handlePublishSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1">
                  Service Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Electrical Fault Diagnosis"
                  value={pubTitle}
                  onChange={(e) => setPubTitle(e.target.value)}
                  className="w-full rounded-xl border border-line bg-sunken/40 px-3 py-2 text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-structural"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1">
                  Standard Rate (NGN)
                </label>
                <input
                  type="number"
                  required
                  min="500"
                  placeholder="e.g. 15000"
                  value={pubPrice}
                  onChange={(e) => setPubPrice(e.target.value)}
                  className="w-full rounded-xl border border-line bg-sunken/40 px-3 py-2 text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-structural"
                />
              </div>

              <CategorySelect
                value={pubCatId}
                onChange={setPubCatId}
                categories={categoriesQuery.data}
                placeholder="Select Category (optional)"
              />

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1">
                  Scope Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Details of what is covered in this service..."
                  value={pubDesc}
                  onChange={(e) => setPubDesc(e.target.value)}
                  className="w-full rounded-xl border border-line bg-sunken/40 px-3 py-2 text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-structural"
                />
              </div>

              <div>
                <ImageMultiUpload
                  value={pubImages}
                  onChange={setPubImages}
                  disabled={createListingMutation.isPending}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsPublishOpen(false)}
                  className="rounded-lg border border-line px-4 py-2 text-xs font-bold text-muted hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createListingMutation.isPending}
                  className="rounded-lg border border-structural bg-ink px-5 py-2 text-xs font-bold text-page hover:opacity-90 disabled:opacity-50 shadow-xs"
                >
                  {createListingMutation.isPending ? 'Publishing...' : 'Publish Listing'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
