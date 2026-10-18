import type {
  Application,
  ApplicationStatus,
  Booking,
  Brand,
  BrandInput,
  BrandReport,
  Collab,
  CollabFinance,
  CollabInput,
  DeliveryStats,
  FinanceInput,
  PaymentStatus,
  Profile,
  ProfileInput,
  ProfileStatus,
  RetainerPayment,
  Role,
} from '../types'

export interface Api {
  mode: 'demo' | 'live'

  // Auth
  getUserId(): Promise<string | null>
  onAuthChange(cb: (userId: string | null) => void): () => void
  signIn(email: string, password: string): Promise<void>
  signUp(email: string, password: string): Promise<void>
  resetPassword(email: string): Promise<void>
  signOut(): Promise<void>
  demoSignIn?(role: Role): Promise<void>

  // Own profile
  getMyProfile(): Promise<Profile | null>
  saveMyProfile(input: ProfileInput): Promise<Profile>
  deleteMyAccount(): Promise<void>

  // Collaborations
  listCollabs(): Promise<Collab[]>
  saveCollab(input: CollabInput, id?: string): Promise<Collab>
  deleteCollab(id: string): Promise<void>

  // Influencer applications
  listMyApplications(): Promise<Application[]>
  apply(collabId: string, message: string, preferredDate: string | null): Promise<void>
  withdraw(applicationId: string): Promise<void>
  markSeen(applicationIds: string[]): Promise<void>
  submitPosts(applicationId: string, links: string[]): Promise<void> // replaces the creator's post links

  // Push notifications: the phones to notify for the signed-in user
  registerDevice(token: string, platform: 'ios' | 'android'): Promise<void>
  unregisterDevice(token: string): Promise<void>

  // Google Calendar: accepted bookings are added to the influencer's calendar
  getCalendarEmail(): Promise<string | null> // the connected Google account, or null
  connectCalendar(): Promise<string> // URL of Google's consent screen
  disconnectCalendar(): Promise<void>

  // Admin
  listApplicants(collabId: string): Promise<Application[]>
  // booking: the confirmed visit and posting deadline; undefined leaves them as they are
  setApplicationStatus(id: string, status: ApplicationStatus, booking?: Booking): Promise<void>
  setAttendance(applicationId: string, attendance: 'attended' | 'no_show' | null): Promise<void>
  getReliability(): Promise<Record<string, DeliveryStats>> // by influencer id
  getReportToken(collabId: string): Promise<string> // creates the collab's private report link if needed

  listAllApplications(): Promise<Application[]> // every application, with its collab and creator

  // Admin: brands and money (never visible to creators)
  listBrands(): Promise<Brand[]>
  saveBrand(input: BrandInput, id?: string): Promise<Brand>
  listFinances(): Promise<Record<string, CollabFinance>> // by collab id
  saveFinance(collabId: string, input: FinanceInput): Promise<void>
  listRetainerPayments(): Promise<RetainerPayment[]>
  saveRetainerPayment(brandId: string, month: string, amount: number, status: PaymentStatus, invoicedOn: string | null): Promise<void>

  // Brand report: works without signing in
  getReport(token: string): Promise<BrandReport | null>
  listInfluencers(): Promise<Profile[]>
  setInfluencerStatus(id: string, status: ProfileStatus): Promise<void>
}
