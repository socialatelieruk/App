// Google Calendar helpers shared by the google-calendar and
// on-application-change functions.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0'

export const env = (name: string) => Deno.env.get(name) ?? ''

export const CALENDAR_SCOPES = 'openid email https://www.googleapis.com/auth/calendar.events'

export const redirectUri = () => `${env('SUPABASE_URL')}/functions/v1/google-calendar/callback`

export function calendarConfigured() {
  return !!(env('GOOGLE_CLIENT_ID') && env('GOOGLE_CLIENT_SECRET'))
}

export interface ApplicationRow {
  id: string
  collab_id: string
  user_id: string
  status: string
  scheduled_start: string | null
  scheduled_end: string | null
  google_event_id: string | null
}

class TokenRevoked extends Error {}

async function googleToken(params: Record<string, string>) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env('GOOGLE_CLIENT_ID'), client_secret: env('GOOGLE_CLIENT_SECRET'), ...params }),
  })
  const data = await res.json()
  if (!res.ok) {
    if (data.error === 'invalid_grant') throw new TokenRevoked('Google access was revoked')
    throw new Error(`Google token error ${res.status}: ${JSON.stringify(data)}`)
  }
  return data as { access_token: string; refresh_token?: string; id_token?: string }
}

export function exchangeCode(code: string) {
  return googleToken({ code, grant_type: 'authorization_code', redirect_uri: redirectUri() })
}

export async function revoke(refreshToken: string) {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`, { method: 'POST' }).catch(() => {})
}

async function calendarFetch(accessToken: string, path: string, init: RequestInit = {}) {
  return fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  })
}

// Makes the influencer's Google Calendar match an application: an event while
// it's accepted with a booking time, no event otherwise.
export async function syncApplication(db: SupabaseClient, app: ApplicationRow): Promise<string> {
  if (!calendarConfigured()) return 'calendar-not-configured'
  const { data: link } = await db.from('google_calendar_links').select('refresh_token').eq('user_id', app.user_id).maybeSingle()
  if (!link) return 'not-connected'

  let accessToken: string
  try {
    accessToken = (await googleToken({ refresh_token: link.refresh_token, grant_type: 'refresh_token' })).access_token
  } catch (e) {
    if (e instanceof TokenRevoked) {
      await db.from('google_calendar_links').delete().eq('user_id', app.user_id)
      return 'disconnected'
    }
    throw e
  }

  const setEventId = (id: string | null) => db.from('applications').update({ google_event_id: id }).eq('id', app.id)
  const wanted = app.status === 'accepted' && !!app.scheduled_start

  if (!wanted) {
    if (!app.google_event_id) return 'nothing-to-do'
    const res = await calendarFetch(accessToken, `/${app.google_event_id}`, { method: 'DELETE' })
    if (!res.ok && res.status !== 404 && res.status !== 410) throw new Error(`Calendar delete ${res.status}: ${await res.text()}`)
    await setEventId(null)
    return 'deleted'
  }

  const { data: collab } = await db.from('collabs').select('title, brand, location, city, offer, deliverables').eq('id', app.collab_id).single()
  if (!collab) return 'collab-missing'
  const start = new Date(app.scheduled_start!)
  const end = app.scheduled_end ? new Date(app.scheduled_end) : new Date(start.getTime() + 60 * 60_000)
  const event = {
    summary: `${collab.brand} · ${collab.title}`,
    location: [collab.location, collab.city].filter(Boolean).join(', '),
    description: [
      collab.offer && `You get: ${collab.offer}`,
      collab.deliverables && `You post: ${collab.deliverables}`,
      'Booked through The Social Atelier.',
    ]
      .filter(Boolean)
      .join('\n'),
    status: 'confirmed', // also restores the event if the influencer deleted it
    start: { dateTime: start.toISOString(), timeZone: 'Europe/London' },
    end: { dateTime: end.toISOString(), timeZone: 'Europe/London' },
  }

  if (app.google_event_id) {
    const res = await calendarFetch(accessToken, `/${app.google_event_id}`, { method: 'PATCH', body: JSON.stringify(event) })
    if (res.ok) return 'updated'
    if (res.status !== 404 && res.status !== 410) throw new Error(`Calendar update ${res.status}: ${await res.text()}`)
    // The influencer deleted the event themselves: add it again below.
  }
  const res = await calendarFetch(accessToken, '', { method: 'POST', body: JSON.stringify(event) })
  if (!res.ok) throw new Error(`Calendar insert ${res.status}: ${await res.text()}`)
  await setEventId((await res.json()).id)
  return 'created'
}
