import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api'
import { addDays, DELIVERY_LABELS, deliveryStatus, platformOf, reliability } from '../../delivery'
import { errorMessage, formatBooking, formatDate, formatFollowers, todayISO } from '../../format'
import { reportUrl, shareLink } from '../../links'
import type { Application, ApplicationStatus, Booking, BrandReport, Collab, DeliveryStats, ShortlistEntry } from '../../types'
import { Badge, Empty, ErrorText, Sheet, Spinner } from '../../ui'
import { ReportView } from '../BrandReport'

interface Props {
  collab: Collab
  brandHasPortal: boolean // the brand signs in and approves its own shortlist
  onClose: () => void
  onEdit: () => void
  onChanged: () => void
}

export default function Applicants({ collab, brandHasPortal, onClose, onEdit, onChanged }: Props) {
  const [apps, setApps] = useState<Application[] | null>(null)
  const [shortlist, setShortlist] = useState<ShortlistEntry[]>([])
  const [stats, setStats] = useState<Record<string, DeliveryStats>>({})
  const [error, setError] = useState<string | null>(null)
  const [scheduling, setScheduling] = useState<string | null>(null) // application being accepted or re-timed
  const [report, setReport] = useState<BrandReport | null>(null)
  const [shareNote, setShareNote] = useState<string | null>(null)

  const load = useCallback(() => {
    api.listApplicants(collab.id).then(setApps, (e) => setError(errorMessage(e)))
    api.getReliability().then(setStats, () => {})
    api.listShortlist().then((s) => setShortlist(s.filter((x) => x.collab_id === collab.id)), () => {})
  }, [collab.id])

  useEffect(load, [load])

  const run = async (fn: () => Promise<unknown>) => {
    setError(null)
    try {
      await fn()
      setScheduling(null)
      load()
      onChanged()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const setStatus = (id: string, status: ApplicationStatus, booking?: Booking) =>
    run(async () => {
      await api.setApplicationStatus(id, status, booking)
      // Acting on a brand's decision (booking or declining) clears it from Brand replies.
      const entry = shortlist.find((s) => s.application_id === id)
      if (entry?.decision && !entry.handled) await api.markShortlistHandled(id)
    })
  const entryFor = (id: string) => shortlist.find((s) => s.application_id === id)
  const withBrand = shortlist.filter((s) => !s.decision).length

  const share = async () => {
    setShareNote(null)
    try {
      const how = await shareLink(reportUrl(await api.getReportToken(collab.id)), `${collab.brand} · Campaign report`)
      if (how === 'copied') setShareNote('Report link copied. Paste it into your email or message to the brand.')
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const preview = async () => {
    try {
      setReport(await api.getReport(await api.getReportToken(collab.id)))
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const live = apps?.filter((a) => a.status !== 'withdrawn') ?? []
  const accepted = live.filter((a) => a.status === 'accepted')
  const counts = accepted.reduce<Record<string, number>>((c, a) => {
    const s = deliveryStatus(a)
    c[s] = (c[s] ?? 0) + 1
    return c
  }, {})

  if (report) {
    return (
      <Sheet title="Brand report preview" onClose={() => setReport(null)}>
        <p className="notice">This is what the brand sees. No-shows and contact details are left out.</p>
        <ReportView report={report} />
      </Sheet>
    )
  }

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
        {collab.brand} · {accepted.length}/{collab.spots} spots filled · <Badge status={collab.status} />
      </p>

      {accepted.length > 0 && (
        <section className="delivery-summary card">
          <span className="eyebrow">Content delivery</span>
          <div className="delivery-counts">
            {(['posted', 'posted-late', 'due', 'overdue', 'no-show'] as const)
              .filter((s) => counts[s])
              .map((s) => (
                <span key={s} className="delivery-count" data-delivery={s}>
                  <strong>{counts[s]}</strong> {DELIVERY_LABELS[s]}
                </span>
              ))}
          </div>
          <div className="actions">
            <button className="primary small" onClick={share}>
              Share brand report
            </button>
            <button className="secondary small" onClick={preview}>
              Preview
            </button>
          </div>
          {shareNote && <p className="muted small">{shareNote}</p>}
        </section>
      )}

      {brandHasPortal && (
        <p className="muted small">
          {collab.brand} approves creators from your shortlist.
          {withBrand > 0 && ` ${withBrand} waiting for their decision.`}
        </p>
      )}

      <ErrorText error={error} />
      {!apps ? (
        <Spinner />
      ) : live.length === 0 ? (
        <Empty>No applications yet.</Empty>
      ) : (
        <ul className="list">
          {live.map((a) => {
            const rel = reliability(stats[a.user_id])
            const delivery = a.status === 'accepted' ? deliveryStatus(a) : null
            return (
              <li key={a.id} className="card applicant">
                <div className="card-top">
                  <strong>{a.profile?.full_name ?? 'Unknown'}</strong>
                  <Badge status={a.status} />
                </div>
                <span className="reliability" data-tier={rel.tier} title={rel.detail}>
                  Reliability {rel.label} <span className="muted">· {rel.detail}</span>
                </span>
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
                {(() => {
                  const entry = entryFor(a.id)
                  if (!entry) return null
                  const note = entry.note ? `: “${entry.note}”` : ''
                  return (
                    <p className="shortlist-line" data-decision={entry.decision ?? 'waiting'}>
                      {entry.decision === 'approved'
                        ? `Approved by ${collab.brand}${note}`
                        : entry.decision === 'declined'
                          ? `Declined by ${collab.brand}${note}`
                          : `With ${collab.brand} · waiting for their decision`}
                      {!entry.decision && (
                        <button className="link small" onClick={() => run(() => api.removeFromShortlist(a.id))}>
                          Undo
                        </button>
                      )}
                    </p>
                  )
                })()}
                <span className="muted small">
                  Applied {formatDate(a.created_at)}
                  {a.preferred_date && ` · wants ${formatDate(a.preferred_date)}`}
                  {a.profile?.email && ` · ${a.profile.email}`}
                </span>

                {a.status === 'accepted' && (
                  <div className="delivery">
                    <p className="booked">{a.scheduled_start ? `Booked for ${formatBooking(a.scheduled_start, a.scheduled_end)}` : 'Accepted with no fixed time'}</p>
                    <p className="delivery-line">
                      <span className="badge" data-delivery={delivery!}>
                        {DELIVERY_LABELS[delivery!]}
                      </span>
                      {a.content_due && delivery !== 'no-show' && <span className="muted small">Due {formatDate(a.content_due)}</span>}
                      {a.posted_at && <span className="muted small">Posted {formatDate(a.posted_at.slice(0, 10))}</span>}
                    </p>
                    {a.post_links.length > 0 && (
                      <div className="post-links">
                        {a.post_links.map((url) => (
                          <a key={url} className="post-link" href={url} target="_blank" rel="noreferrer">
                            {platformOf(url)} ↗
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {scheduling === a.id ? (
                  <ScheduleForm
                    collab={collab}
                    application={a}
                    onConfirm={(booking) => setStatus(a.id, 'accepted', booking)}
                    onCancel={() => setScheduling(null)}
                  />
                ) : (
                  <div className="actions wrap">
                    {brandHasPortal && a.status === 'pending' && !entryFor(a.id) && (
                      <button className="primary small" onClick={() => run(() => api.sendToBrand(a.id))}>
                        Send to brand
                      </button>
                    )}
                    {a.status !== 'accepted' ? (
                      <button className={brandHasPortal ? 'secondary small' : 'primary small'} onClick={() => setScheduling(a.id)}>
                        Accept
                      </button>
                    ) : (
                      <button className="secondary small" onClick={() => setScheduling(a.id)}>
                        Change time
                      </button>
                    )}
                    {a.status === 'accepted' &&
                      (a.attendance === 'no_show' ? (
                        <button className="secondary small" onClick={() => run(() => api.setAttendance(a.id, null))}>
                          Undo no-show
                        </button>
                      ) : (
                        a.post_links.length === 0 && (
                          <button className="secondary small" onClick={() => run(() => api.setAttendance(a.id, 'no_show'))}>
                            Mark no-show
                          </button>
                        )
                      ))}
                    {a.status !== 'declined' && (
                      <button className="secondary small" onClick={() => setStatus(a.id, 'declined')}>
                        Decline
                      </button>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Sheet>
  )
}

const DURATIONS = [30, 60, 90, 120, 180, 240]
const durationLabel = (m: number) => (m < 60 ? `${m} min` : `${m / 60} hour${m === 60 ? '' : 's'}`)

const localDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const localTime = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

// The confirmed booking time, which goes into the influencer's calendar, and the posting deadline.
function ScheduleForm({ collab, application, onConfirm, onCancel }: { collab: Collab; application: Application; onConfirm: (b: Booking) => void; onCancel: () => void }) {
  const existing = application.scheduled_start ? new Date(application.scheduled_start) : null
  const existingMinutes = existing && application.scheduled_end ? Math.round((new Date(application.scheduled_end).getTime() - existing.getTime()) / 60_000) : null

  const [timed, setTimed] = useState(collab.type !== 'Walk-in' || !!existing)
  const [date, setDate] = useState(existing ? localDate(existing) : (application.preferred_date ?? collab.event_date ?? todayISO()))
  const [time, setTime] = useState(existing ? localTime(existing) : '12:00')
  const [minutes, setMinutes] = useState(existingMinutes ?? (collab.type === 'Event' ? 180 : 90))
  // Follows the visit date until the admin picks a deadline themselves.
  const [dueEdited, setDueEdited] = useState(!!application.content_due)
  const [due, setDue] = useState(application.content_due ?? '')
  const contentDue = dueEdited ? due : addDays(timed ? date : todayISO(), collab.content_due_days)
  const [busy, setBusy] = useState(false)
  const id = application.id

  const confirm = (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const start = new Date(`${date}T${time}`)
    onConfirm({
      schedule: timed ? { start: start.toISOString(), end: new Date(start.getTime() + minutes * 60_000).toISOString() } : null,
      contentDue: contentDue || null,
    })
  }

  return (
    <form className="schedule stack" onSubmit={confirm}>
      <span className="eyebrow">{application.status === 'accepted' ? 'Change booking' : 'Confirm booking'}</span>
      {collab.type === 'Walk-in' && (
        <label className="toggle">
          <input id={`timed-${id}`} type="checkbox" checked={timed} onChange={(e) => setTimed(e.target.checked)} />
          Set a date and time
        </label>
      )}
      {timed && (
        <>
          <div className="row">
            <label>
              Date
              <input id={`date-${id}`} type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label>
              Time
              <input id={`time-${id}`} type="time" required value={time} onChange={(e) => setTime(e.target.value)} />
            </label>
          </div>
          <label>
            Length
            <select id={`length-${id}`} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
              {[...new Set([...DURATIONS, minutes])]
                .sort((a, b) => a - b)
                .map((m) => (
                  <option key={m} value={m}>
                    {durationLabel(m)}
                  </option>
                ))}
            </select>
          </label>
        </>
      )}
      <label>
        Content due by
        <input
          id={`due-${id}`}
          type="date"
          required
          value={contentDue}
          onChange={(e) => {
            setDueEdited(true)
            setDue(e.target.value)
          }}
        />
      </label>
      <p className="muted small">The visit goes into their Google Calendar if they've connected it. The deadline is when their post links are due.</p>
      <div className="actions">
        <button className="primary small" type="submit" disabled={busy}>
          {application.status === 'accepted' ? 'Save' : 'Accept'}
        </button>
        <button className="secondary small" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
