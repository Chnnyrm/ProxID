/**
 * SafeImage.tsx - Safe image loader with loading skeleton and cartoon fallback.
 *
 * Guarantees:
 * - Shows skeleton while loading.
 * - Smoothly transitions image in once loaded.
 * - Never shows a broken-image icon: if url is null/empty or load fails, renders fallback.
 * - Pure ASCII.
 */

import { useEffect, useState } from 'react'

import { Skeleton } from '@/components/ui/skeleton'

interface SafeImageProps {
  src?: string | null
  alt?: string
  className?: string
  fallback: React.ReactNode
  skeletonClassName?: string
  loading?: 'lazy' | 'eager'
}

export function SafeImage({
  src,
  alt = '',
  className = 'h-full w-full object-cover',
  fallback,
  skeletonClassName = 'h-full w-full',
  loading = 'lazy',
}: SafeImageProps) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>(() =>
    src ? 'loading' : 'error',
  )

  useEffect(() => {
    if (!src) {
      setStatus('error')
    } else {
      setStatus('loading')
    }
  }, [src])

  if (!src || status === 'error') {
    return (
      <div className="flex h-full w-full items-center justify-center bg-sunken">
        {fallback}
      </div>
    )
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      {status === 'loading' && (
        <Skeleton className={`absolute inset-0 z-10 ${skeletonClassName}`} />
      )}
      <img
        src={src}
        alt={alt}
        loading={loading}
        className={`${className} ${
          status === 'loaded' ? 'opacity-100' : 'opacity-0'
        } transition-opacity duration-200`}
        onLoad={() => setStatus('loaded')}
        onError={() => setStatus('error')}
      />
    </div>
  )
}
