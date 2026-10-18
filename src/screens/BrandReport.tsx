import { useEffect, useState } from 'react'
import { api } from '../api'
import { platformOf } from '../delivery'
import { errorMessage, formatDate, formatFollowers } from '../format'
import type { BrandReport } from '../types'
import { Spinner } from '../ui'

// The page a brand opens from a collab's private report link.
export default function BrandReportPage({ token }: { token: string }) {
  const [report, setReport] = useState<BrandReport | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getReport(token).then(setReport, (e) => setError(errorMessage(e)))
  }, [token])

  useEffect(() => {
    if (report) document.title = `${report.collab.brand} · Campaign report · The Social Atelier`
  }, [report])

  return (
    <div className="report-page">
      {error ? (
        <ReportMessage title="This report couldn't load" body={`${error} Please try again in a moment.`} />
      ) : report === undefined ? (
        <Spinner />
      ) : report === null ? (
        <ReportMessage title="Report not found" body="This link may have been replaced. Please ask The Social Atelier for the latest link." />
      ) : (
        <ReportView report={report} />
      )}
    </div>
  )
}

function ReportMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="report-message">
      <img className="logo" src={`${import.meta.env.BASE_URL}logo.png`} alt="The Social Atelier" />
      <h1>{title}</h1>
      <p className="muted">{body}</p>
    </div>
  )
}

const dateOnly = (iso: string) => formatDate(iso.slice(0, 10) === iso ? iso : localISO(iso))
const localISO = (iso: string) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function ReportView({ report }: { report: BrandReport }) {
  const { collab, creators } = report
  const posted = creators.filter((c) => c.post_links.length > 0)
  const postCount = posted.reduce((n, c) => n + c.post_links.length, 0)
  const audience = posted.reduce((n, c) => n + c.followers, 0)
  const visits = creators.map((c) => c.visited).filter(Boolean) as string[]
  const sortedVisits = [...visits].sort()
  const when = collab.event_date
    ? formatDate(collab.event_date)
    : sortedVisits.length
      ? sortedVisits.length > 1 && dateOnly(sortedVisits[0]) !== dateOnly(sortedVisits.at(-1)!)
        ? `${dateOnly(sortedVisits[0])} – ${dateOnly(sortedVisits.at(-1)!)}`
        : dateOnly(sortedVisits[0])
      : null

  return (
    <article className="report">
      <header className="report-head">
        <img className="logo report-logo" src={`${import.meta.env.BASE_URL}logo.png`} alt="The Social Atelier" />
        <span className="eyebrow">Campaign report</span>
        <h1>{collab.brand}</h1>
        <p className="report-sub">{collab.title}</p>
        <p className="muted small">{[when, [collab.location, collab.city].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}</p>
      </header>

      <dl className="report-stats">
        <div>
          <dt>Creators</dt>
          <dd>{creators.length}</dd>
        </div>
        <div>
          <dt>Have posted</dt>
          <dd>
            {posted.length}
            <span className="of">/{creators.length}</span>
          </dd>
        </div>
        <div>
          <dt>Posts live</dt>
          <dd>{postCount}</dd>
        </div>
        <div>
          <dt>Combined audience</dt>
          <dd>{formatFollowers(audience)}</dd>
        </div>
      </dl>

      {collab.deliverables && (
        <p className="report-brief">
          <span className="eyebrow">The brief</span>
          {collab.deliverables}
        </p>
      )}

      <section>
        <h2 className="section-title">Creators</h2>
        {creators.length === 0 ? (
          <p className="empty">Creators will appear here once they're booked.</p>
        ) : (
          <ul className="report-creators">
            {creators.map((c, i) => (
              <li key={i}>
                <div className="card-top">
                  <strong className="report-name">{c.name}</strong>
                  <span className="badge" data-status={c.post_links.length ? 'accepted' : 'pending'}>
                    {c.post_links.length ? 'Posted' : 'Content due'}
                  </span>
                </div>
                <div className="meta">
                  {c.instagram && (
                    <a href={`https://instagram.com/${c.instagram}`} target="_blank" rel="noreferrer">
                      @{c.instagram}
                    </a>
                  )}
                  {c.tiktok && (
                    <a href={`https://tiktok.com/@${c.tiktok}`} target="_blank" rel="noreferrer">
                      TikTok @{c.tiktok}
                    </a>
                  )}
                  <span>{formatFollowers(c.followers)} followers</span>
                </div>
                <p className="muted small">
                  {[
                    c.visited && `Visited ${dateOnly(c.visited)}`,
                    c.posted_at ? `Posted ${dateOnly(c.posted_at)}` : c.content_due && `Posting by ${formatDate(c.content_due)}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {c.post_links.length > 0 && (
                  <div className="post-links">
                    {c.post_links.map((url) => (
                      <a key={url} className="post-link" href={url} target="_blank" rel="noreferrer">
                        View on {platformOf(url)} ↗
                      </a>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="report-foot">
        Prepared by The Social Atelier · Updated {new Date(report.generated_at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
      </footer>
    </article>
  )
}
