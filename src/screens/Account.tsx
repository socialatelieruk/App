import { useState } from 'react'
import { api } from '../api'
import { openExternal } from '../links'
import { stopPush } from '../push'
import { errorMessage, formatFollowers } from '../format'
import type { Profile } from '../types'
import { Badge, ErrorText } from '../ui'
import ProfileForm from './ProfileForm'

interface Props {
  profile: Profile
  onProfile: (p: Profile) => void
  calendarEmail?: string | null // influencers only
  onCalendarChanged?: () => void
}

export default function Account({ profile, onProfile, calendarEmail, onCalendarChanged }: Props) {
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [calendarBusy, setCalendarBusy] = useState(false)

  const calendarAction = async (fn: () => Promise<void>) => {
    setCalendarBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setCalendarBusy(false)
    }
  }

  const deleteAccount = async () => {
    if (!confirm('Delete your account and all your applications? This cannot be undone.')) return
    try {
      await stopPush()
      await api.deleteMyAccount()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <>
      <header className="page-header">
        <h1>Profile</h1>
      </header>

      {editing ? (
        <ProfileForm
          profile={profile}
          submitLabel="Save changes"
          onSaved={(p) => {
            onProfile(p)
            setEditing(false)
          }}
        />
      ) : (
        <div className="card profile-card">
          <div className="avatar">{(profile.full_name || profile.email || '?').slice(0, 1).toUpperCase()}</div>
          <div className="stack tight">
            <strong className="card-title">{profile.full_name || 'The Social Atelier'}</strong>
            <span className="muted small">{profile.email}</span>
            {profile.role === 'influencer' ? (
              <>
                <div className="meta">
                  {profile.instagram && <span>IG @{profile.instagram}</span>}
                  {profile.tiktok && <span>TikTok @{profile.tiktok}</span>}
                  <span>{formatFollowers(profile.followers)} followers</span>
                  {profile.city && <span>{profile.city}</span>}
                </div>
                {profile.bio && <p className="small">{profile.bio}</p>}
                <span>
                  Status: <Badge status={profile.status} />
                </span>
              </>
            ) : (
              <Badge status="admin" />
            )}
          </div>
        </div>
      )}

      {profile.role === 'influencer' && !editing && (
        <section className="calendar-card card">
          <span className="eyebrow">Google Calendar</span>
          {calendarEmail ? (
            <>
              <p>
                Connected to <strong>{calendarEmail}</strong>. Accepted collabs are added to your calendar automatically.
              </p>
              <button
                className="link subtle"
                disabled={calendarBusy}
                onClick={() =>
                  calendarAction(async () => {
                    await api.disconnectCalendar()
                    onCalendarChanged?.()
                  })
                }
              >
                Disconnect
              </button>
            </>
          ) : (
            <>
              <p>Connect your Google Calendar and every collab you're accepted for appears there with its date and time.</p>
              <button className="primary" disabled={calendarBusy} onClick={() => calendarAction(async () => openExternal(await api.connectCalendar()))}>
                Connect Google Calendar
              </button>
            </>
          )}
        </section>
      )}

      <div className="stack">
        {profile.role === 'influencer' && !editing && (
          <button className="secondary" onClick={() => setEditing(true)}>
            Edit profile
          </button>
        )}
        {editing && (
          <button className="link" onClick={() => setEditing(false)}>
            Cancel
          </button>
        )}
        <button className="secondary" onClick={() => stopPush().then(() => api.signOut())}>
          Sign out
        </button>
        <button className="danger" onClick={deleteAccount}>
          Delete account
        </button>
        <ErrorText error={error} />
        {api.mode === 'demo' && <p className="muted small">Demo mode. Deleting the account resets the demo data.</p>}
      </div>
    </>
  )
}
