/**
 * Push notifications and in-app alerts service.
 * Pure ASCII.
 */

import { api, query } from '@/lib/api'
import type {
  NotificationItem,
  PushPublicKey,
  PushStatus,
  PushSubscriptionData,
} from '@/types/api'

export const notificationService = {
  getVapidPublicKey: () => api.get<PushPublicKey>('/push/vapid-public-key'),

  getPushStatus: () => api.get<PushStatus>('/push/status'),

  subscribePush: (data: PushSubscriptionData) =>
    api.post<{ status: string }>('/push/subscribe', data),

  listNotifications: (limit = 50, offset = 0) =>
    api.get<NotificationItem[]>(`/notifications${query({ limit, offset })}`),

  markNotificationRead: (id: string) =>
    api.patch<void>(`/notifications/${id}/read`),

  triggerTestNotification: (payload: {
    title: string
    message: string
    link?: string
    type?: string
    actions?: Array<{ action: string; title: string }>
  }) =>
    api.post<{
      status: string
      delivery_path: string
      notification_id: string
      push_delivered: boolean
    }>('/notifications/test', payload),
}
