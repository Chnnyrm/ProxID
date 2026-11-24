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
    <div className="rounded-2xl border border-line bg-surface p-4 sm:p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <Skeleton className="h-12 w-12 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4 rounded-lg" />
          <Skeleton className="h-3 w-1/2 rounded-md" />
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Skeleton className="h-6 w-28 rounded-lg" />
        <Skeleton className="h-6 w-16 rounded-lg" />
      </div>
      <div className="mt-4 space-y-2">
        <Skeleton className="h-3 w-full rounded-md" />
        <Skeleton className="h-3 w-4/5 rounded-md" />
      </div>
      <div className="mt-5 border-t border-line pt-3 flex justify-between items-center">
        <Skeleton className="h-4 w-20 rounded-md" />
        <Skeleton className="h-7 w-24 rounded-lg" />
      </div>
    </div>
  )
}

/** A list of card skeletons, for the browse and nearby pages. */
export function CardSkeletonList({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
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

/** Job detail placeholder. */
export function JobDetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <Skeleton className="h-8 w-3/4 rounded-lg" />
      <Skeleton className="h-4 w-1/3" />
      <div className="mt-6 rounded-2xl border border-line bg-surface p-6 space-y-4">
        <Skeleton className="h-5 w-40" />
        <TextSkeleton lines={4} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface p-5 space-y-3">
          <Skeleton className="h-4 w-32" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-5 space-y-3">
          <Skeleton className="h-4 w-32" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Job room placeholder. */
export function JobRoomSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-64 rounded-lg" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        <div className="rounded-2xl border border-line bg-surface p-5 space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-line">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-20 rounded-full" />
          </div>
          <div className="space-y-3 py-4">
            <Skeleton className="h-14 w-3/4 rounded-xl ml-auto" />
            <Skeleton className="h-14 w-2/3 rounded-xl" />
            <Skeleton className="h-12 w-4/5 rounded-xl ml-auto" />
          </div>
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-line bg-surface p-5 space-y-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
          <div className="rounded-2xl border border-line bg-surface p-5 space-y-3">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  )
}

/** Profile page placeholder. */
export function ProfileSkeleton() {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-line bg-surface p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-8 w-20 rounded-full" />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-6 space-y-4">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <TextSkeleton lines={3} />
      </div>

      <div className="rounded-2xl border border-line bg-surface p-6 space-y-3">
        <Skeleton className="h-5 w-32" />
        <div className="space-y-2 pt-2">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    </div>
  )
}
