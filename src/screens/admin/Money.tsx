import { useState } from 'react'
import { api } from '../../api'
import { errorMessage } from '../../format'
import { reportUrl, shareLink } from '../../links'
import { formatMoney, isOverdue, type MoneySummary } from '../../money'
import type { Collab, CollabFinance, DealType, PaymentStatus } from '../../types'

// Paid this month / outstanding / overdue, with unpaid money in the danger colour.
export function MoneySummaryView({ summary, onClick }: { summary: MoneySummary; onClick?: () => void }) {
  const body = (
    <dl className="money-summary">
      <div>
        <dt>Paid this month</dt>
        <dd>{formatMoney(summary.paidThisMonth)}</dd>
      </div>
      <div className={summary.outstanding ? 'owed' : ''}>
        <dt>Outstanding</dt>
        <dd>{formatMoney(summary.outstanding)}</dd>
      </div>
      <div className={summary.overdue ? 'owed' : ''}>
        <dt>Overdue</dt>
        <dd>{formatMoney(summary.overdue)}</dd>
      </div>
    </dl>
  )
  return onClick ? (
    <button className="money-card card" onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className="money-card card">{body}</div>
  )
}

const STATUS_LABEL: Record<PaymentStatus, string> = { unpaid: 'Unpaid', invoiced: 'Invoiced', paid: 'Paid' }

// "£350 · Invoiced", in the danger colour while unpaid and marked overdue after 30 days.
export function PaymentTag({ amount, status, invoicedOn }: { amount: number; status: PaymentStatus; invoicedOn: string | null }) {
  const overdue = isOverdue(status, invoicedOn)
  return (
    <span className="payment-tag" data-payment={overdue ? 'overdue' : status}>
      {formatMoney(amount)} · {overdue ? 'Overdue' : STATUS_LABEL[status]}
    </span>
  )
}

// A collab's fee, or what covers it when there's no fee.
export function CollabFee({ finance, dealType, packaged }: { finance?: CollabFinance; dealType?: DealType; packaged?: boolean }) {
  if (!finance?.fee) return <span className="payment-tag">{packaged ? 'Package' : dealType === 'retainer' ? 'Retainer' : 'Gifted'}</span>
  return <PaymentTag amount={finance.fee} status={finance.payment_status} invoicedOn={finance.invoiced_on} />
}

// Share a collab's brand report link; returns the button and any "copied" note.
export function ShareReportButton({ collab, className = 'secondary small' }: { collab: Collab; className?: string }) {
  const [note, setNote] = useState<string | null>(null)
  const share = async () => {
    setNote(null)
    try {
      const how = await shareLink(reportUrl(await api.getReportToken(collab.id)), `${collab.brand} · Campaign report`)
      if (how === 'copied') setNote('Link copied')
    } catch (e) {
      setNote(errorMessage(e))
    }
  }
  return (
    <>
      <button className={className} onClick={share}>
        Share report
      </button>
      {note && <span className="muted small">{note}</span>}
    </>
  )
}
