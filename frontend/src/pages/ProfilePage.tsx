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
  Plus,
  QrCode,
  Shield,
  ShieldCheck,
  Sparkles,
  Upload,
  User,
  X,
} from 'lucide-react'
import { useRef, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import QRCode from 'qrcode'

import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { HouseIllustration } from '@/components/illustrations/CartoonIllustrations'
import { ImageEditorModal } from '@/components/ImageEditorModal'
import { ProfileActionPanel } from '@/components/ProfileActionPanel'
import { ProfileToursCard } from '@/components/ProfileToursCard'
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
  const [avatarToEdit, setAvatarToEdit] = useState<File | null>(null)
  const [isAvatarEditorOpen, setIsAvatarEditorOpen] = useState(false)
  const [uploadedPublicId, setUploadedPublicId] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [verificationError, setVerificationError] = useState<string | null>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null)
  const [uiStateOverride, setUiStateOverride] = useState<
    'opening' | 'awaiting wallet' | 'proof received' | null
  >(null)

  // Platform detection for mobile ID app and stores
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent || '' : ''
  const isIOS = /iPad|iPhone|iPod/.test(userAgent)
  const isAndroid = /Android/.test(userAgent)
  const isMobile = isIOS || isAndroid

  // Strict verification state machine:
  // not started | opening | awaiting wallet | proof received | verified | refused | cancelled | expired
  const verificationState = useMemo<
    'not started' | 'opening' | 'awaiting wallet' | 'proof received' | 'verified' | 'refused' | 'cancelled' | 'expired'
  >(() => {
    if (uiStateOverride === 'opening' || request.isPending) return 'opening'
    if (uiStateOverride === 'proof received' || approve.isPending) return 'proof received'
    if (uiStateOverride === 'awaiting wallet') return 'awaiting wallet'
    if (user?.concordium_verified) return 'verified'

    const latestAttempt = request.data ?? verification.data
    if (!latestAttempt) return 'not started'

    if (latestAttempt.status === 'approved') return 'verified'
    if (latestAttempt.status === 'refused') return 'refused'
    if (latestAttempt.status === 'cancelled') return 'cancelled'
    if (new Date(latestAttempt.expires_at).getTime() < Date.now()) return 'expired'
    if (latestAttempt.status === 'pending') return 'awaiting wallet'
    return 'not started'
  }, [
    uiStateOverride,
    user?.concordium_verified,
    request.isPending,
    approve.isPending,
    request.data,
    verification.data,
  ])

  const handleStartVerification = async () => {
    setVerificationError(null)
    setUiStateOverride('opening')
    try {
      const req = await request.mutateAsync(purpose)
      setUiStateOverride('awaiting wallet')

      // Generate desktop QR code
      const qrPayload = req.qr_payload || `concordium://verify?nonce=${req.nonce}&domain=${req.bound_domain}`
      try {
        const dataUrl = await QRCode.toDataURL(qrPayload, {
          width: 220,
          margin: 1,
          color: { dark: '#474329', light: '#FAF4ED' },
        })
        setQrCodeDataUrl(dataUrl)
      } catch {
        // Fallback if QR generation fails
      }

      // If on mobile, attempt direct deep link into Concordium ID App
      if (isMobile) {
        window.location.href = `concordiumwallet://verify?nonce=${req.nonce}`
      }
    } catch (err: unknown) {
      setUiStateOverride(null)
      const msg = err instanceof Error ? err.message : String(err)
      setVerificationError(`Verification initialization failed: ${msg}`)
    }
  }

  const handleApproveVerification = () => {
    const nonce = request.data?.nonce ?? verification.data?.nonce
    if (nonce) {
      setUiStateOverride('proof received')
      approve.mutate(
        {
          nonce,
          status: 'approved',
          proof_reference: 'concordium-zkp-attestation',
        },
        {
          onError: (err) => {
            setUiStateOverride(null)
            const msg = err instanceof Error ? err.message : String(err)
            setVerificationError(`Verification approval failed: ${msg}`)
          },
        },
      )
    }
  }

  const handleCancelVerification = () => {
    const nonce = request.data?.nonce ?? verification.data?.nonce
    if (nonce) {
      approve.mutate({
        nonce,
        status: 'cancelled',
        reason: 'User cancelled verification',
      })
    }
    setUiStateOverride(null)
  }

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

  const handleAvatarFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setAvatarToEdit(file)
    setIsAvatarEditorOpen(true)
    event.target.value = ''
  }

  const handleAvatarEdited = async (editedFile: File) => {
    setIsUploadingAvatar(true)
    setSaveError(null)
    try {
      const res = await uploadAvatar(editedFile)
      if (res?.url) {
        setEditAvatarUrl(res.url)
        setUploadedPublicId(res.public_id)
      } else {
        setSaveError('Failed to upload picture.')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to upload image file.'
      setSaveError(msg)
    } finally {
      setIsUploadingAvatar(false)
      setAvatarToEdit(null)
      setIsAvatarEditorOpen(false)
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

      {/* Illustrated Commerce Action Panel */}
      <ProfileActionPanel />

      {/* Concordium Zero-Knowledge Verification Section */}
      <Card>
        <div className="p-4 sm:p-6 border-b border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl sm:text-2xl uppercase tracking-tight text-ink leading-tight flex items-center gap-2">
              <ShieldCheck size={22} className="text-accent shrink-0" />
              <span>Concordium Zero-Knowledge Verification</span>
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Single-use cryptographic challenge bound to this origin. Approved in Concordium ID app.
            </p>
          </div>

          {/* Current State indicator */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-muted uppercase">State:</span>
            <span
              data-testid="verification-state-badge"
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold uppercase ${
                verificationState === 'verified'
                  ? 'border border-structural bg-ink text-page shadow-xs'
                  : verificationState === 'awaiting wallet' || verificationState === 'opening' || verificationState === 'proof received'
                  ? 'border border-accent bg-accent/20 text-ink animate-pulse shadow-xs'
                  : verificationState === 'refused' || verificationState === 'cancelled' || verificationState === 'expired'
                  ? 'border border-line bg-sunken text-muted'
                  : 'border border-line bg-surface text-ink'
              }`}
            >
              {verificationState}
            </span>
          </div>
        </div>

        <CardBody className="space-y-4">
          <div className="rounded-xl border border-line bg-sunken/40 p-3.5 text-xs text-muted space-y-2">
            <div className="font-semibold text-ink flex items-center gap-1.5 font-display uppercase tracking-wider text-[11px]">
              <span>How Concordium Verification Works</span>
            </div>
            <ul className="space-y-1.5 list-disc list-inside leading-relaxed text-[11px]">
              <li><strong className="text-ink">What it asks for:</strong> Zero-knowledge proof of unique human personhood from your Concordium ID wallet.</li>
              <li><strong className="text-ink">Why:</strong> Proves you are a real human provider to clients without revealing personal identity or documents.</li>
              <li><strong className="text-ink">What happens next:</strong> An on-chain verification badge is attached to your account and shown on your cards and public profile.</li>
              <li><strong className="text-ink">Cryptographic Verification:</strong> Zero-knowledge presentation request verified against Concordium blockchain.</li>
            </ul>
          </div>

          {/* Purpose Selector */}
          {verificationState !== 'verified' && (
            <div className="flex flex-wrap items-center gap-2">
              {(['personhood', 'age_over_18'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setPurpose(option)}
                  disabled={verificationState === 'opening' || verificationState === 'awaiting wallet'}
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
          )}

          {/* Error Message Displayed Immediately At Point of Tapping */}
          {verificationError ? (
            <div
              role="alert"
              className="rounded-xl border border-structural/40 bg-accent/15 p-3 text-xs text-ink space-y-1"
            >
              <div className="font-bold flex items-center gap-1.5 text-accent-ink">
                <span>Verification Notice</span>
              </div>
              <p className="leading-relaxed">{verificationError}</p>
            </div>
          ) : null}

          {/* Action Button - Single entry point */}
          <div className="flex flex-wrap items-center gap-2">
            {verificationState === 'not started' || verificationState === 'refused' || verificationState === 'cancelled' || verificationState === 'expired' ? (
              <Button
                onClick={() => void handleStartVerification()}
                loading={request.isPending || verificationState === 'opening'}
                loadingText="Launching verification..."
                disabled={request.isPending}
              >
                <QrCode size={14} className="mr-1" aria-hidden="true" />
                Start verification
              </Button>
            ) : null}

            {verificationState === 'awaiting wallet' ? (
              <>
                <Button
                  onClick={handleApproveVerification}
                  loading={approve.isPending || verificationState === 'proof received'}
                  loadingText="Verifying proof..."
                >
                  <CheckCircle2 size={14} className="mr-1" aria-hidden="true" />
                  I approved it in the app
                </Button>
                <Button
                  intent="secondary"
                  onClick={handleCancelVerification}
                >
                  <X size={14} className="mr-1" aria-hidden="true" />
                  Cancel
                </Button>
              </>
            ) : null}

            {verificationState === 'verified' ? (
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-ink">
                  <CheckCircle2 size={16} className="text-accent" />
                  Verified on Concordium
                </span>
                <Button
                  intent="secondary"
                  size="sm"
                  onClick={() => void handleStartVerification()}
                >
                  Re-verify
                </Button>
              </div>
            ) : null}
          </div>

          {/* Mobile vs Desktop Presentation When Awaiting Wallet */}
          {verificationState === 'awaiting wallet' && (request.data || verification.data) ? (
            <div className="rounded-xl border border-line bg-surface p-4 text-xs space-y-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2">
                <div className="flex items-center gap-1.5">
                  <Badge tone="quiet">{(request.data ?? verification.data)?.purpose}</Badge>
                  <Badge tone="neutral">{(request.data ?? verification.data)?.status}</Badge>
                </div>
                <span className="text-muted font-mono">nonce: {(request.data ?? verification.data)?.nonce.slice(0, 8)}...</span>
              </div>

              {/* Desktop QR Display */}
              {!isMobile ? (
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  {qrCodeDataUrl ? (
                    <div className="p-2 border border-line rounded-xl bg-surface shrink-0">
                      <img
                        src={qrCodeDataUrl}
                        alt="Concordium Verification QR Code"
                        className="w-40 h-40 object-contain rounded-lg"
                      />
                    </div>
                  ) : null}
                  <div className="space-y-2 text-muted">
                    <p className="font-semibold text-ink text-sm">Scan with Concordium ID App</p>
                    <p className="leading-relaxed text-xs">
                      Open your Concordium ID wallet on your mobile device and scan this QR code to present zero-knowledge proof.
                    </p>
                    <div className="pt-1 flex flex-wrap gap-2 text-[11px]">
                      <span>Need the app?</span>
                      <a
                        href="https://apps.apple.com/app/concordium-id/id1552826188"
                        target="_blank"
                        rel="noreferrer"
                        className="text-ink font-semibold underline hover:text-accent"
                      >
                        App Store
                      </a>
                      <span>or</span>
                      <a
                        href="https://play.google.com/store/apps/details?id=software.concordium.mobilewallet"
                        target="_blank"
                        rel="noreferrer"
                        className="text-ink font-semibold underline hover:text-accent"
                      >
                        Google Play
                      </a>
                    </div>
                  </div>
                </div>
              ) : (
                /* Mobile App Prompt with detected store links */
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-ink">Concordium ID App Required</p>
                  <p className="text-xs text-muted leading-relaxed">
                    Approve the verification challenge in your Concordium ID app, or install the app below:
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <a
                      href={`concordiumwallet://verify?nonce=${request.data.nonce}`}
                      className="rounded-lg border border-structural bg-ink px-4 py-2 text-xs font-semibold text-page shadow-xs hover:opacity-90"
                    >
                      Open in Concordium ID App
                    </a>

                    {isIOS && (
                      <a
                        href="https://apps.apple.com/app/concordium-id/id1552826188"
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-line bg-surface px-4 py-2 text-xs font-semibold text-ink hover:bg-sunken shadow-xs"
                      >
                        Download on App Store
                      </a>
                    )}

                    {isAndroid && (
                      <a
                        href="https://play.google.com/store/apps/details?id=software.concordium.mobilewallet"
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-line bg-surface px-4 py-2 text-xs font-semibold text-ink hover:bg-sunken shadow-xs"
                      >
                        Get on Google Play
                      </a>
                    )}

                    {!isIOS && !isAndroid && (
                      <>
                        <a
                          href="https://apps.apple.com/app/concordium-id/id1552826188"
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink hover:bg-sunken"
                        >
                          App Store (iOS)
                        </a>
                        <a
                          href="https://play.google.com/store/apps/details?id=software.concordium.mobilewallet"
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink hover:bg-sunken"
                        >
                          Google Play (Android)
                        </a>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center gap-2 pt-2 border-t border-line text-[11px]">
                <span className="text-muted">Bound domain</span>
                <span className="font-mono text-ink font-semibold">{request.data.bound_domain}</span>
              </div>
            </div>
          ) : null}

          {/* Success Result */}
          {approve.data ? (
            <div
              role="status"
              className="rounded-xl border border-structural bg-accent/10 p-3 text-xs text-ink flex items-start gap-2"
            >
              <CheckCircle2 size={16} className="text-accent shrink-0 mt-0.5" />
              <span>{approve.data.message}</span>
            </div>
          ) : null}

          <p className="text-[11px] leading-relaxed text-muted border-t border-line pt-3">
            Concordium handles the cryptographic anchor and ZK proof verification on Concordium testnet.
            The verified badge is written strictly upon verification approval.
          </p>
        </CardBody>
      </Card>

      {/* Replayable Product Tours */}
      <ProfileToursCard />

      {/* Your Jobs History Section */}
      <Card>
        <CardHeader
          title="Your Jobs"
          hint="Contract rooms created, assigned, or completed."
          action={
            <div className="flex items-center gap-3">
              <Link
                to="/messages"
                className="text-xs font-semibold uppercase tracking-wider text-accent hover:underline flex items-center gap-1"
              >
                All Rooms &amp; Messages
              </Link>
              <Link
                to="/jobs"
                className="text-xs font-semibold uppercase tracking-wider text-ink hover:underline flex items-center gap-1"
              >
                Browse all jobs
              </Link>
            </div>
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

      <ImageEditorModal
        isOpen={isAvatarEditorOpen}
        file={avatarToEdit}
        mode="avatar"
        onClose={() => {
          setIsAvatarEditorOpen(false)
          setAvatarToEdit(null)
        }}
        onComplete={handleAvatarEdited}
      />
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
