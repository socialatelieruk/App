import { addDays } from '../../delivery'
import { todayISO } from '../../format'
import { moneySummary } from '../../money'
import type { Application, Collab } from '../../types'
import { type AdminData, queue, type QueueKind } from './data'
import { MoneySummaryView } from './Money'

interface Props {
  data: AdminData
  onProfiles: () => void
  onQueue: (kind: QueueKind) => void
  onOpenCollab: (c: Collab) => void
  onMoney: () => void
  onBrandSignups: () => void
  onBriefs: () => void
}

const dayLabel = (iso: string) => {
  const today = todayISO()
  const day = iso.slice(0, 10)
  const date = new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
  if (day === today) return `Today · ${date}`
  if (day === addDays(today, 1)) return `Tomorrow · ${date}`
  return date
}

const localDay = (iso: string) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function Today({ data, onProfiles, onQueue, onOpenCollab, onMoney, onBrandSignups, onBriefs }: Props) {
  const pendingProfiles = data.influencers.filter((p) => p.status === 'pending').length
  const counts: Record<QueueKind, number> = {
    waiting: queue(data.applications, 'waiting').length,
    overdue: queue(data.applications, 'overdue').length,
    due: queue(data.applications, 'due').length,
    bookings: queue(data.applications, 'bookings').length,
    replies: queue(data.applications, 'replies', data.shortlist).length,
  }
  const brandSignups = data.brandAccounts.filter((a) => a.status === 'pending').length
  const briefs = data.briefs.filter((b) => b.status === 'submitted').length
  const bookings = queue(data.applications, 'bookings')
  const byDay = new Map<string, Application[]>()
  for (const b of bookings) {
    const day = localDay(b.scheduled_start!)
    byDay.set(day, [...(byDay.get(day) ?? []), b])
  }
  const money = moneySummary(data.brands, data.collabs, data.finances, data.retainers, data.brandPayments)
  const nothingToDo = pendingProfiles + brandSignups + briefs + counts.replies + counts.waiting + counts.overdue + counts.due + counts.bookings === 0

  const cards: { label: string; count: number; onClick: () => void; urgent?: boolean }[] = [
    { label: 'Briefs to review', count: briefs, onClick: onBriefs },
    { label: 'Brand replies', count: counts.replies, onClick: () => onQueue('replies') },
    { label: 'Brand sign-ups', count: brandSignups, onClick: onBrandSignups },
    { label: 'Profiles to review', count: pendingProfiles, onClick: onProfiles },
    { label: 'Applications waiting', count: counts.waiting, onClick: () => onQueue('waiting') },
    { label: 'Content overdue', count: counts.overdue, onClick: () => onQueue('overdue'), urgent: true },
    { label: 'Content due this week', count: counts.due, onClick: () => onQueue('due') },
    { label: 'Bookings next 7 days', count: counts.bookings, onClick: () => onQueue('bookings') },
  ]

  return (
    <>
      <header className="page-header">
        <span className="eyebrow">{new Date(`${todayISO()}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        <h1>Today</h1>
      </header>

      {nothingToDo ? (
        <div className="caught-up">
          <h2>All caught up</h2>
          <p className="muted">No briefs, sign-ups or brand replies to deal with, no applications waiting and no content overdue. Nothing is booked for the next 7 days.</p>
        </div>
      ) : (
        <div className="today-cards">
          {cards.map((c) => (
            <button key={c.label} className="today-card card" data-urgent={c.urgent && c.count > 0 ? 'true' : undefined} data-empty={c.count === 0 ? 'true' : undefined} onClick={c.onClick}>
              <strong>{c.count}</strong>
              <span>{c.label}</span>
            </button>
          ))}
        </div>
      )}

      <section>
        <h3 className="section-title">Money</h3>
        <MoneySummaryView summary={money} onClick={onMoney} />
      </section>

      {bookings.length > 0 && (
        <section>
          <h3 className="section-title">This week's bookings</h3>
          <div className="week">
            {[...byDay].map(([day, items]) => (
              <div key={day} className="week-day">
                <span className="week-date">{dayLabel(day)}</span>
                <ul className="list">
                  {items.map((a) => (
                    <li key={a.id}>
                      <button className="card booking-row" onClick={() => onOpenCollab(a.collab!)}>
                        <span className="booking-time">{new Date(a.scheduled_start!).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>
                        <span className="booking-who">
                          <strong>{a.profile!.full_name}</strong>
                          <span className="muted small">
                            {a.collab!.brand} · {a.collab!.title}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  )
}
