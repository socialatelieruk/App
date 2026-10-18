import { createClient } from '@supabase/supabase-js'
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
  Profile,
  RetainerPayment,
  ShortlistCard,
  ShortlistEntry,
} from '../types'
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

    async signUp(email, password, as) {
      const { data, error } = await sb.auth.signUp({ email, password, options: as ? { data: { signup_as: as } } : undefined })
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

    async listAllApplications() {
      return check(await sb.from('applications').select('*, collab:collabs(*), profile:profiles(*)').order('created_at', { ascending: false })) as Application[]
    },

    async listBrands() {
      const rows = check(await sb.from('brands').select('*').order('name')) as Brand[]
      return rows.map((b) => ({ ...b, monthly_fee: b.monthly_fee === null ? null : Number(b.monthly_fee) }))
    },

    async saveBrand(input, id) {
      const query = id ? sb.from('brands').update(input).eq('id', id) : sb.from('brands').insert(input)
      const { data, error } = await query.select().single()
      if (error) throw new Error(error.code === '23505' ? 'A brand with that name already exists.' : error.message)
      return data as Brand
    },

    async listFinances() {
      const rows = check(await sb.from('collab_finances').select('*')) as CollabFinance[]
      return Object.fromEntries(rows.map((f) => [f.collab_id, { ...f, fee: f.fee === null ? null : Number(f.fee) }]))
    },

    async saveFinance(collabId, input) {
      check(await sb.from('collab_finances').upsert({ collab_id: collabId, ...input, updated_at: new Date().toISOString() }))
    },

    async listRetainerPayments() {
      const rows = check(await sb.from('retainer_payments').select('*')) as RetainerPayment[]
      return rows.map((p) => ({ ...p, amount: Number(p.amount) }))
    },

    async saveRetainerPayment(brandId, month, amount, status, invoicedOn) {
      check(
        await sb
          .from('retainer_payments')
          .upsert({ brand_id: brandId, month, amount, status, invoiced_on: invoicedOn, paid_on: null }, { onConflict: 'brand_id,month' }),
      )
    },

    async getMyBrandAccount() {
      const id = await uid()
      return check(await sb.from('brand_accounts').select('*').eq('user_id', id).maybeSingle()) as BrandAccount | null
    },

    async registerBrand(input) {
      check(
        await sb.rpc('register_brand', {
          in_business_name: input.business_name,
          in_contact_name: input.contact_name,
          in_phone: input.phone,
          in_instagram: input.instagram,
          in_website: input.website,
          in_area: input.area,
          in_category: input.category,
        }),
      )
    },

    async listPackages() {
      const rows = check(await sb.from('packages').select('*').order('sort')) as Package[]
      return rows.map((p) => ({ ...p, price: Number(p.price) }))
    },

    async startCheckout(packageId) {
      return (await invoke('stripe-checkout', { package_id: packageId })) as { url: string }
    },

    async listBrandPayments() {
      const rows = check(await sb.from('brand_payments').select('*').order('created_at', { ascending: false })) as BrandPayment[]
      return rows.map((p) => ({ ...p, amount: Number(p.amount) }))
    },

    async listBriefs() {
      return check(await sb.from('briefs').select('*').order('created_at', { ascending: false })) as Brief[]
    },

    async submitBrief(paymentId, input, packageId) {
      const account = (check(await sb.from('brand_accounts').select('brand_id').eq('user_id', await uid()).single()) as { brand_id: string })
      check(await sb.from('briefs').insert({ ...input, brand_id: account.brand_id, payment_id: paymentId, package_id: packageId }))
    },

    async resubmitBrief(id, input) {
      check(await sb.from('briefs').update(input).eq('id', id))
    },

    async uploadBriefImage(file) {
      const account = (check(await sb.from('brand_accounts').select('brand_id').eq('user_id', await uid()).single()) as { brand_id: string })
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
      const path = `${account.brand_id}/${crypto.randomUUID()}.${ext}`
      const { error } = await sb.storage.from('brief-images').upload(path, file, { contentType: file.type, upsert: false })
      if (error) throw new Error(error.message)
      return sb.storage.from('brief-images').getPublicUrl(path).data.publicUrl
    },

    async getShortlist() {
      return (check(await sb.rpc('brand_shortlist')) ?? []) as ShortlistCard[]
    },

    async decideShortlist(applicationId, decision, note) {
      check(await sb.rpc('brand_decide', { application: applicationId, decision, note }))
    },

    async getCampaigns() {
      return (check(await sb.rpc('brand_campaigns')) ?? []) as BrandCampaign[]
    },

    async listBrandAccounts() {
      return check(await sb.from('brand_accounts').select('*').order('created_at', { ascending: false })) as BrandAccount[]
    },

    async approveBrandAccount(userId, brandId) {
      return check(await sb.rpc('approve_brand_account', { account_user_id: userId, link_brand_id: brandId })) as string
    },

    async declineBrandAccount(userId) {
      check(await sb.rpc('decline_brand_account', { account_user_id: userId, note: '' }))
    },

    async savePackage(input, id) {
      check(await (id ? sb.from('packages').update(input).eq('id', id) : sb.from('packages').insert(input)))
    },

    async sendBriefBack(id, note) {
      check(await sb.from('briefs').update({ status: 'changes_requested', admin_note: note }).eq('id', id))
    },

    async publishBrief(briefId, input) {
      const collab = check(await sb.from('collabs').insert(input).select().single()) as Collab
      check(await sb.from('briefs').update({ status: 'approved', collab_id: collab.id, admin_note: '' }).eq('id', briefId))
      return collab
    },

    async listShortlist() {
      return check(await sb.from('shortlist').select('*')) as ShortlistEntry[]
    },

    async sendToBrand(applicationId) {
      const { error } = await sb.from('shortlist').insert({ application_id: applicationId })
      if (error) throw new Error(error.code === '23505' ? 'Already sent to the brand.' : error.message)
    },

    async removeFromShortlist(applicationId) {
      check(await sb.from('shortlist').delete().eq('application_id', applicationId).is('decision', null))
    },

    async markShortlistHandled(applicationId) {
      check(await sb.from('shortlist').update({ handled: true }).eq('application_id', applicationId))
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
