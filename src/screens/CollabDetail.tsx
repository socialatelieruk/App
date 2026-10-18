import { useState } from 'react'
import { api } from '../api'
import { errorMessage, formatBooking, formatDate, formatFollowers, googleCalendarUrl, todayISO } from '../format'
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
