import { formatDate } from '../format'
import type { Application, Collab } from '../types'
import { Badge, Empty } from '../ui'

export default function MyApplications({ applications, onOpen }: { applications: Application[]; onOpen: (c: Collab) => void }) {
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
                  <button className="card row-card" onClick={() => onOpen(a.collab!)}>
                    <div>
                      <span className="eyebrow">{a.collab!.brand}</span>
                      <strong>{a.collab!.title}</strong>
                      <span className="muted small">
                        Applied {formatDate(a.created_at)}
                        {a.preferred_date && ` · for ${formatDate(a.preferred_date)}`}
                      </span>
                    </div>
                    <Badge status={a.status} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
    </>
  )
}
