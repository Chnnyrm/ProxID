/**
 * The neighbourhood map.
 *
 * OpenStreetMap raster tiles, no paid key. Two things make it belong in this product:
 *
 * 1. The tile URL and attribution come from the backend, so a deployment can change them
 *    without a rebuild.
 * 2. The tiles are filtered per theme, so a mocha page does not contain a glowing white
 *    rectangle. The filter lives in index.css under `.map-tiles`.
 *
 * Pins are drawn as divIcons rather than Leaflet's default images, because the default
 * icon path breaks under a bundler and because a pin has to carry the verified state.
 */

import 'leaflet/dist/leaflet.css'

import L from 'leaflet'
import { useEffect, useMemo, useState } from 'react'
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'

import { VerifiedBadge } from '@/components/VerifiedBadge'
import { Skeleton } from '@/components/ui/skeleton'
import { useMapConfig } from '@/hooks/useProviders'
import { distance as formatDistance, money } from '@/lib/format'
import type { Coordinates } from '@/lib/contracts'

export interface MapPoint {
  id: string
  kind: 'job' | 'provider'
  latitude: number
  longitude: number
  title: string
  subtitle?: string | null
  price?: number | null
  distanceKm?: number | null
  verified?: boolean
  isDemo?: boolean
  href?: string
}

const FALLBACK_TILE = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const FALLBACK_ATTRIBUTION = 'OpenStreetMap contributors'

/**
 * A pin built from HTML: a round head on the coordinate with a triangular point.
 *
 * Verified pins are pink; unverified pins are mocha. The shape is the same so the colour
 * is the only difference, and the colour is backed by the badge inside the popup: colour
 * is never the only carrier of meaning.
 */
function pinIcon(point: MapPoint, active: boolean): L.DivIcon {
  const fill = point.verified ? 'var(--accent)' : 'var(--text)'
  const glyphColor = point.verified ? 'var(--accent-ink)' : 'var(--surface)'
  const glyph = point.kind === 'job' ? 'J' : 'P'
  return L.divIcon({
    className: '',
    iconSize: [30, 40],
    iconAnchor: [15, 40],
    popupAnchor: [0, -36],
    html: `
      <div class="animate-pin-drop ${active ? 'pin-active' : ''}" style="position:relative;width:30px;height:40px;transform-origin:50% 100%;">
        <div style="position:absolute;top:0;left:0;width:30px;height:30px;border-radius:9999px;background:${fill};border:2px solid var(--surface);display:flex;align-items:center;justify-content:center;color:${glyphColor};font-size:12px;font-weight:600;box-shadow:0 1px 3px rgb(0 0 0 / 0.28);">${glyph}</div>
        <div style="position:absolute;top:26px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:10px solid ${fill};"></div>
      </div>`,
  })
}

/** Re-centres only when the target actually changes, so a theme toggle cannot pan the map. */
function Recentre({ center }: { center: Coordinates }) {
  const map = useMap()
  useEffect(() => {
    map.setView([center.latitude, center.longitude], map.getZoom(), { animate: false })
  }, [map, center.latitude, center.longitude])
  return null
}

/** Keeps the selected pin clear when the person clicks the map. */
function ClearOnMapClick({ onClear }: { onClear: () => void }) {
  useMapEvents({ click: () => onClear() })
  return null
}

export function NeighborhoodMap({
  center,
  radiusKm,
  points,
  loading,
  height = 420,
  onSelect,
}: {
  center: Coordinates
  radiusKm: number
  points: MapPoint[]
  loading: boolean
  height?: number
  onSelect?: (point: MapPoint) => void
}) {
  const { data: mapConfig } = useMapConfig()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const icons = useMemo(() => {
    const map = new Map<string, L.DivIcon>()
    for (const point of points) {
      map.set(point.id, pinIcon(point, point.id === selectedId))
    }
    return map
  }, [points, selectedId])

  const tileUrl = mapConfig?.tile_url ?? FALLBACK_TILE
  const attribution = mapConfig?.attribution ?? FALLBACK_ATTRIBUTION

  return (
    <div className="map-shell relative isolate overflow-hidden rounded-card border border-line" style={{ height }}>
      {loading ? (
        <div className="absolute inset-0 z-[500] flex flex-col justify-end gap-2 p-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-10 w-2/3" />
        </div>
      ) : null}

      <MapContainer
        center={[center.latitude, center.longitude]}
        zoom={14}
        // Scrolling the page must not be hijacked by the map.
        scrollWheelZoom={false}
        className="h-full w-full"
        attributionControl
      >
        <TileLayer url={tileUrl} attribution={attribution} className="map-tiles" />
        <Recentre center={center} />
        <ClearOnMapClick onClear={() => setSelectedId(null)} />

        {radiusKm > 0 ? (
          <Circle
            center={[center.latitude, center.longitude]}
            radius={radiusKm * 1000}
            pathOptions={{
              color: 'var(--accent)',
              weight: 1.5,
              fillColor: 'var(--accent)',
              fillOpacity: 0.08,
            }}
          />
        ) : null}

        {points.map((point) => (
          <Marker
            key={point.id}
            position={[point.latitude, point.longitude]}
            icon={icons.get(point.id) ?? pinIcon(point, false)}
            eventHandlers={{
              click: () => {
                setSelectedId(point.id)
                onSelect?.(point)
              },
            }}
          >
            <Popup>
              <div className="min-w-[160px]">
                <p className="text-sm font-semibold text-ink">{point.title}</p>
                {point.subtitle ? <p className="mt-0.5 text-xs text-muted">{point.subtitle}</p> : null}
                <p className="mt-1 text-xs text-muted">
                  {point.distanceKm !== null && point.distanceKm !== undefined
                    ? formatDistance(point.distanceKm)
                    : 'Distance unknown'}
                  {point.price !== null && point.price !== undefined ? ` - ${money(point.price)}` : ''}
                </p>
                <div className="mt-1.5">
                  <VerifiedBadge verified={Boolean(point.verified)} />
                </div>
                {point.href ? (
                  <a className="mt-2 inline-block text-xs font-medium text-ink underline" href={point.href}>
                    Open
                  </a>
                ) : null}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <div className="pointer-events-none absolute bottom-2 left-2 z-[500] rounded-full border border-line bg-surface/95 px-2 py-1 text-[10px] font-medium text-muted">
        {points.length} on the map
      </div>
    </div>
  )
}
