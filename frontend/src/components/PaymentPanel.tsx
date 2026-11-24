/**
 * The x402 panel in a job room.
 *
 * This is the screen where honesty matters most. The rail is not connected, so the panel
 * shows the 402 requirement the server would send, says plainly that nothing was
 * charged, and never renders a transaction hash that does not exist.
 */

import { AlertTriangle, CreditCard, ShieldCheck } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useInitiatePayment, usePaymentStatus, useSettlePayment } from '@/hooks/usePayments'
import { money, paymentLabel } from '@/lib/format'

export function PaymentPanel({ jobId, amount, currency }: { jobId: string; amount: number; currency: string }) {
  const status = usePaymentStatus(jobId, true)
  const initiate = useInitiatePayment(jobId)
  const settle = useSettlePayment(jobId)
  const receipt = status.data ?? null

  const busy = initiate.isPending || settle.isPending
  const answer = initiate.data ?? settle.data ?? null

  return (
    <Card>
      <CardHeader
        title="Payment"
        hint="x402 on Concordium. The buyer signs, the facilitator sponsors gas."
        action={<Badge tone="neutral">{paymentLabel(receipt?.status)}</Badge>}
      />

      <CardBody className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm text-muted">Amount on the job</span>
          <span className="text-lg font-semibold text-ink">{money(amount, currency)}</span>
        </div>

        {status.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : receipt ? (
          <dl className="space-y-1.5 rounded-xl border border-line bg-sunken/40 p-3 text-xs">
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Status</dt>
              <dd className="font-medium text-ink">{paymentLabel(receipt.status)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Network</dt>
              <dd className="text-ink">{receipt.network}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Settlement hash</dt>
              <dd className="text-ink">
                {receipt.x402_tx_hash ? receipt.x402_tx_hash : 'none, pending settlement'}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="rounded-xl border border-dashed border-line p-3 text-xs text-muted">
            No payment has been asked for on this job yet.
          </p>
        )}

        {answer ? (
          <p
            role="status"
            className="flex items-start gap-2 rounded-xl border border-line bg-accent-wash p-3 text-xs text-ink"
          >
            <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{answer.message}</span>
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            intent="primary"
            onClick={() => initiate.mutate()}
            loading={initiate.isPending}
            disabled={busy}
          >
            <CreditCard size={15} aria-hidden="true" />
            Start payment
          </Button>
          {receipt && receipt.status !== 'settled' ? (
            <Button
              intent="secondary"
              onClick={() => settle.mutate(receipt.id)}
              loading={settle.isPending}
              disabled={busy}
            >
              <ShieldCheck size={15} aria-hidden="true" />
              Settle
            </Button>
          ) : null}
        </div>

        <p className="text-[11px] leading-relaxed text-muted">
          The rail is built and not connected: no facilitator URL or merchant account has been
          issued, so both actions record a receipt and answer &quot;not configured&quot;. No money
          moves and no hash is invented.
        </p>
      </CardBody>
    </Card>
  )
}
