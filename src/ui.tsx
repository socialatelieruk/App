import type { ReactNode } from 'react'
import { formatDate, formatFollowers } from './format'
import { CATEGORY_GRADIENTS, type Collab } from './types'

export function Sheet({ title, onClose, action, children }: { title: string; onClose: () => void; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <header className="sheet-header">
          <button type="button" className="link" onClick={onClose}>
            Close
          </button>
          <h2>{title}</h2>
          <div className="sheet-action">{action}</div>
        </header>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}

export function CollabImage({ collab, tall }: { collab: Collab; tall?: boolean }) {
  return (
    <div className={`collab-image ${tall ? 'tall' : ''}`} style={{ background: CATEGORY_GRADIENTS[collab.category] }}>
      {collab.image_url && <img src={collab.image_url} alt="" loading="lazy" onError={(e) => (e.currentTarget.style.display = 'none')} />}
      <span className="type-pill">{collab.type}</span>
      {!collab.image_url && <span className="image-brand">{collab.brand}</span>}
    </div>
  )
}

export function CollabCard({ collab, onOpen, badge }: { collab: Collab; onOpen: () => void; badge?: ReactNode }) {
  return (
    <button className="card collab-card" onClick={onOpen}>
      <CollabImage collab={collab} />
      <div className="card-body">
        <div className="card-top">
          <span className="eyebrow">{collab.brand}</span>
          {badge}
        </div>
        <strong className="card-title">{collab.title}</strong>
        <div className="meta">
          <span>📍 {collab.location ? `${collab.location}, ` : ''}{collab.city}</span>
          {collab.event_date && <span>📅 {formatDate(collab.event_date)}</span>}
          {collab.min_followers > 0 && <span>👥 {formatFollowers(collab.min_followers)}+</span>}
        </div>
        {collab.offer && <p className="offer">🎁 {collab.offer}</p>}
      </div>
    </button>
  )
}

export function Badge({ status }: { status: string }) {
  return (
    <span className="badge" data-status={status}>
      {status}
    </span>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>
}

export function ErrorText({ error }: { error: string | null }) {
  return error ? <p className="error">{error}</p> : null
}

export function Spinner() {
  return <div className="spinner" aria-label="Loading" />
}
