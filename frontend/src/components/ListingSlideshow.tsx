/**
 * ListingSlideshow.tsx
 *
 * Compact image slideshow for ServiceCard, JobCard, and profile listings:
 * - Swipeable on touch.
 * - Desktop hover chevron arrows.
 * - Dot indicators when multiple images exist.
 * - Single image behaves as static image (no arrows, no dots).
 * - Aspect ratio strictly reserved to avoid layout shift.
 * - Lazy loading for off-screen images.
 * - Pure ASCII.
 */

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState, useRef } from 'react'

import { SafeImage } from '@/components/SafeImage'

interface ListingSlideshowProps {
  images: string[]
  title: string
  aspectRatioClass?: string
  fallback?: React.ReactNode
  onImageClick?: (url: string, index: number) => void
  className?: string
}

export function ListingSlideshow({
  images,
  title,
  aspectRatioClass = 'aspect-video',
  fallback,
  onImageClick,
  className = '',
}: ListingSlideshowProps) {
  const validImages = (images || []).filter(Boolean)
  const [currentIndex, setCurrentIndex] = useState(0)
  const touchStartXRef = useRef<number | null>(null)

  const hasMultiple = validImages.length > 1
  const currentImage = validImages[currentIndex] || validImages[0]

  const handlePrev = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setCurrentIndex((prev) => (prev === 0 ? validImages.length - 1 : prev - 1))
  }

  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setCurrentIndex((prev) => (prev === validImages.length - 1 ? 0 : prev + 1))
  }

  const handleDotClick = (e: React.MouseEvent, index: number) => {
    e.preventDefault()
    e.stopPropagation()
    setCurrentIndex(index)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || !hasMultiple) return
    const touchEndX = e.changedTouches[0].clientX
    const diff = touchEndX - touchStartXRef.current
    touchStartXRef.current = null

    if (diff > 40) {
      // Swiped right -> go to previous
      setCurrentIndex((prev) => (prev === 0 ? validImages.length - 1 : prev - 1))
    } else if (diff < -40) {
      // Swiped left -> go to next
      setCurrentIndex((prev) => (prev === validImages.length - 1 ? 0 : prev + 1))
    }
  }

  const handleClickImage = (e: React.MouseEvent) => {
    if (currentImage && onImageClick) {
      e.preventDefault()
      e.stopPropagation()
      onImageClick(currentImage, currentIndex)
    }
  }

  if (validImages.length === 0) {
    return (
      <div
        className={`relative ${aspectRatioClass} w-full bg-sunken overflow-hidden flex items-center justify-center ${className}`}
      >
        {fallback}
      </div>
    )
  }

  return (
    <div
      className={`group/slideshow relative ${aspectRatioClass} w-full bg-sunken overflow-hidden select-none ${className}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={handleClickImage}
      data-testid="listing-slideshow"
    >
      <SafeImage
        src={currentImage}
        alt={`${title} (photo ${currentIndex + 1})`}
        className="h-full w-full object-cover transition-all duration-200"
        fallback={fallback}
        skeletonClassName={`${aspectRatioClass} w-full`}
      />

      {/* Multiple images controls */}
      {hasMultiple && (
        <>
          {/* Desktop Hover Arrows */}
          <button
            type="button"
            onClick={handlePrev}
            className="absolute left-1.5 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-ink/75 hover:bg-ink text-page flex items-center justify-center opacity-0 group-hover/slideshow:opacity-100 transition-opacity z-10 shadow-xs"
            aria-label="Previous photo"
            data-testid="slideshow-prev"
          >
            <ChevronLeft size={16} />
          </button>

          <button
            type="button"
            onClick={handleNext}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-ink/75 hover:bg-ink text-page flex items-center justify-center opacity-0 group-hover/slideshow:opacity-100 transition-opacity z-10 shadow-xs"
            aria-label="Next photo"
            data-testid="slideshow-next"
          >
            <ChevronRight size={16} />
          </button>

          {/* Dot Indicators */}
          <div
            className="absolute bottom-2 inset-x-0 flex items-center justify-center gap-1.5 z-10 pointer-events-auto"
            data-testid="slideshow-dots"
          >
            {validImages.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={(e) => handleDotClick(e, idx)}
                className={`h-1.5 rounded-full transition-all duration-150 ${
                  idx === currentIndex
                    ? 'w-4 bg-page ring-1 ring-ink/30 shadow-xs'
                    : 'w-1.5 bg-page/60 hover:bg-page'
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>

          {/* Image counter badge */}
          <div className="absolute top-2 right-2 rounded-md bg-ink/70 backdrop-blur-2xs px-1.5 py-0.5 font-mono text-[9px] text-page font-bold shadow-xs">
            {currentIndex + 1}/{validImages.length}
          </div>
        </>
      )}
    </div>
  )
}
