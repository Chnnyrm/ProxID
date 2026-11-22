/**
 * Rebuilt Landing Page.
 *
 * Designed to the owner's exact editorial poster specification:
 * - Soft Sand (#F0E5DB) canvas with Mocha Green (#474329) condensed display type.
 * - Watermelon Pink (#FC75B4) graphic accent script and focused CTAs.
 * - Editorial metadata corner stamps and structured asymmetric blocks.
 * - 8-part structure matching Gigr: Header, Hero + Typewriter + Phone Mockup,
 *   Category Marquee, How It Works, Feature Cards, Proof section, Final CTA, Footer.
 * - Official Concordium SVGs and verified copy from docs/landing-copy.md.
 * - No background gradients. Transform and opacity motion with cubic-bezier(0.22, 1, 0.36, 1).
 */

import { motion } from 'framer-motion'
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Coins,
  ExternalLink,
  Fingerprint,
  MapPin,
  QrCode,
  Search,
  ShieldCheck,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'

import { AuthDialog } from '@/components/AuthDialog'
import { Logo } from '@/components/Logo'
import { useAuth } from '@/hooks/useAuth'

// ---------- Typewriter Cycling Verbs ----------
const TYPEWRITER_LINES = [
  'a plumber you can trust',
  'a tutor whose identity is checked',
  'a driver who is really a person',
  'an agent that answers for its owner',
]

function TypewriterText() {
  const [index, setIndex] = useState(0)
  const [displayed, setDisplayed] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    const current = TYPEWRITER_LINES[index] ?? TYPEWRITER_LINES[0] ?? ''
    let timer: ReturnType<typeof setTimeout>

    if (!isDeleting) {
      if (displayed.length < current.length) {
        timer = setTimeout(() => {
          setDisplayed(current.slice(0, displayed.length + 1))
        }, 55)
      } else {
        // Hold for ~2.4s as specified in landing-copy.md
        timer = setTimeout(() => setIsDeleting(true), 2400)
      }
    } else {
      if (displayed.length > 0) {
        timer = setTimeout(() => {
          setDisplayed(displayed.slice(0, -1))
        }, 30)
      } else {
        setIsDeleting(false)
        setIndex((prev) => (prev + 1) % TYPEWRITER_LINES.length)
      }
    }

    return () => clearTimeout(timer)
  }, [displayed, isDeleting, index])

  return (
    <span className="inline-block min-h-[1.3em] font-medium text-accent">
      {displayed}
      <span
        aria-hidden="true"
        className="inline-block w-[2.5px] h-[1.1em] bg-accent ml-1 align-middle animate-pulse"
      />
    </span>
  )
}

// ---------- Category Marquee ----------
const CATEGORIES = [
  'Plumbing',
  'Electrical',
  'Tutoring',
  'Cleaning',
  'Moving',
  'Carpentry',
  'Painting',
  'Delivery',
  'Repairs',
  'Gardening',
  'Photography',
  'Catering',
]

function CategoryMarquee() {
  return (
    <section
      aria-label="Service categories"
      className="relative border-y border-line bg-surface/50 py-4 overflow-hidden"
    >
      <div className="flex w-max whitespace-nowrap animate-[proxid-marquee_32s_linear_infinite] hover:[animation-play-state:paused] motion-reduce:animate-none">
        {[...CATEGORIES, ...CATEGORIES, ...CATEGORIES].map((category, i) => (
          <div
            key={i}
            className="mx-3 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-1.5 text-xs font-semibold tracking-wide text-ink shadow-sm"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
            <span>{category}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

// ---------- Phone Mockup with ProxID Live Preview ----------
function PhoneMockup({ onOpenAuth }: { onOpenAuth: () => void }) {
  return (
    <div className="relative mx-auto mt-12 w-full max-w-[340px] sm:max-w-[380px] lg:mt-0">
      {/* Floating proof chips (desktop) */}
      <div className="absolute -left-20 top-8 hidden xl:flex items-center gap-2.5 rounded-2xl border border-line bg-surface p-3 shadow-xl z-20">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-wash text-accent-ink shrink-0">
          <ShieldCheck className="h-5 w-5 text-accent" />
        </div>
        <div className="text-left">
          <p className="text-xs font-bold text-ink">Verified Person</p>
          <p className="text-[10px] text-muted">Concordium ZK proof</p>
        </div>
      </div>

      <div className="absolute -right-20 top-36 hidden xl:flex items-center gap-2.5 rounded-2xl border border-line bg-surface p-3 shadow-xl z-20">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-wash text-accent-ink shrink-0">
          <Bot className="h-5 w-5 text-accent" />
        </div>
        <div className="text-left">
          <p className="text-xs font-bold text-ink">proxidAI Agent</p>
          <p className="text-[10px] text-muted">CIS-8004 #12802</p>
        </div>
      </div>

      <div className="absolute -left-16 bottom-16 hidden xl:flex items-center gap-2.5 rounded-2xl border border-line bg-surface p-3 shadow-xl z-20">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-wash text-accent-ink shrink-0">
          <Coins className="h-5 w-5 text-accent" />
        </div>
        <div className="text-left">
          <p className="text-xs font-bold text-ink">x402 Micropayment</p>
          <p className="text-[10px] text-muted">Sponsored network fees</p>
        </div>
      </div>

      {/* Phone chassis */}
      <div className="relative rounded-[2.5rem] border-[8px] border-structural bg-surface p-3 shadow-2xl">
        {/* Notch */}
        <div className="mx-auto h-4 w-28 rounded-full bg-structural mb-3" />

        {/* Inner Screen */}
        <div className="space-y-3 rounded-[1.8rem] bg-page p-3 text-ink">
          {/* Mock Header */}
          <div className="flex items-center justify-between border-b border-line/60 pb-2">
            <div className="flex items-center gap-1.5">
              <Logo className="h-5 w-5" />
              <span className="text-xs font-bold tracking-tight">ProxID</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-2 py-0.5 text-[10px] font-medium text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              <span>Concordium Testnet</span>
            </div>
          </div>

          {/* Job Card */}
          <div className="rounded-2xl border border-line bg-surface p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-ink">
                  AO
                </span>
                <div>
                  <p className="text-xs font-bold text-ink leading-tight">Ada O.</p>
                  <p className="text-[9px] text-muted">Yaba, Lagos</p>
                </div>
              </div>
              <div className="flex items-center gap-1 rounded-full border border-line bg-accent-wash px-2 py-0.5 text-[9px] font-semibold text-accent-ink">
                <img
                  src="/brands/concordium-small.svg"
                  alt=""
                  className="h-2.5 w-2.5 shrink-0"
                  aria-hidden="true"
                />
                <span>ZK Verified</span>
              </div>
            </div>

            <p className="mt-2 text-xs font-bold text-ink">
              Electrical fault diagnosis & circuit repair
            </p>
            <p className="text-[10px] text-muted line-clamp-2 mt-0.5">
              Breaker tripping under heavy load. Need a verified electrician within 3 km.
            </p>

            <div className="mt-2.5 flex items-center justify-between border-t border-line/40 pt-2 text-[10px]">
              <div>
                <span className="font-bold text-ink">180 CCD</span>
                <span className="text-muted ml-1">(~$32)</span>
              </div>
              <span className="rounded-full bg-accent/20 px-2 py-0.5 font-medium text-ink">
                1.2 km away
              </span>
            </div>
          </div>

          {/* Agent Action Box */}
          <div className="rounded-2xl border border-line bg-surface p-3 shadow-sm space-y-2">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-ink">
              <Bot size={13} className="text-accent" />
              <span>proxidAI Coordinator</span>
              <span className="ml-auto rounded-full bg-accent-wash px-1.5 py-0.5 text-[8px] font-mono text-muted">
                ACTIVE
              </span>
            </div>
            <p className="text-[10px] text-muted leading-relaxed">
              Matched with Northgate Facilities Ltd. Zero-knowledge proof verified against
              Concordium ID registry.
            </p>
            <div className="rounded-xl border border-line bg-sunken/40 px-2.5 py-1.5 text-[9px] font-mono text-muted flex items-center justify-between">
              <span>x402 receipt:</span>
              <span className="text-accent font-semibold flex items-center gap-1">
                <span>0x7f2a...98e4</span>
                <CheckCircle2 size={11} aria-hidden="true" />
              </span>
            </div>
          </div>

          {/* Action CTA inside phone */}
          <button
            type="button"
            onClick={onOpenAuth}
            className="w-full rounded-xl border border-structural bg-accent py-2 text-xs font-bold text-accent-ink shadow-sm transition-transform active:translate-y-px"
          >
            Open Job Room
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------- Main Landing Page Component ----------
export function LandingPage() {
  const { isSignedIn } = useAuth()
  const [authOpen, setAuthOpen] = useState(false)
  const [authTab, setAuthTab] = useState<'login' | 'register'>('register')

  if (isSignedIn) {
    return <Navigate to="/jobs" replace />
  }

  const openAuth = (tab: 'login' | 'register') => {
    setAuthTab(tab)
    setAuthOpen(true)
  }

  return (
    <div className="min-h-screen bg-page text-ink selection:bg-accent selection:text-accent-ink">
      {/* 1. HERO SECTION (Editorial Poster Style) */}
      <section className="relative px-4 pt-8 pb-16 sm:px-6 sm:pt-14 sm:pb-24 border-b border-line">
        <div className="mx-auto max-w-6xl">
          {/* Poster Metadata Header (Small caps corners) */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3 text-[10px] font-mono tracking-widest uppercase text-muted">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              <span>PROXID // 01</span>
            </div>
            <span>CONCORDIUM TESTNET // CIS-8004</span>
            <span className="hidden sm:inline">POSTGIS PROXIMITY</span>
            <span className="hidden md:inline">x402 STATELESS MICROPAYMENTS</span>
          </div>

          <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left Column: Bold Condensed Typography Poster */}
            <div className="lg:col-span-7">
              {/* Eyebrow */}
              <div className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold tracking-wide text-ink">
                <Fingerprint size={14} className="text-accent" />
                <span>Verified people. Accountable agents.</span>
              </div>

              {/* Massive Condensed Display Headline with Overlapping Hot Pink Script */}
              <div className="relative mt-4">
                <h1 className="text-4xl sm:text-6xl md:text-7xl font-black uppercase tracking-tight text-ink leading-[0.95]">
                  Local work, from someone whose humanity is proven.
                </h1>

                {/* Hot pink overlapping script graphic accent referencing the poster style */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -bottom-4 right-2 sm:right-10 select-none font-serif italic text-3xl sm:text-5xl text-accent -rotate-6 opacity-90 drop-shadow-sm"
                >
                  Verified Nearby
                </span>
              </div>

              {/* Typewriter cycle */}
              <div className="mt-8 text-lg sm:text-xl font-medium text-ink flex items-center gap-2">
                <span className="text-muted">Find:</span>
                <TypewriterText />
              </div>

              {/* Subhead strictly from landing-copy.md */}
              <p className="mt-4 max-w-xl text-sm sm:text-base text-muted leading-relaxed">
                ProxID matches you with verified people nearby, and proxidAI runs the job.
                Every provider carries a zero-knowledge proof that a real person stands behind the
                account. The agent has its own registered identity on Concordium, and it pays per
                action over x402 without ever holding your keys.
              </p>

              {/* CTAs */}
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => openAuth('register')}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-structural bg-accent px-7 text-sm font-bold text-accent-ink shadow-md transition-all duration-200 ease-house hover:brightness-105 active:translate-y-px"
                >
                  Get started
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => openAuth('login')}
                  className="inline-flex h-12 items-center justify-center rounded-full border border-line bg-surface px-6 text-sm font-semibold text-ink shadow-sm transition-colors duration-200 ease-house hover:bg-accent-wash active:translate-y-px"
                >
                  Sign in
                </button>
              </div>

              {/* Powered by Concordium badge */}
              <div className="mt-8 flex items-center gap-3 text-xs text-muted">
                <span>Identity & settlement secured by</span>
                <div className="inline-flex items-center gap-1.5 font-semibold text-ink">
                  <img
                    src="/brands/concordium-small.svg"
                    alt="Concordium"
                    className="h-4 w-4 shrink-0"
                  />
                  <span>Concordium</span>
                </div>
              </div>
            </div>

            {/* Right Column: Interactive Phone Mockup */}
            <div className="lg:col-span-5">
              <PhoneMockup onOpenAuth={() => openAuth('login')} />
            </div>
          </div>
        </div>
      </section>

      {/* 2. CATEGORY MARQUEE */}
      <CategoryMarquee />

      {/* 3. HOW IT WORKS (3 Steps) */}
      <section id="how-it-works" className="px-4 py-16 sm:px-6 sm:py-24 border-b border-line">
        <div className="mx-auto max-w-6xl">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-[11px] font-mono tracking-widest uppercase text-muted">
              THE WORKFLOW
            </span>
            <h2 className="mt-2 text-3xl sm:text-5xl font-black uppercase tracking-tight text-ink">
              How ProxID works
            </h2>
            <p className="mt-3 text-sm text-muted">
              Three steps connecting verified humans with accountable agent automation.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Step 1 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="relative rounded-2xl border border-line bg-surface p-6 shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="font-mono text-2xl font-black text-accent">01</span>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface-sunken/40">
                    <Search className="h-5 w-5 text-ink" />
                  </div>
                </div>
                <h3 className="text-lg font-bold text-ink">Post the job</h3>
                <p className="mt-2 text-xs text-muted leading-relaxed">
                  Say what you need in your own words. proxidAI turns it into a structured job and
                  finds people within reach.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-line/40 text-[11px] font-mono text-muted">
                PostGIS spatial indexing
              </div>
            </motion.div>

            {/* Step 2 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="relative rounded-2xl border border-line bg-surface p-6 shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="font-mono text-2xl font-black text-accent">02</span>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface-sunken/40">
                    <ShieldCheck className="h-5 w-5 text-ink" />
                  </div>
                </div>
                <h3 className="text-lg font-bold text-ink">Check the person</h3>
                <p className="mt-2 text-xs text-muted leading-relaxed">
                  Every provider shows a Verified by Concordium badge. That is a zero-knowledge
                  proof of a real identity, and it reveals nothing else about them.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-line/40 text-[11px] font-mono text-muted">
                Zero-knowledge proof verification
              </div>
            </motion.div>

            {/* Step 3 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="relative rounded-2xl border border-line bg-surface p-6 shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="font-mono text-2xl font-black text-accent">03</span>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface-sunken/40">
                    <Bot className="h-5 w-5 text-ink" />
                  </div>
                </div>
                <h3 className="text-lg font-bold text-ink">The agent runs it</h3>
                <p className="mt-2 text-xs text-muted leading-relaxed">
                  proxidAI coordinates in the job room, agrees the price, and pays over x402. You
                  approve anything irreversible in the Concordium ID app.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-line/40 text-[11px] font-mono text-muted">
                x402 protocol settlement
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 4. FEATURE CARDS (Six cards, Asymmetric Grid) */}
      <section id="features" className="px-4 py-16 sm:px-6 sm:py-24 border-b border-line">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14">
            <span className="text-[11px] font-mono tracking-widest uppercase text-muted">
              CRYPTOGRAPHIC TRUST
            </span>
            <h2 className="mt-2 text-3xl sm:text-5xl font-black uppercase tracking-tight text-ink">
              Engineered for genuine accountability
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Card 1 */}
            <motion.div
              whileHover={{ y: -3 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-2xl border border-line bg-surface p-6 shadow-sm"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-wash text-accent-ink mb-4">
                <Fingerprint className="h-5 w-5 text-accent" />
              </div>
              <h3 className="text-base font-bold text-ink">Proof, not a profile photo</h3>
              <p className="mt-2 text-xs text-muted leading-relaxed">
                A verified human is a cryptographic claim, not a selfie.
              </p>
            </motion.div>

            {/* Card 2 */}
            <motion.div
              whileHover={{ y: -3 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-2xl border border-line bg-surface p-6 shadow-sm"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-wash text-accent-ink mb-4">
                <Bot className="h-5 w-5 text-accent" />
              </div>
              <h3 className="text-base font-bold text-ink">An agent with its own identity</h3>
              <p className="mt-2 text-xs text-muted leading-relaxed">
                proxidAI is registered on Concordium with its own account, so it answers for what it
                does.
              </p>
            </motion.div>

            {/* Card 3 */}
            <motion.div
              whileHover={{ y: -3 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-2xl border border-line bg-surface p-6 shadow-sm"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-wash text-accent-ink mb-4">
                <Coins className="h-5 w-5 text-accent" />
              </div>
              <h3 className="text-base font-bold text-ink">Payments without a wallet lesson</h3>
              <p className="mt-2 text-xs text-muted leading-relaxed">
                x402 settles per action, and a sponsor covers the network fee. Nobody buys gas.
              </p>
            </motion.div>

            {/* Card 4 */}
            <motion.div
              whileHover={{ y: -3 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-2xl border border-line bg-surface p-6 shadow-sm"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-wash text-accent-ink mb-4">
                <QrCode className="h-5 w-5 text-accent" />
              </div>
              <h3 className="text-base font-bold text-ink">You approve the irreversible things</h3>
              <p className="mt-2 text-xs text-muted leading-relaxed">
                Consent happens in the Concordium ID app, against a request hash that cannot be
                altered in transit.
              </p>
            </motion.div>

            {/* Card 5 */}
            <motion.div
              whileHover={{ y: -3 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-2xl border border-line bg-surface p-6 shadow-sm"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-wash text-accent-ink mb-4">
                <CheckCircle2 className="h-5 w-5 text-accent" />
              </div>
              <h3 className="text-base font-bold text-ink">A record you can audit</h3>
              <p className="mt-2 text-xs text-muted leading-relaxed">
                Every verification, consent and payment is anchored as a hash on chain. The records
                stay off chain.
              </p>
            </motion.div>

            {/* Card 6 */}
            <motion.div
              whileHover={{ y: -3 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-2xl border border-line bg-surface p-6 shadow-sm"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-wash text-accent-ink mb-4">
                <MapPin className="h-5 w-5 text-accent" />
              </div>
              <h3 className="text-base font-bold text-ink">Matched by distance, not by city</h3>
              <p className="mt-2 text-xs text-muted leading-relaxed">
                PostGIS proximity means the person is actually near you, not just in your city.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 5. PROOF SECTION ("Check it yourself.") */}
      <section className="px-4 py-16 sm:px-6 sm:py-24 border-b border-line bg-surface/30">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-3xl border border-line bg-surface p-8 sm:p-12 shadow-sm">
            <div className="max-w-2xl">
              <span className="text-[11px] font-mono tracking-widest uppercase text-muted">
                PUBLIC ON-CHAIN VERIFICATION
              </span>
              <h2 className="mt-2 text-3xl sm:text-4xl font-black uppercase tracking-tight text-ink">
                Check it yourself.
              </h2>
              <p className="mt-3 text-sm text-muted leading-relaxed">
                The agent's card, its badge and its payments are all on chain. Open the registry and
                verify them without taking our word for anything.
              </p>
            </div>

            <div className="mt-8 grid sm:grid-cols-3 gap-4">
              {/* Link 1 */}
              <button
                type="button"
                onClick={() => openAuth('login')}
                className="group flex flex-col justify-between rounded-xl border border-line bg-page p-4 text-left transition-colors duration-200 hover:border-structural"
              >
                <div>
                  <p className="text-xs font-bold text-ink flex items-center justify-between">
                    <span>The agent card</span>
                    <ExternalLink
                      size={14}
                      className="text-muted group-hover:text-ink transition-colors"
                    />
                  </p>
                  <p className="mt-1 text-[11px] text-muted">
                    CIS-8004 metadata card with SHA-256 integrity hash.
                  </p>
                </div>
                <span className="mt-3 text-[10px] font-mono text-accent flex items-center gap-1">
                  <span>Verify agent</span>
                  <ArrowRight size={11} aria-hidden="true" />
                </span>
              </button>

              {/* Link 2 */}
              <a
                href="https://testnet.ccdexplorer.io"
                target="_blank"
                rel="noreferrer"
                className="group flex flex-col justify-between rounded-xl border border-line bg-page p-4 text-left transition-colors duration-200 hover:border-structural"
              >
                <div>
                  <p className="text-xs font-bold text-ink flex items-center justify-between">
                    <span>The registry</span>
                    <ExternalLink
                      size={14}
                      className="text-muted group-hover:text-ink transition-colors"
                    />
                  </p>
                  <p className="mt-1 text-[11px] text-muted">
                    Concordium testnet contract index 12802, subindex 0.
                  </p>
                </div>
                <span className="mt-3 text-[10px] font-mono text-accent flex items-center gap-1">
                  <span>CCDExplorer</span>
                  <ArrowRight size={11} aria-hidden="true" />
                </span>
              </a>

              {/* Link 3 */}
              <button
                type="button"
                onClick={() => openAuth('login')}
                className="group flex flex-col justify-between rounded-xl border border-line bg-page p-4 text-left transition-colors duration-200 hover:border-structural"
              >
                <div>
                  <p className="text-xs font-bold text-ink flex items-center justify-between">
                    <span>A payment receipt</span>
                    <ExternalLink
                      size={14}
                      className="text-muted group-hover:text-ink transition-colors"
                    />
                  </p>
                  <p className="mt-1 text-[11px] text-muted">
                    x402 gas-sponsored settlement proof with transaction hash.
                  </p>
                </div>
                <span className="mt-3 text-[10px] font-mono text-accent flex items-center gap-1">
                  <span>Inspect settlement</span>
                  <ArrowRight size={11} aria-hidden="true" />
                </span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 6. FINAL CTA */}
      <section className="px-4 py-20 sm:px-6 sm:py-28 border-b border-line text-center">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl sm:text-5xl font-black uppercase tracking-tight text-ink leading-tight">
            Hire someone real, with an agent doing the paperwork.
          </h2>
          <p className="mt-4 text-base text-muted font-medium">No wallet needed to start.</p>
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={() => openAuth('register')}
              className="inline-flex h-14 items-center justify-center gap-2 rounded-full border border-structural bg-accent px-10 text-base font-bold text-accent-ink shadow-lg transition-transform duration-200 ease-house hover:brightness-105 active:translate-y-px"
            >
              Get started
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>

      {/* 7. FOOTER */}
      <footer className="px-4 py-10 sm:px-6 border-t border-line/60">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted">
          <div className="flex items-center gap-2.5">
            <Logo className="h-5 w-5" />
            <span className="font-bold text-ink tracking-tight">ProxID</span>
            <span className="text-muted/60" aria-hidden="true">/</span>
            <span className="inline-flex items-center gap-1 font-medium text-ink">
              <img
                src="/brands/concordium-small.svg"
                alt=""
                className="h-3.5 w-3.5 shrink-0"
                aria-hidden="true"
              />
              Verified by Concordium.
            </span>
          </div>

          <div className="flex items-center gap-6">
            <a href="#how-it-works" className="hover:text-ink transition-colors">
              How it works
            </a>
            <span className="text-muted/40" aria-hidden="true">/</span>
            <button
              type="button"
              onClick={() => openAuth('login')}
              className="hover:text-ink transition-colors"
            >
              Security
            </button>
            <span className="text-muted/40" aria-hidden="true">/</span>
            <button
              type="button"
              onClick={() => openAuth('login')}
              className="hover:text-ink transition-colors"
            >
              Privacy
            </button>
            <span className="text-muted/40" aria-hidden="true">/</span>
            <button
              type="button"
              onClick={() => openAuth('login')}
              className="hover:text-ink transition-colors"
            >
              Terms
            </button>
          </div>
        </div>
      </footer>

      {/* Auth Modal Triggered From Any CTA on Landing */}
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} defaultTab={authTab} />
    </div>
  )
}
