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
