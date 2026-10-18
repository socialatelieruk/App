import type { Brand, Collab, CollabFinance } from '../../types'
import { Badge, CollabCard, Empty } from '../../ui'
import { CollabFee } from './Money'

interface Props {
  collabs: Collab[]
  brands: Brand[]
  finances: Record<string, CollabFinance>
  onOpen: (c: Collab) => void
  onNew: () => void
}

export default function AdminCollabs({ collabs, brands, finances, onOpen, onNew }: Props) {
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
                  <CollabFee finance={finances[c.id]} dealType={brands.find((b) => b.id === c.brand_id)?.deal_type} />
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
