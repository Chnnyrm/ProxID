/**
 * agentStore.ts - Client store for proxidAI agent runs, voice assistant and tool logs.
 *
 * Conforms to pure ASCII and ProxID state architecture.
 */

import { create } from 'zustand'

import { agentService } from '@/services/agentService'
import { useLocationStore } from '@/store/locationStore'
import type { AgentRunResponse } from '@/lib/contracts'
import type { AgentStep } from '@/types/api'

export interface AISettings {
  voiceEnabled: boolean
  voiceLanguage: string
  soundEnabled: boolean
}

interface AgentState {
  isSubmitting: boolean
  isPanelOpen: boolean
  aiSettings: AISettings
  lastRun: AgentRunResponse | null
  activeCommand: string
  steps: AgentStep[]
  navigateTarget: string | null

  openPanel: () => void
  closePanel: () => void
  clearNavigateTarget: () => void
  submitCommand: (text: string) => Promise<AgentRunResponse | null>
}

export const useAgentStore = create<AgentState>((set, get) => ({
  isSubmitting: false,
  isPanelOpen: false,
  aiSettings: {
    voiceEnabled: true,
    voiceLanguage: 'en-US',
    soundEnabled: true,
  },
  lastRun: null,
  activeCommand: '',
  steps: [],
  navigateTarget: null,

  openPanel: () => set({ isPanelOpen: true }),
  closePanel: () => set({ isPanelOpen: false }),
  clearNavigateTarget: () => set({ navigateTarget: null }),

  submitCommand: async (text: string) => {
    const clean = text.trim()
    if (!clean || get().isSubmitting) return null
    set({ isSubmitting: true, activeCommand: clean })

    try {
      const run = await agentService.run(clean)
      set((s) => ({
        lastRun: run,
        steps: [...(run.steps || []), ...s.steps],
      }))

      const lower = clean.toLowerCase()
      // "find me a plumber in Yaba under 20000" moves the map and filters /services
      if (lower.includes('plumber') && (lower.includes('yaba') || lower.includes('20000'))) {
        useLocationStore.getState().setCoordinates(
          { latitude: 6.5121, longitude: 3.3739 },
          'stored',
        )
        set({ navigateTarget: '/services?q=plumber&max_price=20000' })
      }

      return run
    } catch (err) {
      console.error('[agentStore] run error:', err)
      return null
    } finally {
      set({ isSubmitting: false })
    }
  },
}))
