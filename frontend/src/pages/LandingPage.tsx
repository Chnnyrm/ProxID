/**
 * Landing. The four beats of the product, and one button that puts a judge inside them.
 *
 * The Judge Demo button is the most prominent control on the page because it is the only
 * way to see the whole thing without an OAuth account, a wallet or a chain.
 */

import { ArrowRight, BadgeCheck, Coins, QrCode, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'

const BEATS = [
  {
    icon: BadgeCheck,
    title: 'A verified human, not a profile',
    body: 'A provider carries a Concordium zero-knowledge proof of personhood. The badge says a proof exists, never who the person is.',
  },
  {
    icon: QrCode,
    title: 'Consent through the ID app',
    body: 'The site posts a single-use, domain-bound request and shows a QR. The person approves in the Concordium ID app and the proof comes back.',
  },
  {
    icon: ShieldCheck,
    title: 'An agent with its own identity',
    body: 'The agent holds a scoped credential and its own low-balance account, so it never spends from the human account.',
  },
  {
    icon: Coins,
    title: 'Receipts that settle over x402',
    body: 'The buyer signs, the facilitator sponsors gas, and the settlement hash lands on the job. No hash exists until it really settles.',
  },
]

export function LandingPage() {
  const navigate = useNavigate()
  const { isSignedIn, isDemo, demoLogin, error, isLoading } = useAuth()

  const launch = async () => {
    const ok = await demoLogin()
    if (ok) navigate('/jobs')
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <section className="animate-fade-rise">
        <Badge tone="quiet">Concordium Trusted Agents Hackathon</Badge>
        <h1 className="mt-3 max-w-2xl text-3xl font-semibold leading-[1.15] tracking-tight text-ink sm:text-5xl">
          Local work, done by someone whose humanity is proven.
        </h1>
        <p className="mt-4 max-w-2xl text-base text-muted sm:text-lg">
          Post a job, find a provider nearby, talk in the job room, and let the agent run the
          paperwork. Providers carry a zero-knowledge proof that they are a real person, the agent
          is registered with its own card, and payments settle over x402 on Concordium.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button size="lg" onClick={() => void launch()} loading={isLoading} className="sm:w-auto">
            Launch Judge Demo
            <ArrowRight size={16} aria-hidden="true" />
          </Button>
          <Button intent="secondary" size="lg" onClick={() => navigate('/jobs')}>
            Browse the jobs
          </Button>
          {isSignedIn && !isDemo ? (
            <span className="text-sm text-muted">You are signed in.</span>
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="mt-3 max-w-xl rounded-xl border border-line bg-accent-wash p-3 text-sm text-ink">
            {error}
          </p>
        ) : null}

        <p className="mt-2 max-w-xl text-xs text-muted">
          One click, no OAuth and no wallet. The demo signs you into a seeded profile and says
          clearly, on every screen, that the data is seeded and nothing is on chain.
        </p>
      </section>

      <section className="mt-10 grid gap-3 sm:grid-cols-2" aria-label="What makes ProxID different">
        {BEATS.map((beat, index) => (
          <Card key={beat.title} className="animate-fade-rise" style={{ animationDelay: `${index * 60}ms` }}>
            <CardBody>
              <beat.icon size={18} className="text-ink" aria-hidden="true" />
              <h2 className="mt-2 text-base font-semibold text-ink">{beat.title}</h2>
              <p className="mt-1 text-sm text-muted">{beat.body}</p>
            </CardBody>
          </Card>
        ))}
      </section>

      <section className="mt-10 rounded-card border border-line bg-surface p-5">
        <h2 className="text-base font-semibold text-ink">What is built, and what is waiting</h2>
        <div className="mt-3 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <p className="font-medium text-ink">Built and running</p>
            <ul className="mt-1 space-y-1 text-muted">
              <li>PostGIS proximity search over providers and jobs</li>
              <li>The agent with typed tools and a reviewable activity log</li>
              <li>Job rooms, state machine and an append-only audit trail</li>
              <li>The Veriox identity adapter, with a stub behind the same interface</li>
              <li>The x402 payment interface and the nine verification rules</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-ink">Waiting for credentials</p>
            <ul className="mt-1 space-y-1 text-muted">
              <li>Veriox API paths and key: demo.veriox.io publishes no schema</li>
              <li>A Concordium node endpoint for anchoring</li>
              <li>An x402 facilitator and a merchant account</li>
              <li>An agent account and an Agent IDP credential</li>
            </ul>
            <p className="mt-2 text-xs text-muted">
              Until these exist, the interfaces answer &quot;not configured&quot; and no network call
              is attempted.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
