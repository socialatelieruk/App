import { useState } from 'react'
import { api } from '../api'
import { errorMessage, formatBooking, formatDate, formatFollowers, googleCalendarUrl, todayISO } from '../format'
import { DELIVERY_LABELS, deliveryStatus, parseLinks, platformOf } from '../delivery'
import { openExternal } from '../links'
import { COLLAB_TYPE_HINTS, type Application, type Collab, type Profile } from '../types'
import { Badge, CollabImage, ErrorText, Sheet } from '../ui'

interface Props {
  collab: Collab
  profile: Profile
  application?: Application
  calendarConnected: boolean
  onClose: () => void
  onChanged: () => void
}

export default function CollabDetail({ collab, profile, application, calendarConnected, onClose, onChanged }: Props) {
  const [applying, setApplying] = useState(false)
  const [message, setMessage] = useState('')
  const [date, setDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const deadlinePassed = !!collab.apply_by && collab.apply_by < todayISO()
  const active = application && application.status !== 'withdrawn'

  // The first reason the influencer can't apply, if any.
  const blocker =
    collab.status !== 'open' || deadlinePassed
      ? 'Applications for this collab are closed.'
      : profile.status === 'pending'
        ? 'Your profile is being reviewed. You can apply once it is approved.'
        : profile.status === 'rejected'
          ? 'Your profile was not approved for collaborations.'
          : profile.followers < collab.min_followers
            ? `This collab needs ${formatFollowers(collab.min_followers)}+ followers.`
            : null

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      onChanged()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet title={collab.brand} onClose={onClose}>
      <CollabImage collab={collab} tall />
      <div className="detail-head">
        <span className="eyebrow">
          {collab.category} · {collab.type}
        </span>
        <h2>{collab.title}</h2>
        <p className="muted">{[collab.location, collab.city].filter(Boolean).join(', ')}</p>
      </div>

      {collab.description && <p>{collab.description}</p>}

      <dl className="facts">
        {collab.offer && (
          <>
            <dt>You get</dt>
            <dd>{collab.offer}</dd>
          </>
        )}
        {collab.deliverables && (
          <>
            <dt>You post</dt>
            <dd>{collab.deliverables}</dd>
          </>
        )}
        <dt>How it works</dt>
        <dd>{COLLAB_TYPE_HINTS[collab.type]}</dd>
        {collab.event_date && (
          <>
            <dt>Date</dt>
            <dd>{formatDate(collab.event_date)}</dd>
          </>
        )}
        {collab.min_followers > 0 && (
          <>
            <dt>Followers</dt>
            <dd>{formatFollowers(collab.min_followers)}+</dd>
          </>
        )}
        <dt>Spots</dt>
        <dd>{collab.spots}</dd>
        {collab.apply_by && (
          <>
            <dt>Apply by</dt>
            <dd>{formatDate(collab.apply_by)}</dd>
          </>
        )}
      </dl>

      {active ? (
        <div className="apply-box">
          <p>
            Your application: <Badge status={application.status} />
          </p>
          {application.status === 'accepted' && (
            <>
              {application.scheduled_start ? (
                <>
                  <p className="booked">Booked for {formatBooking(application.scheduled_start, application.scheduled_end)}</p>
                  {calendarConnected ? (
                    <p className="muted small">This booking is in your Google Calendar.</p>
                  ) : (
                    <>
                      <button
                        className="secondary"
                        onClick={() =>
                          openExternal(
                            googleCalendarUrl(
                              `${collab.brand} · ${collab.title}`,
                              [collab.offer && `You get: ${collab.offer}`, collab.deliverables && `You post: ${collab.deliverables}`, 'Booked through The Social Atelier.'].filter(Boolean).join('\n'),
                              [collab.location, collab.city].filter(Boolean).join(', '),
                              application.scheduled_start!,
                              application.scheduled_end,
                            ),
                          )
                        }
                      >
                        Add to Google Calendar
                      </button>
                      <p className="muted small">Connect Google Calendar in your Profile to add bookings automatically.</p>
                    </>
                  )}
                </>
              ) : (
                <p className="muted">You're in! {collab.type === 'Walk-in' ? 'Visit any time during opening hours.' : 'The Social Atelier will be in touch with booking details.'}</p>
              )}
              <ContentDue collab={collab} application={application} onChanged={onChanged} />
            </>
          )}
          {application.status === 'pending' && (
            <button className="secondary" disabled={busy} onClick={() => run(() => api.withdraw(application.id))}>
              Withdraw application
            </button>
          )}
        </div>
      ) : blocker ? (
        <p className="notice">{blocker}</p>
      ) : applying ? (
        <form
          className="apply-box stack"
          onSubmit={(e) => {
            e.preventDefault()
            run(() => api.apply(collab.id, message.trim(), date || null))
          }}
        >
          <label>
            Why are you a great fit?
            <textarea rows={4} required value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Tell the brand about your audience and your content idea" />
          </label>
          {collab.type === 'Booking' && (
            <label>
              Preferred date
              <input type="date" min={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
          )}
          <ErrorText error={error} />
          <button className="primary" type="submit" disabled={busy}>
            {busy ? 'Sending…' : 'Send application'}
          </button>
        </form>
      ) : (
        <button className="primary" onClick={() => setApplying(true)}>
          Apply for this collab
        </button>
      )}
      {!applying && <ErrorText error={error} />}
    </Sheet>
  )
}

// Posting deadline and the creator's post links: the proof the brand is paying for.
function ContentDue({ collab, application, onChanged }: { collab: Collab; application: Application; onChanged: () => void }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const status = deliveryStatus(application)

  if (status === 'no-show') {
    return <p className="notice">You were marked as not attending this booking. If that's wrong, please contact The Social Atelier.</p>
  }

  const save = async (links: string[]) => {
    setBusy(true)
    setError(null)
    try {
      await api.submitPosts(application.id, links)
      setText('')
      onChanged()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const add = (e: React.FormEvent) => {
    e.preventDefault()
    const { links, invalid } = parseLinks(text)
    if (invalid.length) return setError(`These don't look like links: ${invalid.join(', ')}`)
    const all = [...new Set([...application.post_links, ...links])]
    if (all.length > 10) return setError('You can add up to 10 links.')
    save(all)
  }

  return (
    <section className="content-due" data-delivery={status}>
      <div className="card-top">
        <span className="eyebrow">Your content</span>
        <span className="badge" data-delivery={status}>
          {DELIVERY_LABELS[status]}
        </span>
      </div>
      {application.content_due && (
        <p className="due-date">
          {application.post_links.length ? 'Was due' : 'Post by'} {formatDate(application.content_due)}
        </p>
      )}
      {collab.deliverables && <p className="muted small">What to post: {collab.deliverables}</p>}
      {status === 'overdue' && <p className="error">Your post is overdue. Please add your links as soon as it's live.</p>}

      {application.post_links.length > 0 && (
        <ul className="submitted-links">
          {application.post_links.map((url) => (
            <li key={url}>
              <a href={url} target="_blank" rel="noreferrer">
                {platformOf(url)} ↗
              </a>
              <button className="link subtle" disabled={busy} onClick={() => save(application.post_links.filter((l) => l !== url))} aria-label={`Remove ${url}`}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <form className="stack" onSubmit={add}>
        <label>
          {application.post_links.length ? 'Add more links' : 'Paste your post links'}
          <textarea
            id={`links-${application.id}`}
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="instagram.com/reel/… one per line"
            autoCapitalize="none"
            autoCorrect="off"
          />
        </label>
        <ErrorText error={error} />
        <button className="primary" type="submit" disabled={busy || !text.trim()}>
          {busy ? 'Saving…' : 'Submit links'}
        </button>
      </form>
    </section>
  )
}
