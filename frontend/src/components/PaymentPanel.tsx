/**
 * The x402 panel in a job room.
 *
 * This is the screen where honesty matters most. When settled, it displays the on-chain
 * transaction hash with a direct link to testnet.ccdscan.io. When not yet settled,
 * it plainly states that no settlement has occurred and no hash exists.
 */

import { AlertTriangle, CheckCircle, CreditCard, ExternalLink, ShieldCheck } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useInitiatePayment, usePaymentStatus, useSettlePayment } from '@/hooks/usePayments'
import { money, paymentLabel } from '@/lib/format'

export function PaymentPanel({
  jobId,
  amount,
  currency,
  jobTxHash,
}: {
  jobId: string
  amount: number
  currency: string
  jobTxHash?: string | null
}) {
  const status = usePaymentStatus(jobId, true)
  const initiate = useInitiatePayment(jobId)
  const settle = useSettlePayment(jobId)
  const receipt = status.data ?? null

  const busy = initiate.isPending || settle.isPending
  const answer = initiate.data ?? settle.data ?? null

  const effectiveTxHash = receipt?.x402_tx_hash || jobTxHash || null
  const isSettled = receipt?.status === 'settled' || Boolean(effectiveTxHash)

  return (
    <Card>
      <CardHeader
        title="Payment"
        hint="x402 on Concordium. The buyer signs, the facilitator sponsors gas."
        action={
          isSettled ? (
            <Badge tone="positive" className="inline-flex items-center gap-1">
              <CheckCircle size={11} aria-hidden="true" />
              Settled
            </Badge>
          ) : (
            <Badge tone="neutral">{paymentLabel(receipt?.status)}</Badge>
          )
        }
      />

      <CardBody className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm text-muted">Amount on the job</span>
          <span className="text-lg font-semibold text-ink">{money(amount, currency)}</span>
        </div>

        {status.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : receipt || effectiveTxHash ? (
          <dl className="space-y-1.5 rounded-xl border border-line bg-sunken/40 p-3 text-xs">
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Status</dt>
              <dd className="font-medium text-ink">
                {isSettled ? 'Settled on Concordium' : paymentLabel(receipt?.status)}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Network</dt>
              <dd className="text-ink">{receipt?.network || 'concordium'}</dd>
            </div>
            <div className="flex justify-between items-center gap-2">
              <dt className="text-muted">Settlement hash</dt>
              <dd className="text-ink">
                {effectiveTxHash ? (
                  <a
                    href={`https://testnet.ccdscan.io/?r=${effectiveTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-mono font-semibold text-primary underline hover:text-primary-hover"
                    title="View transaction on CCDScan Explorer"
                  >
                    <span>{effectiveTxHash.slice(0, 10)}...{effectiveTxHash.slice(-8)}</span>
                    <ExternalLink size={12} aria-hidden="true" />
                  </a>
                ) : (
                  <span className="text-muted">No settlement yet. No transaction hash exists.</span>
                )}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="rounded-xl border border-dashed border-line p-3 text-xs text-muted">
            No settlement yet. No transaction hash exists.
          </p>
        )}

        {effectiveTxHash ? (
          <div className="pt-1">
            <a
              href={`https://testnet.ccdscan.io/?r=${effectiveTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-accent/40 bg-accent/10 text-xs font-mono font-medium text-ink hover:bg-accent/20 transition-all shadow-xs"
            >
              <ExternalLink size={13} className="text-accent" aria-hidden="true" />
              <span>View On-Chain Receipt (CCDScan)</span>
            </a>
          </div>
        ) : null}

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
          {!isSettled ? (
            <>
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
            </>
          ) : (
            <div className="text-xs text-muted">
              Settlement completed. Funds transferred and finalized on Concordium testnet.
            </div>
          )}
        </div>

        <p className="text-[11px] leading-relaxed text-muted">
          x402 rail operates via dual managed keys: the backend payer account signs the transfer,
          and the Concordium facilitator sponsors gas. A user never holds a private key.
        </p>
      </CardBody>
    </Card>
  )
}
