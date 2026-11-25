/**
 * Hooks for notifications and web push management.
 * Pure ASCII.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { notificationService } from '@/services/notificationService'
import type { PushSubscriptionData } from '@/types/api'

export const notificationKeys = {
  all: ['notifications'] as const,
  pushStatus: ['push', 'status'] as const,
}

export function useNotifications(enabled = true) {
  return useQuery({
    queryKey: notificationKeys.all,
    queryFn: () => notificationService.listNotifications(),
    enabled,
  })
}

export function usePushStatus(enabled = true) {
  return useQuery({
    queryKey: notificationKeys.pushStatus,
    queryFn: () => notificationService.getPushStatus(),
    enabled,
  })
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => notificationService.markNotificationRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all })
    },
  })
}

export function useSubscribePush() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: PushSubscriptionData) => notificationService.subscribePush(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.pushStatus })
    },
  })
}

export function useTriggerTestNotification() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: {
      title: string
      message: string
      link?: string
      type?: string
      actions?: Array<{ action: string; title: string }>
    }) => notificationService.triggerTestNotification(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all })
    },
  })
}
