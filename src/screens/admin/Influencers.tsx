import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api'
import { reliability } from '../../delivery'
import { errorMessage, formatDate, formatFollowers } from '../../format'
import type { DeliveryStats, Profile, ProfileStatus } from '../../types'
import { Badge, Empty, ErrorText, Spinner } from '../../ui'

export default function Influencers() {
  const [people, setPeople] = useState<Profile[] | null>(null)
  const [tab, setTab] = useState<ProfileStatus>('pending')
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<Record<string, DeliveryStats>>({})

  const load = useCallback(() => {
    api.listInfluencers().then(setPeople, (e) => setError(errorMessage(e)))
    api.getReliability().then(setStats, () => {})
  }, [])
  useEffect(load, [load])

  const setStatus = async (id: string, status: ProfileStatus) => {
    try {
      await api.setInfluencerStatus(id, status)
      load()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const count = (s: ProfileStatus) => people?.filter((p) => p.status === s).length ?? 0
  // Most reliable first, so the best creators are easy to pick for paying clients; new creators last.
  const shown = (people?.filter((p) => p.status === tab) ?? []).sort(
    (a, b) => (reliability(stats[b.id]).score ?? -1) - (reliability(stats[a.id]).score ?? -1),
  )

  return (
    <>
      <header className="page-header">
        <h1>Influencers</h1>
      </header>
      <div className="segmented">
        {(['pending', 'approved', 'rejected'] as const).map((s) => (
          <button key={s} className={tab === s ? 'on' : ''} onClick={() => setTab(s)}>
            {s[0].toUpperCase() + s.slice(1)} ({count(s)})
          </button>
        ))}
      </div>
      <ErrorText error={error} />
      {!people ? (
        <Spinner />
      ) : shown.length === 0 ? (
        <Empty>{tab === 'pending' ? 'No one waiting for review.' : 'Nobody here yet.'}</Empty>
      ) : (
        <ul className="list">
          {shown.map((p) => (
            <li key={p.id} className="card applicant">
              <div className="card-top">
                <strong>{p.full_name || p.email}</strong>
                <Badge status={p.status} />
              </div>
              {(() => {
                const rel = reliability(stats[p.id])
                return (
                  <span className="reliability" data-tier={rel.tier}>
                    Reliability {rel.label} <span className="muted">· {rel.detail}</span>
                  </span>
                )
              })()}
              <div className="meta">
                {p.instagram && (
                  <a href={`https://instagram.com/${p.instagram}`} target="_blank" rel="noreferrer">
                    IG @{p.instagram}
                  </a>
                )}
                {p.tiktok && (
                  <a href={`https://tiktok.com/@${p.tiktok}`} target="_blank" rel="noreferrer">
                    TikTok @{p.tiktok}
                  </a>
                )}
                <span>{formatFollowers(p.followers)} followers</span>
                {p.city && <span>{p.city}</span>}
              </div>
              {p.bio && <p className="small">{p.bio}</p>}
              <span className="muted small">
                Joined {formatDate(p.created_at)} · {p.email}
              </span>
              <div className="actions">
                {p.status !== 'approved' && (
                  <button className="primary small" onClick={() => setStatus(p.id, 'approved')}>
                    Approve
                  </button>
                )}
                {p.status !== 'rejected' && (
                  <button className="secondary small" onClick={() => setStatus(p.id, 'rejected')}>
                    Reject
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
