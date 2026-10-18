export function formatDate(iso: string | null): string {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

export function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return String(n)
}

export function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong. Please try again.'
}

// "Sat 24 Oct, 12:30–14:00"
export function formatBooking(start: string, end: string | null): string {
  const s = new Date(start)
  const day = s.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
  const time = (d: Date) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return end ? `${day}, ${time(s)}–${time(new Date(end))}` : `${day}, ${time(s)}`
}

// Pre-filled "add event" page in Google Calendar.
export function googleCalendarUrl(title: string, details: string, location: string, start: string, end: string | null): string {
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const s = new Date(start)
  const e = end ? new Date(end) : new Date(s.getTime() + 60 * 60_000)
  const params = new URLSearchParams({ action: 'TEMPLATE', text: title, details, location, dates: `${stamp(s)}/${stamp(e)}` })
  return `https://calendar.google.com/calendar/render?${params}`
}
