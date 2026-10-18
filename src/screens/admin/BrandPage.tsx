import { useState } from 'react'
import { api } from '../../api'
import { errorMessage } from '../../format'
import { formatMoney, formatMonth, isOverdue, moneySummary, retainerMonths } from '../../money'
import { PAYMENT_STATUSES, type Brand, type Collab, type PaymentStatus } from '../../types'
import { Badge, Empty, ErrorText, Sheet } from '../../ui'
import { type AdminData, deliveryCounts } from './data'
import { CollabFee, MoneySummaryView, ShareReportButton } from './Money'

interface Props {
  brand: Brand
  data: AdminData
  onClose: () => void
  onEdit: () => void
  onOpenCollab: (c: Collab) => void
  onNewCollab: () => void
  onChanged: () => void
}

const DEAL: Record<Brand['deal_type'], string> = { gifted: 'Gifted', paid: 'Paid per collab', retainer: 'Retainer' }

export default function BrandPage({ brand, data, onClose, onEdit, onOpenCollab, onNewCollab, onChanged }: Props) {
  const [error, setError] = useState<string | null>(null)
  const collabs = data.collabs.filter((c) => c.brand_id === brand.id)
  const months = retainerMonths(brand, data.retainers)
  const money = moneySummary([brand], data.collabs, data.finances, data.retainers, data.brandPayments)
  const accounts = data.brandAccounts.filter((a) => a.brand_id === brand.id)
  const portalPayments = data.brandPayments.filter((p) => p.brand_id === brand.id && (p.status === 'paid' || p.status === 'failed'))

  const setMonth = async (month: string, amount: number, status: PaymentStatus, invoicedOn: string | null) => {
    setError(null)
    try {
      // Keeps the original invoice date when a month moves on to paid.
      await api.saveRetainerPayment(brand.id, month, amount, status, invoicedOn)
      onChanged()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <Sheet
      title={brand.name}
      onClose={onClose}
      action={
        <button className="link strong" onClick={onEdit}>
          Edit
        </button>
      }
    >
      <div className="detail-head">
        <span className="eyebrow">
          {DEAL[brand.deal_type]}
          {brand.deal_type === 'retainer' && brand.monthly_fee ? ` · ${formatMoney(brand.monthly_fee)} a month` : ''}
        </span>
        <h2>{brand.name}</h2>
        {brand.area && <p className="muted">{brand.area}</p>}
      </div>

      <dl className="facts">
        {brand.contact_name && (
          <>
            <dt>Contact</dt>
            <dd>{brand.contact_name}</dd>
          </>
        )}
        {brand.email && (
          <>
            <dt>Email</dt>
            <dd>
              <a href={`mailto:${brand.email}`}>{brand.email}</a>
            </dd>
          </>
        )}
        {brand.phone && (
          <>
            <dt>Phone</dt>
            <dd>
              <a href={`tel:${brand.phone.replace(/\s/g, '')}`}>{brand.phone}</a>
            </dd>
          </>
        )}
        {brand.instagram && (
          <>
            <dt>Instagram</dt>
            <dd>
              <a href={`https://instagram.com/${brand.instagram}`} target="_blank" rel="noreferrer">
                @{brand.instagram}
              </a>
            </dd>
          </>
        )}
        {brand.notes && (
          <>
            <dt>Notes</dt>
            <dd className="notes">{brand.notes}</dd>
          </>
        )}
      </dl>

      {accounts.length > 0 && (
        <section>
          <h3 className="section-title">Brand portal</h3>
          {accounts.map((a) => (
            <p key={a.user_id} className="small">
              {a.contact_name} signs in as <a href={`mailto:${a.email}`}>{a.email}</a>
              {a.status !== 'approved' && ` · ${a.status}`}
            </p>
          ))}
        </section>
      )}

      <section className="stack tight">
        <h3 className="section-title">Money</h3>
        <MoneySummaryView summary={money} />
      </section>

      {portalPayments.length > 0 && (
        <section>
          <h3 className="section-title">Package payments</h3>
          <ul className="list payment-history">
            {portalPayments.map((p) => (
              <li key={p.id}>
                <span>
                  {data.packages.find((x) => x.id === p.package_id)?.name ?? 'Package'}
                  <span className="muted small"> · {new Date(p.paid_at ?? p.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </span>
                <span className={p.status === 'failed' ? 'owed' : ''}>
                  {formatMoney(p.amount)} · {p.status === 'paid' ? 'Paid' : 'Failed'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {months.length > 0 && (
        <section>
          <h3 className="section-title">Retainer</h3>
          <ul className="list retainer-months">
            {months.map((m) => {
              const overdue = isOverdue(m.status, m.invoiced_on)
              return (
                <li key={m.month} className="retainer-month" data-payment={overdue ? 'overdue' : m.status}>
                  <div>
                    <strong>{formatMonth(m.month)}</strong>
                    <span className="muted small">
                      {formatMoney(m.amount)}
                      {m.status === 'paid' && m.paid_on ? ` · paid ${new Date(`${m.paid_on}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : ''}
                      {m.status === 'invoiced' && m.invoiced_on ? ` · invoiced ${new Date(`${m.invoiced_on}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : ''}
                      {overdue ? ' · overdue' : ''}
                    </span>
                  </div>
                  <select
                    id={`retainer-${m.month}`}
                    aria-label={`Payment for ${formatMonth(m.month)}`}
                    value={m.status}
                    onChange={(e) => setMonth(m.month, m.amount, e.target.value as PaymentStatus, m.invoiced_on)}
                  >
                    {PAYMENT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s[0].toUpperCase() + s.slice(1)}
                      </option>
                    ))}
                  </select>
                </li>
              )
            })}
          </ul>
        </section>
      )}
      <ErrorText error={error} />

      <section>
        <div className="section-head">
          <h3 className="section-title">Collabs</h3>
          <button className="link small" onClick={onNewCollab}>
            + New collab
          </button>
        </div>
        {collabs.length === 0 ? (
          <Empty>No collabs for {brand.name} yet.</Empty>
        ) : (
          <ul className="list">
            {collabs.map((c) => {
              const d = deliveryCounts(data.applications, c.id)
              return (
                <li key={c.id} className="card brand-collab">
                  <button className="brand-collab-main" onClick={() => onOpenCollab(c)}>
                    <div className="card-top">
                      <strong className="card-title">{c.title}</strong>
                      <Badge status={c.status} />
                    </div>
                    <span className="muted small">
                      {d.booked === 0
                        ? 'No creators booked yet'
                        : [`${d.posted}/${d.booked} posted`, d.overdue && `${d.overdue} overdue`, d.noShow && `${d.noShow} no-show`].filter(Boolean).join(' · ')}
                    </span>
                    <CollabFee finance={data.finances[c.id]} dealType={brand.deal_type} packaged={!!c.package_id} />
                  </button>
                  {d.booked > 0 && (
                    <div className="actions">
                      <ShareReportButton collab={c} />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </Sheet>
  )
}
