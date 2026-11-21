/**
 * Jobs: what is open nearby, what you posted, and the form to post one.
 *
 * The list is the primary surface; the map is beside it on a wide screen and above it on
 * a phone, and both read the same query so the two cannot disagree.
 */

import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'

import { JobCard } from '@/components/JobCard'
import { EmptyState } from '@/components/EmptyState'
import { NeighborhoodMap, type MapPoint } from '@/components/map/NeighborhoodMap'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { TextAreaField, TextField } from '@/components/ui/input'
import { CardSkeletonList } from '@/components/ui/skeleton'
import { useBrowseJobs, useNearbyJobs, usePostJob } from '@/hooks/useJobs'
import { useAuth } from '@/hooks/useAuth'
import { useLocationStore, RADIUS_CHOICES } from '@/store/locationStore'
import { money } from '@/lib/format'

type Tab = 'nearby' | 'all'

export function JobsPage() {
  const { isSignedIn } = useAuth()
  const [tab, setTab] = useState<Tab>('nearby')
  const [showForm, setShowForm] = useState(false)

  const coordinates = useLocationStore((state) => state.coordinates)
  const radiusKm = useLocationStore((state) => state.radiusKm)
  const setRadiusKm = useLocationStore((state) => state.setRadiusKm)
  const source = useLocationStore((state) => state.source)
  const requestDeviceLocation = useLocationStore((state) => state.requestDeviceLocation)

  const nearby = useNearbyJobs()
  const browse = useBrowseJobs()
  const active = tab === 'nearby' ? nearby : browse
  const jobs = active.data ?? []

  const points = useMemo<MapPoint[]>(
    () =>
      jobs
        .filter((job) => job.latitude !== null && job.longitude !== null)
        .map((job) => ({
          id: job.id,
          kind: 'job',
          latitude: job.latitude as number,
          longitude: job.longitude as number,
          title: job.title,
          subtitle: job.category_name,
          price: job.price,
          distanceKm: job.distance_km,
          verified: false,
          isDemo: job.is_demo,
          href: `/jobs/${job.id}`,
        })),
    [jobs],
  )

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Jobs</h1>
          <p className="mt-1 text-sm text-muted">
            {source === 'demo'
              ? 'Showing the demo neighbourhood in Yaba, Lagos. Share your own location for real distances.'
              : 'Around your shared location, nearest first.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button intent="secondary" size="sm" onClick={() => void requestDeviceLocation()}>
            Use my location
          </Button>
          <Button size="sm" onClick={() => setShowForm((open) => !open)}>
            <Plus size={15} aria-hidden="true" />
            Post a job
          </Button>
        </div>
      </div>

      {showForm ? (
        <PostJobForm onDone={() => setShowForm(false)} isSignedIn={isSignedIn} />
      ) : null}

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div role="tablist" aria-label="Job list" className="flex gap-1">
              {(['nearby', 'all'] as Tab[]).map((option) => (
                <button
                  key={option}
                  role="tab"
                  aria-selected={tab === option}
                  onClick={() => setTab(option)}
                  className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors duration-200 ease-house ${
                    tab === option
                      ? 'border-structural bg-accent text-accent-ink'
                      : 'border-line bg-surface text-ink hover:bg-accent-wash'
                  }`}
                >
                  {option === 'nearby' ? 'Nearby' : 'Everything open'}
                </button>
              ))}
            </div>
            {tab === 'nearby' ? (
              <div className="flex flex-wrap gap-1">
                {RADIUS_CHOICES.map((choice) => (
                  <button
                    key={choice}
                    onClick={() => setRadiusKm(choice)}
                    aria-pressed={radiusKm === choice}
                    className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors duration-200 ease-house ${
                      radiusKm === choice ? 'bg-sunken text-ink' : 'text-muted hover:text-ink'
                    }`}
                  >
                    {choice === 0 ? 'Any' : choice < 1 ? `${choice * 1000} m` : `${choice} km`}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {active.isLoading ? (
            <CardSkeletonList count={4} />
          ) : active.isError ? (
            <EmptyState
              title="We could not load the jobs"
              body="Nothing was changed. Check your connection, then try again."
              action={
                <Button intent="secondary" onClick={() => void active.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : jobs.length === 0 ? (
            <EmptyState
              title="No open jobs here yet"
              body="Widen the radius, or post the first one. A job posted here appears for providers within their own reach."
              action={
                <Button onClick={() => setShowForm(true)}>
                  <Plus size={15} aria-hidden="true" />
                  Post a job
                </Button>
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {jobs.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          )}
        </div>

        <div className="min-w-0 lg:sticky lg:top-20 lg:self-start">
          <NeighborhoodMap
            center={coordinates}
            radiusKm={radiusKm}
            points={points}
            loading={active.isLoading}
            height={380}
          />
        </div>
      </div>
    </div>
  )
}

/** The post-a-job form. Prices are in the job's own currency, never converted. */
function PostJobForm({ onDone, isSignedIn }: { onDone: () => void; isSignedIn: boolean }) {
  const coordinates = useLocationStore((state) => state.coordinates)
  const post = usePostJob()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const next: Record<string, string> = {}
    if (title.trim().length < 4) next.title = 'Give the job a title of at least 4 characters.'
    if (description.trim().length < 10) next.description = 'Describe the work, at least 10 characters.'
    const amount = Number(price)
    if (!Number.isFinite(amount) || amount <= 0) next.price = 'Set a budget above zero.'
    setErrors(next)
    if (Object.keys(next).length > 0) return
    post.mutate(
      {
        title: title.trim(),
        description: description.trim(),
        price: amount,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      },
      {
        onSuccess: () => {
          setTitle('')
          setDescription('')
          setPrice('')
          onDone()
        },
      },
    )
  }

  return (
    <Card className="mt-4 animate-fade-rise">
      <CardHeader title="Post a job" hint="Providers within reach of this point will see it." />
      <CardBody>
        {!isSignedIn ? (
          <p className="mb-3 rounded-xl border border-line bg-accent-wash p-3 text-sm text-ink">
            Sign in first. The judge demo takes one click and needs no account.
          </p>
        ) : null}
        <form className="space-y-3" onSubmit={submit} noValidate>
          <TextField
            label="Title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            error={errors.title ?? null}
            placeholder="Fix the kitchen sink leak"
          />
          <TextAreaField
            label="What needs doing"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            error={errors.description ?? null}
            placeholder="Water is pooling under the sink. I am home after 5pm."
          />
          <TextField
            label="Budget"
            inputMode="decimal"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            error={errors.price ?? null}
            hint={`In ${'NGN'}. Shown as ${money(Number(price) || 0)}.`}
            placeholder="12000"
          />
          {post.isError ? (
            <p role="alert" className="rounded-xl border border-line bg-accent-wash p-3 text-sm text-ink">
              We could not post that job. Nothing was saved. Check the fields and try again.
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" loading={post.isPending} disabled={!isSignedIn}>
              Post it
            </Button>
            <Button type="button" intent="ghost" onClick={onDone}>
              Cancel
            </Button>
            <Badge tone="quiet">Posted at your current map centre</Badge>
          </div>
        </form>
      </CardBody>
    </Card>
  )
}
