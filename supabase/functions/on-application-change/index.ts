// Runs whenever an application changes (Supabase database webhook on UPDATE
// and DELETE of public.applications; see README → Notifications):
//   - pushes a "You're in" notification to the influencer's phones when
//     they're accepted
//   - keeps their Google Calendar in step with the booking time, if they
//     connected it
//
// Secrets (Supabase → Edge Functions → Secrets):
//   WEBHOOK_SECRET            shared secret the webhook sends in x-webhook-secret
//   FIREBASE_SERVICE_ACCOUNT  Firebase service account JSON, for Android
//   APNS_KEY_P8, APNS_KEY_ID, APPLE_TEAM_ID   Apple push key, for iPhone
//   APNS_BUNDLE_ID            optional, defaults to uk.socialatelier.app
//   APNS_SANDBOX              optional, "true" for builds run from Xcode
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET    for Google Calendar
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0'
import { importPKCS8, SignJWT } from 'npm:jose@5.9.6'
import { type ApplicationRow, env, syncApplication } from '../_shared/google-calendar.ts'

interface Device {
  token: string
  platform: 'ios' | 'android'
}

Deno.serve(async (req) => {
  if (!env('WEBHOOK_SECRET') || req.headers.get('x-webhook-secret') !== env('WEBHOOK_SECRET')) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { type, record, old_record } = (await req.json()) as { type: string; record: ApplicationRow | null; old_record: ApplicationRow | null }
  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'))
  const result: Record<string, unknown> = {}

  // A deleted application (or collab) takes its calendar event with it.
  if (type === 'DELETE' && old_record) {
    result.calendar = await syncApplication(db, { ...old_record, status: 'deleted' }).catch(fail('calendar'))
    return Response.json(result)
  }
  if (type !== 'UPDATE' || !record || !old_record) return Response.json({ skipped: true })

  const newlyAccepted = record.status === 'accepted' && old_record.status !== 'accepted'
  const bookingChanged =
    record.status !== old_record.status || record.scheduled_start !== old_record.scheduled_start || record.scheduled_end !== old_record.scheduled_end

  if (newlyAccepted) result.push = await notify(db, record).catch(fail('push'))
  // Skips updates that only record the calendar event id, which this function makes itself.
  if (bookingChanged) result.calendar = await syncApplication(db, record).catch(fail('calendar'))
  return Response.json(Object.keys(result).length ? result : { skipped: true })
})

const fail = (what: string) => (e: unknown) => {
  console.error(`${what} failed`, e)
  return 'error'
}

async function notify(db: SupabaseClient, app: ApplicationRow) {
  const [{ data: collab }, { data: devices }] = await Promise.all([
    db.from('collabs').select('title, brand').eq('id', app.collab_id).single(),
    db.from('device_tokens').select('token, platform').eq('user_id', app.user_id),
  ])
  if (!collab || !devices?.length) return { sent: 0 }

  const when = app.scheduled_start
    ? ` on ${new Date(app.scheduled_start).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Europe/London' })}`
    : ''
  const message = {
    title: "You're in",
    body: `${collab.brand} accepted you for ${collab.title}${when}. Open the app for the details.`,
  }

  const results = await Promise.all(
    (devices as Device[]).map(async (d) => {
      try {
        const outcome = d.platform === 'ios' ? await sendApns(d.token, message) : await sendFcm(d.token, message)
        if (outcome === 'invalid-token') await db.from('device_tokens').delete().eq('token', d.token)
        return outcome
      } catch (e) {
        console.error(`push to ${d.platform} failed`, e)
        return 'error'
      }
    }),
  )
  return { sent: results.filter((r) => r === 'sent').length, results }
}

type Outcome = 'sent' | 'invalid-token' | 'not-configured' | 'error'

// Android, through Firebase Cloud Messaging (HTTP v1 API).
let fcmAuth: { token: string; expires: number } | null = null

async function sendFcm(token: string, msg: { title: string; body: string }): Promise<Outcome> {
  if (!env('FIREBASE_SERVICE_ACCOUNT')) return 'not-configured'
  const account = JSON.parse(env('FIREBASE_SERVICE_ACCOUNT'))

  if (!fcmAuth || fcmAuth.expires < Date.now() + 60_000) {
    const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/firebase.messaging' })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuer(account.client_email)
      .setAudience('https://oauth2.googleapis.com/token')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(await importPKCS8(account.private_key, 'RS256'))
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    })
    if (!res.ok) throw new Error(`Google auth failed: ${res.status} ${await res.text()}`)
    const { access_token, expires_in } = await res.json()
    fcmAuth = { token: access_token, expires: Date.now() + expires_in * 1000 }
  }

  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${fcmAuth.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: { token, notification: msg, android: { priority: 'high' } } }),
  })
  if (res.ok) return 'sent'
  const text = await res.text()
  if (res.status === 404 || text.includes('UNREGISTERED')) return 'invalid-token'
  throw new Error(`FCM ${res.status}: ${text}`)
}

// iPhone, through Apple Push Notification service.
let apnsAuth: { token: string; issued: number } | null = null

async function sendApns(token: string, msg: { title: string; body: string }): Promise<Outcome> {
  if (!env('APNS_KEY_P8') || !env('APNS_KEY_ID') || !env('APPLE_TEAM_ID')) return 'not-configured'

  // Apple wants the provider token refreshed at most every 20–60 minutes.
  if (!apnsAuth || Date.now() - apnsAuth.issued > 45 * 60_000) {
    const jwt = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: env('APNS_KEY_ID') })
      .setIssuer(env('APPLE_TEAM_ID'))
      .setIssuedAt()
      .sign(await importPKCS8(env('APNS_KEY_P8'), 'ES256'))
    apnsAuth = { token: jwt, issued: Date.now() }
  }

  const host = env('APNS_SANDBOX') === 'true' ? 'api.sandbox.push.apple.com' : 'api.push.apple.com'
  const res = await fetch(`https://${host}/3/device/${token}`, {
    method: 'POST',
    headers: {
      authorization: `bearer ${apnsAuth.token}`,
      'apns-topic': env('APNS_BUNDLE_ID') || 'uk.socialatelier.app',
      'apns-push-type': 'alert',
      'apns-priority': '10',
    },
    body: JSON.stringify({ aps: { alert: msg, sound: 'default' } }),
  })
  if (res.ok) return 'sent'
  const text = await res.text()
  if (res.status === 410 || text.includes('BadDeviceToken') || text.includes('Unregistered')) return 'invalid-token'
  throw new Error(`APNs ${res.status}: ${text}`)
}
