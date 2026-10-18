import { todayISO } from './format'
import type { Brand, BrandPayment, Collab, CollabFinance, PaymentStatus, RetainerPayment } from './types'

export const OVERDUE_AFTER_DAYS = 30

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 2, minimumFractionDigits: 0 })
export const formatMoney = (n: number) => gbp.format(n)

const daysBetween = (from: string, to: string) => Math.floor((Date.parse(to) - Date.parse(from)) / 86_400_000)

// Invoiced more than 30 days ago and still not paid.
export const isOverdue = (status: PaymentStatus, invoicedOn: string | null, today = todayISO()) =>
  status === 'invoiced' && !!invoicedOn && daysBetween(invoicedOn, today) > OVERDUE_AFTER_DAYS

export const monthStart = (date: string) => `${date.slice(0, 7)}-01`

export const formatMonth = (month: string) => new Date(`${month}T12:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

// Every retainer month from the start up to this month, newest first, with its payment.
export interface RetainerMonth {
  month: string
  amount: number
  status: PaymentStatus
  invoiced_on: string | null
  paid_on: string | null
  payment?: RetainerPayment
}

export function retainerMonths(brand: Brand, payments: RetainerPayment[], today = todayISO()): RetainerMonth[] {
  if (brand.deal_type !== 'retainer' || !brand.retainer_start) return []
  const months: RetainerMonth[] = []
  const end = monthStart(today)
  let [y, m] = brand.retainer_start.split('-').map(Number)
  for (let i = 0; i < 120; i++) {
    const month = `${y}-${String(m).padStart(2, '0')}-01`
    if (month > end) break
    const payment = payments.find((p) => p.brand_id === brand.id && p.month === month)
    months.push({
      month,
      amount: payment?.amount ?? brand.monthly_fee ?? 0,
      status: payment?.status ?? 'unpaid',
      invoiced_on: payment?.invoiced_on ?? null,
      paid_on: payment?.paid_on ?? null,
      payment,
    })
    if (++m > 12) {
      m = 1
      y++
    }
  }
  return months.reverse()
}

export interface MoneySummary {
  paidThisMonth: number
  outstanding: number // unpaid or invoiced
  overdue: number // invoiced over 30 days ago (included in outstanding)
}

// Totals across collab fees, retainer months and brand-portal payments, for all
// brands or the ones given. Portal checkouts that were never completed don't count;
// a failed charge is outstanding (and overdue after 30 days).
export function moneySummary(
  brands: Brand[],
  collabs: Collab[],
  finances: Record<string, CollabFinance>,
  payments: RetainerPayment[],
  portal: BrandPayment[] = [],
  today = todayISO(),
): MoneySummary {
  const brandIds = new Set(brands.map((b) => b.id))
  const thisMonth = today.slice(0, 7)
  const sum: MoneySummary = { paidThisMonth: 0, outstanding: 0, overdue: 0 }
  const add = (amount: number, status: PaymentStatus, invoicedOn: string | null, paidOn: string | null) => {
    if (status === 'paid') {
      if (paidOn?.startsWith(thisMonth)) sum.paidThisMonth += amount
    } else {
      sum.outstanding += amount
      if (isOverdue(status, invoicedOn, today)) sum.overdue += amount
    }
  }
  for (const c of collabs) {
    const f = finances[c.id]
    if (c.brand_id && brandIds.has(c.brand_id) && f?.fee) add(f.fee, f.payment_status, f.invoiced_on, f.paid_on)
  }
  for (const b of brands) for (const m of retainerMonths(b, payments, today)) if (m.amount) add(m.amount, m.status, m.invoiced_on, m.paid_on)
  for (const p of portal) {
    if (!brandIds.has(p.brand_id)) continue
    if (p.status === 'paid') add(p.amount, 'paid', null, p.paid_at?.slice(0, 10) ?? null)
    else if (p.status === 'failed') add(p.amount, 'invoiced', p.created_at.slice(0, 10), null)
  }
  return sum
}
