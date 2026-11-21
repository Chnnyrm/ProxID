/**
 * The agent: run a command, read the activity log, read the agent card and identity.
 */

import { api } from '@/lib/api'
import type { AgentRunResponse, AgentActivityResponse } from '@/lib/contracts'
import type { AgentCard, AgentIdentity, AgentTools } from '@/types/api'

export const agentService = {
  /** Ask the agent to do something. The reply carries what it actually did. */
  run: (command: string, jobId?: string | null) =>
    api.post<AgentRunResponse>('/agent/run', {
      command,
      ...(jobId ? { job_id: jobId } : {}),
    }),

  /** The tools this build exposes, and whether a model is configured. */
  tools: () => api.get<AgentTools>('/agent/tools'),

  /** What the agent did on this account. */
  activity: () => api.get<AgentActivityResponse>('/agent/log'),

  /** The card this build would register, with the five verification checks. */
  card: () => api.get<AgentCard>('/agent/card'),

  /** The agent's own scoped identity, kept separate from the human's. */
  identity: () => api.get<AgentIdentity>('/agent/identity'),

  /** Register the agent. Not configured in this build; answers with a sentence. */
  register: () => api.post<{ agent_id: string; agent_card_url: string }>('/agent/register'),
}
