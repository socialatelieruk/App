// Sends email through Resend (https://resend.com).
// Secrets: RESEND_API_KEY, EMAIL_FROM (e.g. "The Social Atelier <hello@yourdomain.co.uk>"),
// ADMIN_EMAIL (where admin alerts go, comma-separated for several).
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0'

const env = (name: string) => Deno.env.get(name) ?? ''

export const adminEmails = () =>
  env('ADMIN_EMAIL')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean)

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

// A short, on-brand email: heading, a few paragraphs, an optional button.
export function emailBody(heading: string, paragraphs: string[], button?: { label: string; url: string }) {
  const text = [heading, '', ...paragraphs, ...(button ? ['', `${button.label}: ${button.url}`] : []), '', 'The Social Atelier'].join('\n')
  const html = `<div style="background:#faf5ef;padding:32px 20px;font-family:Helvetica,Arial,sans-serif;color:#141210">
  <div style="max-width:520px;margin:0 auto">
    <p style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#857c72;margin:0 0 18px">The Social Atelier</p>
    <h1 style="font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:28px;margin:0 0 18px">${escape(heading)}</h1>
    ${paragraphs.map((p) => `<p style="font-size:15px;line-height:1.6;margin:0 0 14px">${escape(p).replace(/\n/g, '<br>')}</p>`).join('')}
    ${
      button
        ? `<p style="margin:24px 0"><a href="${escape(button.url)}" style="background:#141210;color:#faf5ef;padding:14px 22px;text-decoration:none;font-size:12px;letter-spacing:.16em;text-transform:uppercase">${escape(button.label)}</a></p>`
        : ''
    }
  </div>
</div>`
  return { text, html }
}

export async function sendEmail(to: string[], subject: string, body: { text: string; html: string }): Promise<string> {
  const recipients = to.filter(Boolean)
  if (recipients.length === 0) return 'no-recipients'
  if (!env('RESEND_API_KEY') || !env('EMAIL_FROM')) {
    console.log(`Email not configured; would send "${subject}" to ${recipients.join(', ')}`)
    return 'not-configured'
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env('EMAIL_FROM'), to: recipients, subject, text: body.text, html: body.html }),
  })
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`)
  return 'sent'
}

// Everyone who can sign in for a brand.
export async function brandEmails(db: SupabaseClient, brandId: string): Promise<string[]> {
  const { data } = await db.from('brand_accounts').select('email').eq('brand_id', brandId).eq('status', 'approved')
  return (data ?? []).map((r: { email: string }) => r.email)
}

export const appUrl = () => env('APP_URL') || 'https://socialatelieruk.github.io/App/'
