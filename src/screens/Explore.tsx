import { useMemo, useState } from 'react'
import { todayISO } from '../format'
import { CATEGORIES, COLLAB_TYPES, type Application, type Category, type Collab, type CollabType, type Profile } from '../types'
import { Badge, CollabCard, Empty } from '../ui'

interface Props {
  profile: Profile
  collabs: Collab[]
  applications: Application[]
  onOpen: (c: Collab) => void
}

export default function Explore({ profile, collabs, applications, onOpen }: Props) {
  const [type, setType] = useState<CollabType | 'All'>('All')
  const [category, setCategory] = useState<Category | 'All'>('All')
  const [city, setCity] = useState<string>('All')

  const today = todayISO()
  const open = collabs.filter((c) => c.status === 'open' && (!c.apply_by || c.apply_by >= today))
  const cities = useMemo(() => [...new Set(open.map((c) => c.city))].sort(), [open])
  const appByCollab = new Map(applications.filter((a) => a.status !== 'withdrawn').map((a) => [a.collab_id, a]))

  const shown = open.filter((c) => (type === 'All' || c.type === type) && (category === 'All' || c.category === category) && (city === 'All' || c.city === city))

  return (
    <>
      <header className="page-header">
        <span className="eyebrow">Welcome, {profile.full_name.split(' ')[0] || 'there'}</span>
        <h1>Explore</h1>
      </header>

      {profile.status === 'pending' && <p className="notice">Thanks for joining! Your profile is being reviewed. You can browse now and apply once you're approved.</p>}

      <div className="chips scroll">
        {(['All', ...COLLAB_TYPES] as const).map((t) => (
          <button key={t} className={`chip ${type === t ? 'on' : ''}`} onClick={() => setType(t)}>
            {t}
          </button>
        ))}
      </div>
      <div className="filters">
        <select value={category} onChange={(e) => setCategory(e.target.value as Category | 'All')} aria-label="Category">
          <option value="All">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select value={city} onChange={(e) => setCity(e.target.value)} aria-label="City">
          <option value="All">All cities</option>
          {cities.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>

      {shown.length === 0 ? (
        <Empty>No collabs match right now. Check back soon!</Empty>
      ) : (
        <div className="cards">
          {shown.map((c) => {
            const app = appByCollab.get(c.id)
            return <CollabCard key={c.id} collab={c} onOpen={() => onOpen(c)} badge={app && <Badge status={app.status === 'pending' ? 'applied' : app.status} />} />
          })}
        </div>
      )}
    </>
  )
}
