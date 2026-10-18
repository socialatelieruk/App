import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api'
import { errorMessage, formatDate, formatFollowers } from '../../format'
import type { Application, ApplicationStatus, Collab } from '../../types'
import { Badge, Empty, ErrorText, Sheet, Spinner } from '../../ui'

export default function Applicants({ collab, onClose, onEdit, onChanged }: { collab: Collab; onClose: () => void; onEdit: () => void; onChanged: () => void }) {
  const [apps, setApps] = useState<Application[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    api.listApplicants(collab.id).then(setApps, (e) => setError(errorMessage(e)))
  }, [collab.id])

  useEffect(load, [load])

  const setStatus = async (id: string, status: ApplicationStatus) => {
    try {
      await api.setApplicationStatus(id, status)
      load()
      onChanged()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const live = apps?.filter((a) => a.status !== 'withdrawn') ?? []
  const accepted = live.filter((a) => a.status === 'accepted').length

  return (
    <Sheet
      title={collab.title}
      onClose={onClose}
      action={
        <button className="link strong" onClick={onEdit}>
          Edit
        </button>
      }
    >
      <p className="muted">
        {collab.brand} · {accepted}/{collab.spots} spots filled · <Badge status={collab.status} />
      </p>
      <ErrorText error={error} />
      {!apps ? (
        <Spinner />
      ) : live.length === 0 ? (
        <Empty>No applications yet.</Empty>
      ) : (
        <ul className="list">
          {live.map((a) => (
            <li key={a.id} className="card applicant">
              <div className="card-top">
                <strong>{a.profile?.full_name ?? 'Unknown'}</strong>
                <Badge status={a.status} />
              </div>
              {a.profile && (
                <div className="meta">
                  {a.profile.instagram && (
                    <a href={`https://instagram.com/${a.profile.instagram}`} target="_blank" rel="noreferrer">
                      IG @{a.profile.instagram}
                    </a>
                  )}
                  {a.profile.tiktok && (
                    <a href={`https://tiktok.com/@${a.profile.tiktok}`} target="_blank" rel="noreferrer">
                      TikTok @{a.profile.tiktok}
                    </a>
                  )}
                  <span>{formatFollowers(a.profile.followers)} followers</span>
                  <span>{a.profile.city}</span>
                </div>
              )}
              {a.message && <p className="quote">“{a.message}”</p>}
              <span className="muted small">
                Applied {formatDate(a.created_at)}
                {a.preferred_date && ` · wants ${formatDate(a.preferred_date)}`}
                {a.profile?.email && ` · ${a.profile.email}`}
              </span>
              <div className="actions">
                {a.status !== 'accepted' && (
                  <button className="primary small" onClick={() => setStatus(a.id, 'accepted')}>
                    Accept
                  </button>
                )}
                {a.status !== 'declined' && (
                  <button className="secondary small" onClick={() => setStatus(a.id, 'declined')}>
                    Decline
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
