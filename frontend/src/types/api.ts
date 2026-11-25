/**
 * Domain entities. This module imports nothing: it is the shape of the world, and
 * every other layer may depend on it.
 *
 * `is_demo` is a field on a real record, not a label in the copy. Anything read from
 * it is seeded demonstration data, and the interface must say so wherever it shows.
 */

export type Role = 'client' | 'provider' | 'both'

export type JobStatus =
  | 'open'
  | 'requested'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'disputed'

export type MessageAuthor = 'client' | 'provider' | 'system' | 'agent'

export type X402Status = 'not_configured' | 'pending' | 'settled' | 'failed' | 'demo'

export type VerificationStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'consumed'
  | 'demo_approved'

export interface User {
  id: string
  display_name: string
  role: Role | string
  avatar_url: string | null
  bio: string | null
  neighbourhood: string | null
  concordium_verified: boolean
  cis8004_agent_id: string | null
  is_demo: boolean
  created_at: string
}

export interface Me extends User {
  email: string
  concordium_account_address: string | null
  latitude: number | null
  longitude: number | null
  agent_autonomy_level?: string
}

export interface Session {
  access_token: string
  token_type: 'bearer'
  expires_at: string
  user: Me
}

export interface Category {
  id: string
  name: string
  slug: string
  description: string | null
}

export interface ProviderService {
  id: string
  title: string
  price: number
  category_name: string | null
  image_url?: string | null
}

export interface Provider extends User {
  distance_km: number | null
  completed_jobs: number
  average_rating: number | null
  rating_count: number
  services: ProviderService[]
}

export interface ServiceListing {
  id: string
  provider_id: string
  category_id: string | null
  category_name: string | null
  title: string
  description: string | null
  price: number
  min_price: number | null
  max_price: number | null
  currency: string
  latitude: number | null
  longitude: number | null
  radius_km: number
  image_url: string | null
  is_active: boolean
  distance_km: number | null
  provider_display_name: string | null
  provider_avatar_url: string | null
  provider_concordium_verified: boolean
  is_demo: boolean
  created_at: string
}

export interface Job {
  id: string
  client_id: string
  provider_id: string | null
  service_listing_id: string | null
  category_id: string | null
  category_name: string | null
  title: string
  description: string | null
  price: number
  min_price: number | null
  max_price: number | null
  currency: string
  status: JobStatus | string
  latitude: number | null
  longitude: number | null
  image_url: string | null
  distance_km: number | null
  client_display_name: string | null
  provider_display_name: string | null
  x402_tx_hash: string | null
  is_demo: boolean
  created_at: string
  updated_at: string
}

export interface JobMessage {
  id: string
  job_id: string
  sender_id: string | null
  author_kind: MessageAuthor | string
  body: string
  sender_display_name: string | null
  is_demo: boolean
  created_at: string
}

export interface JobRoom {
  job: Job
  client: User
  provider: User | null
  messages: JobMessage[]
  payment_status: string | null
}

export interface AgentStep {
  tool: string
  summary: string
  succeeded: boolean
  arguments?: Record<string, any> | null
  result?: Record<string, any> | null
  created_at: string | null
}

export interface AgentAction {
  id: string
  label: string
  kind: string
  target?: string | null
  payload?: Record<string, any> | null
}

export interface AgentRun {
  reply: string
  steps: AgentStep[]
  used_tools: string[]
  degraded: boolean
  actions?: AgentAction[]
}

export interface AgentTurn {
  id: string
  conversation_id: string
  role: string
  content: string
  steps?: AgentStep[] | null
  used_tools?: string[] | null
  actions?: AgentAction[] | null
  degraded?: boolean
  created_at: string
}

export interface AgentConversation {
  id: string
  title: string
  turns: AgentTurn[]
  created_at: string
}

export interface PushSubscriptionKeys {
  p256dh: string
  auth: string
}

export interface PushSubscriptionData {
  endpoint: string
  keys: PushSubscriptionKeys
  user_agent?: string | null
}

export interface PushStatus {
  subscribed: boolean
  count: number
}

export interface PushPublicKey {
  public_key: string
}

export interface NotificationItem {
  id: string
  title: string
  message: string
  link?: string | null
  type: string
  tag?: string | null
  actions?: Array<{ action: string; title: string }> | null
  is_read: boolean
  push_sent: boolean
  created_at: string
}

export interface AgentTools {
  tools: string[]
  llm_configured: boolean
  model: string | null
}

export interface AgentCardCheck {
  name: string
  passed: boolean
  detail: string
}

export interface AgentCard {
  card: Record<string, unknown>
  registered: boolean
  agent_id: string | null
  agent_verified: boolean
  agent_account_address: string | null
  registry_configured: boolean
  registry_address: string
  verification: {
    valid: boolean
    checks: AgentCardCheck[]
    failed: string[]
  }
  spending_limits: SpendingLimits
  is_demo: boolean
}

export interface AgentIdentity {
  agent_account_address: string | null
  agent_verified: boolean
  agent_verification_ref: string | null
  human_verified: boolean
  human_account_address: string | null
  idp_configured: boolean
  separate_account: boolean
  is_demo: boolean
  note: string
}

export interface SpendingLimits {
  per_payment_cap: number
  daily_cap: number
  recipient_allowlist: string[]
  requires_human_approval: boolean
  enforced_by: string
}

export interface X402Receipt {
  id: string
  job_id: string
  amount: number
  currency: string
  status: X402Status | string
  network: string
  x402_tx_hash: string | null
  payer_account: string | null
  payee_account: string | null
  is_demo: boolean
  failure_reason: string | null
  created_at: string
  settled_at: string | null
}

export interface X402Action {
  configured: boolean
  status: X402Status | string
  message: string
  network: string
  receipt: X402Receipt | null
}

export interface Verification {
  nonce: string
  purpose: string
  bound_domain: string
  status: VerificationStatus | string
  qr_payload: string | null
  request_anchor_ref: string | null
  audit_anchor_ref: string | null
  expires_at: string
  is_demo: boolean
  configured: boolean
  message: string
}

export interface Approval {
  status: string
  verified: boolean
  message: string
  proof_reference: string | null
  audit_anchor_ref: string | null
}

export interface MapConfig {
  tile_url: string
  attribution: string
}
