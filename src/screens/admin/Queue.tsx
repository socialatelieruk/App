import { api } from '../../api'
import { formatBooking, formatDate } from '../../format'
import type { Application, Collab, ShortlistEntry } from '../../types'
import { Empty, Sheet } from '../../ui'
import { queue, QUEUES, type QueueKind } from './data'

interface Props {
  kind: QueueKind
  applications: Application[]
  shortlist: ShortlistEntry[]
  onOpenCollab: (c: Collab) => void
  onClose: () => void
  onChanged: () => void
}

// The filtered list behind a Today card. Tapping a row opens that collab's applicants.
export default function Queue({ kind, applications, shortlist, onOpenCollab, onClose, onChanged }: Props) {
  const items = queue(applications, kind, shortlist)
  const reply = (a: Application) => shortlist.find((s) => s.application_id === a.id)
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
      case 'replies': {
        const r = reply(a)!
        const note = r.note ? `: “${r.note}”` : ''
        return r.decision === 'approved' ? `Approved by the brand${note}. Set a booking time.` : `Declined by the brand${note}. Send a replacement.`
      }
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
              <div className="card row-card" data-queue={kind}>
                <button className="row-card-main" onClick={() => onOpenCollab(a.collab!)}>
                  <span className="eyebrow">
                    {a.collab!.brand} · {a.collab!.title}
                  </span>
                  <strong>{a.profile!.full_name}</strong>
                  <span className={kind === 'overdue' || (kind === 'replies' && reply(a)?.decision === 'declined') ? 'error small' : 'muted small'}>{detail(a)}</span>
                </button>
                {kind === 'replies' ? (
                  <button className="link small" onClick={() => api.markShortlistHandled(a.id).then(onChanged)}>
                    Done
                  </button>
                ) : (
                  <button className="link small" onClick={() => onOpenCollab(a.collab!)}>
                    Open
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  )
}
