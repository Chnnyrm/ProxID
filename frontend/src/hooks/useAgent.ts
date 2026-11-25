/**
 * The agent: run a command, watch the activity, read the card and the identity.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { agentService } from '@/services/agentService'

export const agentKeys = {
  tools: ['agent', 'tools'] as const,
  activity: ['agent', 'activity'] as const,
  card: ['agent', 'card'] as const,
  identity: ['agent', 'identity'] as const,
  conversation: ['agent', 'conversation'] as const,
}

/** Whether the model is configured, and which tools exist. */
export function useAgentTools() {
  return useQuery({ queryKey: agentKeys.tools, queryFn: () => agentService.tools() })
}

/** Load user's persisted conversation thread. */
export function useAgentConversation(enabled: boolean) {
  return useQuery({
    queryKey: agentKeys.conversation,
    queryFn: () => agentService.conversation(),
    enabled,
  })
}

/** What the agent did on this account. */
export function useAgentActivity(enabled: boolean) {
  return useQuery({
    queryKey: agentKeys.activity,
    queryFn: () => agentService.activity(),
    enabled,
  })
}

/** The card and its five checks. */
export function useAgentCard(enabled: boolean) {
  return useQuery({
    queryKey: agentKeys.card,
    queryFn: () => agentService.card(),
    enabled,
  })
}

/** The agent's own scoped identity. */
export function useAgentIdentity(enabled: boolean) {
  return useQuery({
    queryKey: agentKeys.identity,
    queryFn: () => agentService.identity(),
    enabled,
  })
}

/** Ask the agent to do something, then refresh its log. */
export function useRunAgent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { command: string; jobId?: string | null }) =>
      agentService.run(input.command, input.jobId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: agentKeys.activity })
      void queryClient.invalidateQueries({ queryKey: agentKeys.conversation })
      void queryClient.invalidateQueries({ queryKey: ['jobs'] })
    },
  })
}
