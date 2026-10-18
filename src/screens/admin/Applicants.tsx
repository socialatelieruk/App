import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api'
import { errorMessage, formatBooking, formatDate, formatFollowers, todayISO } from '../../format'
import type { Application, ApplicationStatus, Collab, Schedule } from '../../types'
import { Badge, Empty, ErrorText, Sheet, Spinner } from '../../ui'

export default function Applicants({ collab, onClose, onEdit, onChanged }: { collab: Collab; onClose: () => void; onEdit: () => void; onChanged: () => void }) {
  const [apps, setApps] = useState<Application[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scheduling, setScheduling] = useState<string | null>(null) // application being accepted or re-timed

  const load = useCallback(() => {
    api.listApplicants(collab.id).then(setApps, (e) => setError(errorMessage(e)))
  }, [collab.id])

  useEffect(load, [load])

  const setStatus = async (id: string, status: ApplicationStatus, schedule?: Schedule | null) => {
    try {
      await api.setApplicationStatus(id, status, schedule)
      setScheduling(null)
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
              {a.status === 'accepted' && (
                <p className="booked">{a.scheduled_start ? `Booked for ${formatBooking(a.scheduled_start, a.scheduled_end)}` : 'Accepted with no fixed time'}</p>
              )}

              {scheduling === a.id ? (
                <ScheduleForm
                  collab={collab}
                  application={a}
                  onConfirm={(schedule) => setStatus(a.id, 'accepted', schedule)}
                  onCancel={() => setScheduling(null)}
                />
              ) : (
                <div className="actions">
                  {a.status !== 'accepted' ? (
                    <button className="primary small" onClick={() => setScheduling(a.id)}>
                      Accept
                    </button>
                  ) : (
                    <button className="secondary small" onClick={() => setScheduling(a.id)}>
                      Change time
                    </button>
                  )}
                  {a.status !== 'declined' && (
                    <button className="secondary small" onClick={() => setStatus(a.id, 'declined')}>
                      Decline
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  )
}

const DURATIONS = [30, 60, 90, 120, 180, 240]
const durationLabel = (m: number) => (m < 60 ? `${m} min` : `${m / 60} hour${m === 60 ? '' : 's'}`)

const localDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const localTime = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

// The confirmed booking time, which goes into the influencer's calendar.
function ScheduleForm({ collab, application, onConfirm, onCancel }: { collab: Collab; application: Application; onConfirm: (s: Schedule | null) => void; onCancel: () => void }) {
  const existing = application.scheduled_start ? new Date(application.scheduled_start) : null
  const existingMinutes = existing && application.scheduled_end ? Math.round((new Date(application.scheduled_end).getTime() - existing.getTime()) / 60_000) : null

  const [timed, setTimed] = useState(collab.type !== 'Walk-in' || !!existing)
  const [date, setDate] = useState(existing ? localDate(existing) : (application.preferred_date ?? collab.event_date ?? todayISO()))
  const [time, setTime] = useState(existing ? localTime(existing) : '12:00')
  const [minutes, setMinutes] = useState(existingMinutes ?? (collab.type === 'Event' ? 180 : 90))
  const [busy, setBusy] = useState(false)
  const id = application.id

  const confirm = (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    if (!timed) return onConfirm(null)
    const start = new Date(`${date}T${time}`)
    onConfirm({ start: start.toISOString(), end: new Date(start.getTime() + minutes * 60_000).toISOString() })
  }

  return (
    <form className="schedule stack" onSubmit={confirm}>
      <span className="eyebrow">{application.status === 'accepted' ? 'Change booking time' : 'Confirm booking time'}</span>
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
          <p className="muted small">This goes straight into their calendar if they've connected Google Calendar.</p>
        </>
      )}
      <div className="actions">
        <button className="primary small" type="submit" disabled={busy}>
          {application.status === 'accepted' ? 'Save time' : 'Accept'}
        </button>
        <button className="secondary small" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
