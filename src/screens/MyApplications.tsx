import { DELIVERY_LABELS, deliveryStatus } from '../delivery'
import { formatBooking, formatDate } from '../format'
import type { Application, Collab } from '../types'
import { Badge, Empty } from '../ui'

export default function MyApplications({ applications, newIds, onOpen }: { applications: Application[]; newIds: Set<string>; onOpen: (c: Collab) => void }) {
  const visible = applications.filter((a) => a.status !== 'withdrawn' && a.collab)
  const groups: { title: string; items: Application[] }[] = [
    { title: 'Accepted', items: visible.filter((a) => a.status === 'accepted') },
    { title: 'Waiting to hear back', items: visible.filter((a) => a.status === 'pending') },
    { title: 'Not this time', items: visible.filter((a) => a.status === 'declined') },
  ]

  return (
    <>
      <header className="page-header">
        <h1>My collabs</h1>
      </header>
      {visible.length === 0 && <Empty>You haven't applied for anything yet. Find a collab in Explore.</Empty>}
      {groups
        .filter((g) => g.items.length > 0)
        .map((g) => (
          <section key={g.title}>
            <h3 className="section-title">{g.title}</h3>
            <ul className="list">
              {g.items.map((a) => (
                <li key={a.id}>
                  <button className={`card row-card ${newIds.has(a.id) ? 'is-new' : ''}`} onClick={() => onOpen(a.collab!)}>
                    <div>
                      <span className="eyebrow">
                        {a.collab!.brand}
                        {newIds.has(a.id) && <span className="new-tag">New</span>}
                      </span>
                      <strong>{a.collab!.title}</strong>
                      {a.status === 'accepted' && a.scheduled_start && new Date(a.scheduled_start) > new Date() ? (
                        <span className="booked small">Booked for {formatBooking(a.scheduled_start, a.scheduled_end)}</span>
                      ) : a.status === 'accepted' && a.posted_at ? (
                        <span className="muted small">Posted {formatDate(a.posted_at.slice(0, 10))}</span>
                      ) : a.status === 'accepted' && a.content_due && a.post_links.length === 0 && a.attendance !== 'no_show' ? (
                        <span className="muted small">Post by {formatDate(a.content_due)}</span>
                      ) : (
                        <span className="muted small">
                          Applied {formatDate(a.created_at)}
                          {a.preferred_date && ` · for ${formatDate(a.preferred_date)}`}
                        </span>
                      )}
                    </div>
                    {a.status === 'accepted' ? (
                      <span className="badge" data-delivery={deliveryStatus(a)}>
                        {DELIVERY_LABELS[deliveryStatus(a)]}
                      </span>
                    ) : (
                      <Badge status={a.status} />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
    </>
  )
}
