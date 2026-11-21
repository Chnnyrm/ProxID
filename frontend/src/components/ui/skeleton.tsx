/**
 * Skeletons rather than spinners: a shape that becomes the content it is waiting for.
 * Every loading surface in the product uses these, so nothing on screen is static while
 * something is loading.
 */

import { cn } from '@/lib/cn'

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn('skeleton block', className)} />
}

/** A card-shaped placeholder, used while a list of jobs or providers loads. */
export function CardSkeleton() {
  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="mt-3 h-3 w-1/2" />
      <Skeleton className="mt-4 h-3 w-full" />
      <Skeleton className="mt-2 h-3 w-4/5" />
      <div className="mt-4 flex gap-2">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
    </div>
  )
}

/** A list of card skeletons, for the browse and nearby pages. */
export function CardSkeletonList({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: count }).map((_, index) => (
        <CardSkeleton key={index} />
      ))}
    </div>
  )
}

/** A text-line placeholder, for detail pages. */
export function TextSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton key={index} className={cn('h-3', index === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  )
}
