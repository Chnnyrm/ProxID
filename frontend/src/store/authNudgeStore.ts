/**
 * authNudgeStore.ts - Store for managing the cartoon RequireAuth nudge modal.
 * Pure ASCII only.
 */

import { create } from 'zustand'

interface AuthNudgeState {
  isOpen: boolean
  action: string
  openNudge: (action: string) => void
  closeNudge: () => void
}

export const useAuthNudgeStore = create<AuthNudgeState>((set) => ({
  isOpen: false,
  action: 'continue with this action',
  openNudge: (action: string) => set({ isOpen: true, action }),
  closeNudge: () => set({ isOpen: false }),
}))
