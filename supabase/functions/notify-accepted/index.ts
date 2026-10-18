// Sends a push notification to an influencer's phones when Social Atelier
// accepts their application. Called by a Supabase database webhook on
// UPDATE of public.applications (see README → Notifications).
//
// Secrets (Supabase → Edge Functions → Secrets):
//   WEBHOOK_SECRET            shared secret the webhook sends in x-webhook-secret
//   FIREBASE_SERVICE_ACCOUNT  Firebase service account JSON, for Android
//   APNS_KEY_P8, APNS_KEY_ID, APPLE_TEAM_ID   Apple push key, for iPhone
//   APNS_BUNDLE_ID            optional, defaults to uk.socialatelier.app
//   APNS_SANDBOX              optional, "true" for builds run from Xcode
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import { importPKCS8, SignJWT } from 'npm:jose@5.9.6'

interface Application {
  id: string
  collab_id: string
  user_id: string
  status: string
}

interface Device {
  token: string
  platform: 'ios' | 'android'
}

const env = (name: string) => Deno.env.get(name) ?? ''

Deno.serve(async (req) => {
  if (!env('WEBHOOK_SECRET') || req.headers.get('x-webhook-secret') !== env('WEBHOOK_SECRET')) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { type, record, old_record } = (await req.json()) as { type: string; record: Application; old_record: Application | null }
  if (type !== 'UPDATE' || record.status !== 'accepted' || old_record?.status === 'accepted') {
    return Response.json({ skipped: true })
  }

  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'))
  const [{ data: collab }, { data: devices }] = await Promise.all([
    db.from('collabs').select('title, brand').eq('id', record.collab_id).single(),
    db.from('device_tokens').select('token, platform').eq('user_id', record.user_id),
  ])
  if (!collab || !devices?.length) return Response.json({ sent: 0 })

  const message = {
    title: "You're in",
    body: `${collab.brand} accepted you for ${collab.title}. Open the app for the details.`,
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
  return Response.json({ sent: results.filter((r) => r === 'sent').length, results })
})

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
