/**
 * NotificationBell.tsx - In-app notification center and Web Push controller.
 * Pure ASCII, palette compliant (Ink #474329, Sand #FAF4ED, Accent #FC75B4).
 */

import { useState } from 'react'
import { AlertCircle, Bell, Check, ExternalLink, Send, ShieldCheck, Sparkles, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import {
  useMarkNotificationRead,
  useNotifications,
  usePushStatus,
  useTriggerTestNotification,
} from '@/hooks/useNotifications'
import { useApplyJob } from '@/hooks/useJobs'
import { subscribeToPushNotifications } from '@/lib/push'

export function NotificationBell() {
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const [subscribing, setSubscribing] = useState(false)

  const notifications = useNotifications()
  const pushStatus = usePushStatus()
  const markRead = useMarkNotificationRead()
  const triggerTest = useTriggerTestNotification()
  const applyJob = useApplyJob()

  const list = notifications.data || []
  const unreadCount = list.filter((n) => !n.is_read).length

  const handleSubscribe = async () => {
    setSubscribing(true)
    try {
      await subscribeToPushNotifications()
      void pushStatus.refetch()
    } finally {
      setSubscribing(false)
    }
  }

  const handleTestNotification = async () => {
    await triggerTest.mutateAsync({
      title: 'Agent Match Found',
      message: 'A verified plumber in Yaba is ready for your job request.',
      link: '/jobs',
      type: 'agent',
      actions: [
        { action: 'view', title: 'View Job' },
        { action: 'chat', title: 'Open Room' },
      ],
    })
    void notifications.refetch()
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
        className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-ink hover:bg-sunken hover:border-structural transition-colors shadow-xs"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-mono font-bold text-ink">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 z-[700] w-80 sm:w-96 rounded-2xl border border-line bg-surface p-3 shadow-xl space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-line pb-2.5">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-ink font-display uppercase">Notifications</span>
              <span className="text-[10px] font-mono text-muted">
                {unreadCount > 0 ? `(${unreadCount} new)` : '(All caught up)'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-md text-muted hover:text-ink hover:bg-sunken"
              aria-label="Close notifications"
            >
              <X size={14} />
            </button>
          </div>

          {/* Web Push Status Bar */}
          {typeof window !== 'undefined' &&
          'Notification' in window &&
          Notification.permission === 'denied' ? (
            <div className="rounded-xl border border-structural bg-sunken/60 p-2.5 space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <AlertCircle size={14} className="text-accent shrink-0" />
                <span className="font-mono text-[11px] font-bold text-ink">
                  Web Push: Blocked by Browser
                </span>
              </div>
              <p className="text-[11px] text-muted leading-relaxed">
                Notifications are blocked in your browser settings. To re-enable alerts, click the
                lock or site settings icon next to the URL and change Notifications to "Allow".
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-line bg-sunken/40 p-2.5 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${
                    pushStatus.data?.subscribed ? 'bg-accent' : 'bg-muted'
                  }`}
                />
                <span className="text-[11px] font-mono text-ink">
                  Web Push: {pushStatus.data?.subscribed ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              {!pushStatus.data?.subscribed && (
                <button
                  type="button"
                  onClick={handleSubscribe}
                  disabled={subscribing}
                  className="rounded-lg border border-structural bg-ink px-2.5 py-1 text-[10px] font-bold text-page hover:opacity-90 transition-opacity"
                >
                  {subscribing ? 'Enabling...' : 'Enable Push'}
                </button>
              )}
            </div>
          )}

          {/* Test Action Trigger */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] font-mono text-muted">AGENT COMPOSE</span>
            <button
              type="button"
              onClick={handleTestNotification}
              disabled={triggerTest.isPending}
              className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2 py-0.5 text-[10px] font-mono text-ink hover:bg-sunken transition-colors"
            >
              <Sparkles size={11} className="text-accent" />
              <span>{triggerTest.isPending ? 'Sending...' : 'Send Test Notification'}</span>
            </button>
          </div>

          {/* Notifications List */}
          <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
            {list.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted">
                No notifications yet.
              </div>
            ) : (
              list.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-xl border p-2.5 text-xs transition-colors space-y-1.5 ${
                    item.is_read
                      ? 'border-line/60 bg-sunken/20 text-muted'
                      : 'border-line bg-surface text-ink shadow-xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-xs text-ink leading-tight">{item.title}</span>
                    <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border border-line bg-sunken text-muted shrink-0">
                      {item.push_sent ? 'Web Push' : 'In-App'}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-ink/80">{item.message}</p>

                  {/* Rich Actions */}
                  {item.actions && item.actions.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {item.actions.map((act, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={async () => {
                            if (!item.is_read) markRead.mutate(item.id)
                            if (act.action === 'apply' && act.job_id) {
                              try {
                                await applyJob.mutateAsync({ jobId: String(act.job_id) })
                              } catch {
                                // Handled
                              }
                            }
                            if (item.link) navigate(item.link)
                            setIsOpen(false)
                          }}
                          className="inline-flex items-center gap-1 rounded-md border border-structural bg-ink px-2 py-0.5 text-[10px] font-mono font-bold text-page hover:opacity-90"
                        >
                          <span>{act.title}</span>
                          <ExternalLink size={10} />
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[9px] font-mono text-muted pt-1 border-t border-line/40">
                    <span>{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {!item.is_read && (
                      <button
                        type="button"
                        onClick={() => markRead.mutate(item.id)}
                        className="text-ink hover:underline font-semibold"
                      >
                        Mark as read
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
