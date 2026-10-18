// Starts a Stripe Checkout for a brand buying a package.
//
//   POST { package_id } with the brand's session → { url } of Stripe Checkout
//
// One-off packages use a payment; monthly packages a subscription. A pending
// brand_payments row is created first and marked paid by stripe-webhook.
// Secrets: STRIPE_SECRET_KEY, APP_URL (where Stripe sends people back).
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import { appUrl } from '../_shared/email.ts'
import { stripe } from '../_shared/stripe.ts'

const env = (name: string) => Deno.env.get(name) ?? ''

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: cors })
  if (req.method !== 'POST') return reply({ error: 'Not found' }, 404)
  if (!env('STRIPE_SECRET_KEY')) return reply({ error: 'Payments are not set up yet. Please contact The Social Atelier.' }, 503)

  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'))
  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
  const { data: auth } = await db.auth.getUser(jwt)
  if (!auth.user) return reply({ error: 'Please sign in again.' }, 401)

  const { data: account } = await db.from('brand_accounts').select('brand_id, email, business_name, status').eq('user_id', auth.user.id).maybeSingle()
  if (!account || account.status !== 'approved' || !account.brand_id) return reply({ error: 'Your account needs to be approved before you can pay.' }, 403)

  const { package_id } = await req.json().catch(() => ({ package_id: null }))
  const { data: pkg } = await db.from('packages').select('*').eq('id', package_id).eq('active', true).maybeSingle()
  if (!pkg) return reply({ error: 'That package is no longer available.' }, 404)

  const monthly = pkg.billing === 'monthly'
  const { data: payment, error } = await db
    .from('brand_payments')
    .insert({ brand_id: account.brand_id, package_id: pkg.id, user_id: auth.user.id, kind: pkg.billing, amount: pkg.price, status: 'pending' })
    .select('id')
    .single()
  if (error || !payment) return reply({ error: 'Could not start the payment. Please try again.' }, 500)

  const metadata = { payment_id: payment.id, brand_id: account.brand_id, package_id: pkg.id }
  try {
    const session = await stripe<{ id: string; url: string }>('checkout/sessions', {
      mode: monthly ? 'subscription' : 'payment',
      customer_email: account.email,
      client_reference_id: payment.id,
      success_url: `${appUrl()}?payment=success`,
      cancel_url: `${appUrl()}?payment=cancelled`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'gbp',
            unit_amount: Math.round(Number(pkg.price) * 100),
            product_data: { name: `The Social Atelier · ${pkg.name}`, description: pkg.description || undefined },
            recurring: monthly ? { interval: 'month' } : undefined,
          },
        },
      ],
      metadata,
      ...(monthly ? { subscription_data: { metadata } } : { payment_intent_data: { metadata } }),
    })
    await db.from('brand_payments').update({ stripe_session_id: session.id }).eq('id', payment.id)
    return reply({ url: session.url })
  } catch (e) {
    console.error(e)
    await db.from('brand_payments').update({ status: 'cancelled' }).eq('id', payment.id)
    return reply({ error: 'Stripe could not start the checkout. Please try again.' }, 502)
  }
})
