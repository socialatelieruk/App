import type { ReactNode } from 'react'
import { formatDate, formatFollowers } from './format'
import { CATEGORY_TONES, type Collab } from './types'

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
    <div className={`collab-image ${tall ? 'tall' : ''}`} style={{ background: CATEGORY_TONES[collab.category] }}>
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
          <span>{collab.location ? `${collab.location}, ` : ''}{collab.city}</span>
          {collab.event_date && <span>{formatDate(collab.event_date)}</span>}
          {collab.min_followers > 0 && <span>{formatFollowers(collab.min_followers)}+ followers</span>}
        </div>
        {collab.offer && <p className="offer">{collab.offer}</p>}
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

const ICON_PATHS = {
  explore: 'M12 3l1.8 5.6L19.5 10l-5.7 1.4L12 17l-1.8-5.6L4.5 10l5.7-1.4z M18.5 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z',
  list: 'M8 6h12 M8 12h12 M8 18h12 M4 6h.01 M4 12h.01 M4 18h.01',
  person: 'M12 12a4 4 0 100-8 4 4 0 000 8z M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5',
  gift: 'M4 11h16v10H4z M3 7h18v4H3z M12 7v14 M12 7c-1.5-3.5-6-3.5-6-1s4.5 1 6 1c1.5 0 6 1.5 6-1s-4.5-2.5-6 1z',
  today: 'M4 6h16v14H4z M4 10h16 M8 3v4 M16 3v4 M8 14h3',
  store: 'M4 10v10h16V10 M3 10l2-6h14l2 6 M3 10c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3 M10 20v-5h4v5',
  people: 'M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7z M2.5 20c0-3.5 2.9-5.5 6.5-5.5s6.5 2 6.5 5.5 M16 4.3a3.5 3.5 0 010 6.4 M18.5 14.8c1.9.7 3 2.5 3 5.2',
} as const

export type IconName = keyof typeof ICON_PATHS

export function Icon({ name }: { name: IconName }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICON_PATHS[name]} />
    </svg>
  )
}
