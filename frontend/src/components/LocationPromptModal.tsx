/**
 * Location Detection and Setup Modal.
 *
 * Prompts authenticated users who do not have coordinates set:
 * - Clear explanation: "ProxID connects you with verified providers and jobs nearby."
 * - One-tap geolocation request with reverse geocoding to neighbourhood.
 * - Draggable pin fallback if geolocation is declined or unavailable.
 * - Pure ASCII only.
 */

import { Check, Crosshair, MapPin, Navigation as NavIcon, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { MapContainer, Marker, TileLayer } from 'react-leaflet'
import L from 'leaflet'

import { HouseIllustration } from '@/components/illustrations/CartoonIllustrations'
import { createPinIcon } from '@/lib/mapPins'
import { useAuthStore } from '@/store/authStore'
import { useLocationStore } from '@/store/locationStore'
import { useTourStore } from '@/store/tourStore'

const PROMPT_DISMISSED_KEY = 'proxid-location-prompt-dismissed'
const DEFAULT_CENTER = { latitude: 6.5095, longitude: 3.3711 }

export function LocationPromptModal() {
  const user = useAuthStore((state) => state.user)
  const isSignedIn = useAuthStore((state) => state.status) === 'signed-in'
  const updateProfile = useAuthStore((state) => state.updateProfile)
  const setCoordinates = useLocationStore((state) => state.setCoordinates)
  const isTourActive = useTourStore((state) => state.isTourActive)

  const [isOpen, setIsOpen] = useState(false)
  const [mode, setMode] = useState<'prompt' | 'map'>('prompt')
  const [isDetecting, setIsDetecting] = useState(false)
  const [detectError, setDetectError] = useState<string | null>(null)
  const [pinPosition, setPinPosition] = useState<{ latitude: number; longitude: number }>(DEFAULT_CENTER)
  const [isSaving, setIsSaving] = useState(false)

  const markerRef = useRef<L.Marker | null>(null)

  useEffect(() => {
    if (!isSignedIn || !user) {
      setIsOpen(false)
      return
    }

    // If user already has coordinates in account
    if (typeof user.latitude === 'number' && typeof user.longitude === 'number') {
      // Ensure location store has their stored coordinates
      const currentLoc = useLocationStore.getState().coordinates
      if (currentLoc.latitude !== user.latitude || currentLoc.longitude !== user.longitude) {
        setCoordinates({ latitude: user.latitude, longitude: user.longitude }, 'stored')
      }
      setIsOpen(false)
      return
    }

    // Check if dismissed in this session
    const dismissed = sessionStorage.getItem(PROMPT_DISMISSED_KEY)
    if (!dismissed) {
      setIsOpen(true)
    }
  }, [isSignedIn, user, setCoordinates])

  const handleDismiss = () => {
    sessionStorage.setItem(PROMPT_DISMISSED_KEY, 'true')
    setIsOpen(false)
  }

  const reverseGeocode = async (lat: number, lon: number): Promise<string> => {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3500)
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=14&addressdetails=1`,
        { signal: controller.signal }
      )
      clearTimeout(timeoutId)
      if (res.ok) {
        const data = await res.json()
        const addr = data.address || {}
        const neighbourhood =
          addr.suburb ||
          addr.neighbourhood ||
          addr.city_district ||
          addr.quarter ||
          addr.town ||
          addr.city ||
          addr.county ||
          'Nearby'
        return String(neighbourhood).trim()
      }
    } catch {
      // Fallback
    }
    return `Location (${lat.toFixed(2)}, ${lon.toFixed(2)})`
  }

  const handleRequestLocation = async () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setDetectError('Geolocation is not supported by your browser. Please choose your location on the map.')
      setMode('map')
      return
    }

    setIsDetecting(true)
    setDetectError(null)

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude
        const lon = pos.coords.longitude
        setIsDetecting(false)

        try {
          const neighbourhood = await reverseGeocode(lat, lon)
          await updateProfile({ latitude: lat, longitude: lon, neighbourhood })
          setCoordinates({ latitude: lat, longitude: lon }, 'device')
          sessionStorage.setItem(PROMPT_DISMISSED_KEY, 'true')
          setIsOpen(false)
        } catch {
          setCoordinates({ latitude: lat, longitude: lon }, 'device')
          setIsOpen(false)
        }
      },
      () => {
        setIsDetecting(false)
        setDetectError('Location access was denied or unavailable. Please drag the pin on the map below.')
        setMode('map')
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    )
  }

  const handleConfirmPinLocation = async () => {
    setIsSaving(true)
    try {
      const neighbourhood = await reverseGeocode(pinPosition.latitude, pinPosition.longitude)
      await updateProfile({
        latitude: pinPosition.latitude,
        longitude: pinPosition.longitude,
        neighbourhood
      })
      setCoordinates(pinPosition, 'stored')
      sessionStorage.setItem(PROMPT_DISMISSED_KEY, 'true')
      setIsOpen(false)
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen || isTourActive) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="location-modal-title"
      className="fixed inset-0 z-[740] flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs animate-fade-rise"
    >
      <div className="card w-full max-w-md bg-surface border-2 border-structural shadow-xl overflow-hidden relative">
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-muted hover:text-ink p-1 rounded-lg z-10"
          aria-label="Skip location setup"
        >
          <X size={18} />
        </button>

        {mode === 'prompt' ? (
          <div className="p-6 flex flex-col items-center text-center">
            <HouseIllustration size={64} className="w-16 h-16 mb-2" />
            <h3 id="location-modal-title" className="font-display text-lg uppercase tracking-wider text-ink font-bold">
              Where are you located?
            </h3>
            <p className="mt-2 text-xs sm:text-sm text-muted leading-relaxed max-w-sm">
              ProxID uses your location to discover verified providers and local jobs nearby.
              We never share your raw coordinates publicly.
            </p>

            {detectError && (
              <p className="mt-3 p-2 text-xs text-ink bg-accent/15 border border-line rounded-lg text-left">
                {detectError}
              </p>
            )}

            <div className="mt-6 flex flex-col w-full gap-2.5">
              <button
                type="button"
                disabled={isDetecting}
                onClick={() => void handleRequestLocation()}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-accent-ink font-semibold text-sm border border-structural shadow-xs hover:brightness-105 active:scale-95 transition-all disabled:opacity-50"
              >
                <Crosshair size={16} />
                <span>{isDetecting ? 'Detecting your coordinates...' : 'Detect My Location'}</span>
              </button>

              <button
                type="button"
                onClick={() => setMode('map')}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-page text-ink font-semibold text-sm border border-line hover:border-structural transition-all"
              >
                <MapPin size={16} />
                <span>Choose on Map</span>
              </button>

              <button
                type="button"
                onClick={handleDismiss}
                className="mt-1 text-xs text-muted hover:text-ink transition-colors"
              >
                Skip for now
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 sm:p-5 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 id="location-modal-title" className="font-display text-base uppercase tracking-wider text-ink font-bold">
                  Pin Your Location
                </h3>
                <p className="text-xs text-muted">
                  Drag the pin on the map to set your neighbourhood.
                </p>
              </div>
            </div>

            <div className="w-full h-60 rounded-xl overflow-hidden border border-line relative">
              <MapContainer
                center={[pinPosition.latitude, pinPosition.longitude]}
                zoom={13}
                scrollWheelZoom={false}
                className="w-full h-full"
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution="OpenStreetMap contributors"
                />
                <Marker
                  position={[pinPosition.latitude, pinPosition.longitude]}
                  draggable={true}
                  ref={markerRef}
                  eventHandlers={{
                    dragend() {
                      const marker = markerRef.current
                      if (marker) {
                        const latLng = marker.getLatLng()
                        setPinPosition({ latitude: latLng.lat, longitude: latLng.lng })
                      }
                    },
                  }}
                  icon={createPinIcon({ id: 'my-pin', kind: 'provider', title: 'My Location' }, true)}
                />
              </MapContainer>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setMode('prompt')}
                className="px-3 py-2 text-xs text-muted hover:text-ink"
              >
                Back
              </button>

              <button
                type="button"
                disabled={isSaving}
                onClick={() => void handleConfirmPinLocation()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-accent-ink font-semibold text-xs border border-structural shadow-xs hover:brightness-105 active:scale-95 transition-all disabled:opacity-50"
              >
                <Check size={14} />
                <span>{isSaving ? 'Saving...' : 'Save This Location'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
