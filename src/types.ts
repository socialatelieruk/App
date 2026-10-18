export type Role = 'influencer' | 'admin' | 'brand'
export type ProfileStatus = 'pending' | 'approved' | 'rejected'

export interface Profile {
  id: string
  email: string
  full_name: string
  instagram: string
  tiktok: string
  followers: number
  city: string
  bio: string
  role: Role
  status: ProfileStatus
  created_at: string
}

export type ProfileInput = Pick<Profile, 'full_name' | 'instagram' | 'tiktok' | 'followers' | 'city' | 'bio'>

export const COLLAB_TYPES = ['Booking', 'Event', 'Walk-in'] as const
export type CollabType = (typeof COLLAB_TYPES)[number]

export const COLLAB_TYPE_HINTS: Record<CollabType, string> = {
  Booking: 'Pick a date and the brand confirms your booking',
  Event: 'Join other creators at a set date and time',
  'Walk-in': 'Visit any time during opening hours once accepted',
}

export const CATEGORIES = ['Food & Drink', 'Beauty', 'Fashion', 'Wellness', 'Travel', 'Experiences', 'Lifestyle'] as const
export type Category = (typeof CATEGORIES)[number]

export type CollabStatus = 'open' | 'closed'

export interface Collab {
  id: string
  title: string
  brand: string // brand name, as creators see it
  brand_id: string | null // the brand record (admins only see its details)
  package_id: string | null // the package that paid for it, for brand-portal collabs
  description: string
  category: Category
  type: CollabType
  city: string
  location: string
  image_url: string
  offer: string // what the influencer receives
  deliverables: string // what the influencer posts in return
  min_followers: number
  spots: number
  event_date: string | null // YYYY-MM-DD, for events
  apply_by: string | null // YYYY-MM-DD
  content_due_days: number // days after the visit that posts are due
  status: CollabStatus
  created_at: string
  application_count?: number
}

export type CollabInput = Omit<Collab, 'id' | 'created_at' | 'application_count'>

export type ApplicationStatus = 'pending' | 'accepted' | 'declined' | 'withdrawn'

export interface Schedule {
  start: string // ISO date-time
  end: string
}

// What an admin confirms when accepting: the visit (if timed) and the posting deadline.
export interface Booking {
  schedule: Schedule | null
  contentDue: string | null
}

// Per-influencer delivery record behind the reliability score.
export interface DeliveryStats {
  on_time: number
  late: number
  overdue: number
  no_shows: number
  upcoming: number
}

// The brand-facing report behind a collab's private link.
export interface BrandReport {
  collab: Pick<Collab, 'title' | 'brand' | 'type' | 'category' | 'city' | 'location' | 'image_url' | 'event_date' | 'deliverables'>
  creators: {
    name: string
    instagram: string
    tiktok: string
    followers: number
    city: string
    visited: string | null
    content_due: string | null
    post_links: string[]
    posted_at: string | null
  }[]
  generated_at: string
}

export interface Application {
  id: string
  collab_id: string
  user_id: string
  message: string
  preferred_date: string | null
  status: ApplicationStatus
  seen: boolean // false until the influencer has seen an acceptance
  scheduled_start: string | null // confirmed booking time (ISO), set when accepted
  scheduled_end: string | null
  content_due: string | null // YYYY-MM-DD posting deadline
  post_links: string[] // the creator's live posts
  posted_at: string | null
  attendance: 'attended' | 'no_show' | null
  created_at: string
  collab?: Collab
  profile?: Profile
}

// Quiet tonal backdrops for collabs without a photo.
export const CATEGORY_TONES: Record<Category, string> = {
  'Food & Drink': '#e9dccb',
  Beauty: '#efdcd6',
  Fashion: '#dcd6cf',
  Wellness: '#d9e0d5',
  Travel: '#d6dde3',
  Experiences: '#e6d8c4',
  Lifestyle: '#e3ddd2',
}

// Admin-only records: creators never see these.
export const DEAL_TYPES = ['gifted', 'paid', 'retainer'] as const
export type DealType = (typeof DEAL_TYPES)[number]

export interface Brand {
  id: string
  name: string
  instagram: string
  contact_name: string
  email: string
  phone: string
  area: string
  deal_type: DealType
  monthly_fee: number | null // retainer brands
  retainer_start: string | null // YYYY-MM-01
  notes: string
  created_at: string
}

export type BrandInput = Omit<Brand, 'id' | 'created_at'>

export const PAYMENT_STATUSES = ['unpaid', 'invoiced', 'paid'] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

// Fee for one collab. No fee means the collab is gifted.
export interface CollabFinance {
  collab_id: string
  fee: number | null
  payment_status: PaymentStatus
  invoiced_on: string | null
  paid_on: string | null
}

export type FinanceInput = Pick<CollabFinance, 'fee' | 'payment_status' | 'invoiced_on' | 'paid_on'>

// One retainer month that has been invoiced or paid; months with no row are unpaid.
export interface RetainerPayment {
  id: string
  brand_id: string
  month: string // YYYY-MM-01
  amount: number
  status: PaymentStatus
  invoiced_on: string | null
  paid_on: string | null
}

// Brand portal --------------------------------------------------------------

export const BRAND_CATEGORIES = ['Food & Drink', 'Beauty', 'Wellness', 'Fashion', 'Hotels', 'Other'] as const
export type BrandCategory = (typeof BRAND_CATEGORIES)[number]

// A brand user's sign-up details; approval links it to a brand record.
export interface BrandAccount {
  user_id: string
  business_name: string
  contact_name: string
  email: string
  phone: string
  instagram: string
  website: string
  area: string
  category: BrandCategory
  status: 'pending' | 'approved' | 'declined'
  brand_id: string | null
  created_at: string
}

export type BrandSignup = Pick<BrandAccount, 'business_name' | 'contact_name' | 'phone' | 'instagram' | 'website' | 'area' | 'category'>

export interface Package {
  id: string
  name: string
  description: string
  creators: number
  price: number
  billing: 'one_off' | 'monthly'
  active: boolean
  sort: number
}

export type PackageInput = Omit<Package, 'id'>

export interface BrandPayment {
  id: string
  brand_id: string
  package_id: string | null
  kind: 'one_off' | 'monthly'
  amount: number
  status: 'pending' | 'paid' | 'failed' | 'cancelled'
  period_start: string | null
  created_at: string
  paid_at: string | null
}

export interface Brief {
  id: string
  brand_id: string
  payment_id: string | null
  package_id: string | null
  title: string
  offer: string
  deliverables: string
  location: string
  city: string
  preferred_dates: string
  type: CollabType
  min_followers: number
  creator_type: string
  image_url: string
  status: 'submitted' | 'changes_requested' | 'approved'
  admin_note: string // why it was sent back
  collab_id: string | null
  created_at: string
  updated_at: string
}

export type BriefInput = Pick<Brief, 'title' | 'offer' | 'deliverables' | 'location' | 'city' | 'preferred_dates' | 'type' | 'min_followers' | 'creator_type' | 'image_url'>

// Admin's view of a shortlisted applicant.
export interface ShortlistEntry {
  application_id: string
  collab_id: string
  brand_id: string
  sent_at: string
  decision: 'approved' | 'declined' | null
  note: string
  decided_at: string | null
  handled: boolean // the admin has acted on the decision
}

// What a brand sees for a shortlisted creator: public details only.
export interface ShortlistCard {
  application_id: string
  collab_id: string
  collab_title: string
  sent_at: string
  decision: 'approved' | 'declined' | null
  note: string
  decided_at: string | null
  name: string
  instagram: string
  tiktok: string
  followers: number
  city: string
  bio: string
  reliability: string
  past_posts: string[]
}

export interface BrandCampaign {
  id: string
  title: string
  status: CollabStatus
  type: CollabType
  event_date: string | null
  location: string
  city: string
  spots: number
  created_at: string
  booked: number
  posted: number
  due: number
  overdue: number
  report: BrandReport | null
}
