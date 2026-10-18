import { createClient } from '@supabase/supabase-js'
import type { Application, BrandReport, Collab, DeliveryStats, Profile } from '../types'
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

  // Calls an edge function, surfacing its { error } message when it fails.
  async function invoke(name: string, body: Record<string, unknown>) {
    const { data, error } = await sb.functions.invoke(name, { body })
    if (error) {
      const detail = await error.context?.json?.().catch(() => null)
      throw new Error(detail?.error ?? 'Something went wrong. Please try again.')
    }
    return data
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

    async getCalendarEmail() {
      const rows = check(await sb.rpc('my_calendar_link')) as { email: string }[] | null
      return rows?.[0] ? rows[0].email || 'your Google account' : null
    },

    async connectCalendar() {
      return ((await invoke('google-calendar', { action: 'start' })) as { url: string }).url
    },

    async disconnectCalendar() {
      await invoke('google-calendar', { action: 'disconnect' })
    },

    async submitPosts(applicationId, links) {
      check(await sb.from('applications').update({ post_links: links }).eq('id', applicationId))
    },

    async listApplicants(collabId) {
      return check(await sb.from('applications').select('*, profile:profiles(*)').eq('collab_id', collabId).order('created_at')) as Application[]
    },

    async setApplicationStatus(id, status, booking) {
      const fields = booking
        ? { scheduled_start: booking.schedule?.start ?? null, scheduled_end: booking.schedule?.end ?? null, content_due: booking.contentDue }
        : {}
      check(await sb.from('applications').update({ status, ...fields }).eq('id', id))
    },

    async setAttendance(applicationId, attendance) {
      check(await sb.from('applications').update({ attendance }).eq('id', applicationId))
    },

    async getReliability() {
      const rows = check(await sb.rpc('reliability_stats')) as ({ user_id: string } & DeliveryStats)[]
      return Object.fromEntries(rows.map(({ user_id, ...stats }) => [user_id, stats]))
    },

    async getReportToken(collabId) {
      const existing = check(await sb.from('report_links').select('token').eq('collab_id', collabId).maybeSingle()) as { token: string } | null
      if (existing) return existing.token
      return (check(await sb.from('report_links').insert({ collab_id: collabId }).select('token').single()) as { token: string }).token
    },

    async getReport(token) {
      return check(await sb.rpc('collab_report', { report_token: token })) as BrandReport | null
    },

    async listInfluencers() {
      return check(await sb.from('profiles').select('*').eq('role', 'influencer').order('created_at', { ascending: false })) as Profile[]
    },

    async setInfluencerStatus(id, status) {
      check(await sb.from('profiles').update({ status }).eq('id', id))
    },
  }
}
