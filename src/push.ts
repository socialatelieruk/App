import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { api } from './api'

// Push is switched on per build (see the GitHub workflows): Android needs a
// Firebase config file, and there's nothing to send from in demo mode.
const enabled = Capacitor.isNativePlatform() && api.mode === 'live' && import.meta.env.VITE_PUSH_ENABLED === 'true'

let currentToken: string | null = null

interface Handlers {
  onReceived: () => void // a notification arrived while the app is open
  onOpened: () => void // the influencer tapped a notification
}

// Asks for permission (only the first time) and registers this phone.
// Returns a cleanup function.
export function startPush({ onReceived, onOpened }: Handlers): () => void {
  if (!enabled) return () => {}
  let active = true
  const platform = Capacitor.getPlatform() as 'ios' | 'android'

  const listeners = [
    PushNotifications.addListener('registration', ({ value }) => {
      currentToken = value
      if (active) api.registerDevice(value, platform).catch(() => {})
    }),
    PushNotifications.addListener('pushNotificationReceived', () => onReceived()),
    PushNotifications.addListener('pushNotificationActionPerformed', () => onOpened()),
  ]

  ;(async () => {
    let { receive } = await PushNotifications.checkPermissions()
    if (receive === 'prompt' || receive === 'prompt-with-rationale') receive = (await PushNotifications.requestPermissions()).receive
    if (receive === 'granted' && active) await PushNotifications.register()
  })().catch(() => {})

  return () => {
    active = false
    listeners.forEach((l) => l.then((h) => h.remove()))
  }
}

// Stops notifications going to this phone once its user signs out.
export async function stopPush(): Promise<void> {
  if (!enabled || !currentToken) return
  const token = currentToken
  currentToken = null
  await api.unregisterDevice(token).catch(() => {})
  await PushNotifications.unregister().catch(() => {})
}
