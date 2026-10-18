export const PLATFORMS = ['Instagram', 'TikTok', 'Facebook', 'LinkedIn', 'X', 'YouTube', 'Pinterest'] as const
export type Platform = (typeof PLATFORMS)[number]

export const STATUSES = ['Idea', 'Draft', 'Scheduled', 'Posted'] as const
export type Status = (typeof STATUSES)[number]

export interface Post {
  id: string
  title: string
  caption: string
  hashtags: string
  date: string // YYYY-MM-DD
  time: string // HH:MM, may be empty
  platforms: Platform[]
  status: Status
  notes: string
  createdAt: number
  updatedAt: number
}

export const PLATFORM_COLORS: Record<Platform, string> = {
  Instagram: '#d6336c',
  TikTok: '#111111',
  Facebook: '#1877f2',
  LinkedIn: '#0a66c2',
  X: '#495057',
  YouTube: '#e03131',
  Pinterest: '#c92a2a',
}
