// Receives Stripe events and records brand payments.
//
//   checkout.session.completed      one-off paid; subscription id saved
//   checkout.session.expired        abandoned checkout → cancelled
//   checkout.session.async_payment_succeeded / _failed
//   invoice.paid                    each month of a subscription → paid
//   invoice.payment_failed          a subscription charge failed → failed
//
// Paid and failed payments email the brand and the admin.
// Secrets: STRIPE_WEBHOOK_SECRET (the endpoint's signing secret), plus email secrets.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0'
import { adminEmails, appUrl, brandEmails, emailBody, sendEmail } from '../_shared/email.ts'
import { verifyStripeSignature } from '../_shared/stripe.ts'

const env = (name: string) => Deno.env.get(name) ?? ''

// deno-lint-ignore no-explicit-any
type StripeObject = Record<string, any>

Deno.serve(async (req) => {
  const payload = await req.text()
  if (!(await verifyStripeSignature(payload, req.headers.get('stripe-signature'), env('STRIPE_WEBHOOK_SECRET')))) {
    return new Response('Invalid signature', { status: 400 })
  }
  const event = JSON.parse(payload) as { type: string; data: { object: StripeObject } }
  const obj = event.data.object
  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'))

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const id = obj.metadata?.payment_id ?? obj.client_reference_id
        if (obj.mode === 'subscription') {
          // invoice.paid marks the first month paid.
          await db.from('brand_payments').update({ stripe_subscription_id: obj.subscription, stripe_session_id: obj.id }).eq('id', id)
        } else if (obj.payment_status === 'paid') {
          await markPaid(db, id, {})
        }
        break
      }
      case 'checkout.session.async_payment_failed':
        await markFailed(db, obj.metadata?.payment_id ?? obj.client_reference_id, {})
        break
      case 'checkout.session.expired':
        await db.from('brand_payments').update({ status: 'cancelled' }).eq('id', obj.metadata?.payment_id ?? obj.client_reference_id).eq('status', 'pending')
        break
      case 'invoice.paid':
      case 'invoice.payment_failed': {
        const subscription = obj.subscription ?? obj.parent?.subscription_details?.subscription
        if (!subscription) break
        const meta = obj.subscription_details?.metadata ?? obj.parent?.subscription_details?.metadata ?? {}
        const fields = {
          stripe_invoice_id: obj.id,
          stripe_subscription_id: subscription,
          amount: (obj.amount_paid || obj.amount_due || 0) / 100,
          period_start: obj.period_start ? new Date(obj.period_start * 1000).toISOString().slice(0, 10) : null,
        }
        // The first invoice settles the payment row made at checkout; later ones are new months.
        let id: string | undefined = obj.billing_reason === 'subscription_create' ? meta.payment_id : undefined
        if (!id) {
          const { data: existing } = await db.from('brand_payments').select('id').eq('stripe_invoice_id', obj.id).maybeSingle()
          id = existing?.id
        }
        if (!id) {
          const { data: first } = await db
            .from('brand_payments')
            .select('brand_id, package_id, user_id')
            .eq('stripe_subscription_id', subscription)
            .order('created_at')
            .limit(1)
            .maybeSingle()
          const origin = first ?? (meta.brand_id ? { brand_id: meta.brand_id, package_id: meta.package_id ?? null, user_id: null } : null)
          if (!origin) break
          const { data: inserted } = await db
            .from('brand_payments')
            .insert({ ...origin, kind: 'monthly', status: 'pending', ...fields })
            .select('id')
            .single()
          id = inserted?.id
        }
        if (!id) break
        if (event.type === 'invoice.paid') await markPaid(db, id, fields)
        else await markFailed(db, id, fields)
        break
      }
    }
  } catch (e) {
    console.error(e)
    return new Response('Webhook handler failed', { status: 500 }) // Stripe retries
  }
  return Response.json({ received: true })
})

async function markPaid(db: SupabaseClient, id: string, fields: Record<string, unknown>) {
  // Stripe can send the same event more than once; only the first one counts.
  const { data: before } = await db.from('brand_payments').select('status').eq('id', id).maybeSingle()
  if (!before || before.status === 'paid') return
  const { data: p } = await db
    .from('brand_payments')
    .update({ ...fields, status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', id)
    .select('brand_id, amount, kind, packages(name), brands(name)')
    .single()
  if (!p) return
  // deno-lint-ignore no-explicit-any
  const row = p as any
  const what = `${row.packages?.name ?? 'Package'} · £${Number(row.amount).toFixed(2)}${row.kind === 'monthly' ? ' (monthly)' : ''}`
  await Promise.all([
    sendEmail(
      await brandEmails(db, row.brand_id),
      'Payment received',
      emailBody('Thank you, your payment is complete', [`We've received your payment for ${what}.`, 'You can now submit your brief in the app. We review every brief before it goes live to creators.'], { label: 'Open The Social Atelier', url: appUrl() }),
    ),
    sendEmail(adminEmails(), `Payment received: ${row.brands?.name ?? 'Brand'}`, emailBody(`${row.brands?.name ?? 'A brand'} paid`, [what])),
  ]).catch((e) => console.error('payment email failed', e))
}

async function markFailed(db: SupabaseClient, id: string, fields: Record<string, unknown>) {
  const { data: p } = await db
    .from('brand_payments')
    .update({ ...fields, status: 'failed' })
    .eq('id', id)
    .neq('status', 'paid')
    .select('brand_id, amount, kind, packages(name), brands(name)')
    .maybeSingle()
  if (!p) return
  // deno-lint-ignore no-explicit-any
  const row = p as any
  const what = `${row.packages?.name ?? 'Package'} · £${Number(row.amount).toFixed(2)}`
  await Promise.all([
    sendEmail(
      await brandEmails(db, row.brand_id),
      'Your payment didn’t go through',
      emailBody('Your payment didn’t go through', [`We couldn't take payment for ${what}.`, 'Please check your card details and try again from the app, or reply to this email and we’ll help.'], { label: 'Open The Social Atelier', url: appUrl() }),
    ),
    sendEmail(adminEmails(), `Payment failed: ${row.brands?.name ?? 'Brand'}`, emailBody(`Payment failed for ${row.brands?.name ?? 'a brand'}`, [what])),
  ]).catch((e) => console.error('payment email failed', e))
}
