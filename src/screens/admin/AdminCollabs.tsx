import type { Collab } from '../../types'
import { Badge, CollabCard, Empty } from '../../ui'

export default function AdminCollabs({ collabs, onOpen, onNew }: { collabs: Collab[]; onOpen: (c: Collab) => void; onNew: () => void }) {
  return (
    <>
      <header className="page-header with-action">
        <h1>Collabs</h1>
        <button className="primary small" onClick={onNew}>
          + New
        </button>
      </header>
      {collabs.length === 0 ? (
        <Empty>No collabs yet. Tap “New” to post your first one.</Empty>
      ) : (
        <div className="cards">
          {collabs.map((c) => (
            <CollabCard
              key={c.id}
              collab={c}
              onOpen={() => onOpen(c)}
              badge={
                <span className="badges">
                  <span className="count">{c.application_count ?? 0} applied</span>
                  {c.status === 'closed' && <Badge status="closed" />}
                </span>
              }
            />
          ))}
        </div>
      )}
    </>
  )
}
