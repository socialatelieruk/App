import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import { errorMessage } from './format'
import Account from './screens/Account'
import Auth from './screens/Auth'
import CollabDetail from './screens/CollabDetail'
import Explore from './screens/Explore'
import MyApplications from './screens/MyApplications'
import ProfileForm from './screens/ProfileForm'
import AdminCollabs from './screens/admin/AdminCollabs'
import Applicants from './screens/admin/Applicants'
import CollabForm from './screens/admin/CollabForm'
import Influencers from './screens/admin/Influencers'
import type { Application, Collab, Profile } from './types'
import { ErrorText, Spinner } from './ui'

type InfluencerTab = 'explore' | 'mine' | 'profile'
type AdminTab = 'collabs' | 'influencers' | 'profile'

export default function App() {
  const [userId, setUserId] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    api.getUserId().then(setUserId)
    return api.onAuthChange(setUserId)
  }, [])

  if (userId === undefined) return <Spinner />
  if (!userId) return <Auth />
  // Keyed so a different user starts with fresh state.
  return <SignedIn key={userId} />
}

function SignedIn() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getMyProfile().then(setProfile, (e) => setError(errorMessage(e)))
  }, [])

  if (error)
    return (
      <div className="auth">
        <ErrorText error={error} />
        <button className="secondary" onClick={() => api.signOut()}>
          Sign out
        </button>
      </div>
    )
  if (!profile) return <Spinner />

  if (profile.role === 'influencer' && !profile.full_name) {
    return (
      <div className="app">
        <header className="page-header">
          <h1>Tell us about you</h1>
          <p className="muted">Social Atelier reviews every profile so brands get the right creators. This takes 30 seconds.</p>
        </header>
        <ProfileForm profile={profile} onSaved={setProfile} submitLabel="Submit for review" />
      </div>
    )
  }

  return profile.role === 'admin' ? <AdminApp profile={profile} onProfile={setProfile} /> : <InfluencerApp profile={profile} onProfile={setProfile} />
}

function useCollabs() {
  const [collabs, setCollabs] = useState<Collab[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const reload = useCallback(() => {
    api.listCollabs().then(
      (c) => {
        setCollabs(c)
        setLoading(false)
      },
      (e) => setError(errorMessage(e)),
    )
  }, [])
  useEffect(reload, [reload])
  return { collabs, loading, error, reload }
}

function InfluencerApp({ profile, onProfile }: { profile: Profile; onProfile: (p: Profile) => void }) {
  const [tab, setTab] = useState<InfluencerTab>('explore')
  const { collabs, loading, error, reload } = useCollabs()
  const [applications, setApplications] = useState<Application[]>([])
  const [open, setOpen] = useState<Collab | null>(null)

  const reloadApps = useCallback(() => {
    api.listMyApplications().then(setApplications, () => {})
  }, [])
  useEffect(reloadApps, [reloadApps])

  // Refresh the profile so an approval shows up without signing out.
  useEffect(() => {
    api.getMyProfile().then((p) => p && onProfile(p), () => {})
  }, [tab, onProfile])

  return (
    <div className="app">
      <main>
        <ErrorText error={error} />
        {loading ? (
          <Spinner />
        ) : tab === 'explore' ? (
          <Explore profile={profile} collabs={collabs} applications={applications} onOpen={setOpen} />
        ) : tab === 'mine' ? (
          <MyApplications applications={applications} onOpen={setOpen} />
        ) : (
          <Account profile={profile} onProfile={onProfile} />
        )}
      </main>

      <TabBar
        tabs={[
          ['explore', '✨', 'Explore'],
          ['mine', '📋', 'My collabs'],
          ['profile', '👤', 'Profile'],
        ]}
        active={tab}
        onChange={(t) => setTab(t as InfluencerTab)}
      />

      {open && (
        <CollabDetail
          key={open.id}
          collab={open}
          profile={profile}
          application={applications.find((a) => a.collab_id === open.id)}
          onClose={() => setOpen(null)}
          onChanged={() => {
            reloadApps()
            reload()
          }}
        />
      )}
    </div>
  )
}

function AdminApp({ profile, onProfile }: { profile: Profile; onProfile: (p: Profile) => void }) {
  const [tab, setTab] = useState<AdminTab>('collabs')
  const { collabs, loading, error, reload } = useCollabs()
  const [viewing, setViewing] = useState<Collab | null>(null)
  const [editing, setEditing] = useState<Collab | 'new' | null>(null)

  return (
    <div className="app">
      <main>
        <ErrorText error={error} />
        {tab === 'collabs' ? (
          loading ? (
            <Spinner />
          ) : (
            <AdminCollabs collabs={collabs} onOpen={setViewing} onNew={() => setEditing('new')} />
          )
        ) : tab === 'influencers' ? (
          <Influencers />
        ) : (
          <Account profile={profile} onProfile={onProfile} />
        )}
      </main>

      <TabBar
        tabs={[
          ['collabs', '🎁', 'Collabs'],
          ['influencers', '⭐', 'Influencers'],
          ['profile', '👤', 'Account'],
        ]}
        active={tab}
        onChange={(t) => setTab(t as AdminTab)}
      />

      {viewing && !editing && (
        <Applicants
          collab={viewing}
          onClose={() => setViewing(null)}
          onEdit={() => setEditing(viewing)}
          onChanged={reload}
        />
      )}
      {editing && (
        <CollabForm
          collab={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            setViewing(null)
            reload()
          }}
        />
      )}
    </div>
  )
}

function TabBar({ tabs, active, onChange }: { tabs: [string, string, string][]; active: string; onChange: (t: string) => void }) {
  return (
    <nav className="tabbar">
      {tabs.map(([id, icon, label]) => (
        <button key={id} className={active === id ? 'on' : ''} onClick={() => onChange(id)}>
          <span className="tab-icon">{icon}</span>
          {label}
        </button>
      ))}
    </nav>
  )
}
