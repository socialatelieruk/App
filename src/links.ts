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
