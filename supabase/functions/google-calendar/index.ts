// Connects an influencer's Google Calendar so accepted collabs are added
// to it automatically.
//
//   POST { action: 'start' }       → { url } of Google's consent screen (signed-in users)
//   POST { action: 'disconnect' }  → removes the connection
//   GET  /callback?code&state      → Google redirects here after consent
//
// Secrets: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, WEBHOOK_SECRET (signs the OAuth state).
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import { type ApplicationRow, CALENDAR_SCOPES, calendarConfigured, env, exchangeCode, redirectUri, revoke, syncApplication } from '../_shared/google-calendar.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const db = () => createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'))

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  const url = new URL(req.url)
  if (req.method === 'GET' && url.pathname.endsWith('/callback')) return callback(url)
  if (req.method !== 'POST') return new Response('Not found', { status: 404 })

  const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: cors })
  if (!calendarConfigured() || !env('WEBHOOK_SECRET')) return reply({ error: 'Google Calendar is not set up yet.' }, 503)

  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
  const { data: auth } = await db().auth.getUser(jwt)
  if (!auth.user) return reply({ error: 'Please sign in again.' }, 401)

  const { action } = await req.json().catch(() => ({ action: null }))
  if (action === 'start') {
    const state = await sign({ u: auth.user.id, exp: Date.now() + 15 * 60_000 })
    const consent = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    consent.search = new URLSearchParams({
      client_id: env('GOOGLE_CLIENT_ID'),
      redirect_uri: redirectUri(),
      response_type: 'code',
      scope: CALENDAR_SCOPES,
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
    }).toString()
    return reply({ url: consent.toString() })
  }
  if (action === 'disconnect') {
    const client = db()
    const { data: link } = await client.from('google_calendar_links').select('refresh_token').eq('user_id', auth.user.id).maybeSingle()
    if (link) await revoke(link.refresh_token)
    await client.from('google_calendar_links').delete().eq('user_id', auth.user.id)
    // Existing events stay in their calendar; forget them so nothing tries to update them.
    await client.from('applications').update({ google_event_id: null }).eq('user_id', auth.user.id)
    return reply({ ok: true })
  }
  return reply({ error: 'Unknown action' }, 400)
})

async function callback(url: URL) {
  const payload = await verify(url.searchParams.get('state') ?? '')
  const code = url.searchParams.get('code')
  if (!payload || !code) return page('That link has expired', 'Go back to The Social Atelier and tap Connect Google Calendar again.')

  try {
    const tokens = await exchangeCode(code)
    if (!tokens.refresh_token) throw new Error('Google did not return a refresh token')
    const email = tokens.id_token ? (JSON.parse(atob(tokens.id_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).email ?? '') : ''
    const client = db()
    await client.from('google_calendar_links').upsert({ user_id: payload.u, email, refresh_token: tokens.refresh_token, connected_at: new Date().toISOString() })

    // Add bookings that were accepted before the calendar was connected.
    const { data: apps } = await client
      .from('applications')
      .select('id, collab_id, user_id, status, scheduled_start, scheduled_end, google_event_id')
      .eq('user_id', payload.u)
      .eq('status', 'accepted')
      .gt('scheduled_start', new Date().toISOString())
    for (const app of (apps ?? []) as ApplicationRow[]) await syncApplication(client, app).catch((e) => console.error(e))

    return page('Google Calendar connected', 'Accepted collabs will now appear in your calendar automatically. Tap Done to go back to the app.')
  } catch (e) {
    console.error(e)
    return page('Something went wrong', 'We couldn’t connect your calendar. Please go back to the app and try again.')
  }
}

// OAuth state: the user id and an expiry, signed so it can't be forged.
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))

async function hmac(data: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(`calendar-state:${env('WEBHOOK_SECRET')}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))))
}

async function sign(payload: { u: string; exp: number }) {
  const body = b64url(new TextEncoder().encode(JSON.stringify(payload)))
  return `${body}.${await hmac(body)}`
}

async function verify(state: string): Promise<{ u: string; exp: number } | null> {
  const [body, sig] = state.split('.')
  if (!body || !sig || !env('WEBHOOK_SECRET') || sig !== (await hmac(body))) return null
  const payload = JSON.parse(new TextDecoder().decode(fromB64url(body)))
  return payload.exp > Date.now() ? payload : null
}

// Supabase serves function responses on its own domain as plain text, so the
// page Google returns to is a short text message.
function page(title: string, message: string) {
  return new Response(`THE SOCIAL ATELIER\n\n${title}\n\n${message}\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
