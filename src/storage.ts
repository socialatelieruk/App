import { Preferences } from '@capacitor/preferences'
import type { Post } from './types'

// Preferences uses native storage on iOS/Android and localStorage on the web.
const KEY = 'posts.v1'

export async function loadPosts(): Promise<Post[]> {
  const { value } = await Preferences.get({ key: KEY })
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function savePosts(posts: Post[]): Promise<void> {
  await Preferences.set({ key: KEY, value: JSON.stringify(posts) })
}
