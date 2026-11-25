/**
 * ImageLightboxModal.tsx - Fullscreen image lightbox modal with Cloudinary download.
 *
 * Requirements:
 * - Opens on image or avatar click.
 * - Displays image large and centered.
 * - Download control fetches image and saves to user's device with sensible filename.
 * - Closes on Escape key and clicking backdrop.
 * - Pure ASCII.
 */

import { Download, Loader2, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import { useLightboxStore } from '@/store/lightboxStore'

export function ImageLightboxModal() {
  const { isOpen, imageUrl, title, closeLightbox } = useLightboxStore()
  const [isDownloading, setIsDownloading] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeLightbox()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, closeLightbox])

  if (!isOpen || !imageUrl) return null

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!imageUrl) return
    setIsDownloading(true)
    try {
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      const clean = (title || 'proxid-image')
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '_')
        .replace(/_+/g, '_')
        .slice(0, 50)
      a.download = `${clean || 'proxid-asset'}.png`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(blobUrl)
      document.body.removeChild(a)
    } catch {
      window.open(imageUrl, '_blank')
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Image Lightbox'}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 backdrop-blur-xs p-4 sm:p-6 animate-fade-in"
      onClick={closeLightbox}
      data-testid="lightbox-modal"
    >
      <div
        className="relative max-h-[90vh] max-w-[92vw] flex flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Control Bar */}
        <div className="flex w-full items-center justify-between gap-4 px-2 text-page">
          <span className="truncate font-mono text-xs text-page/90 max-w-[70vw]">
            {title || 'Image Preview'}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDownload}
              disabled={isDownloading}
              data-testid="lightbox-download"
              className="inline-flex items-center gap-1.5 rounded-lg border border-line/40 bg-ink px-3 py-1.5 text-xs font-mono font-bold text-page hover:bg-page hover:text-ink transition-colors shadow-sm"
              title="Download image"
            >
              {isDownloading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Download size={14} />
              )}
              <span>{isDownloading ? 'Saving...' : 'Download'}</span>
            </button>
            <button
              type="button"
              onClick={closeLightbox}
              data-testid="lightbox-close"
              className="rounded-lg border border-line/40 bg-ink p-1.5 text-page hover:bg-page hover:text-ink transition-colors shadow-sm"
              aria-label="Close lightbox"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Image Display */}
        <div className="relative rounded-2xl overflow-hidden border border-line/30 bg-surface shadow-2xl max-h-[80vh] flex items-center justify-center">
          <img
            src={imageUrl}
            alt={title || 'Image'}
            className="max-h-[78vh] max-w-[88vw] object-contain select-none"
          />
        </div>
      </div>
    </div>
  )
}
