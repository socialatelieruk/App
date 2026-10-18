import { createClient } from '@supabase/supabase-js'
import type { Application, Collab, Profile } from '../types'
import type { Api } from './types'

export function createSupabaseApi(url: string, anonKey: string): Api {
  const sb = createClient(url, anonKey)

  const uid = async () => {
    const { data } = await sb.auth.getSession()
    const id = data.session?.user.id
    if (!id) throw new Error('You are signed out.')
    return id
  }

  // Throws Supabase errors so screens can show the message.
  function check<T>(res: { data: T; error: { message: string } | null }): T {
    if (res.error) throw new Error(res.error.message)
    return res.data
  }

  return {
    mode: 'live',

    async getUserId() {
      const { data } = await sb.auth.getSession()
      return data.session?.user.id ?? null
    },

    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((_event, session) => cb(session?.user.id ?? null))
      return () => data.subscription.unsubscribe()
    },

    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password })
      if (error) throw new Error(error.message)
    },

    async signUp(email, password) {
      const { data, error } = await sb.auth.signUp({ email, password })
      if (error) throw new Error(error.message)
      if (!data.session) throw new Error('Check your email to confirm your account, then sign in.')
    },

    async resetPassword(email) {
      const { error } = await sb.auth.resetPasswordForEmail(email)
      if (error) throw new Error(error.message)
    },

    async signOut() {
      await sb.auth.signOut()
    },

    async getMyProfile() {
      const id = await uid()
      return check(await sb.from('profiles').select('*').eq('id', id).maybeSingle()) as Profile | null
    },

    async saveMyProfile(input) {
      const id = await uid()
      return check(await sb.from('profiles').update(input).eq('id', id).select().single()) as Profile
    },

    async deleteMyAccount() {
      check(await sb.rpc('delete_my_account'))
      await sb.auth.signOut()
    },

    async listCollabs() {
      const rows = check(await sb.from('collabs').select('*, applications(count)').order('created_at', { ascending: false }))
      return (rows as (Collab & { applications: { count: number }[] })[]).map(({ applications, ...c }) => ({
        ...c,
        application_count: applications?.[0]?.count ?? 0,
      }))
    },

    async saveCollab(input, id) {
      const query = id ? sb.from('collabs').update(input).eq('id', id) : sb.from('collabs').insert(input)
      return check(await query.select().single()) as Collab
    },

    async deleteCollab(id) {
      check(await sb.from('collabs').delete().eq('id', id))
    },

    async listMyApplications() {
      const id = await uid()
      return check(await sb.from('applications').select('*, collab:collabs(*)').eq('user_id', id).order('created_at', { ascending: false })) as Application[]
    },

    async apply(collabId, message, preferredDate) {
      const id = await uid()
      const { error } = await sb.from('applications').upsert(
        { collab_id: collabId, user_id: id, message, preferred_date: preferredDate, status: 'pending' },
        { onConflict: 'collab_id,user_id' },
      )
      if (error) throw new Error(error.code === '42501' ? 'You can apply once your profile is approved and while the collab is open.' : error.message)
    },

    async withdraw(applicationId) {
      check(await sb.from('applications').update({ status: 'withdrawn' }).eq('id', applicationId))
    },

    async markSeen(applicationIds) {
      if (applicationIds.length === 0) return
      check(await sb.from('applications').update({ seen: true }).in('id', applicationIds))
    },

    async registerDevice(token, platform) {
      check(await sb.rpc('register_device', { device_token: token, device_platform: platform }))
    },

    async unregisterDevice(token) {
      check(await sb.rpc('unregister_device', { device_token: token }))
    },

    async listApplicants(collabId) {
      return check(await sb.from('applications').select('*, profile:profiles(*)').eq('collab_id', collabId).order('created_at')) as Application[]
    },

    async setApplicationStatus(id, status) {
      check(await sb.from('applications').update({ status }).eq('id', id))
    },

    async listInfluencers() {
      return check(await sb.from('profiles').select('*').eq('role', 'influencer').order('created_at', { ascending: false })) as Profile[]
    },

    async setInfluencerStatus(id, status) {
      check(await sb.from('profiles').update({ status }).eq('id', id))
    },
  }
}
