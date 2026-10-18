import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'

// Opens a web page outside the app: an in-app browser sheet on phones, a new tab on the web.
export async function openExternal(url: string): Promise<void> {
  if (Capacitor.isNativePlatform()) await Browser.open({ url, presentationStyle: 'popover' })
  else window.open(url, '_blank', 'noopener')
}

// Runs a callback when the in-app browser is closed (used to refresh after connecting a calendar).
export function onBrowserClosed(cb: () => void): () => void {
  if (!Capacitor.isNativePlatform()) {
    const onFocus = () => cb()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }
  const handle = Browser.addListener('browserFinished', cb)
  return () => {
    handle.then((h) => h.remove())
  }
}

// Public web address of the app, where brand reports open.
export const PUBLIC_URL = (import.meta.env.VITE_PUBLIC_URL as string | undefined) || 'https://socialatelieruk.github.io/App/'

export const reportUrl = (token: string) => `${PUBLIC_URL}?report=${token}`

// Opens the phone's share sheet, or copies the link where sharing isn't available.
export async function shareLink(url: string, title: string): Promise<'shared' | 'copied'> {
  if (Capacitor.isNativePlatform()) {
    const { Share } = await import('@capacitor/share')
    await Share.share({ title, url })
    return 'shared'
  }
  if (navigator.share) {
    try {
      await navigator.share({ title, url })
      return 'shared'
    } catch {
      // cancelled or not allowed: fall back to copying
    }
  }
  await navigator.clipboard.writeText(url)
  return 'copied'
}
