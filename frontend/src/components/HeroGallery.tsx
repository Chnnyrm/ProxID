/**
 * HeroGallery.tsx
 *
 * Hero image gallery with thumbnail strip and lightbox integration:
 * - Dedicated for /services/:id and /jobs/:id detail pages.
 * - Large main image with reserved aspect ratio.
 * - Thumbnail strip below with active selection ring.
 * - Click on main image opens ImageLightboxModal with download control.
 * - Single image shows no arrows and no thumbnails.
 * - Pure ASCII.
 */

import { ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react'
import { useState } from 'react'

import { SafeImage } from '@/components/SafeImage'
import { useLightboxStore } from '@/store/lightboxStore'

interface HeroGalleryProps {
  images: string[]
  title: string
  aspectRatioClass?: string
  fallback?: React.ReactNode
}

export function HeroGallery({
  images,
  title,
  aspectRatioClass = 'aspect-video sm:aspect-[16/9] max-h-[420px]',
  fallback,
}: HeroGalleryProps) {
  const validImages = (images || []).filter(Boolean)
  const [activeIndex, setActiveIndex] = useState(0)
  const openLightbox = useLightboxStore((state) => state.openLightbox)

  const hasMultiple = validImages.length > 1
  const currentImage = validImages[activeIndex] || validImages[0]

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation()
    setActiveIndex((prev) => (prev === 0 ? validImages.length - 1 : prev - 1))
  }

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation()
    setActiveIndex((prev) => (prev === validImages.length - 1 ? 0 : prev + 1))
  }

  const handleMainClick = () => {
    if (currentImage) {
      openLightbox(currentImage, `${title} - Image ${activeIndex + 1}`)
    }
  }

  if (validImages.length === 0) {
    return (
      <div
        className={`relative ${aspectRatioClass} w-full rounded-2xl border border-line bg-sunken overflow-hidden flex items-center justify-center`}
      >
        {fallback}
      </div>
    )
  }

  return (
    <div className="space-y-3" data-testid="hero-gallery">
      {/* Main Large Display Image */}
      <div
        className={`relative ${aspectRatioClass} w-full rounded-2xl border border-line bg-sunken overflow-hidden shadow-sm cursor-pointer group select-none`}
        onClick={handleMainClick}
        title="Click to expand full image and download"
      >
        <SafeImage
          src={currentImage}
          alt={`${title} - Photo ${activeIndex + 1}`}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          fallback={fallback}
          skeletonClassName={`${aspectRatioClass} w-full`}
        />

        {/* Hover Expand Badge */}
        <div className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-lg border border-line/40 bg-ink/75 px-2.5 py-1 text-[11px] font-mono text-page backdrop-blur-xs shadow-xs">
          <Maximize2 size={12} />
          <span>Click to expand</span>
        </div>

        {/* Navigation Arrows for Multiple Images */}
        {hasMultiple && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              className="absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-ink/75 hover:bg-ink text-page flex items-center justify-center shadow-md transition-all hover:scale-105 z-10"
              aria-label="Previous image"
              data-testid="hero-gallery-prev"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-ink/75 hover:bg-ink text-page flex items-center justify-center shadow-md transition-all hover:scale-105 z-10"
              aria-label="Next image"
              data-testid="hero-gallery-next"
            >
              <ChevronRight size={20} />
            </button>

            {/* Counter */}
            <div className="absolute top-3 right-3 rounded-md bg-ink/75 backdrop-blur-xs px-2 py-0.5 font-mono text-xs text-page font-bold shadow-xs">
              {activeIndex + 1} / {validImages.length}
            </div>
          </>
        )}
      </div>

      {/* Thumbnails Strip (Shown only if > 1 image) */}
      {hasMultiple && (
        <div
          className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-thin"
          data-testid="hero-gallery-thumbnails"
        >
          {validImages.map((url, idx) => (
            <button
              key={url}
              type="button"
              onClick={() => setActiveIndex(idx)}
              className={`relative h-16 w-20 shrink-0 rounded-xl overflow-hidden border transition-all duration-150 ${
                idx === activeIndex
                  ? 'border-transparent ring-2 ring-ink scale-102 shadow-sm'
                  : 'border-line opacity-60 hover:opacity-100'
              }`}
              title={`View image ${idx + 1}`}
            >
              <img
                src={url}
                alt={`Thumbnail ${idx + 1}`}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
