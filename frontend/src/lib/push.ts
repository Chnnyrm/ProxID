/**
 * Web Push registration and subscription helpers.
 * Pure ASCII.
 */

import { notificationService } from '@/services/notificationService'

function urlB64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    return null
  }
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    return reg
  } catch (err) {
    console.warn('Service worker registration failed:', err)
    return null
  }
}

export async function syncPushSubscription(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false
  }
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return false
  }

  try {
    const registration = await navigator.serviceWorker.ready
    let subscription = await registration.pushManager.getSubscription()
    if (!subscription) {
      const res = await notificationService.getVapidPublicKey()
      const publicKey = res.public_key
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(publicKey),
      })
    }
    const subJSON = subscription.toJSON()
    if (subJSON.endpoint && subJSON.keys?.p256dh && subJSON.keys?.auth) {
      await notificationService.subscribePush({
        endpoint: subJSON.endpoint,
        keys: {
          p256dh: subJSON.keys.p256dh,
          auth: subJSON.keys.auth,
        },
        user_agent: navigator.userAgent.slice(0, 500),
      })
      return true
    }
    return false
  } catch (err) {
    console.warn('Push sync error:', err)
    return false
  }
}

export async function subscribeToPushNotifications(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false
  }

  try {
    const res = await notificationService.getVapidPublicKey()
    const publicKey = res.public_key
    if (!publicKey) return false

    let permission = Notification.permission
    if (permission === 'default') {
      permission = await Notification.requestPermission()
    }

    if (permission !== 'granted') {
      return false
    }

    const registration = await navigator.serviceWorker.ready
    let subscription = await registration.pushManager.getSubscription()
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(publicKey),
      })
    }

    const subJSON = subscription.toJSON()
    if (subJSON.endpoint && subJSON.keys?.p256dh && subJSON.keys?.auth) {
      await notificationService.subscribePush({
        endpoint: subJSON.endpoint,
        keys: {
          p256dh: subJSON.keys.p256dh,
          auth: subJSON.keys.auth,
        },
        user_agent: navigator.userAgent.slice(0, 500),
      })
      return true
    }
    return false
  } catch (err) {
    console.warn('Push subscription failed:', err)
    return false
  }
}
