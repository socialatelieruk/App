import { useState } from 'react'
import { formatDate } from '../../format'
import type { BrandCampaign, BrandPayment, Brief, Package } from '../../types'
import { Badge, Empty } from '../../ui'
import { ReportView } from '../BrandReport'
import { billingLabel } from './labels'

interface Props {
  account: { business_name: string; contact_name: string }
  campaigns: BrandCampaign[]
  briefs: Brief[]
  credit: BrandPayment | null // a paid package not yet used for a brief
  packages: Package[]
  onChoosePackage: () => void
  onNewBrief: () => void
  onEditBrief: (b: Brief) => void
}

export default function Campaigns({ account, campaigns, briefs, credit, packages, onChoosePackage, onNewBrief, onEditBrief }: Props) {
  const [openReport, setOpenReport] = useState<string | null>(null)
  const pending = briefs.filter((b) => b.status !== 'approved')
  const creditPackage = packages.find((p) => p.id === credit?.package_id)

  return (
    <>
      <header className="page-header">
        <span className="eyebrow">{account.business_name}</span>
        <h1>Campaigns</h1>
      </header>

      {credit ? (
        <button className="next-step card" onClick={onNewBrief}>
          <span className="eyebrow">Paid · {creditPackage ? `${creditPackage.name}, ${creditPackage.creators} creators` : 'ready for your brief'}</span>
          <strong className="card-title">Submit your brief</strong>
          <span className="muted small">Tell us what you're offering and what creators should post. We'll review it and publish it to our creators.</span>
          <span className="banner-link">Start brief</span>
        </button>
      ) : (
        <button className="next-step card" onClick={onChoosePackage}>
          <span className="eyebrow">New campaign</span>
          <strong className="card-title">Choose a package</strong>
          <span className="muted small">{packages.map((p) => `${p.name}: ${p.creators} creators, ${billingLabel(p)}`).join(' · ')}</span>
          <span className="banner-link">See packages</span>
        </button>
      )}

      {pending.length > 0 && (
        <section>
          <h3 className="section-title">Briefs</h3>
          <ul className="list">
            {pending.map((b) => (
              <li key={b.id} className="card brief-row" data-status={b.status}>
                <div className="card-top">
                  <strong className="card-title">{b.title}</strong>
                  <span className="badge" data-status={b.status === 'submitted' ? 'pending' : 'rejected'}>
                    {b.status === 'submitted' ? 'In review' : 'Changes needed'}
                  </span>
                </div>
                {b.status === 'submitted' ? (
                  <span className="muted small">Sent {formatDate(b.updated_at.slice(0, 10))}. We'll publish it once it's reviewed.</span>
                ) : (
                  <>
                    <p className="quote">“{b.admin_note || 'Please take another look at your brief.'}”</p>
                    <button className="secondary small" onClick={() => onEditBrief(b)}>
                      Edit and resubmit
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="section-title">Your campaigns</h3>
        {campaigns.length === 0 ? (
          <Empty>Your campaigns appear here once a brief is approved.</Empty>
        ) : (
          <ul className="list">
            {campaigns.map((c) => (
              <li key={c.id} className="card campaign-card">
                <div className="card-top">
                  <strong className="card-title">{c.title}</strong>
                  <Badge status={c.status === 'open' ? 'live' : 'closed'} />
                </div>
                <span className="muted small">{[c.type, [c.location, c.city].filter(Boolean).join(', '), c.event_date && formatDate(c.event_date)].filter(Boolean).join(' · ')}</span>
                <dl className="campaign-stats">
                  <div>
                    <dt>Booked</dt>
                    <dd>
                      {c.booked}
                      <span className="of">/{c.spots}</span>
                    </dd>
                  </div>
                  <div>
                    <dt>Posted</dt>
                    <dd>{c.posted}</dd>
                  </div>
                  <div>
                    <dt>Due</dt>
                    <dd>{c.due}</dd>
                  </div>
                  <div className={c.overdue ? 'owed' : ''}>
                    <dt>Overdue</dt>
                    <dd>{c.overdue}</dd>
                  </div>
                </dl>
                {c.report && c.booked > 0 && (
                  <>
                    <button className="link small" onClick={() => setOpenReport(openReport === c.id ? null : c.id)}>
                      {openReport === c.id ? 'Hide report' : 'View report'}
                    </button>
                    {openReport === c.id && (
                      <div className="inline-report">
                        <ReportView report={c.report} />
                      </div>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
