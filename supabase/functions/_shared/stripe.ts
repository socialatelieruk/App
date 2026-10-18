// Minimal Stripe API client (no SDK): form-encoded requests and webhook
// signature checks. The secret key only ever lives in Supabase secrets.
const env = (name: string) => Deno.env.get(name) ?? ''

type Params = { [key: string]: string | number | boolean | undefined | Params | Params[] }

// Stripe expects nested fields as line_items[0][price_data][currency]=gbp.
export function formEncode(params: Params, prefix = '', out = new URLSearchParams()): URLSearchParams {
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue
    const name = prefix ? `${prefix}[${key}]` : key
    if (Array.isArray(value)) value.forEach((v, i) => formEncode(v, `${name}[${i}]`, out))
    else if (typeof value === 'object') formEncode(value, name, out)
    else out.append(name, String(value))
  }
  return out
}

export async function stripe<T = Record<string, unknown>>(path: string, params: Params): Promise<T> {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('STRIPE_SECRET_KEY')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formEncode(params),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Stripe ${res.status}: ${data?.error?.message ?? JSON.stringify(data)}`)
  return data as T
}

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

// Checks the Stripe-Signature header against the raw request body.
export async function verifyStripeSignature(payload: string, header: string | null, secret: string, toleranceSeconds = 300): Promise<boolean> {
  if (!header || !secret) return false
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=') as [string, string]))
  const timestamp = Number(parts.t)
  const signatures = header
    .split(',')
    .filter((p) => p.startsWith('v1='))
    .map((p) => p.slice(3))
  if (!timestamp || signatures.length === 0) return false
  if (Math.abs(Date.now() / 1000 - timestamp) > toleranceSeconds) return false
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const expected = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`)))
  // Constant-time comparison.
  return signatures.some((sig) => sig.length === expected.length && [...sig].reduce((d, c, i) => d | (c.charCodeAt(0) ^ expected.charCodeAt(i)), 0) === 0)
}
