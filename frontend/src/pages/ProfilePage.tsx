/**
 * Profile: who you are, whether your humanity is proven, and the verification flow.
 * Matches Gigr's ProfilePage pattern with inline editing, avatar upload, and Concordium ZK proofs.
 */

import {
  Briefcase,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Edit2,
  ExternalLink,
  Image as ImageIcon,
  LogOut,
  MapPin,
  QrCode,
  Shield,
  ShieldCheck,
  Sparkles,
  Upload,
  User,
  X,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { HouseIllustration } from '@/components/illustrations/CartoonIllustrations'
import { SafeImage } from '@/components/SafeImage'
import { VerifiedBadge } from '@/components/VerifiedBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { TextField, TextAreaField } from '@/components/ui/input'
import { ProfileSkeleton, TextSkeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/useAuth'
import { useMyJobs } from '@/hooks/useJobs'
import { useApproveVerification, useMyVerification, useRequestVerification } from '@/hooks/useVerification'
import { money, statusLabel, timeAgo } from '@/lib/format'
import { useLightboxStore } from '@/store/lightboxStore'

export function ProfilePage() {
  const { user, isSignedIn, isLoading, logout, updateProfile, uploadAvatar } = useAuth()
  const verification = useMyVerification(isSignedIn)
  const request = useRequestVerification()
  const approve = useApproveVerification()
  const myJobs = useMyJobs(isSignedIn)
  const openLightbox = useLightboxStore((state) => state.openLightbox)

  const [purpose, setPurpose] = useState<'personhood' | 'age_over_18'>('personhood')
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [uploadedPublicId, setUploadedPublicId] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  // Edit form state
  const [editName, setEditName] = useState('')
  const [editUsername, setEditUsername] = useState('')
  const [editBio, setEditBio] = useState('')
  const [editNeighbourhood, setEditNeighbourhood] = useState('')
  const [editAvatarUrl, setEditAvatarUrl] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const startEdit = () => {
    if (!user) return
    setEditName(user.display_name || '')
    setEditUsername(user.username || '')
    setEditBio(user.bio || '')
    setEditNeighbourhood(user.neighbourhood || '')
    setEditAvatarUrl(user.avatar_url || '')
    setUploadedPublicId(null)
    setSaveError(null)
    setIsEditing(true)
  }

  const cancelEdit = () => {
    setIsEditing(false)
    setSaveError(null)
  }

  const handleAvatarFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setIsUploadingAvatar(true)
    setSaveError(null)
    try {
      const res = await uploadAvatar(file)
      if (res) {
        setEditAvatarUrl(res.url)
        setUploadedPublicId(res.public_id)
      } else {
        setSaveError('Failed to upload picture. Check format (JPG, PNG, WebP).')
      }
    } catch {
      setSaveError('Failed to upload image file.')
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editName.trim()) {
      setSaveError('Display name is required.')
      return
    }
    const cleanUsername = editUsername.trim().toLowerCase()
    if (cleanUsername && !/^[a-z0-9_-]{3,30}$/.test(cleanUsername)) {
      setSaveError('Username must be 3-30 characters using only lowercase letters, numbers, hyphens, and underscores.')
      return
    }
    setIsSaving(true)
    setSaveError(null)
    try {
      await updateProfile({
        display_name: editName.trim(),
        username: cleanUsername || undefined,
        bio: editBio.trim() || null,
        neighbourhood: editNeighbourhood.trim() || null,
        avatar_url: editAvatarUrl.trim() || null,
      })
      setIsEditing(false)
    } catch {
      setSaveError('Could not save profile changes. Username may already be taken.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await logout()
    } finally {
      setIsLoggingOut(false)
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <ProfileSkeleton />
      </div>
    )
  }

  if (!isSignedIn || !user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <EmptyState
          icon={<User size={24} />}
          title="Sign in to view your profile"
          description="Your verified Concordium credentials, active job rooms, and agent card live behind a session."
          actionLabel="Go to sign in"
          onAction={() => {
            window.location.href = '/login'
          }}
        />
      </div>
    )
  }

  const attempt = approvalState(request.data, verification.data)
  const latest = request.data ?? verification.data ?? null

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 space-y-5">
      {/* Profile Overview Card */}
      <Card>
        <CardBody className="p-5 sm:p-6">
          {!isEditing ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-4">
                <div
                  className="relative shrink-0 cursor-pointer group"
                  onClick={() => openLightbox(user.avatar_url, `${user.display_name} Profile Photo`)}
                  title="Click to view full photo and download"
                >
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.display_name}
                      className="h-16 w-16 rounded-full border border-line object-cover shadow-sm group-hover:ring-2 group-hover:ring-accent transition-all"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full border border-line bg-sunken text-xl font-bold text-ink">
                      {user.display_name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  {user.concordium_verified && (
                    <div
                      className="absolute -bottom-1 -right-1 rounded-full bg-surface p-0.5 shadow"
                      title="Concordium Verified Human"
                    >
                      <ShieldCheck size={18} className="text-accent fill-accent/20" />
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-bold tracking-tight text-ink truncate">{user.display_name}</h1>
                    <VerifiedBadge verified={user.concordium_verified} />
                  </div>
                  {user.username && (
                    <div className="mt-0.5 flex items-center gap-2">
                      <Link
                        to={`/u/${user.username}`}
                        className="text-xs font-mono font-semibold text-accent hover:underline flex items-center gap-1"
                        title="View your public portfolio"
                      >
                        <span>@{user.username}</span>
                        <ExternalLink size={11} />
                      </Link>
                    </div>
                  )}
                  <p className="mt-0.5 text-xs text-muted truncate">{user.email}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted">
                    <MapPin size={12} className="shrink-0" />
                    <span>{user.neighbourhood ?? 'Neighbourhood not set'}</span>
                    {user.latitude !== null && user.longitude !== null
                      ? ` (${user.latitude.toFixed(2)}, ${user.longitude.toFixed(2)})`
                      : ''}
                  </p>
                  {user.bio ? <p className="mt-2 text-sm text-ink max-w-lg">{user.bio}</p> : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
                <Button
                  intent="secondary"
                  size="sm"
                  onClick={startEdit}
                  className="transition-all duration-150"
                >
                  <Edit2 size={13} className="mr-1" aria-hidden="true" />
                  Edit Profile
                </Button>
                <Button
                  intent="ghost"
                  size="sm"
                  loading={isLoggingOut}
                  loadingText="Signing out..."
                  disabled={isLoggingOut}
                  onClick={() => void handleLogout()}
                >
                  <LogOut size={13} className="mr-1" aria-hidden="true" />
                  Sign out
                </Button>
              </div>
            </div>
          ) : (
            /* Inline Edit Profile Form */
            <form onSubmit={(e) => void handleSaveProfile(e)} className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-line">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-ink">Edit Personal Profile</h2>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="p-1 text-muted hover:text-ink rounded-lg transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {saveError && (
                <div className="rounded-xl border border-structural bg-accent/10 p-2.5 text-xs text-ink">
                  {saveError}
                </div>
              )}

              {/* Avatar upload row */}
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  {editAvatarUrl ? (
                    <img
                      src={editAvatarUrl}
                      alt="Avatar preview"
                      className="h-16 w-16 rounded-full border border-line object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full border border-line bg-sunken text-xl font-bold text-ink">
                      {editName.slice(0, 2).toUpperCase() || 'U'}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                    className="absolute -bottom-1 -right-1 rounded-full bg-ink text-surface p-1.5 shadow hover:scale-105 transition-transform disabled:opacity-50"
                    title="Upload picture"
                  >
                    <Camera size={13} />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => void handleAvatarFile(e)}
                    className="hidden"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-medium text-ink">Profile Avatar</span>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      intent="secondary"
                      size="sm"
                      loading={isUploadingAvatar}
                      loadingText="Uploading..."
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload size={12} className="mr-1" />
                      Choose photo
                    </Button>
                    {editAvatarUrl && (
                      <Button
                        type="button"
                        intent="ghost"
                        size="sm"
                        disabled={isUploadingAvatar}
                        onClick={() => {
                          setEditAvatarUrl('')
                          setUploadedPublicId(null)
                        }}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                  {uploadedPublicId && (
                    <p className="text-[11px] font-mono text-muted truncate max-w-xs">
                      Public ID: {uploadedPublicId}
                    </p>
                  )}
                  <p className="text-[11px] text-muted">Upload any photo; it will be formatted to fit.</p>
                </div>
              </div>

              <TextField
                label="Display Name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Ada Lovelace"
                required
              />

              <TextField
                label="Username (unique portfolio handle)"
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                placeholder="e.g. adanwosu"
                hint="Used for your shareable public portfolio link at /u/username."
              />

              <TextField
                label="Neighbourhood"
                value={editNeighbourhood}
                onChange={(e) => setEditNeighbourhood(e.target.value)}
                placeholder="Yaba, Lagos"
              />

              <TextAreaField
                label="Bio & Specialties"
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                placeholder="Tell clients or providers about your trades, skills, and background..."
              />

              <div className="flex justify-end gap-2 pt-2 border-t border-line">
                <Button type="button" intent="secondary" onClick={cancelEdit} disabled={isSaving}>
                  Cancel
                </Button>
                <Button type="submit" loading={isSaving} loadingText="Saving...">
                  <Check size={14} className="mr-1" />
                  Save changes
                </Button>
              </div>
            </form>
          )}
        </CardBody>
      </Card>

      {/* Concordium Zero-Knowledge Verification Section */}
      <Card>
        <CardHeader
          title="Concordium Zero-Knowledge Verification"
          hint="Single-use cryptographic challenge bound to this origin. Approved in Concordium ID app."
        />
        <CardBody className="space-y-4">
          <div className="rounded-xl border border-line bg-sunken/40 p-3.5 text-xs text-muted space-y-2">
            <div className="font-semibold text-ink flex items-center gap-1.5 font-display uppercase tracking-wider text-[11px]">
              <span>How Concordium Verification Works</span>
            </div>
            <ul className="space-y-1.5 list-disc list-inside leading-relaxed text-[11px]">
              <li><strong className="text-ink">What it asks for:</strong> Zero-knowledge proof of unique human personhood from your Concordium ID wallet.</li>
              <li><strong className="text-ink">Why:</strong> Proves you are a real human provider to clients without revealing personal identity or documents.</li>
              <li><strong className="text-ink">What happens next:</strong> An on-chain verification badge is attached to your account and shown on your cards and public profile.</li>
              <li><strong className="text-ink">What it cannot do today:</strong> Veriox operates as an edge Cloudflare Worker integration rather than a merchant backend QR API, so identity issuance is demonstrated here via a domain-bound cryptographic challenge simulation.</li>
            </ul>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(['personhood', 'age_over_18'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setPurpose(option)}
                aria-pressed={purpose === option}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  purpose === option
                    ? 'border-structural bg-accent text-accent-ink shadow-sm'
                    : 'border-line bg-surface text-ink hover:bg-sunken'
                }`}
              >
                {option === 'personhood' ? 'Prove Human Personhood' : 'Prove Age Over 18'}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => request.mutate(purpose)}
              loading={request.isPending}
              loadingText="Generating nonce..."
              disabled={request.isPending}
            >
              <QrCode size={14} className="mr-1" aria-hidden="true" />
              Start verification
            </Button>

            {attempt?.status === 'pending' && attempt.nonce ? (
              <Button
                intent="secondary"
                onClick={() => approve.mutate(attempt.nonce as string)}
                loading={approve.isPending}
                loadingText="Verifying proof..."
                disabled={approve.isPending}
              >
                <CheckCircle2 size={14} className="mr-1" aria-hidden="true" />
                I approved it in the app
              </Button>
            ) : null}
          </div>

          {request.data ? (
            <div className="rounded-xl border border-line bg-surface p-4 text-xs space-y-3 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2">
                <div className="flex items-center gap-1.5">
                  <Badge tone="quiet">{request.data.purpose}</Badge>
                  <Badge tone="neutral">{request.data.status}</Badge>
                </div>
                <span className="text-muted">expires {timeAgo(request.data.expires_at)}</span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-muted">Bound domain</span>
                <span className="font-mono text-ink font-semibold">{request.data.bound_domain}</span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Veriox integrates via an edge Cloudflare Worker and client SDK (window.Veriox) rather than a backend QR generation endpoint; the verification challenge is simulated here for demonstration.
              </p>
            </div>
          ) : null}

          {approve.data ? (
            <div
              role="status"
              className="rounded-xl border border-structural bg-accent/10 p-3 text-xs text-ink flex items-start gap-2"
            >
              <CheckCircle2 size={16} className="text-accent shrink-0 mt-0.5" />
              <span>{approve.data.message}</span>
            </div>
          ) : null}

          {!request.data && verification.isLoading ? <TextSkeleton lines={3} /> : null}

          {!request.data && !verification.isLoading && !latest ? (
            <p className="text-xs text-muted">
              No verification started yet. Press &quot;Start verification&quot; to test the live challenge loop.
            </p>
          ) : null}

          <p className="text-[11px] leading-relaxed text-muted border-t border-line pt-3">
            Veriox handles the cryptographic anchor and ZK proof verification on Concordium testnet.
            The verified badge is written strictly upon verification approval.
          </p>
        </CardBody>
      </Card>

      {/* Your Jobs History Section */}
      <Card>
        <CardHeader
          title="Your Jobs"
          hint="Contract rooms created, assigned, or completed."
          action={
            <Link
              to="/jobs"
              className="text-xs font-semibold uppercase tracking-wider text-ink hover:underline flex items-center gap-1"
            >
              Browse all jobs
            </Link>
          }
        />
        <CardBody>
          {myJobs.isLoading ? (
            <TextSkeleton lines={4} />
          ) : myJobs.isError ? (
            <ErrorState
              title="Could not load your jobs"
              message="Failed to fetch jobs associated with your account."
              onRetry={() => void myJobs.refetch()}
            />
          ) : (myJobs.data ?? []).length === 0 ? (
            <EmptyState
              icon={<Briefcase size={20} />}
              title="No jobs on your account yet"
              description="Post a new job listing to find verified local providers, or explore active postings."
              actionLabel="Post a job"
              onAction={() => {
                window.location.href = '/jobs'
              }}
            />
          ) : (
            <div className="divide-y divide-line">
              {(myJobs.data ?? []).map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="relative h-11 w-11 shrink-0 rounded-lg overflow-hidden bg-sunken border border-line">
                      <SafeImage
                        src={job.image_url}
                        alt={job.title}
                        fallback={
                          <HouseIllustration className="h-6 w-6 opacity-75" size={24} />
                        }
                        skeletonClassName="h-11 w-11"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/jobs/${job.id}/room`}
                        className="font-medium text-ink hover:underline block truncate text-sm"
                      >
                        {job.title}
                      </Link>
                      <span className="text-xs text-muted">
                        {money(job.price, job.currency)}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone="quiet">{statusLabel(job.status)}</Badge>
                    <Link
                      to={`/jobs/${job.id}/room`}
                      className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink hover:bg-sunken transition-colors"
                    >
                      Open room
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}

function approvalState(
  requested: { nonce: string; status: string } | null | undefined,
  existing: { nonce: string; status: string } | null | undefined,
): { nonce: string | null; status: string } | null {
  const source = requested ?? existing
  if (!source) return null
  return { nonce: source.status === 'pending' ? source.nonce : null, status: source.status }
}
