import type { Application, ApplicationStatus, Collab, CollabInput, Profile, ProfileInput, ProfileStatus, Role } from '../types'

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

  // Push notifications: the phones to notify for the signed-in user
  registerDevice(token: string, platform: 'ios' | 'android'): Promise<void>
  unregisterDevice(token: string): Promise<void>

  // Admin
  listApplicants(collabId: string): Promise<Application[]>
  setApplicationStatus(id: string, status: ApplicationStatus): Promise<void>
  listInfluencers(): Promise<Profile[]>
  setInfluencerStatus(id: string, status: ProfileStatus): Promise<void>
}
