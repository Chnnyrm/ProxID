/**
 * JobsPage.tsx
 *
 * Jobs: browse nearby work, filter by category and search, view your posted work,
 * and post new requests with category attribution.
 *
 * Matches Gigr list patterns: responsive, skeletons, empty states, instant feedback.
 */

import { Briefcase, Clock, Filter, Map as MapIcon, MapPin, Plus, Search, SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { JobCard } from '@/components/JobCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { TextAreaField, TextField } from '@/components/ui/input'
import { CardSkeletonList } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/useAuth'
import { useBrowseJobs, useMyJobs, useNearbyJobs, usePostJob } from '@/hooks/useJobs'
import { useCategories } from '@/hooks/useProviders'
import { money } from '@/lib/format'
import { RADIUS_CHOICES, useLocationStore } from '@/store/locationStore'
import type { Job } from '@/types/api'

type Tab = 'nearby' | 'browse' | 'mine'
type SortOrder = 'newest' | 'price_high' | 'price_low'

export function JobsPage() {
  const { isSignedIn } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>('nearby')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest')
  const [showForm, setShowForm] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  // Auto-open compose form if navigating with ?compose=1 (PWA shortcut)
  useEffect(() => {
    if (searchParams.get('compose') === '1') {
      if (!isSignedIn) {
        window.dispatchEvent(
          new CustomEvent('proxid-require-auth', {
            detail: { action: 'post a job' },
          })
        )
      } else {
        setShowForm(true)
      }
      searchParams.delete('compose')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams, isSignedIn])

  const coordinates = useLocationStore((state) => state.coordinates)
  const radiusKm = useLocationStore((state) => state.radiusKm)
  const setRadiusKm = useLocationStore((state) => state.setRadiusKm)
  const source = useLocationStore((state) => state.source)
  const requestDeviceLocation = useLocationStore((state) => state.requestDeviceLocation)

  const nearby = useNearbyJobs()
  const browse = useBrowseJobs()
  const mine = useMyJobs(isSignedIn)
  const { data: categories = [] } = useCategories()

  const currentQuery = tab === 'nearby' ? nearby : tab === 'browse' ? browse : mine
  const rawJobs: Job[] = currentQuery.data ?? []

  // Filter and sort jobs locally for instant response
  const processedJobs = useMemo(() => {
    let list = [...rawJobs]

    // Category filter
    if (selectedCategory !== 'all') {
      list = list.filter((j) => j.category_id === selectedCategory || j.category_name?.toLowerCase() === selectedCategory.toLowerCase())
    }

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter(
        (j) =>
          j.title.toLowerCase().includes(q) ||
          (j.description && j.description.toLowerCase().includes(q)) ||
          (j.category_name && j.category_name.toLowerCase().includes(q)),
      )
    }

    // Sort order
    if (sortOrder === 'price_high') {
      list.sort((a, b) => (b.price ?? 0) - (a.price ?? 0))
    } else if (sortOrder === 'price_low') {
      list.sort((a, b) => (a.price ?? 0) - (b.price ?? 0))
    } else {
      // newest first
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }

    return list
  }, [rawJobs, selectedCategory, searchQuery, sortOrder])

  const hasActiveFilters = searchQuery.trim().length > 0 || selectedCategory !== 'all' || (tab === 'nearby' && radiusKm !== 5)

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
        <div>
          <h1 className="font-display text-4xl sm:text-5xl uppercase tracking-tight text-ink leading-none">
            Open Jobs
          </h1>
          <p className="mt-1 text-xs text-muted">Community tasks within range</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/map?filter=jobs"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-3.5 text-xs font-bold text-ink hover:bg-sunken transition-colors shadow-xs"
          >
            <MapIcon size={14} aria-hidden="true" />
            <span>Map</span>
          </Link>
          <Button
            size="sm"
            data-tour="tour-post-job"
            onClick={() => {
              if (!isSignedIn) {
                window.dispatchEvent(new CustomEvent('proxid-require-auth', { detail: { action: 'post an open job' } }))
                return
              }
              setShowForm((open) => !open)
            }}
          >
            <Plus size={15} aria-hidden="true" />
            <span>Post Job</span>
          </Button>
        </div>
      </div>

      {/* Inline Post a Job Form */}
      {showForm ? (
        <PostJobForm
          onDone={() => setShowForm(false)}
          isSignedIn={isSignedIn}
          categories={categories}
        />
      ) : null}

      {/* Radius in Effect & Geolocation Control */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-sunken/40 px-3.5 py-2">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-structural" />
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-ink">
            {radiusKm > 0 ? `${radiusKm} km radius in effect` : 'Global radius active'}
          </span>
          <span className="text-[11px] text-muted hidden sm:inline">
            // based on your active location
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick radius buttons */}
          <div className="flex items-center rounded-lg border border-line bg-surface p-0.5 text-[11px] font-mono">
            {[2, 5, 10, 20].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRadiusKm(r)}
                className={`rounded-md px-2 py-0.5 transition-colors ${
                  radiusKm === r
                    ? 'bg-ink font-bold text-page'
                    : 'text-muted hover:text-ink'
                }`}
              >
                {r}km
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void requestDeviceLocation()}
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-line bg-surface px-2.5 text-[11px] font-medium text-ink hover:bg-sunken transition-colors shadow-xs"
            title="Update to device location"
          >
            <MapPin size={12} />
            <span>Nearby</span>
          </button>
        </div>
      </div>

      {/* Tabs and Search Controls */}
      <div className="mt-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Main Tabs */}
          <div
            role="tablist"
            aria-label="Job views"
            className="flex rounded-xl border border-line bg-sunken/50 p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'nearby'}
              onClick={() => setTab('nearby')}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 ease-house ${
                tab === 'nearby'
                  ? 'bg-structural text-page shadow-sm'
                  : 'text-muted hover:text-ink'
              }`}
            >
              Nearby
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'browse'}
              onClick={() => setTab('browse')}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 ease-house ${
                tab === 'browse'
                  ? 'bg-structural text-page shadow-sm'
                  : 'text-muted hover:text-ink'
              }`}
            >
              Browse All
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'mine'}
              onClick={() => setTab('mine')}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 ease-house ${
                tab === 'mine'
                  ? 'bg-structural text-page shadow-sm'
                  : 'text-muted hover:text-ink'
              }`}
            >
              My Jobs
            </button>
          </div>

          {/* Quick Search and Filter Toggle */}
          <div className="flex flex-1 items-center justify-end gap-2 sm:max-w-xs">
            <div className="relative w-full">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                aria-hidden="true"
              />
              <input
                type="text"
                placeholder="Search jobs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-line bg-surface py-1.5 pl-8 pr-3 text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                >
                  <X size={12} />
                </button>
              ) : null}
            </div>

            <Button
              intent={showFilters || hasActiveFilters ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setShowFilters((open) => !open)}
              aria-label="Filter options"
              className="shrink-0"
            >
              <SlidersHorizontal size={14} aria-hidden="true" />
              <span className="hidden sm:inline">Filters</span>
            </Button>
          </div>
        </div>

        {/* Category Pills Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 no-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-200 ease-house ${
              selectedCategory === 'all'
                ? 'border-structural bg-ink text-page font-semibold'
                : 'border-line bg-surface text-ink hover:bg-sunken'
            }`}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-200 ease-house ${
                selectedCategory === cat.id
                  ? 'border-structural bg-ink text-page font-semibold'
                  : 'border-line bg-surface text-ink hover:bg-sunken'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Collapsible Secondary Filters (Radius & Sort) */}
        {showFilters ? (
          <div className="rounded-xl border border-line bg-surface p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              {tab === 'nearby' ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium text-muted uppercase tracking-wider text-[10px]">
                    Radius:
                  </span>
                  {RADIUS_CHOICES.map((choice) => (
                    <button
                      key={choice}
                      type="button"
                      onClick={() => setRadiusKm(choice)}
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors duration-200 ${
                        radiusKm === choice
                          ? 'bg-structural text-page font-semibold'
                          : 'bg-sunken/60 text-muted hover:text-ink'
                      }`}
                    >
                      {choice === 0 ? 'Any' : choice < 1 ? `${choice * 1000} m` : `${choice} km`}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="flex items-center gap-2">
                <span className="font-medium text-muted uppercase tracking-wider text-[10px]">
                  Sort:
                </span>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                  className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs text-ink focus:outline-none"
                >
                  <option value="newest">Newest first</option>
                  <option value="price_high">Price: High to Low</option>
                  <option value="price_low">Price: Low to High</option>
                </select>
              </div>

              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory('all')
                    setSearchQuery('')
                    setRadiusKm(5)
                    setSortOrder('newest')
                  }}
                  className="text-xs text-accent font-semibold hover:underline"
                >
                  Reset all filters
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {/* Main Jobs Feed */}
      <div className="mt-5 space-y-4">
        {currentQuery.isLoading ? (
          <CardSkeletonList count={6} />
        ) : currentQuery.isError ? (
          <ErrorState
            title="We could not load the jobs"
            message="Nothing was changed. Check your connection, then try again."
            onRetry={() => void currentQuery.refetch()}
          />
        ) : processedJobs.length === 0 ? (
          <div className="space-y-3">
            <EmptyState
              icon={<Briefcase size={22} />}
              title={
                hasActiveFilters
                  ? 'No jobs match your filter'
                  : tab === 'mine'
                    ? 'No jobs posted yet'
                    : `No open jobs within ${radiusKm} km`
              }
              description={
                hasActiveFilters
                  ? 'Try clearing your search terms or picking All Categories to see available requests.'
                  : tab === 'mine'
                    ? 'Post your first job request to hire verified local professionals.'
                    : 'Be the first to post a job in this neighbourhood, or widen your distance radius.'
              }
              actionLabel={hasActiveFilters ? 'Clear filters' : 'Post a job'}
              onAction={
                hasActiveFilters
                  ? () => {
                      setSelectedCategory('all')
                      setSearchQuery('')
                    }
                  : () => setShowForm(true)
              }
            />
            {/* One-tap way to widen radius */}
            {tab === 'nearby' && (
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setRadiusKm(15)}
                  className="rounded-lg border border-structural bg-ink px-3.5 py-1.5 text-xs font-bold text-page hover:opacity-90 transition-opacity shadow-xs"
                >
                  Widen radius to 15 km
                </button>
                <button
                  type="button"
                  onClick={() => setRadiusKm(25)}
                  className="rounded-lg border border-line bg-surface px-3.5 py-1.5 text-xs font-bold text-ink hover:bg-sunken transition-colors shadow-xs"
                >
                  Expand to 25 km
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {processedJobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** The post-a-job form with category selection and immediate feedback. */
function PostJobForm({
  onDone,
  isSignedIn,
  categories,
}: {
  onDone: () => void
  isSignedIn: boolean
  categories: Array<{ id: string; name: string }>
}) {
  const coordinates = useLocationStore((state) => state.coordinates)
  const post = usePostJob()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const next: Record<string, string> = {}
    if (title.trim().length < 4) next.title = 'Give the job a title of at least 4 characters.'
    if (description.trim().length < 10) next.description = 'Describe the work in at least 10 characters.'
    const amount = Number(price)
    if (!Number.isFinite(amount) || amount <= 0) next.price = 'Set a budget above zero.'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSubmitting(true)
    try {
      await post.mutateAsync({
        title: title.trim(),
        description: description.trim(),
        price: amount,
        category_id: categoryId || undefined,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      })
      setTitle('')
      setDescription('')
      setPrice('')
      onDone()
    } catch {
      // error handled by mutation
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="mt-4 animate-fade-rise">
      <CardHeader title="Post a job" hint="Verified providers in this area will see your request." />
      <CardBody>
        {!isSignedIn ? (
          <p className="mb-3 rounded-xl border border-line bg-accent-wash p-3 text-sm text-ink">
            Sign in first. The demo account takes one click from the sign-in modal.
          </p>
        ) : null}
        <form className="space-y-3" onSubmit={(e) => void submit(e)} noValidate>
          <TextField
            label="Title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            error={errors.title ?? null}
            placeholder="Fix kitchen sink pipe leak"
            disabled={submitting}
            required
          />

          {categories.length > 0 ? (
            <div>
              <label htmlFor="job-category-select" className="mb-1 block text-sm font-medium text-ink">
                Category
              </label>
              <select
                id="job-category-select"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                disabled={submitting}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink focus:outline-none"
              >
                <option value="">Select a category (optional)</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <TextAreaField
            label="What needs doing"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            error={errors.description ?? null}
            placeholder="Water is pooling beneath the kitchen trap. Available evenings after 5pm."
            disabled={submitting}
            required
          />

          <TextField
            label="Budget"
            inputMode="decimal"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            error={errors.price ?? null}
            hint={`In NGN. Displayed as ${money(Number(price) || 0)}.`}
            placeholder="15000"
            disabled={submitting}
            required
          />

          {post.isError ? (
            <p role="alert" className="rounded-xl border border-line bg-accent-wash p-3 text-xs text-ink">
              We could not post that job. Check the details and try again.
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              type="submit"
              loading={submitting || post.isPending}
              loadingText="Posting job..."
              disabled={!isSignedIn || submitting}
            >
              Post it
            </Button>
            <Button type="button" intent="ghost" onClick={onDone} disabled={submitting}>
              Cancel
            </Button>
            <Badge tone="quiet">Targeted to your current map location</Badge>
          </div>
        </form>
      </CardBody>
    </Card>
  )
}
