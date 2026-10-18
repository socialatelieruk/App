import { deliveryStatus } from '../delivery'
import { reliability } from '../delivery'
import type {
  Application,
  Brand,
  BrandAccount,
  BrandCampaign,
  BrandPayment,
  BrandReport,
  Brief,
  Collab,
  CollabFinance,
  DeliveryStats,
  Package,
  PaymentStatus,
  Profile,
  RetainerPayment,
  ShortlistCard,
  ShortlistEntry,
} from '../types'
import type { Api } from './types'

// Demo mode keeps everything in this browser/device so the app can be tried
// before a Supabase project is connected.
const KEY = 'demo.v6'

interface DemoState {
  userId: string | null
  profiles: Profile[]
  collabs: Collab[]
  applications: Application[]
  reportLinks: Record<string, string> // collab id → token
  brands: Brand[]
  finances: Record<string, CollabFinance> // by collab id
  retainerPayments: RetainerPayment[]
  brandAccounts: BrandAccount[]
  packages: Package[]
  brandPayments: BrandPayment[]
  briefs: Brief[]
  shortlist: ShortlistEntry[]
}

const now = () => new Date().toISOString()
const inDays = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
// First day of the month, n months ago (YYYY-MM-01).
const monthsAgo = (n: number) => {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
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
    city: 'Manchester',
    bio: '',
    role: 'influencer',
    status: 'approved',
    created_at: now(),
    ...p,
  })
  const collab = (c: Partial<Collab> & Pick<Collab, 'id' | 'title' | 'brand_id' | 'category' | 'type'>): Collab => ({
    brand: brands.find((b) => b.id === c.brand_id)!.name,
    description: '',
    city: 'Manchester',
    location: '',
    image_url: '',
    offer: '',
    deliverables: '',
    min_followers: 0,
    spots: 5,
    event_date: null,
    apply_by: inDays(14),
    content_due_days: 7,
    package_id: null,
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
  const brand = (b: Partial<Brand> & Pick<Brand, 'id' | 'name' | 'deal_type'>): Brand => ({
    instagram: '',
    contact_name: '',
    email: '',
    phone: '',
    area: '',
    monthly_fee: null,
    retainer_start: null,
    notes: '',
    created_at: now(),
    ...b,
  })

  // Fictional Manchester brands (phone numbers are from Ofcom's range reserved for drama).
  const brands: Brand[] = [
    brand({ id: 'b1', name: 'Sayonara', deal_type: 'retainer', monthly_fee: 350, retainer_start: monthsAgo(3), instagram: 'sayonaramcr', contact_name: 'Kenji Watanabe', email: 'kenji@sayonara.example', phone: '0161 496 0142', area: 'Spinningfields, Manchester', notes: 'Monthly retainer: 3 creators a month. Prefers evening sittings, Tue–Thu.' }),
    brand({ id: 'b2', name: 'Jardim', deal_type: 'paid', instagram: 'jardim.mcr', contact_name: 'Sofia Almeida', email: 'sofia@jardim.example', phone: '0161 496 0277', area: 'Ancoats, Manchester', notes: '£350 per campaign. Invoice on completion.' }),
    brand({ id: 'b3', name: 'Mill & Ember', deal_type: 'paid', instagram: 'millandember', contact_name: 'Tom Hargreaves', email: 'tom@millandember.example', phone: '0161 496 0318', area: 'Ancoats, Manchester', notes: 'Wood-fired kitchen. Wants Reels over static posts.' }),
    brand({ id: 'b4', name: 'Northern Thread', deal_type: 'paid', instagram: 'northernthread', contact_name: 'Ella Brooks', email: 'ella@northernthread.example', phone: '0161 496 0455', area: 'Northern Quarter, Manchester', notes: 'Invoice raised before the launch. Chase accounts if unpaid.' }),
    brand({ id: 'b5', name: 'Velvet Room Spa', deal_type: 'gifted', instagram: 'velvetroomspa', contact_name: 'Hannah Clarke', email: 'hannah@velvetroom.example', phone: '0161 496 0563', area: 'Spinningfields, Manchester' }),
    brand({ id: 'b6', name: 'Copper Pot Bakery', deal_type: 'gifted', instagram: 'copperpotbakes', contact_name: 'Raj Patel', email: 'raj@copperpot.example', phone: '0161 496 0691', area: 'Didsbury, Manchester', notes: 'Walk-ins any day before 2pm.' }),
    brand({ id: 'b7', name: 'Haven Wellness', deal_type: 'retainer', monthly_fee: 250, retainer_start: monthsAgo(1), instagram: 'havenwellnessaltrincham', contact_name: 'Grace Doyle', email: 'grace@havenwellness.example', phone: '0161 496 0734', area: 'Altrincham' }),
  ]

  const collabs: Collab[] = [
    collab({ id: 'c1', title: 'Wood-fired supper for two', brand_id: 'b3', category: 'Food & Drink', type: 'Booking', location: 'Ancoats', description: 'Six plates from the fire, cooked at the counter. Bring a friend.', offer: 'Supper for two with a drink each (up to £90)', deliverables: '1 Instagram Reel + 3 stories tagging @millandember', min_followers: 5000, spots: 8 }),
    collab({ id: 'c2', title: 'Signature facial', brand_id: 'b5', category: 'Beauty', type: 'Booking', location: 'Spinningfields', description: 'Our 60-minute signature glow facial with a skin consultation.', offer: '60-minute facial worth £145', deliverables: '1 TikTok or Reel + 2 stories', min_followers: 10000, spots: 4 }),
    collab({ id: 'c3', title: 'AW collection launch party', brand_id: 'b4', category: 'Fashion', type: 'Event', location: 'Northern Quarter', description: 'Preview the AW collection with drinks, DJ and styling sessions.', offer: 'Entry, drinks and a gifted piece from the collection', deliverables: '3 stories on the night + 1 feed post within a week', min_followers: 15000, spots: 20, event_date: inDays(10) }),
    collab({ id: 'c4', title: 'Coffee & pastry on us', brand_id: 'b6', category: 'Food & Drink', type: 'Walk-in', location: 'Didsbury Village', description: 'Pop in whenever suits you and try the autumn bakes.', offer: 'Any drink and pastry', deliverables: '2 stories tagging @copperpotbakes', min_followers: 2000, spots: 30 }),
    collab({ id: 'c5', title: 'Sound bath & spa day', brand_id: 'b7', category: 'Wellness', type: 'Booking', location: 'Altrincham', description: 'Full spa access plus a 45-minute group sound bath.', offer: 'Day pass worth £95', deliverables: '1 Reel + 3 stories', min_followers: 7500, spots: 6 }),
    collab({ id: 'c6', title: 'Omakase tasting menu', brand_id: 'b1', category: 'Food & Drink', type: 'Event', location: 'Spinningfields', description: 'Twelve-course omakase evening at the chef’s counter.', offer: 'Omakase for one with sake pairing', deliverables: '1 Reel + 3 stories tagging @sayonaramcr', min_followers: 10000, spots: 3, event_date: inDays(-14), apply_by: inDays(-20), status: 'closed' }),
    collab({ id: 'c7', title: 'Courtyard lunch', brand_id: 'b2', category: 'Food & Drink', type: 'Booking', location: 'Ancoats', description: 'Long lunch in the courtyard garden.', offer: 'Lunch for two (up to £120)', deliverables: '1 Reel or TikTok + 2 stories tagging @jardim.mcr', min_followers: 8000, spots: 3, apply_by: inDays(-10), status: 'closed' }),
    collab({ id: 'c8', package_id: 'pk1', title: 'Sunday roast for two', brand_id: 'b2', category: 'Food & Drink', type: 'Booking', location: 'Ancoats', description: 'Our Sunday roast with all the trimmings.', offer: 'Roast for two with a bottle of wine', deliverables: '1 Reel + 2 stories tagging @jardim.mcr', min_followers: 8000, spots: 4 }),
  ]

  return {
    userId: null,
    profiles: [
      profile({ id: 'demo-admin', full_name: 'The Social Atelier', role: 'admin' }),
      profile({ id: 'demo-influencer', full_name: 'Maya Collins', instagram: 'mayaeats', tiktok: 'mayaeats', followers: 24500, bio: 'Manchester food & lifestyle. Brunch enthusiast.' }),
      profile({ id: 'demo-2', full_name: 'Jordan Reid', instagram: 'jordanstyle', followers: 61200, bio: 'Menswear and travel.' }),
      profile({ id: 'demo-3', full_name: 'Priya Shah', instagram: 'priyaglow', tiktok: 'priyaglow', followers: 8900, status: 'pending', city: 'Salford', bio: 'Skincare reviews and GRWM.' }),
      profile({ id: 'demo-4', full_name: 'Amara Okafor', instagram: 'amaraeatsmcr', followers: 18300, bio: 'Restaurants and rooftops.' }),
      profile({ id: 'demo-5', full_name: 'Leo Martin', tiktok: 'leomartin', followers: 33100, city: 'Stockport', bio: 'Food TikToks, mostly ramen.' }),
      profile({ id: 'demo-brand', full_name: 'Sofia Almeida', email: 'sofia@jardim.example', role: 'brand' }),
      profile({ id: 'demo-brand-2', full_name: 'Ollie Grant', email: 'ollie@saltandsignal.example', role: 'brand', status: 'pending' }),
      profile({ id: 'demo-brand-3', full_name: 'Imogen Hale', email: 'imogen@willowrooms.example', role: 'brand', status: 'pending' }),
    ],
    collabs,
    applications: [
      app({ id: 'a1', collab_id: 'c3', user_id: 'demo-influencer', message: 'Would love to cover the launch!', status: 'accepted', seen: false, scheduled_start: at(10, 19), scheduled_end: at(10, 22), content_due: inDays(17) }),
      // Waiting for a decision
      app({ id: 'a2', collab_id: 'c1', user_id: 'demo-2', message: 'Fire cooking is my kind of content. Happy to do a Reel.', preferred_date: inDays(5) }),
      app({ id: 'a9', collab_id: 'c2', user_id: 'demo-4', message: 'I’d film a full GRWM before and after.', preferred_date: inDays(8) }),
      app({ id: 'a14', collab_id: 'c8', user_id: 'demo-5', message: 'Roast TikToks do numbers for me.', preferred_date: inDays(7), status: 'declined' }),
      // Sunday roast (from Jardim's brief): with the brand for a decision, plus their replies
      app({ id: 'a15', collab_id: 'c8', user_id: 'demo-influencer', message: 'Sunday roasts are my most-saved Reels.', preferred_date: inDays(8) }),
      app({ id: 'a16', collab_id: 'c8', user_id: 'demo-4', message: 'Would bring my partner and film a full Sunday.', preferred_date: inDays(15) }),
      app({ id: 'a17', collab_id: 'c8', user_id: 'demo-2', message: 'Happy to shoot a roast Reel.', preferred_date: inDays(8), status: 'accepted', seen: false, content_due: inDays(15) }),
      // Booked this week
      app({ id: 'a12', collab_id: 'c2', user_id: 'demo-2', status: 'accepted', scheduled_start: at(1, 15), scheduled_end: at(1, 16), content_due: inDays(8) }),
      app({ id: 'a10', collab_id: 'c5', user_id: 'demo-4', status: 'accepted', scheduled_start: at(2, 11), scheduled_end: at(2, 15), content_due: inDays(9) }),
      app({ id: 'a11', collab_id: 'c1', user_id: 'demo-influencer', status: 'accepted', scheduled_start: at(4, 19), scheduled_end: at(4, 21), content_due: inDays(11) }),
      app({ id: 'a13', collab_id: 'c4', user_id: 'demo-influencer', status: 'accepted', content_due: inDays(3) }),
      // Sayonara, two weeks ago: one on time, one late, one no-show
      app({ id: 'a3', collab_id: 'c6', user_id: 'demo-influencer', status: 'accepted', scheduled_start: at(-14, 19), scheduled_end: at(-14, 21), content_due: inDays(-7), attendance: 'attended', post_links: ['https://www.instagram.com/reel/C9sayonara1/', 'https://www.tiktok.com/@mayaeats/video/7400000000000000001'], posted_at: at(-12, 18) }),
      app({ id: 'a4', collab_id: 'c6', user_id: 'demo-2', status: 'accepted', scheduled_start: at(-14, 19), scheduled_end: at(-14, 21), content_due: inDays(-7), attendance: 'attended', post_links: ['https://www.instagram.com/p/C9jordanomakase/'], posted_at: at(-5, 12) }),
      app({ id: 'a5', collab_id: 'c6', user_id: 'demo-4', status: 'accepted', scheduled_start: at(-14, 19), scheduled_end: at(-14, 21), content_due: inDays(-7), attendance: 'no_show' }),
      // Jardim, last week: one posted, one overdue, one due tomorrow
      app({ id: 'a6', collab_id: 'c7', user_id: 'demo-influencer', status: 'accepted', scheduled_start: at(-6, 13), scheduled_end: at(-6, 15), content_due: inDays(1), attendance: 'attended', post_links: ['https://www.instagram.com/reel/C9jardimmaya/'], posted_at: at(-4, 9) }),
      app({ id: 'a7', collab_id: 'c7', user_id: 'demo-5', status: 'accepted', scheduled_start: at(-9, 13), scheduled_end: at(-9, 15), content_due: inDays(-2), attendance: 'attended' }),
      app({ id: 'a8', collab_id: 'c7', user_id: 'demo-2', status: 'accepted', scheduled_start: at(-6, 15), scheduled_end: at(-6, 17), content_due: inDays(1) }),
    ],
    reportLinks: {},
    brands,
    finances: {
      c1: { collab_id: 'c1', fee: 350, payment_status: 'invoiced', invoiced_on: inDays(-12), paid_on: null },
      c3: { collab_id: 'c3', fee: 500, payment_status: 'invoiced', invoiced_on: inDays(-41), paid_on: null },
      c7: { collab_id: 'c7', fee: 350, payment_status: 'paid', invoiced_on: inDays(-8), paid_on: inDays(0) },
    },
    retainerPayments: [
      { id: 'r1', brand_id: 'b1', month: monthsAgo(3), amount: 350, status: 'paid', invoiced_on: inDays(-95), paid_on: inDays(-80) },
      { id: 'r2', brand_id: 'b1', month: monthsAgo(2), amount: 350, status: 'paid', invoiced_on: inDays(-64), paid_on: inDays(-50) },
      { id: 'r3', brand_id: 'b1', month: monthsAgo(1), amount: 350, status: 'invoiced', invoiced_on: inDays(-35), paid_on: null },
      { id: 'r4', brand_id: 'b7', month: monthsAgo(1), amount: 250, status: 'paid', invoiced_on: inDays(-20), paid_on: inDays(0) },
    ],
    brandAccounts: [
      { user_id: 'demo-brand', business_name: 'Jardim', contact_name: 'Sofia Almeida', email: 'sofia@jardim.example', phone: '0161 496 0277', instagram: 'jardim.mcr', website: 'jardim.example', area: 'Ancoats, Manchester', category: 'Food & Drink', status: 'approved', brand_id: 'b2', created_at: at(-40, 10) },
      { user_id: 'demo-brand-2', business_name: 'Salt & Signal Coffee', contact_name: 'Ollie Grant', email: 'ollie@saltandsignal.example', phone: '01925 496 0812', instagram: 'saltandsignal', website: 'saltandsignal.example', area: 'Warrington', category: 'Food & Drink', status: 'pending', brand_id: null, created_at: at(-1, 9) },
      { user_id: 'demo-brand-3', business_name: 'The Willow Rooms', contact_name: 'Imogen Hale', email: 'imogen@willowrooms.example', phone: '0161 496 0925', instagram: 'thewillowrooms', website: 'willowrooms.example', area: 'Altrincham', category: 'Hotels', status: 'pending', brand_id: null, created_at: at(0, 8) },
    ],
    packages: [
      { id: 'pk1', name: 'Starter', description: '10 vetted creators for one campaign, with a live brand report.', creators: 10, price: 350, billing: 'one_off', active: true, sort: 1 },
      { id: 'pk2', name: 'Monthly', description: '4 creators every month, with a fresh brief each month.', creators: 4, price: 350, billing: 'monthly', active: true, sort: 2 },
    ],
    brandPayments: [
      { id: 'bp1', brand_id: 'b2', package_id: 'pk1', kind: 'one_off', amount: 350, status: 'paid', period_start: null, created_at: at(-21, 10), paid_at: at(-21, 10) },
      { id: 'bp2', brand_id: 'b2', package_id: 'pk1', kind: 'one_off', amount: 350, status: 'paid', period_start: null, created_at: at(-2, 16), paid_at: at(-2, 16) },
    ],
    briefs: [
      {
        id: 'br1', brand_id: 'b2', payment_id: 'bp1', package_id: 'pk1', title: 'Sunday roast for two', offer: 'Roast for two with a bottle of wine',
        deliverables: '1 Reel + 2 stories tagging @jardim.mcr', location: 'Ancoats', city: 'Manchester', preferred_dates: 'Sundays, 12–4pm', type: 'Booking',
        min_followers: 8000, creator_type: 'Food creators with a Manchester audience', image_url: '', status: 'approved', admin_note: '', collab_id: 'c8',
        created_at: at(-20, 11), updated_at: at(-18, 9),
      },
      {
        id: 'br2', brand_id: 'b2', payment_id: 'bp2', package_id: 'pk1', title: 'Bottomless brunch launch', offer: 'Bottomless brunch for two (90 minutes)',
        deliverables: '1 Reel + 3 stories on the day, tagging @jardim.mcr', location: 'Ancoats', city: 'Manchester', preferred_dates: 'Saturdays in November, 11am–2pm', type: 'Booking',
        min_followers: 10000, creator_type: 'Lifestyle and food creators, 25–35 audience', image_url: '', status: 'submitted', admin_note: '', collab_id: null,
        created_at: at(-1, 15), updated_at: at(-1, 15),
      },
    ],
    shortlist: [
      { application_id: 'a15', collab_id: 'c8', brand_id: 'b2', sent_at: at(-1, 10), decision: null, note: '', decided_at: null, handled: false },
      { application_id: 'a16', collab_id: 'c8', brand_id: 'b2', sent_at: at(-1, 10), decision: null, note: '', decided_at: null, handled: false },
      { application_id: 'a17', collab_id: 'c8', brand_id: 'b2', sent_at: at(-3, 10), decision: 'approved', note: 'Great fit for our Sunday crowd.', decided_at: at(-1, 18), handled: false },
      { application_id: 'a14', collab_id: 'c8', brand_id: 'b2', sent_at: at(-3, 10), decision: 'declined', note: 'We’d like more Instagram-led creators.', decided_at: at(-1, 18), handled: false },
    ],
  }
}

// Mirrors the database trigger: invoicing and paying stamp today unless a date is given.
function paymentDates(status: PaymentStatus, invoicedOn: string | null, paidOn: string | null) {
  const today = inDays(0)
  if (status === 'unpaid') return { invoiced_on: null, paid_on: null }
  if (status === 'invoiced') return { invoiced_on: invoicedOn ?? today, paid_on: null }
  return { invoiced_on: invoicedOn, paid_on: paidOn ?? today }
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


  // The brand report for a collab, as collab_report() builds it.
  const buildReport = (collabId: string): BrandReport | null => {
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
  }
  const myAccount = () => state.brandAccounts.find((a) => a.user_id === state.userId) ?? null
  const myBrandId = () => {
    const acc = myAccount()
    return acc?.status === 'approved' ? acc.brand_id : null
  }
  const isAdmin = () => me().role === 'admin'
  const reliabilityLabel = (userId: string) => {
    const stats: DeliveryStats = { on_time: 0, late: 0, overdue: 0, no_shows: 0, upcoming: 0 }
    const key = { 'no-show': 'no_shows', posted: 'on_time', 'posted-late': 'late', overdue: 'overdue', due: 'upcoming' } as const
    for (const a of state.applications.filter((x) => x.user_id === userId && x.status === 'accepted')) stats[key[deliveryStatus(a)]]++
    const tier = reliability(stats).tier
    return { new: 'New to The Social Atelier', excellent: 'Excellent track record', good: 'Reliable', 'at-risk': 'Building their record' }[tier]
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
      setUser(role === 'admin' ? 'demo-admin' : role === 'brand' ? 'demo-brand' : 'demo-influencer')
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
      // Mirrors the database: the brand name follows the chosen brand record.
      const brandName = state.brands.find((b) => b.id === input.brand_id)?.name ?? input.brand
      const fields = { ...input, brand: brandName }
      const collab: Collab = id ? { ...state.collabs.find((c) => c.id === id)!, ...fields } : { ...fields, id: crypto.randomUUID(), created_at: now() }
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
    async listAllApplications() {
      await tick()
      return state.applications.map((a) => ({
        ...a,
        collab: state.collabs.find((c) => c.id === a.collab_id),
        profile: state.profiles.find((p) => p.id === a.user_id),
      }))
    },

    async listBrands() {
      await tick()
      return [...state.brands].sort((a, b) => a.name.localeCompare(b.name))
    },
    async saveBrand(input, id) {
      const name = input.name.trim()
      if (state.brands.some((b) => b.id !== id && b.name.toLowerCase() === name.toLowerCase())) throw new Error('A brand with that name already exists.')
      const brand: Brand = id ? { ...state.brands.find((b) => b.id === id)!, ...input, name } : { ...input, name, id: crypto.randomUUID(), created_at: now() }
      state.brands = id ? state.brands.map((b) => (b.id === id ? brand : b)) : [...state.brands, brand]
      // Renaming a brand renames its collabs, as the database trigger does.
      state.collabs = state.collabs.map((c) => (c.brand_id === brand.id ? { ...c, brand: brand.name } : c))
      persist()
      return brand
    },
    async listFinances() {
      await tick()
      return { ...state.finances }
    },
    async saveFinance(collabId, input) {
      state.finances[collabId] = { collab_id: collabId, ...input, ...paymentDates(input.payment_status, input.invoiced_on, input.paid_on) }
      persist()
    },
    async listRetainerPayments() {
      await tick()
      return [...state.retainerPayments]
    },
    async saveRetainerPayment(brandId, month, amount, status, invoicedOn) {
      const existing = state.retainerPayments.find((p) => p.brand_id === brandId && p.month === month)
      const payment: RetainerPayment = { id: existing?.id ?? crypto.randomUUID(), brand_id: brandId, month, amount, status, ...paymentDates(status, invoicedOn ?? existing?.invoiced_on ?? null, null) }
      state.retainerPayments = existing ? state.retainerPayments.map((p) => (p === existing ? payment : p)) : [...state.retainerPayments, payment]
      persist()
    },

    async getMyBrandAccount() {
      await tick()
      return myAccount()
    },
    async registerBrand(input) {
      const profile = me()
      if (profile.role !== 'brand') throw new Error('Only brand accounts can do this.')
      if (myAccount()) throw new Error('Your business details have already been sent.')
      state.brandAccounts.push({ ...input, instagram: input.instagram.replace(/^@/, ''), user_id: profile.id, email: profile.email, status: 'pending', brand_id: null, created_at: now() })
      state.profiles = state.profiles.map((p) => (p.id === profile.id ? { ...p, full_name: input.contact_name } : p))
      persist()
    },
    async listPackages() {
      await tick()
      return state.packages.filter((p) => isAdmin() || p.active).sort((a, b) => a.sort - b.sort)
    },
    async startCheckout(packageId) {
      // Demo mode stands in for Stripe: the payment succeeds straight away.
      const brandId = myBrandId()
      const pkg = state.packages.find((p) => p.id === packageId)
      if (!brandId || !pkg) throw new Error('Your account needs to be approved before you can pay.')
      state.brandPayments.unshift({ id: crypto.randomUUID(), brand_id: brandId, package_id: pkg.id, kind: pkg.billing, amount: pkg.price, status: 'paid', period_start: pkg.billing === 'monthly' ? inDays(0) : null, created_at: now(), paid_at: now() })
      persist()
      return { paid: true }
    },
    async listBrandPayments() {
      await tick()
      return state.brandPayments.filter((p) => isAdmin() || p.brand_id === myBrandId()).sort((a, b) => b.created_at.localeCompare(a.created_at))
    },
    async listBriefs() {
      await tick()
      return state.briefs.filter((b) => isAdmin() || b.brand_id === myBrandId()).sort((a, b) => b.created_at.localeCompare(a.created_at))
    },
    async submitBrief(paymentId, input, packageId) {
      const brandId = myBrandId()
      const payment = state.brandPayments.find((p) => p.id === paymentId && p.brand_id === brandId && p.status === 'paid')
      if (!payment || state.briefs.some((b) => b.payment_id === paymentId)) throw new Error('Choose a package and pay before submitting a brief.')
      state.briefs.unshift({ ...input, id: crypto.randomUUID(), brand_id: brandId!, payment_id: paymentId, package_id: packageId, status: 'submitted', admin_note: '', collab_id: null, created_at: now(), updated_at: now() })
      persist()
    },
    async resubmitBrief(id, input) {
      const brief = state.briefs.find((b) => b.id === id && b.brand_id === myBrandId())
      if (!brief || brief.status !== 'changes_requested') throw new Error('This brief is with The Social Atelier and can’t be changed right now.')
      Object.assign(brief, input, { status: 'submitted', updated_at: now() })
      persist()
    },
    async uploadBriefImage(file) {
      // Kept small so it fits in this browser's storage.
      const bitmap = await createImageBitmap(file)
      const scale = Math.min(1, 900 / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(bitmap.width * scale)
      canvas.height = Math.round(bitmap.height * scale)
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      return canvas.toDataURL('image/jpeg', 0.8)
    },
    async getShortlist(): Promise<ShortlistCard[]> {
      await tick()
      const brandId = myBrandId()
      return state.shortlist
        .filter((s) => s.brand_id === brandId)
        .map((s) => {
          const a = state.applications.find((x) => x.id === s.application_id)!
          const p = state.profiles.find((x) => x.id === a.user_id)!
          const pastPosts = state.applications
            .filter((x) => x.user_id === p.id && x.id !== a.id && x.status === 'accepted' && x.post_links.length > 0)
            .sort((x, y) => (y.posted_at ?? '').localeCompare(x.posted_at ?? ''))
            .flatMap((x) => x.post_links)
            .slice(0, 3)
          return {
            application_id: s.application_id, collab_id: s.collab_id, collab_title: state.collabs.find((c) => c.id === s.collab_id)?.title ?? '',
            sent_at: s.sent_at, decision: s.decision, note: s.note, decided_at: s.decided_at,
            name: p.full_name, instagram: p.instagram, tiktok: p.tiktok, followers: p.followers, city: p.city, bio: p.bio,
            reliability: reliabilityLabel(p.id), past_posts: pastPosts,
          }
        })
        .sort((x, y) => Number(!!x.decision) - Number(!!y.decision) || y.sent_at.localeCompare(x.sent_at))
    },
    async decideShortlist(applicationId, decision, note) {
      const entry = state.shortlist.find((s) => s.application_id === applicationId && s.brand_id === myBrandId() && !s.decision)
      if (!entry) throw new Error('This creator isn’t waiting for your decision.')
      Object.assign(entry, { decision, note, decided_at: now(), handled: false })
      const app = state.applications.find((a) => a.id === applicationId)!
      const collab = state.collabs.find((c) => c.id === app.collab_id)!
      if (app.status === 'pending') {
        if (decision === 'approved') {
          const from = app.preferred_date && app.preferred_date > inDays(0) ? app.preferred_date : inDays(0)
          const d = new Date(`${from}T12:00:00`)
          d.setDate(d.getDate() + collab.content_due_days)
          Object.assign(app, { status: 'accepted', seen: false, content_due: app.content_due ?? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })
        } else app.status = 'declined'
      }
      persist()
    },
    async getCampaigns(): Promise<BrandCampaign[]> {
      await tick()
      const brandId = myBrandId()
      return state.collabs
        .filter((c) => c.brand_id === brandId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((c) => {
          const accepted = state.applications.filter((a) => a.collab_id === c.id && a.status === 'accepted')
          const count = (s: string[]) => accepted.filter((a) => s.includes(deliveryStatus(a))).length
          return {
            id: c.id, title: c.title, status: c.status, type: c.type, event_date: c.event_date, location: c.location, city: c.city, spots: c.spots, created_at: c.created_at,
            booked: accepted.length, posted: count(['posted', 'posted-late']), due: count(['due']), overdue: count(['overdue']), report: buildReport(c.id),
          }
        })
    },

    async listBrandAccounts() {
      await tick()
      return [...state.brandAccounts].sort((a, b) => b.created_at.localeCompare(a.created_at))
    },
    async approveBrandAccount(userId, brandId) {
      const acc = state.brandAccounts.find((a) => a.user_id === userId)!
      let id = brandId ?? state.brands.find((b) => b.name.toLowerCase() === acc.business_name.toLowerCase())?.id
      if (!id) {
        id = crypto.randomUUID()
        state.brands.push({ id, name: acc.business_name, instagram: acc.instagram, contact_name: acc.contact_name, email: acc.email, phone: acc.phone, area: acc.area, deal_type: 'paid', monthly_fee: null, retainer_start: null, notes: '', created_at: now() })
      }
      Object.assign(acc, { status: 'approved', brand_id: id })
      state.profiles = state.profiles.map((p) => (p.id === userId ? { ...p, status: 'approved' } : p))
      persist()
      return id
    },
    async declineBrandAccount(userId) {
      state.brandAccounts = state.brandAccounts.map((a) => (a.user_id === userId ? { ...a, status: 'declined' } : a))
      state.profiles = state.profiles.map((p) => (p.id === userId ? { ...p, status: 'rejected' } : p))
      persist()
    },
    async savePackage(input, id) {
      state.packages = id ? state.packages.map((p) => (p.id === id ? { ...p, ...input } : p)) : [...state.packages, { ...input, id: crypto.randomUUID() }]
      persist()
    },
    async sendBriefBack(id, note) {
      state.briefs = state.briefs.map((b) => (b.id === id ? { ...b, status: 'changes_requested', admin_note: note, updated_at: now() } : b))
      persist()
    },
    async publishBrief(briefId, input) {
      const collab: Collab = { ...input, brand: state.brands.find((b) => b.id === input.brand_id)?.name ?? input.brand, id: crypto.randomUUID(), created_at: now() }
      state.collabs = [collab, ...state.collabs]
      state.briefs = state.briefs.map((b) => (b.id === briefId ? { ...b, status: 'approved', collab_id: collab.id, admin_note: '', updated_at: now() } : b))
      persist()
      return collab
    },
    async listShortlist() {
      await tick()
      return [...state.shortlist]
    },
    async sendToBrand(applicationId) {
      if (state.shortlist.some((s) => s.application_id === applicationId)) throw new Error('Already sent to the brand.')
      const app = state.applications.find((a) => a.id === applicationId)!
      const collab = state.collabs.find((c) => c.id === app.collab_id)!
      if (!collab.brand_id) throw new Error('This collab isn’t linked to a brand.')
      state.shortlist.push({ application_id: applicationId, collab_id: collab.id, brand_id: collab.brand_id, sent_at: now(), decision: null, note: '', decided_at: null, handled: false })
      persist()
    },
    async removeFromShortlist(applicationId) {
      state.shortlist = state.shortlist.filter((s) => !(s.application_id === applicationId && !s.decision))
      persist()
    },
    async markShortlistHandled(applicationId) {
      state.shortlist = state.shortlist.map((s) => (s.application_id === applicationId ? { ...s, handled: true } : s))
      persist()
    },
    async getReportToken(collabId) {
      state.reportLinks[collabId] ??= crypto.randomUUID()
      persist()
      return state.reportLinks[collabId]
    },
    async getReport(token): Promise<BrandReport | null> {
      await tick()
      const collabId = Object.entries(state.reportLinks).find(([, t]) => t === token)?.[0]
      return collabId ? buildReport(collabId) : null
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
