import { todayISO } from './format'
import type { Application, DeliveryStats } from './types'

export type DeliveryStatus = 'no-show' | 'posted' | 'posted-late' | 'overdue' | 'due'

// Where an accepted creator is with their content.
export function deliveryStatus(a: Pick<Application, 'attendance' | 'post_links' | 'posted_at' | 'content_due'>, today = todayISO()): DeliveryStatus {
  if (a.attendance === 'no_show') return 'no-show'
  if (a.post_links.length > 0) return a.content_due && a.posted_at && localDate(a.posted_at) > a.content_due ? 'posted-late' : 'posted'
  if (a.content_due && a.content_due < today) return 'overdue'
  return 'due'
}

export const DELIVERY_LABELS: Record<DeliveryStatus, string> = {
  'no-show': 'No-show',
  posted: 'Posted',
  'posted-late': 'Posted late',
  overdue: 'Overdue',
  due: 'Content due',
}

const localDate = (iso: string) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Adds days to a YYYY-MM-DD date.
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return localDate(new Date(y, m - 1, d + days).toISOString())
}

export interface Reliability {
  score: number | null // 0–100, null until a booking is finished
  tier: 'new' | 'excellent' | 'good' | 'at-risk'
  label: string
  detail: string
}

// On-time posts count fully, late posts three-quarters; overdue posts and no-shows count against.
export function reliability(s: DeliveryStats | undefined): Reliability {
  const finished = s ? s.on_time + s.late + s.overdue + s.no_shows : 0
  if (!s || finished === 0) return { score: null, tier: 'new', label: 'New', detail: 'No finished bookings yet' }
  const score = Math.round((100 * (s.on_time + 0.75 * s.late)) / finished)
  const tier = s.no_shows > 0 || score < 60 ? 'at-risk' : score >= 90 ? 'excellent' : 'good'
  const parts = [`${s.on_time + s.late} of ${finished} posted`]
  if (s.late) parts.push(`${s.late} late`)
  if (s.overdue) parts.push(`${s.overdue} overdue`)
  if (s.no_shows) parts.push(`${s.no_shows} no-show${s.no_shows > 1 ? 's' : ''}`)
  return { score, tier, label: tier === 'at-risk' ? `${score}% · At risk` : `${score}%`, detail: parts.join(' · ') }
}

const PLATFORMS: [RegExp, string][] = [
  [/instagram\.com|instagr\.am/, 'Instagram'],
  [/tiktok\.com/, 'TikTok'],
  [/youtube\.com|youtu\.be/, 'YouTube'],
  [/facebook\.com|fb\.watch/, 'Facebook'],
  [/(^|\.)x\.com|twitter\.com/, 'X'],
  [/threads\.(net|com)/, 'Threads'],
  [/pinterest\./, 'Pinterest'],
]

export function platformOf(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    return PLATFORMS.find(([re]) => re.test(host))?.[1] ?? host
  } catch {
    return 'Link'
  }
}

// Accepts pasted links with or without https://, one per line or separated by spaces.
export function parseLinks(text: string): { links: string[]; invalid: string[] } {
  const links: string[] = []
  const invalid: string[] = []
  for (const raw of text.split(/[\s,]+/).filter(Boolean)) {
    const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    try {
      const u = new URL(candidate)
      if (!u.hostname.includes('.')) throw new Error()
      links.push(u.toString())
    } catch {
      invalid.push(raw)
    }
  }
  return { links, invalid }
}
