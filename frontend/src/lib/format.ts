/**
 * Formatting for the things a person reads: money, distance, time, and a short hash.
 *
 * Prices are stored in the currency the job carries (NGN in the demo). The interface
 * never converts: a converted price is a different number from the one agreed.
 */

const CURRENCY_SYMBOLS: Record<string, string> = {
  NGN: '\u20a6',
  USD: '$',
  EUR: '\u20ac',
  GBP: '\u00a3',
}

/** A price with its currency symbol, no decimals when the amount is whole. */
export function money(amount: number, currency = 'NGN'): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `
  const rounded = Number.isInteger(amount) ? amount : Number(amount.toFixed(2))
  return `${symbol}${rounded.toLocaleString('en-NG')}`
}

/** A distance in kilometres, from the metres or kilometres the API returns. */
export function distance(km: number | null | undefined): string {
  if (km === null || km === undefined) return 'Distance unknown'
  if (km < 1) return `${Math.round(km * 1000)} m away`
  return `${km.toFixed(1)} km away`
}

/** A relative time, in the words a person would use. */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days} d ago`
  return new Date(iso).toLocaleDateString()
}

/** A clock time for a room message. */
export function clockTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/**
 * A hash or an address shortened for display. Never used to hide the value in a place
 * where the full value matters: a receipt shows its hash in full when one exists.
 */
export function shorten(value: string, lead = 6, tail = 4): string {
  if (value.length <= lead + tail + 1) return value
  return `${value.slice(0, lead)}...${value.slice(-tail)}`
}

/** A job status as a person reads it. */
export function statusLabel(status: string): string {
  switch (status) {
    case 'in_progress':
      return 'In progress'
    case 'open':
      return 'Open'
    case 'requested':
      return 'Requested'
    case 'assigned':
      return 'Assigned'
    case 'completed':
      return 'Completed'
    case 'cancelled':
      return 'Cancelled'
    case 'disputed':
      return 'Disputed'
    default:
      return status
  }
}

/** A receipt status as a person reads it, including the honest "not connected". */
export function paymentLabel(status: string | null | undefined): string {
  switch (status) {
    case 'not_configured':
      return 'Rail not connected'
    case 'pending':
      return 'Awaiting signature'
    case 'settled':
      return 'Settled'
    case 'failed':
      return 'Did not settle'
    case 'demo':
      return 'Demo receipt'
    case null:
    case undefined:
      return 'No payment'
    default:
      return status
  }
}
