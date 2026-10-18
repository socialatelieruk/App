import { deliveryStatus } from '../delivery'
import type { Application, BrandReport, Collab, DeliveryStats, Profile } from '../types'
import type { Api } from './types'

// Demo mode keeps everything in this browser/device so the app can be tried
// before a Supabase project is connected.
const KEY = 'demo.v4'

interface DemoState {
  userId: string | null
  profiles: Profile[]
  collabs: Collab[]
  applications: Application[]
  reportLinks: Record<string, string> // collab id → token
}

const now = () => new Date().toISOString()
const inDays = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}
const at = (days: number, hour: number) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

function seed(): DemoState {
  const profile = (p: Partial<Profile> & Pick<Profile, 'id' | 'full_name'>): Profile => ({
    email: `${p.id}@example.com`,
    instagram: '',
    tiktok: '',
    followers: 0,
    city: 'London',
    bio: '',
    role: 'influencer',
    status: 'approved',
    created_at: now(),
    ...p,
  })
  const collab = (c: Partial<Collab> & Pick<Collab, 'id' | 'title' | 'brand' | 'category' | 'type'>): Collab => ({
    description: '',
    city: 'London',
    location: '',
    image_url: '',
    offer: '',
    deliverables: '',
    min_followers: 0,
    spots: 5,
    event_date: null,
    apply_by: inDays(14),
    content_due_days: 7,
    status: 'open',
    created_at: now(),
    ...c,
  })

  const app = (a: Partial<Application> & Pick<Application, 'id' | 'collab_id' | 'user_id'>): Application => ({
    message: '',
    preferred_date: null,
    status: 'pending',
    seen: true,
    scheduled_start: null,
    scheduled_end: null,
    content_due: null,
    post_links: [],
    posted_at: null,
    attendance: null,
    created_at: now(),
    ...a,
  })

  return {
    userId: null,
    profiles: [
      profile({ id: 'demo-admin', full_name: 'The Social Atelier', role: 'admin' }),
      profile({ id: 'demo-influencer', full_name: 'Maya Collins', instagram: 'mayaeats', tiktok: 'mayaeats', followers: 24500, bio: 'London food & lifestyle. Brunch enthusiast.' }),
      profile({ id: 'demo-2', full_name: 'Jordan Reid', instagram: 'jordanstyle', followers: 61200, bio: 'Menswear and travel.' }),
      profile({ id: 'demo-3', full_name: 'Priya Shah', instagram: 'priyaglow', tiktok: 'priyaglow', followers: 8900, status: 'pending', bio: 'Skincare reviews and GRWM.' }),
      profile({ id: 'demo-4', full_name: 'Amara Okafor', instagram: 'amaraeatslondon', followers: 18300, bio: 'Restaurants and rooftops.' }),
      profile({ id: 'demo-5', full_name: 'Leo Martin', tiktok: 'leomartin', followers: 33100, bio: 'Food TikToks, mostly ramen.' }),
    ],
    collabs: [
      collab({
        id: 'c1',
        title: 'Brunch for two',
        brand: 'The Garden Kitchen',
        category: 'Food & Drink',
        type: 'Booking',
        location: 'Shoreditch, E1',
        description: 'Seasonal brunch menu in our plant-filled dining room. Bring a friend!',
        offer: 'Brunch for two with a drink each (up to £80)',
        deliverables: '1 Instagram Reel + 3 stories tagging @thegardenkitchen',
        min_followers: 5000,
        spots: 8,
      }),
      collab({
        id: 'c2',
        title: 'Signature facial',
        brand: 'Lumière Skin Studio',
        category: 'Beauty',
        type: 'Booking',
        location: 'Marylebone, W1',
        description: 'Our 60-minute signature glow facial with a skin consultation.',
        offer: '60-minute facial worth £145',
        deliverables: '1 TikTok or Reel + 2 stories',
        min_followers: 10000,
        spots: 4,
      }),
      collab({
        id: 'c3',
        title: 'Autumn collection launch party',
        brand: 'Atelier Nord',
        category: 'Fashion',
        type: 'Event',
        location: 'Covent Garden, WC2',
        description: 'Preview the AW collection with drinks, DJ and styling sessions.',
        offer: 'Entry, drinks and a gifted piece from the collection',
        deliverables: '3 stories on the night + 1 feed post within a week',
        min_followers: 15000,
        spots: 20,
        event_date: inDays(10),
      }),
      collab({
        id: 'c4',
        title: 'Coffee & pastry on us',
        brand: 'Grind & Co',
        category: 'Food & Drink',
        type: 'Walk-in',
        location: 'Any London branch',
        description: 'Pop in whenever suits you and try our new seasonal menu.',
        offer: 'Any drink and pastry',
        deliverables: '2 stories tagging @grindandco',
        min_followers: 2000,
        spots: 30,
      }),
      collab({
        id: 'c6',
        title: 'Omakase tasting menu',
        brand: 'Sayonara',
        category: 'Food & Drink',
        type: 'Event',
        location: 'Soho, W1',
        description: 'Twelve-course omakase evening at the chef’s counter.',
        offer: 'Omakase for one with sake pairing',
        deliverables: '1 Reel + 3 stories tagging @sayonara',
        min_followers: 10000,
        spots: 3,
        event_date: inDays(-14),
        apply_by: inDays(-20),
        status: 'closed',
      }),
      collab({
        id: 'c7',
        title: 'Garden lunch',
        brand: 'Jardim',
        category: 'Food & Drink',
        type: 'Booking',
        location: 'Notting Hill, W11',
        description: 'Long lunch in the courtyard garden.',
        offer: 'Lunch for two (up to £120)',
        deliverables: '1 Reel or TikTok + 2 stories tagging @jardim',
        min_followers: 8000,
        spots: 3,
        apply_by: inDays(-10),
        status: 'closed',
      }),
      collab({
        id: 'c5',
        title: 'Sound bath & spa day',
        brand: 'Haven Wellness',
        category: 'Wellness',
        type: 'Booking',
        city: 'Manchester',
        location: 'Northern Quarter',
        description: 'Full spa access plus a 45-minute group sound bath.',
        offer: 'Day pass worth £95',
        deliverables: '1 Reel + 3 stories',
        min_followers: 7500,
        spots: 6,
      }),
    ],
    applications: [
      app({ id: 'a1', collab_id: 'c3', user_id: 'demo-influencer', message: 'Would love to cover the launch!', status: 'accepted', seen: false, scheduled_start: at(10, 19), scheduled_end: at(10, 22), content_due: inDays(17) }),
      app({ id: 'a2', collab_id: 'c1', user_id: 'demo-2', message: 'Brunch fan here, happy to do a Reel.', preferred_date: inDays(5) }),
      // Sayonara, two weeks ago: one on time, one late, one no-show
      app({ id: 'a3', collab_id: 'c6', user_id: 'demo-influencer', status: 'accepted', scheduled_start: at(-14, 19), scheduled_end: at(-14, 21), content_due: inDays(-7), attendance: 'attended', post_links: ['https://www.instagram.com/reel/C9sayonara1/', 'https://www.tiktok.com/@mayaeats/video/7400000000000000001'], posted_at: at(-12, 18) }),
      app({ id: 'a4', collab_id: 'c6', user_id: 'demo-2', status: 'accepted', scheduled_start: at(-14, 19), scheduled_end: at(-14, 21), content_due: inDays(-7), attendance: 'attended', post_links: ['https://www.instagram.com/p/C9jordanomakase/'], posted_at: at(-5, 12) }),
      app({ id: 'a5', collab_id: 'c6', user_id: 'demo-4', status: 'accepted', scheduled_start: at(-14, 19), scheduled_end: at(-14, 21), content_due: inDays(-7), attendance: 'no_show' }),
      // Jardim, last week: one posted, one still to post (overdue), one due tomorrow
      app({ id: 'a6', collab_id: 'c7', user_id: 'demo-influencer', status: 'accepted', scheduled_start: at(-6, 13), scheduled_end: at(-6, 15), content_due: inDays(1), attendance: 'attended', post_links: ['https://www.instagram.com/reel/C9jardimmaya/'], posted_at: at(-4, 9) }),
      app({ id: 'a7', collab_id: 'c7', user_id: 'demo-5', status: 'accepted', scheduled_start: at(-9, 13), scheduled_end: at(-9, 15), content_due: inDays(-2), attendance: 'attended' }),
      app({ id: 'a8', collab_id: 'c7', user_id: 'demo-2', status: 'accepted', scheduled_start: at(-6, 15), scheduled_end: at(-6, 17), content_due: inDays(1) }),
    ],
    reportLinks: {},
  }
}

function load(): DemoState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // fall through to fresh seed data
  }
  return seed()
}

export function createDemoApi(): Api {
  let state = load()
  const listeners = new Set<(id: string | null) => void>()

  const persist = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      // storage unavailable: demo still works for this session
    }
  }
  const setUser = (id: string | null) => {
    state.userId = id
    persist()
    listeners.forEach((l) => l(id))
  }
  const me = () => {
    const p = state.profiles.find((x) => x.id === state.userId)
    if (!p) throw new Error('You are signed out.')
    return p
  }
  const tick = () => new Promise((r) => setTimeout(r, 150))
  const unsupported = async () => {
    throw new Error('Demo mode: use the demo buttons. Connect Supabase to enable real accounts.')
  }

  return {
    mode: 'demo',
    getUserId: async () => state.userId,
    onAuthChange(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    signIn: unsupported,
    signUp: unsupported,
    resetPassword: unsupported,
    async signOut() {
      setUser(null)
    },
    async demoSignIn(role) {
      setUser(role === 'admin' ? 'demo-admin' : 'demo-influencer')
    },

    async getMyProfile() {
      await tick()
      return state.profiles.find((p) => p.id === state.userId) ?? null
    },
    async saveMyProfile(input) {
      const updated = { ...me(), ...input }
      state.profiles = state.profiles.map((p) => (p.id === updated.id ? updated : p))
      persist()
      return updated
    },
    async deleteMyAccount() {
      // Reset the whole demo rather than removing a seeded account.
      state = seed()
      setUser(null)
    },

    async listCollabs() {
      await tick()
      return state.collabs.map((c) => ({ ...c, application_count: state.applications.filter((a) => a.collab_id === c.id && a.status !== 'withdrawn').length }))
    },
    async saveCollab(input, id) {
      const collab: Collab = id ? { ...state.collabs.find((c) => c.id === id)!, ...input } : { ...input, id: crypto.randomUUID(), created_at: now() }
      state.collabs = id ? state.collabs.map((c) => (c.id === id ? collab : c)) : [collab, ...state.collabs]
      persist()
      return collab
    },
    async deleteCollab(id) {
      state.collabs = state.collabs.filter((c) => c.id !== id)
      state.applications = state.applications.filter((a) => a.collab_id !== id)
      persist()
    },

    async listMyApplications() {
      await tick()
      const userId = me().id
      return state.applications.filter((a) => a.user_id === userId).map((a) => ({ ...a, collab: state.collabs.find((c) => c.id === a.collab_id) }))
    },
    async apply(collabId, message, preferredDate) {
      const profile = me()
      if (profile.status !== 'approved') throw new Error('You can apply once your profile is approved.')
      const existing = state.applications.find((a) => a.collab_id === collabId && a.user_id === profile.id)
      if (existing) {
        Object.assign(existing, { message, preferred_date: preferredDate, status: 'pending', seen: true })
      } else {
        state.applications.push({
          id: crypto.randomUUID(),
          collab_id: collabId,
          user_id: profile.id,
          message,
          preferred_date: preferredDate,
          status: 'pending',
          seen: true,
          scheduled_start: null,
          scheduled_end: null,
          content_due: null,
          post_links: [],
          posted_at: null,
          attendance: null,
          created_at: now(),
        })
      }
      persist()
    },
    async withdraw(applicationId) {
      state.applications = state.applications.map((a) => (a.id === applicationId ? { ...a, status: 'withdrawn' } : a))
      persist()
    },

    async submitPosts(applicationId, links) {
      const a = state.applications.find((x) => x.id === applicationId && x.user_id === me().id)
      if (!a || a.status !== 'accepted' || a.attendance === 'no_show') throw new Error('You can add post links once you’re accepted.')
      a.post_links = links
      a.posted_at = links.length === 0 ? null : (a.posted_at ?? now())
      persist()
    },
    async markSeen(applicationIds) {
      state.applications = state.applications.map((a) => (applicationIds.includes(a.id) ? { ...a, seen: true } : a))
      persist()
    },
    // Demo mode has no server to send push notifications from.
    async registerDevice() {},
    async unregisterDevice() {},
    async getCalendarEmail() {
      return null
    },
    connectCalendar: async () => {
      throw new Error('Demo mode: Google Calendar connects once Supabase and Google are set up. You can still use “Add to Google Calendar” on an accepted collab.')
    },
    async disconnectCalendar() {},

    async listApplicants(collabId) {
      await tick()
      return state.applications.filter((a) => a.collab_id === collabId).map((a) => ({ ...a, profile: state.profiles.find((p) => p.id === a.user_id) }))
    },
    async setApplicationStatus(id, status, booking) {
      // Mirrors the database: a new acceptance is unseen until the influencer opens it.
      state.applications = state.applications.map((a) =>
        a.id === id
          ? {
              ...a,
              status,
              seen: status === 'accepted' && a.status !== 'accepted' ? false : a.seen,
              ...(booking ? { scheduled_start: booking.schedule?.start ?? null, scheduled_end: booking.schedule?.end ?? null, content_due: booking.contentDue } : {}),
            }
          : a,
      )
      persist()
    },
    async setAttendance(applicationId, attendance) {
      state.applications = state.applications.map((a) => (a.id === applicationId ? { ...a, attendance } : a))
      persist()
    },
    async getReliability() {
      const stats: Record<string, DeliveryStats> = {}
      for (const a of state.applications.filter((x) => x.status === 'accepted')) {
        const s = (stats[a.user_id] ??= { on_time: 0, late: 0, overdue: 0, no_shows: 0, upcoming: 0 })
        const key = { 'no-show': 'no_shows', posted: 'on_time', 'posted-late': 'late', overdue: 'overdue', due: 'upcoming' } as const
        s[key[deliveryStatus(a)]]++
      }
      return stats
    },
    async getReportToken(collabId) {
      state.reportLinks[collabId] ??= crypto.randomUUID()
      persist()
      return state.reportLinks[collabId]
    },
    async getReport(token): Promise<BrandReport | null> {
      await tick()
      const collabId = Object.entries(state.reportLinks).find(([, t]) => t === token)?.[0]
      const c = state.collabs.find((x) => x.id === collabId)
      if (!c) return null
      const creators = state.applications
        .filter((a) => a.collab_id === c.id && a.status === 'accepted' && a.attendance !== 'no_show')
        .map((a) => {
          const p = state.profiles.find((x) => x.id === a.user_id)!
          return { name: p.full_name, instagram: p.instagram, tiktok: p.tiktok, followers: p.followers, city: p.city, visited: a.scheduled_start, content_due: a.content_due, post_links: a.post_links, posted_at: a.posted_at }
        })
        .sort((x, y) => (x.posted_at ?? '9').localeCompare(y.posted_at ?? '9') || x.name.localeCompare(y.name))
      const { title, brand, type, category, city, location, image_url, event_date, deliverables } = c
      return { collab: { title, brand, type, category, city, location, image_url, event_date, deliverables }, creators, generated_at: now() }
    },
    async listInfluencers() {
      await tick()
      return state.profiles.filter((p) => p.role === 'influencer')
    },
    async setInfluencerStatus(id, status) {
      state.profiles = state.profiles.map((p) => (p.id === id ? { ...p, status } : p))
      persist()
    },
  }
}
