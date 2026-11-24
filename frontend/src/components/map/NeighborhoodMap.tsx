/**
 * The neighbourhood map.
 *
 * OpenStreetMap raster tiles styled with custom theme filters.
 *
 * Concordium is the spine:
 * - Every pin represents either an attested human provider or an active job.
 * - Verified providers display the Concordium cryptographic shield.
 * - Corner metadata explicitly states the radial coordinate index and attestation count.
 */

import 'leaflet/dist/leaflet.css'

import L from 'leaflet'
import { ShieldCheck } from 'lucide-react'
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
 * Editorial map pin.
 * Verified provider pins display a distinct Concordium verification seal.
 * Active selected pin utilizes the singular pink accent ring (#FC75B4).
 */
function createPinIcon(point: MapPoint, active: boolean): L.DivIcon {
  const isVerified = Boolean(point.verified)
  const isProvider = point.kind === 'provider'

  const borderStroke = active ? '#FC75B4' : isVerified ? '#474329' : '#7A7350'
  const bgFill = active ? '#FC75B4' : isVerified ? '#474329' : '#FAF4ED'
  const textFill = active ? '#1C1B12' : isVerified ? '#F0E5DB' : '#474329'
  const label = isProvider ? (isVerified ? 'ZK' : 'PROV') : 'JOB'

  const html = `
    <div class="animate-pin-drop ${active ? 'z-50' : ''}" style="position:relative;width:36px;height:48px;transform-origin:50% 100%;">
      <div style="
        position:absolute;
        top:0;
        left:0;
        width:36px;
        height:36px;
        border-radius:12px;
        background:${bgFill};
        border:2px solid ${borderStroke};
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        color:${textFill};
        font-family:monospace;
        font-size:10px;
        font-weight:700;
        letter-spacing:0.05em;
        box-shadow:0 2px 8px rgba(71,67,41,0.18);
      ">
        <span>${label}</span>
      </div>
      <div style="
        position:absolute;
        top:32px;
        left:50%;
        transform:translateX(-50%);
        width:0;
        height:0;
        border-left:7px solid transparent;
        border-right:7px solid transparent;
        border-top:12px solid ${borderStroke};
      "></div>
    </div>
  `

  return L.divIcon({
    className: 'proxid-editorial-marker',
    iconSize: [36, 48],
    iconAnchor: [18, 48],
    popupAnchor: [0, -44],
    html,
  })
}

function RecentreMap({ center }: { center: Coordinates }) {
  const map = useMap()
  useEffect(() => {
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
  height?: number
  onSelect?: (point: MapPoint) => void
}) {
  const { data: mapConfig } = useMapConfig()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const icons = useMemo(() => {
    const map = new Map<string, L.DivIcon>()
    for (const point of points) {
      map.set(point.id, createPinIcon(point, point.id === selectedId))
    }
    return map
  }, [points, selectedId])

  const tileUrl = mapConfig?.tile_url ?? FALLBACK_TILE
  const attribution = mapConfig?.attribution ?? FALLBACK_ATTRIBUTION

  const verifiedCount = points.filter((p) => p.verified).length

  return (
    <div
      className="relative isolate overflow-hidden rounded-2xl border border-line bg-surface"
      style={{ height }}
    >
      {/* Editorial Corner Metadata */}
      <div className="pointer-events-none absolute left-3 top-3 z-[500] flex flex-col gap-1 rounded-xl border border-line bg-surface/90 px-3 py-2 text-[10px] font-mono text-muted backdrop-blur">
        <span className="font-semibold text-ink uppercase tracking-wider">
          CONCORDIUM RADIAL GEO-INDEX
        </span>
        <span>
          LAT {center.latitude.toFixed(4)} // LON {center.longitude.toFixed(4)}
        </span>
      </div>

      <div className="pointer-events-none absolute right-3 top-3 z-[500] rounded-xl border border-line bg-surface/90 px-3 py-2 text-[10px] font-mono text-muted backdrop-blur">
        <span className="text-ink font-semibold">
          {verifiedCount} VERIFIED / {points.length} TOTAL
        </span>
      </div>

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

        {points.map((point) => (
          <Marker
            key={point.id}
            position={[point.latitude, point.longitude]}
            icon={icons.get(point.id) ?? createPinIcon(point, false)}
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
                      <ShieldCheck size={11} className="text-structural" />
                      ZK-ATTESTED
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
                      : 'Locating'}
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
                      Inspect Profile
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

      <div className="pointer-events-none absolute bottom-3 left-3 z-[500] rounded-lg border border-line bg-surface/95 px-2.5 py-1 text-[10px] font-mono text-muted backdrop-blur">
        RADIUS: {radiusKm > 0 ? `${radiusKm} KM` : 'ANY RANGE'}
      </div>
    </div>
  )
}
