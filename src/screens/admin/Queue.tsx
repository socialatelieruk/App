import { formatBooking, formatDate } from '../../format'
import type { Application, Collab } from '../../types'
import { Empty, Sheet } from '../../ui'
import { queue, QUEUES, type QueueKind } from './data'

// The filtered list behind a Today card. Tapping a row opens that collab's applicants.
export default function Queue({ kind, applications, onOpenCollab, onClose }: { kind: QueueKind; applications: Application[]; onOpenCollab: (c: Collab) => void; onClose: () => void }) {
  const items = queue(applications, kind)
  const detail = (a: Application) => {
    switch (kind) {
      case 'waiting':
        return `Applied ${formatDate(a.created_at.slice(0, 10))}${a.preferred_date ? ` · wants ${formatDate(a.preferred_date)}` : ''}`
      case 'overdue':
        return `Was due ${formatDate(a.content_due!)}`
      case 'due':
        return `Due ${formatDate(a.content_due!)}`
      case 'bookings':
        return formatBooking(a.scheduled_start!, a.scheduled_end)
    }
  }

  return (
    <Sheet title={QUEUES[kind].title} onClose={onClose}>
      {items.length === 0 ? (
        <Empty>{QUEUES[kind].empty}</Empty>
      ) : (
        <ul className="list">
          {items.map((a) => (
            <li key={a.id}>
              <button className="card row-card" data-queue={kind} onClick={() => onOpenCollab(a.collab!)}>
                <div>
                  <span className="eyebrow">
                    {a.collab!.brand} · {a.collab!.title}
                  </span>
                  <strong>{a.profile!.full_name}</strong>
                  <span className={kind === 'overdue' ? 'error small' : 'muted small'}>{detail(a)}</span>
                </div>
                <span className="link small">Open</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  )
}
