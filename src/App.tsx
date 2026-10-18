import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'
import { onBrowserClosed } from './links'
import { startPush } from './push'
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
import BrandForm from './screens/admin/BrandForm'
import BrandPage from './screens/admin/BrandPage'
import Brands from './screens/admin/Brands'
import { type QueueKind, useAdminData } from './screens/admin/data'
import Influencers from './screens/admin/Influencers'
import Queue from './screens/admin/Queue'
import Today from './screens/admin/Today'
import type { Application, Brand, Collab, Profile, ProfileStatus } from './types'
import { ErrorText, Icon, Spinner, type IconName } from './ui'

type InfluencerTab = 'explore' | 'mine' | 'profile'
type AdminTab = 'today' | 'collabs' | 'brands' | 'influencers' | 'profile'

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
          <p className="muted">The Social Atelier reviews every profile so brands get the right creators. This takes 30 seconds.</p>
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

  // Acceptances seen during this visit to My collabs, so they keep their "New" tag until the influencer leaves.
  const [justSeen, setJustSeen] = useState<Set<string>>(new Set())
  const tabRef = useRef(tab)

  // Marks new acceptances as seen; called whenever My collabs is on screen.
  const seeAccepted = useCallback((apps: Application[]) => {
    const ids = apps.filter((a) => a.status === 'accepted' && a.seen === false).map((a) => a.id)
    if (ids.length === 0) return apps
    setJustSeen((s) => new Set([...s, ...ids]))
    api.markSeen(ids).catch(() => {})
    return apps.map((a) => (ids.includes(a.id) ? { ...a, seen: true } : a))
  }, [])

  const reloadApps = useCallback(() => {
    api.listMyApplications().then((apps) => setApplications(tabRef.current === 'mine' ? seeAccepted(apps) : apps), () => {})
  }, [seeAccepted])

  // The connected Google account; re-checked when the influencer returns from Google's consent page.
  const [calendarEmail, setCalendarEmail] = useState<string | null>(null)
  const reloadCalendar = useCallback(() => {
    api.getCalendarEmail().then(setCalendarEmail, () => {})
  }, [])
  useEffect(() => onBrowserClosed(reloadCalendar), [reloadCalendar])

  // Refresh on every tab change so approvals and acceptances show up without signing out.
  useEffect(() => {
    reloadApps()
    reloadCalendar()
    api.getMyProfile().then((p) => p && onProfile(p), () => {})
  }, [tab, onProfile, reloadApps, reloadCalendar])

  const changeTab = (t: InfluencerTab) => {
    if (t !== 'mine') setJustSeen(new Set())
    else setApplications(seeAccepted(applications))
    tabRef.current = t
    setTab(t)
  }

  useEffect(
    () =>
      startPush({
        onReceived: reloadApps,
        onOpened: () => {
          setOpen(null)
          tabRef.current = 'mine'
          setTab('mine')
        },
      }),
    [reloadApps],
  )

  const unseen = applications.filter((a) => a.status === 'accepted' && a.seen === false && a.collab)

  return (
    <div className="app">
      <main>
        <ErrorText error={error} />
        {loading ? (
          <Spinner />
        ) : tab === 'explore' ? (
          <Explore profile={profile} collabs={collabs} applications={applications} unseen={unseen} onOpen={setOpen} onShowAccepted={() => changeTab('mine')} />
        ) : tab === 'mine' ? (
          <MyApplications applications={applications} newIds={justSeen} onOpen={setOpen} />
        ) : (
          <Account profile={profile} onProfile={onProfile} calendarEmail={calendarEmail} onCalendarChanged={reloadCalendar} />
        )}
      </main>

      <TabBar
        tabs={[
          ['explore', 'explore', 'Explore'],
          ['mine', 'list', 'My collabs', unseen.length > 0],
          ['profile', 'person', 'Profile'],
        ]}
        active={tab}
        onChange={(t) => changeTab(t as InfluencerTab)}
      />

      {open && (
        <CollabDetail
          key={open.id}
          collab={open}
          profile={profile}
          application={applications.find((a) => a.collab_id === open.id)}
          calendarConnected={!!calendarEmail}
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
  const [tab, setTab] = useState<AdminTab>('today')
  const { data, error, reload } = useAdminData()
  const [influencerTab, setInfluencerTab] = useState<ProfileStatus>('pending')
  const [queueKind, setQueueKind] = useState<QueueKind | null>(null)
  const [viewing, setViewing] = useState<Collab | null>(null)
  const [editing, setEditing] = useState<Collab | 'new' | null>(null)
  const [newCollabBrand, setNewCollabBrand] = useState<string | undefined>(undefined)
  const [brandId, setBrandId] = useState<string | null>(null)
  const [editingBrand, setEditingBrand] = useState<Brand | 'new' | null>(null)

  // Fresh numbers whenever the admin switches tab.
  const changeTab = (t: AdminTab) => {
    setTab(t)
    reload()
  }
  // Collab objects are re-read from the latest data so sheets show current values.
  const current = (c: Collab | null) => (c && data?.collabs.find((x) => x.id === c.id)) || c
  const brand = data?.brands.find((b) => b.id === brandId) ?? null

  return (
    <div className="app">
      <main>
        <ErrorText error={error} />
        {!data ? (
          <Spinner />
        ) : tab === 'today' ? (
          <Today
            data={data}
            onProfiles={() => {
              setInfluencerTab('pending')
              changeTab('influencers')
            }}
            onQueue={setQueueKind}
            onOpenCollab={setViewing}
            onMoney={() => changeTab('brands')}
          />
        ) : tab === 'collabs' ? (
          <AdminCollabs collabs={data.collabs} brands={data.brands} finances={data.finances} onOpen={setViewing} onNew={() => setEditing('new')} />
        ) : tab === 'brands' ? (
          <Brands data={data} onOpen={(b) => setBrandId(b.id)} onNew={() => setEditingBrand('new')} />
        ) : tab === 'influencers' ? (
          <Influencers key={influencerTab} initialTab={influencerTab} onChanged={reload} />
        ) : (
          <Account profile={profile} onProfile={onProfile} />
        )}
      </main>

      <TabBar
        tabs={[
          ['today', 'today', 'Today'],
          ['collabs', 'gift', 'Collabs'],
          ['brands', 'store', 'Brands'],
          ['influencers', 'people', 'Creators'],
          ['profile', 'person', 'Account'],
        ]}
        active={tab}
        onChange={(t) => changeTab(t as AdminTab)}
      />

      {data && queueKind && <Queue kind={queueKind} applications={data.applications} onOpenCollab={setViewing} onClose={() => setQueueKind(null)} />}
      {data && brand && (
        <BrandPage
          brand={brand}
          data={data}
          onClose={() => setBrandId(null)}
          onEdit={() => setEditingBrand(brand)}
          onOpenCollab={setViewing}
          onNewCollab={() => {
            setNewCollabBrand(brand.id)
            setEditing('new')
          }}
          onChanged={reload}
        />
      )}
      {viewing && !editing && (
        <Applicants collab={current(viewing)!} onClose={() => setViewing(null)} onEdit={() => setEditing(current(viewing))} onChanged={reload} />
      )}
      {data && editing && (
        <CollabForm
          collab={editing === 'new' ? undefined : editing}
          brands={data.brands}
          finance={editing === 'new' ? undefined : data.finances[editing.id]}
          brandId={editing === 'new' ? newCollabBrand : undefined}
          onClose={() => {
            setEditing(null)
            setNewCollabBrand(undefined)
          }}
          onSaved={() => {
            setEditing(null)
            setNewCollabBrand(undefined)
            setViewing(null)
            reload()
          }}
        />
      )}
      {editingBrand && (
        <BrandForm
          brand={editingBrand === 'new' ? undefined : editingBrand}
          onClose={() => setEditingBrand(null)}
          onSaved={(b) => {
            setEditingBrand(null)
            setBrandId(b.id)
            reload()
          }}
        />
      )}
    </div>
  )
}

function TabBar({ tabs, active, onChange }: { tabs: [string, IconName, string, boolean?][]; active: string; onChange: (t: string) => void }) {
  return (
    <nav className="tabbar">
      {tabs.map(([id, icon, label, dot]) => (
        <button key={id} className={active === id ? 'on' : ''} onClick={() => onChange(id)} aria-label={dot ? `${label}, new` : undefined}>
          <span className="tab-icon">
            <Icon name={icon} />
            {dot && <span className="dot" />}
          </span>
          {label}
        </button>
      ))}
    </nav>
  )
}
