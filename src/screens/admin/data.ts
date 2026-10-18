import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api'
import { addDays, deliveryStatus } from '../../delivery'
import { errorMessage, todayISO } from '../../format'
import type { Application, Brand, Collab, CollabFinance, Profile, RetainerPayment } from '../../types'

// Everything the admin screens work from, loaded together so counts agree.
export interface AdminData {
  collabs: Collab[]
  applications: Application[] // with collab and profile
  brands: Brand[]
  finances: Record<string, CollabFinance>
  retainers: RetainerPayment[]
  influencers: Profile[]
}

export function useAdminData() {
  const [data, setData] = useState<AdminData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const reload = useCallback(() => {
    Promise.all([api.listCollabs(), api.listAllApplications(), api.listBrands(), api.listFinances(), api.listRetainerPayments(), api.listInfluencers()]).then(
      ([collabs, applications, brands, finances, retainers, influencers]) => {
        setData({ collabs, applications, brands, finances, retainers, influencers })
        setError(null)
      },
      (e) => setError(errorMessage(e)),
    )
  }, [])
  useEffect(reload, [reload])
  return { data, error, reload }
}

// The filtered lists the Today cards open.
export const QUEUES = {
  waiting: { title: 'Applications waiting', empty: 'No applications are waiting for a decision.' },
  overdue: { title: 'Content overdue', empty: 'No content is overdue.' },
  due: { title: 'Content due this week', empty: 'Nothing is due in the next 7 days.' },
  bookings: { title: 'Bookings in the next 7 days', empty: 'No bookings in the next 7 days.' },
} as const

export type QueueKind = keyof typeof QUEUES

const WEEK_MS = 7 * 86_400_000

export function queue(applications: Application[], kind: QueueKind, now = new Date()): Application[] {
  const today = todayISO()
  const weekEnd = addDays(today, 6)
  const live = applications.filter((a) => a.collab && a.profile)
  switch (kind) {
    case 'waiting':
      return live.filter((a) => a.status === 'pending').sort((a, b) => a.created_at.localeCompare(b.created_at))
    case 'overdue':
      return live.filter((a) => a.status === 'accepted' && deliveryStatus(a, today) === 'overdue').sort((a, b) => a.content_due!.localeCompare(b.content_due!))
    case 'due':
      return live
        .filter((a) => a.status === 'accepted' && deliveryStatus(a, today) === 'due' && a.content_due && a.content_due <= weekEnd)
        .sort((a, b) => a.content_due!.localeCompare(b.content_due!))
    case 'bookings':
      return live
        .filter((a) => {
          if (a.status !== 'accepted' || !a.scheduled_start || a.attendance === 'no_show') return false
          const t = Date.parse(a.scheduled_start)
          return t >= now.getTime() && t < now.getTime() + WEEK_MS
        })
        .sort((a, b) => a.scheduled_start!.localeCompare(b.scheduled_start!))
  }
}

// Posted / overdue / no-show counts for one collab's accepted creators.
export function deliveryCounts(applications: Application[], collabId: string) {
  const accepted = applications.filter((a) => a.collab_id === collabId && a.status === 'accepted')
  const counts = { booked: accepted.length, posted: 0, overdue: 0, noShow: 0, due: 0 }
  for (const a of accepted) {
    const s = deliveryStatus(a)
    if (s === 'posted' || s === 'posted-late') counts.posted++
    else if (s === 'overdue') counts.overdue++
    else if (s === 'no-show') counts.noShow++
    else counts.due++
  }
  return counts
}
