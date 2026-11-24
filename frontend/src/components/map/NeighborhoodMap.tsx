/**
 * The neighbourhood map.
 *
 * OpenStreetMap raster tiles styled with custom theme filters.
 *
 * Requirements:
 * - Circular avatar inside each pin with the marker tail.
 * - If provider has no avatar, a cartoon face.
 * - Verified providers display the official Concordium mark from /brands/concordium.svg.
 * - Service pins use Ink (#474329); Job pins use Accent (#FC75B4).
 * - Radially destacks overlapping points.
 * - Pure ASCII.
 */

import 'leaflet/dist/leaflet.css'

import L from 'leaflet'
import { useEffect, useMemo, useState } from 'react'
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'

import { Skeleton } from '@/components/ui/skeleton'
import { useMapConfig } from '@/hooks/useProviders'
import { distance as formatDistance, money } from '@/lib/format'
import { createPinIcon } from '@/lib/mapPins'
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
  avatarUrl?: string | null
  href?: string
}

const FALLBACK_TILE = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const FALLBACK_ATTRIBUTION = 'OpenStreetMap contributors'

/** Offset overlapping pins on a radial circle so all pins are distinguishable and clickable. */
function destackPoints(rawPoints: MapPoint[]): MapPoint[] {
  const coordMap = new Map<string, MapPoint[]>()
  for (const point of rawPoints) {
    const key = `${point.latitude.toFixed(4)},${point.longitude.toFixed(4)}`
    if (!coordMap.has(key)) coordMap.set(key, [])
    coordMap.get(key)!.push(point)
  }

  const result: MapPoint[] = []
  for (const group of coordMap.values()) {
    if (group.length === 1) {
      result.push(group[0])
    } else {
      const radiusDeg = 0.0016
      group.forEach((pt, idx) => {
        const angle = (idx * 2 * Math.PI) / group.length
        const cosLat = Math.cos((pt.latitude * Math.PI) / 180) || 1
        result.push({
          ...pt,
          latitude: pt.latitude + Math.sin(angle) * radiusDeg,
          longitude: pt.longitude + (Math.cos(angle) * radiusDeg) / cosLat,
        })
      })
    }
  }
  return result
}

function InvalidateOnMount() {
  const map = useMap()
  useEffect(() => {
    map.invalidateSize()
    const timer = setTimeout(() => {
      map.invalidateSize()
    }, 150)
    return () => clearTimeout(timer)
  }, [map])
  return null
}

function RecentreMap({ center }: { center: Coordinates }) {
  const map = useMap()
  useEffect(() => {
    map.invalidateSize()
    map.setView([center.latitude, center.longitude], map.getZoom(), { animate: false })
  }, [map, center.latitude, center.longitude])
  return null
}

function ClearOnMapClick({ onClear }: { onClear: () => void }) {
  useMapEvents({ click: () => onClear() })
  return null
}

export function NeighborhoodMap({
  center,
  radiusKm,
  points,
  loading,
  height = 480,
  onSelect,
}: {
  center: Coordinates
  radiusKm: number
  points: MapPoint[]
  loading: boolean
  height?: number | string
  onSelect?: (point: MapPoint) => void
}) {
  const { data: mapConfig } = useMapConfig()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const destackedPoints = useMemo(() => destackPoints(points), [points])

  const icons = useMemo(() => {
    const map = new Map<string, L.DivIcon>()
    for (const point of destackedPoints) {
      map.set(
        point.id,
        createPinIcon(
          {
            id: point.id,
            kind: point.kind,
            title: point.title,
            price: point.price,
            avatarUrl: point.avatarUrl,
            verified: point.verified,
          },
          point.id === selectedId,
        ),
      )
    }
    return map
  }, [destackedPoints, selectedId])

  const tileUrl = mapConfig?.tile_url ?? FALLBACK_TILE
  const attribution = mapConfig?.attribution ?? FALLBACK_ATTRIBUTION

  return (
    <div
      className="relative isolate overflow-hidden rounded-2xl border border-line bg-surface"
      style={{ height }}
    >
      {loading ? (
        <div className="absolute inset-0 z-[500] flex flex-col justify-end gap-3 p-6 bg-surface/60 backdrop-blur-sm">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-8 w-1/3 rounded-lg" />
        </div>
      ) : null}

      <MapContainer
        center={[center.latitude, center.longitude]}
        zoom={14}
        scrollWheelZoom={false}
        className="h-full w-full"
        attributionControl
      >
        <TileLayer url={tileUrl} attribution={attribution} className="map-tiles" />
        <InvalidateOnMount />
        <RecentreMap center={center} />
        <ClearOnMapClick onClear={() => setSelectedId(null)} />

        {radiusKm > 0 ? (
          <Circle
            center={[center.latitude, center.longitude]}
            radius={radiusKm * 1000}
            pathOptions={{
              color: '#474329',
              weight: 1.5,
              dashArray: '4, 4',
              fillColor: '#474329',
              fillOpacity: 0.05,
            }}
          />
        ) : null}

        {destackedPoints.map((point) => (
          <Marker
            key={point.id}
            position={[point.latitude, point.longitude]}
            icon={
              icons.get(point.id) ??
              createPinIcon(
                {
                  id: point.id,
                  kind: point.kind,
                  title: point.title,
                  price: point.price,
                  avatarUrl: point.avatarUrl,
                  verified: point.verified,
                },
                false,
              )
            }
            eventHandlers={{
              click: () => {
                setSelectedId(point.id)
                onSelect?.(point)
              },
            }}
          >
            <Popup className="proxid-editorial-popup">
              <div className="min-w-[190px] p-1 text-ink font-sans">
                <div className="flex items-center justify-between gap-2 border-b border-line pb-1.5">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-muted">
                    {point.kind === 'provider' ? 'Provider Node' : 'Job Listing'}
                  </span>
                  {point.verified && (
                    <span className="flex items-center gap-1 font-mono text-[9px] text-ink font-bold">
                      <img
                        src="/brands/concordium.svg"
                        className="h-3 w-3 inline-block"
                        alt="Concordium"
                      />
                      CONCORDIUM ATTESTED
                    </span>
                  )}
                </div>

                <p className="mt-2 text-sm font-semibold text-ink leading-tight">{point.title}</p>
                {point.subtitle ? (
                  <p className="mt-0.5 text-xs text-muted leading-tight">{point.subtitle}</p>
                ) : null}

                <div className="mt-2 flex items-center justify-between text-xs text-muted font-mono">
                  <span>
                    {point.distanceKm !== null && point.distanceKm !== undefined
                      ? formatDistance(point.distanceKm)
                      : 'Local'}
                  </span>
                  {point.price !== null && point.price !== undefined ? (
                    <span className="font-bold text-ink">{money(point.price)}</span>
                  ) : null}
                </div>

                <div className="mt-2.5 pt-1.5 border-t border-line">
                  {point.href ? (
                    <a
                      href={point.href}
                      className="inline-block w-full text-center rounded-lg border border-structural bg-surface py-1 text-xs font-semibold text-ink hover:bg-sunken transition-colors"
                    >
                      {point.kind === 'provider' ? 'View Profile' : 'Inspect Job'}
                    </a>
                  ) : (
                    <div className="text-[10px] text-muted font-mono text-center">
                      Verified On Concordium
                    </div>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
