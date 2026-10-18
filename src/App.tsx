import { useEffect, useMemo, useState } from 'react'
import PostEditor from './PostEditor'
import { WEEKDAYS, formatLongDate, formatMonth, monthGrid, toISODate, today } from './dates'
import { loadPosts, savePosts } from './storage'
import { PLATFORMS, PLATFORM_COLORS, STATUSES, type Platform, type Post, type Status } from './types'

type View = 'calendar' | 'list'

function newPost(date: string): Post {
  const now = Date.now()
  return {
    id: crypto.randomUUID(),
    title: '',
    caption: '',
    hashtags: '',
    date,
    time: '',
    platforms: [],
    status: 'Idea',
    notes: '',
    createdAt: now,
    updatedAt: now,
  }
}

const byDateTime = (a: Post, b: Post) => (a.date + a.time).localeCompare(b.date + b.time)

export default function App() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loaded, setLoaded] = useState(false)
  const [view, setView] = useState<View>('calendar')
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const [selectedDate, setSelectedDate] = useState(today())
  const [editing, setEditing] = useState<{ post: Post; isNew: boolean } | null>(null)
  const [platformFilter, setPlatformFilter] = useState<Platform | 'All'>('All')
  const [statusFilter, setStatusFilter] = useState<Status | 'All'>('All')

  useEffect(() => {
    loadPosts().then((p) => {
      setPosts(p)
      setLoaded(true)
    })
  }, [])

  useEffect(() => {
    if (loaded) savePosts(posts)
  }, [posts, loaded])

  const visible = useMemo(
    () =>
      posts
        .filter((p) => platformFilter === 'All' || p.platforms.includes(platformFilter))
        .filter((p) => statusFilter === 'All' || p.status === statusFilter)
        .sort(byDateTime),
    [posts, platformFilter, statusFilter],
  )

  const postsByDate = useMemo(() => {
    const map = new Map<string, Post[]>()
    for (const p of visible) {
      const list = map.get(p.date) ?? []
      list.push(p)
      map.set(p.date, list)
    }
    return map
  }, [visible])

  const savePost = (post: Post) => {
    const updated = { ...post, updatedAt: Date.now() }
    setPosts((ps) => (ps.some((p) => p.id === post.id) ? ps.map((p) => (p.id === post.id ? updated : p)) : [...ps, updated]))
    setSelectedDate(post.date)
    setEditing(null)
  }

  const deletePost = (id: string) => {
    setPosts((ps) => ps.filter((p) => p.id !== id))
    setEditing(null)
  }

  const duplicatePost = (post: Post) => {
    const now = Date.now()
    setEditing({ post: { ...post, id: crypto.randomUUID(), title: `${post.title} (copy)`, status: 'Draft', createdAt: now, updatedAt: now }, isNew: true })
  }

  const shiftMonth = (delta: number) =>
    setCursor(({ year, month }) => {
      const d = new Date(year, month + delta, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })

  const goToday = () => {
    const d = new Date()
    setCursor({ year: d.getFullYear(), month: d.getMonth() })
    setSelectedDate(today())
  }

  const counts = useMemo(() => {
    const c: Record<Status, number> = { Idea: 0, Draft: 0, Scheduled: 0, Posted: 0 }
    for (const p of posts) c[p.status]++
    return c
  }, [posts])

  const todayStr = today()
  const upcoming = visible.filter((p) => p.date >= todayStr)
  const past = visible.filter((p) => p.date < todayStr).reverse()
  const dayPosts = postsByDate.get(selectedDate) ?? []

  return (
    <div className="app">
      <header className="topbar">
        <h1>Content Planner</h1>
        <div className="segmented small">
          <button className={view === 'calendar' ? 'on' : ''} onClick={() => setView('calendar')}>
            Calendar
          </button>
          <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>
            List
          </button>
        </div>
      </header>

      <section className="stats">
        {STATUSES.map((s) => (
          <button key={s} className={`stat ${statusFilter === s ? 'on' : ''}`} data-status={s} onClick={() => setStatusFilter(statusFilter === s ? 'All' : s)}>
            <strong>{counts[s]}</strong>
            <span>{s}</span>
          </button>
        ))}
      </section>

      <div className="filters">
        <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value as Platform | 'All')} aria-label="Filter by platform">
          <option value="All">All platforms</option>
          {PLATFORMS.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        {(platformFilter !== 'All' || statusFilter !== 'All') && (
          <button
            className="link"
            onClick={() => {
              setPlatformFilter('All')
              setStatusFilter('All')
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      <main>
        {view === 'calendar' ? (
          <>
            <div className="month-nav">
              <button className="icon" onClick={() => shiftMonth(-1)} aria-label="Previous month">
                ‹
              </button>
              <h2>{formatMonth(cursor.year, cursor.month)}</h2>
              <button className="icon" onClick={() => shiftMonth(1)} aria-label="Next month">
                ›
              </button>
              <button className="link" onClick={goToday}>
                Today
              </button>
            </div>

            <div className="grid">
              {WEEKDAYS.map((w) => (
                <div key={w} className="weekday">
                  {w}
                </div>
              ))}
              {monthGrid(cursor.year, cursor.month).map((d) => {
                const iso = toISODate(d)
                const items = postsByDate.get(iso) ?? []
                const classes = ['day', d.getMonth() !== cursor.month && 'outside', iso === todayStr && 'today', iso === selectedDate && 'selected'].filter(Boolean).join(' ')
                return (
                  <button key={iso} className={classes} onClick={() => setSelectedDate(iso)} onDoubleClick={() => setEditing({ post: newPost(iso), isNew: true })}>
                    <span className="num">{d.getDate()}</span>
                    <span className="dots">
                      {items.slice(0, 4).map((p) => (
                        <i key={p.id} style={{ background: p.platforms[0] ? PLATFORM_COLORS[p.platforms[0]] : 'var(--muted)' }} />
                      ))}
                      {items.length > 4 && <small>+{items.length - 4}</small>}
                    </span>
                  </button>
                )
              })}
            </div>

            <h3 className="day-title">{formatLongDate(selectedDate)}</h3>
            {dayPosts.length === 0 ? <p className="empty">Nothing planned. Tap + to add a post.</p> : <PostList posts={dayPosts} onOpen={(p) => setEditing({ post: p, isNew: false })} />}
          </>
        ) : (
          <>
            <h3 className="day-title">Upcoming</h3>
            {upcoming.length === 0 ? <p className="empty">No upcoming posts.</p> : <PostList posts={upcoming} showDate onOpen={(p) => setEditing({ post: p, isNew: false })} />}
            {past.length > 0 && (
              <>
                <h3 className="day-title">Past</h3>
                <PostList posts={past} showDate onOpen={(p) => setEditing({ post: p, isNew: false })} />
              </>
            )}
          </>
        )}
      </main>

      <button className="fab" aria-label="Add post" onClick={() => setEditing({ post: newPost(view === 'calendar' ? selectedDate : todayStr), isNew: true })}>
        +
      </button>

      {editing && <PostEditor key={editing.post.id} post={editing.post} isNew={editing.isNew} onSave={savePost} onDelete={deletePost} onDuplicate={duplicatePost} onClose={() => setEditing(null)} />}
    </div>
  )
}

function PostList({ posts, showDate, onOpen }: { posts: Post[]; showDate?: boolean; onOpen: (p: Post) => void }) {
  return (
    <ul className="posts">
      {posts.map((p) => (
        <li key={p.id}>
          <button className="post" onClick={() => onOpen(p)}>
            <div className="post-top">
              <span className="post-title">{p.title}</span>
              <span className="badge" data-status={p.status}>
                {p.status}
              </span>
            </div>
            <div className="post-meta">
              {showDate && <span>{formatLongDate(p.date)}</span>}
              {p.time && <span>{p.time}</span>}
              {p.platforms.map((pl) => (
                <span key={pl} className="tag" style={{ color: PLATFORM_COLORS[pl] }}>
                  {pl}
                </span>
              ))}
            </div>
            {p.caption && <p className="post-caption">{p.caption}</p>}
          </button>
        </li>
      ))}
    </ul>
  )
}
