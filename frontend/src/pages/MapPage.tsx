/**
 * Local Map Page - The centerpiece discovery surface.
 *
 * Requirements:
 * - Dedicated /map route.
 * - Top Filter: All / Services / Jobs.
 * - Job pins (#FC75B4 accent) vs Service pins (#474329 ink).
 * - Legend with 3 words maximum ("Services / Jobs").
 * - Draggable radius slider (500m to 20km) with live circle redraw and thumb display.
 * - Nearby toggle using device location.
 * - Two-word page heading, single line secondary text, zero prose paragraphs.
 * - 100% ASCII.
 */

import { Crosshair, MapPin, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { NeighborhoodMap, type MapPoint } from '@/components/map/NeighborhoodMap'
import { useNearbyJobs } from '@/hooks/useJobs'
import { useNearbyProviders } from '@/hooks/useProviders'
import { useLocationStore } from '@/store/locationStore'

type FilterOption = 'all' | 'services' | 'jobs'

export function MapPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filterParam = searchParams.get('filter')
  const activeFilter: FilterOption =
    filterParam === 'jobs' ? 'jobs' : filterParam === 'services' ? 'services' : 'all'

  const coordinates = useLocationStore((state) => state.coordinates)
  const radiusKm = useLocationStore((state) => state.radiusKm)
  const setRadiusKm = useLocationStore((state) => state.setRadiusKm)
  const source = useLocationStore((state) => state.source)
  const requestDeviceLocation = useLocationStore((state) => state.requestDeviceLocation)

  // Local drag state for live radius circle update
  const [dragRadius, setDragRadius] = useState<number>(radiusKm)
  const [isLocating, setIsLocating] = useState(false)

  useEffect(() => {
    setDragRadius(radiusKm)
  }, [radiusKm])

  const providersQuery = useNearbyProviders(false)
  const jobsQuery = useNearbyJobs()

  const handleFilterChange = (filter: FilterOption) => {
    setSearchParams(filter === 'all' ? {} : { filter })
  }

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDragRadius(parseFloat(e.target.value))
  }

  const handleSliderRelease = () => {
    setRadiusKm(dragRadius)
  }

  const handleNearbyToggle = async () => {
    setIsLocating(true)
    try {
      await requestDeviceLocation()
    } finally {
      setIsLocating(false)
    }
  }

  // Compile map points
  const points = useMemo<MapPoint[]>(() => {
    const list: MapPoint[] = []

    if (activeFilter === 'all' || activeFilter === 'services') {
      const providers = providersQuery.data ?? []
      for (const p of providers) {
        const lat =
          typeof p.latitude === 'number' && !isNaN(p.latitude)
            ? p.latitude
            : coordinates.latitude
        const lon =
          typeof p.longitude === 'number' && !isNaN(p.longitude)
            ? p.longitude
            : coordinates.longitude
        list.push({
          id: `provider-${p.id}`,
          kind: 'provider',
          latitude: lat,
          longitude: lon,
          title: p.display_name,
          subtitle: p.services[0]?.title ?? 'Attested Tradesperson',
          price: p.services[0]?.price ?? null,
          distanceKm: p.distance_km,
          verified: p.concordium_verified,
          avatarUrl: p.avatar_url,
          href: `/providers`,
        })
      }
    }

    if (activeFilter === 'all' || activeFilter === 'jobs') {
      const jobs = jobsQuery.data ?? []
      for (const j of jobs) {
        const lat =
          typeof j.latitude === 'number' && !isNaN(j.latitude)
            ? j.latitude
            : coordinates.latitude
        const lon =
          typeof j.longitude === 'number' && !isNaN(j.longitude)
            ? j.longitude
            : coordinates.longitude
        list.push({
          id: `job-${j.id}`,
          kind: 'job',
          latitude: lat,
          longitude: lon,
          title: j.title,
          subtitle: j.category_name ?? 'Community Task',
          price: j.price,
          distanceKm: j.distance_km,
          verified: false,
          avatarUrl: null,
          href: `/jobs/${j.id}`,
        })
      }
    }

    return list
  }, [
    activeFilter,
    providersQuery.data,
    jobsQuery.data,
    coordinates.latitude,
    coordinates.longitude,
  ])

  const thumbPercent = Math.min(Math.max(((dragRadius - 0.5) / (20 - 0.5)) * 100, 0), 100)
  const formattedRadius = dragRadius < 1 ? `${Math.round(dragRadius * 1000)}m` : `${dragRadius}km`

  const isLoading = providersQuery.isLoading || jobsQuery.isLoading

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-4">
      {/* 5. Minimal Header: 2 words heading, max 1 line secondary text, zero prose */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-line pb-4">
        <div>
          <h1 className="font-display text-4xl sm:text-5xl uppercase tracking-tight text-ink leading-none">
            Local Map
          </h1>
          <p className="mt-1 text-xs text-muted">Discovery within range</p>
        </div>

        {/* Legend: 3 words maximum ("Services / Jobs") */}
        <div className="flex items-center gap-3 text-xs font-mono font-bold text-ink">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-ink inline-block" />
            <span>Services</span>
          </span>
          <span className="text-muted">/</span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-accent inline-block" />
            <span>Jobs</span>
          </span>
        </div>
      </div>

      {/* Control Bar: Filter Tabs + Draggable Radius + Nearby Toggle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-xl border border-line bg-surface p-3 shadow-xs">
        {/* Filter Tabs: All / Services / Jobs */}
        <div className="inline-flex rounded-lg border border-line bg-surface p-1 shadow-xs">
          <button
            type="button"
            onClick={() => handleFilterChange('all')}
            className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              activeFilter === 'all'
                ? 'border border-structural bg-ink text-page shadow-xs'
                : 'text-muted hover:text-ink'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => handleFilterChange('services')}
            className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              activeFilter === 'services'
                ? 'border border-structural bg-ink text-page shadow-xs'
                : 'text-muted hover:text-ink'
            }`}
          >
            Services
          </button>
          <button
            type="button"
            onClick={() => handleFilterChange('jobs')}
            className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              activeFilter === 'jobs'
                ? 'border border-structural bg-ink text-page shadow-xs'
                : 'text-muted hover:text-ink'
            }`}
          >
            Jobs
          </button>
        </div>

        {/* Draggable Radius Slider (500m to 20km) */}
        <div className="flex-1 max-w-sm px-2">
          <div className="flex items-center justify-between text-[11px] font-mono text-muted mb-1">
            <span>RADIUS</span>
            <span className="font-bold text-ink">{formattedRadius}</span>
          </div>

          <div className="relative flex items-center">
            {/* Live Thumb Value Badge */}
            <div
              className="absolute -top-7 -translate-x-1/2 rounded-md border border-structural bg-ink px-1.5 py-0.5 font-mono text-[9px] font-bold text-page pointer-events-none shadow-xs"
              style={{ left: `${thumbPercent}%` }}
            >
              {formattedRadius}
            </div>

            <input
              type="range"
              min="0.5"
              max="20"
              step="0.5"
              value={dragRadius}
              onChange={handleSliderChange}
              onPointerUp={handleSliderRelease}
              onKeyUp={handleSliderRelease}
              onTouchEnd={handleSliderRelease}
              className="w-full accent-ink cursor-pointer h-2 bg-sunken rounded-lg appearance-none"
              aria-label="Filter radius in kilometers"
            />
          </div>
          <div className="flex justify-between text-[9px] font-mono text-muted mt-1">
            <span>500m</span>
            <span>20km</span>
          </div>
        </div>

        {/* Nearby Device Location Toggle */}
        <button
          type="button"
          disabled={isLocating}
          onClick={() => void handleNearbyToggle()}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors shadow-xs ${
            source === 'device'
              ? 'border-structural bg-ink text-page'
              : 'border-line bg-surface text-ink hover:bg-sunken'
          }`}
          title="Toggle current device location"
        >
          {isLocating ? (
            <RefreshCw size={14} className="animate-spin" />
          ) : (
            <Crosshair size={14} />
          )}
          <span>{source === 'device' ? 'Nearby Active' : 'Nearby'}</span>
        </button>
      </div>

      {/* Main Map Canvas */}
      <div
        data-tour="tour-map"
        className="overflow-hidden rounded-2xl border border-line shadow-xs"
      >
        <NeighborhoodMap
          center={coordinates}
          radiusKm={dragRadius}
          points={points}
          loading={isLoading}
          height="calc(100vh - 250px)"
        />
      </div>

      {/* Mini Stats Bar */}
      <div className="flex items-center justify-between text-xs font-mono text-muted px-1">
        <span>
          {points.length} {activeFilter === 'jobs' ? 'JOBS' : activeFilter === 'services' ? 'SERVICES' : 'NODES'} IN {formattedRadius.toUpperCase()}
        </span>
        <span>
          LAT {coordinates?.latitude != null ? coordinates.latitude.toFixed(4) : '6.5244'} // LON {coordinates?.longitude != null ? coordinates.longitude.toFixed(4) : '3.3792'}
        </span>
      </div>
    </div>
  )
}
