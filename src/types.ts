export type Role = 'influencer' | 'admin'
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
  brand: string
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
