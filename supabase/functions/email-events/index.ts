// Sends brand-portal emails from database webhooks (see README → Brand portal):
//   brand_accounts INSERT          → admin: new brand sign-up
//   brand_accounts UPDATE status   → brand: approved / not approved
//   briefs INSERT / resubmitted    → admin: brief to review
//   briefs UPDATE status           → brand: sent back with a note / now live
//   shortlist INSERT               → brand: creators ready (at most every 30 minutes)
//   shortlist UPDATE decision      → admin: brand approved or declined a creator
// Secrets: WEBHOOK_SECRET, RESEND_API_KEY, EMAIL_FROM, ADMIN_EMAIL, APP_URL.
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import { adminEmails, appUrl, brandEmails, emailBody, sendEmail } from '../_shared/email.ts'

const env = (name: string) => Deno.env.get(name) ?? ''
// deno-lint-ignore no-explicit-any
type Row = Record<string, any>

const SHORTLIST_EMAIL_GAP_MS = 30 * 60_000

Deno.serve(async (req) => {
  if (!env('WEBHOOK_SECRET') || req.headers.get('x-webhook-secret') !== env('WEBHOOK_SECRET')) {
    return new Response('Unauthorized', { status: 401 })
  }
  const { type, table, record, old_record } = (await req.json()) as { type: string; table: string; record: Row | null; old_record: Row | null }
  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'))
  const open = { label: 'Open The Social Atelier', url: appUrl() }
  const brandName = async (id: string) => (await db.from('brands').select('name').eq('id', id).maybeSingle()).data?.name ?? 'A brand'
  let result = 'skipped'

  try {
    if (table === 'brand_accounts' && record) {
      if (type === 'INSERT') {
        result = await sendEmail(
          adminEmails(),
          `New brand sign-up: ${record.business_name}`,
          emailBody(`${record.business_name} wants to join`, [
            [record.category, record.area].filter(Boolean).join(' · '),
            `Contact: ${record.contact_name}, ${record.email}${record.phone ? `, ${record.phone}` : ''}`,
            [record.instagram && `Instagram: @${record.instagram}`, record.website && `Website: ${record.website}`].filter(Boolean).join('\n'),
            'Review them in the app under Brands → Sign-ups.',
          ]),
        )
      } else if (type === 'UPDATE' && old_record?.status !== record.status && record.status !== 'pending') {
        result =
          record.status === 'approved'
            ? await sendEmail(
                [record.email],
                'Your account is approved',
                emailBody(`Welcome to The Social Atelier, ${record.contact_name.split(' ')[0]}`, ['Your brand account is approved. Choose a package and submit your first brief to start working with our creators.'], open),
              )
            : await sendEmail(
                [record.email],
                'About your account',
                emailBody('Thank you for applying', ["We're not able to take on your brand at the moment. If you think this is a mistake, just reply to this email."]),
              )
      }
    }

    if (table === 'briefs' && record) {
      const brand = await brandName(record.brand_id)
      const resubmitted = type === 'UPDATE' && old_record?.status === 'changes_requested' && record.status === 'submitted'
      if (type === 'INSERT' || resubmitted) {
        result = await sendEmail(
          adminEmails(),
          `Brief ${resubmitted ? 'resubmitted' : 'submitted'}: ${brand} · ${record.title}`,
          emailBody(`${brand} ${resubmitted ? 'updated' : 'sent'} a brief`, [
            record.title,
            [record.type, record.location, record.preferred_dates].filter(Boolean).join(' · '),
            'Review it in the app: Today → Briefs to review.',
          ]),
        )
      } else if (type === 'UPDATE' && old_record?.status !== record.status) {
        const to = await brandEmails(db, record.brand_id)
        if (record.status === 'changes_requested') {
          result = await sendEmail(to, `Your brief needs a few changes: ${record.title}`, emailBody('A few changes to your brief', [record.title, record.admin_note || 'Please take another look at your brief.'], open))
        } else if (record.status === 'approved') {
          result = await sendEmail(to, `Your campaign is live: ${record.title}`, emailBody('Your campaign is live', [`${record.title} is now open to our creators. We'll send you a shortlist to approve soon.`], open))
        }
      }
    }

    if (table === 'shortlist' && record) {
      if (type === 'INSERT') {
        // One email per batch of creators, not one per creator.
        const { data: accounts } = await db.from('brand_accounts').select('user_id, email, last_shortlist_email_at').eq('brand_id', record.brand_id).eq('status', 'approved')
        const due = (accounts ?? []).filter((a) => !a.last_shortlist_email_at || Date.now() - Date.parse(a.last_shortlist_email_at) > SHORTLIST_EMAIL_GAP_MS)
        if (due.length) {
          result = await sendEmail(
            due.map((a) => a.email),
            'Creators ready for your review',
            emailBody('Your shortlist is ready', ["We've picked creators for your campaign. Approve or decline each one in the app."], { label: 'Review your shortlist', url: appUrl() }),
          )
          await db.from('brand_accounts').update({ last_shortlist_email_at: new Date().toISOString() }).in('user_id', due.map((a) => a.user_id))
        }
      } else if (type === 'UPDATE' && !old_record?.decision && record.decision) {
        const [brand, app] = await Promise.all([
          brandName(record.brand_id),
          db.from('applications').select('profiles(full_name), collabs(title)').eq('id', record.application_id).maybeSingle(),
        ])
        // deno-lint-ignore no-explicit-any
        const a = app.data as any
        const creator = a?.profiles?.full_name ?? 'A creator'
        const collab = a?.collabs?.title ?? 'their campaign'
        const approved = record.decision === 'approved'
        result = await sendEmail(
          adminEmails(),
          `${brand} ${approved ? 'approved' : 'declined'} ${creator}`,
          emailBody(`${brand} ${approved ? 'approved' : 'declined'} ${creator}`, [
            collab,
            record.note ? `Their note: “${record.note}”` : '',
            approved ? 'Set a booking time in the app (Today → Brand replies).' : 'Send them a replacement from the applicants list (Today → Brand replies).',
          ].filter(Boolean)),
        )
      }
    }
  } catch (e) {
    console.error(e)
    return Response.json({ error: String(e) }, { status: 500 })
  }
  return Response.json({ result })
})
