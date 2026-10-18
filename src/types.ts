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

export interface Application {
  id: string
  collab_id: string
  user_id: string
  message: string
  preferred_date: string | null
  status: ApplicationStatus
  created_at: string
  collab?: Collab
  profile?: Profile
}

export const CATEGORY_GRADIENTS: Record<Category, string> = {
  'Food & Drink': 'linear-gradient(135deg, #f08c00, #c2255c)',
  Beauty: 'linear-gradient(135deg, #f783ac, #9c36b5)',
  Fashion: 'linear-gradient(135deg, #343a40, #868e96)',
  Wellness: 'linear-gradient(135deg, #38d9a9, #1971c2)',
  Travel: 'linear-gradient(135deg, #4dabf7, #364fc7)',
  Experiences: 'linear-gradient(135deg, #b5651d, #e8590c)',
  Lifestyle: 'linear-gradient(135deg, #a9e34b, #2b8a3e)',
}
