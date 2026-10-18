import { useState } from 'react'
import { api } from '../../api'
import { platformOf } from '../../delivery'
import { errorMessage, formatFollowers } from '../../format'
import type { ShortlistCard } from '../../types'
import { Empty, ErrorText } from '../../ui'

// Creators The Social Atelier has picked for the brand, to approve or decline.
export default function Shortlist({ items, onChanged }: { items: ShortlistCard[]; onChanged: () => void }) {
  const waiting = items.filter((i) => !i.decision)
  const decided = items.filter((i) => i.decision)
  const byCampaign = new Map<string, ShortlistCard[]>()
  for (const i of waiting) byCampaign.set(i.collab_title, [...(byCampaign.get(i.collab_title) ?? []), i])

  return (
    <>
      <header className="page-header">
        <h1>Shortlist</h1>
        <p className="muted">Creators we've picked for your campaigns. Approve the ones you'd like and we'll book them in.</p>
      </header>
      {waiting.length === 0 && <Empty>Nothing waiting for you. We'll email you when new creators are ready.</Empty>}
      {[...byCampaign].map(([title, cards]) => (
        <section key={title}>
          <h3 className="section-title">{title}</h3>
          <ul className="list">
            {cards.map((c) => (
              <CreatorCard key={c.application_id} card={c} onChanged={onChanged} />
            ))}
          </ul>
        </section>
      ))}
      {decided.length > 0 && (
        <section>
          <h3 className="section-title">Decided</h3>
          <ul className="list">
            {decided.map((c) => (
              <li key={c.application_id} className="card decided-row">
                <div className="card-top">
                  <strong>{c.name}</strong>
                  <span className="badge" data-status={c.decision === 'approved' ? 'accepted' : 'declined'}>
                    {c.decision === 'approved' ? 'Approved' : 'Declined'}
                  </span>
                </div>
                <span className="muted small">
                  {c.collab_title}
                  {c.note ? ` · “${c.note}”` : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

function CreatorCard({ card, onChanged }: { card: ShortlistCard; onChanged: () => void }) {
  const [choice, setChoice] = useState<'approved' | 'declined' | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      await api.decideShortlist(card.application_id, choice!, note.trim())
      onChanged()
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  return (
    <li className="card creator-card">
      <div className="card-top">
        <strong className="card-title">{card.name}</strong>
        <span className="followers">{formatFollowers(card.followers)}</span>
      </div>
      <div className="meta">
        {card.instagram && (
          <a href={`https://instagram.com/${card.instagram}`} target="_blank" rel="noreferrer">
            @{card.instagram}
          </a>
        )}
        {card.tiktok && (
          <a href={`https://tiktok.com/@${card.tiktok}`} target="_blank" rel="noreferrer">
            TikTok @{card.tiktok}
          </a>
        )}
        {card.city && <span>{card.city}</span>}
      </div>
      <span className="reliability-label">{card.reliability}</span>
      {card.bio && <p className="small">{card.bio}</p>}
      {card.past_posts.length > 0 && (
        <div className="stack tight">
          <span className="eyebrow">Past Social Atelier posts</span>
          <div className="post-links">
            {card.past_posts.map((url) => (
              <a key={url} className="post-link" href={url} target="_blank" rel="noreferrer">
                {platformOf(url)} ↗
              </a>
            ))}
          </div>
        </div>
      )}

      {choice ? (
        <div className="stack tight decide">
          <label>
            {choice === 'approved' ? 'Note for us (optional)' : 'Why not? (optional, helps us pick a replacement)'}
            <input id={`note-${card.application_id}`} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <ErrorText error={error} />
          <div className="actions">
            <button className={choice === 'approved' ? 'primary small' : 'danger small-danger'} disabled={busy} onClick={confirm}>
              {busy ? 'Saving…' : choice === 'approved' ? `Approve ${card.name.split(' ')[0]}` : `Decline ${card.name.split(' ')[0]}`}
            </button>
            <button className="secondary small" disabled={busy} onClick={() => setChoice(null)}>
              Back
            </button>
          </div>
        </div>
      ) : (
        <div className="actions">
          <button className="primary small" onClick={() => setChoice('approved')}>
            Approve
          </button>
          <button className="secondary small" onClick={() => setChoice('declined')}>
            Decline
          </button>
        </div>
      )}
    </li>
  )
}
