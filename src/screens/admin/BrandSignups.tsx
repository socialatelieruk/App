import { useState } from 'react'
import { api } from '../../api'
import { errorMessage, formatDate } from '../../format'
import type { Brand, BrandAccount } from '../../types'
import { ErrorText } from '../../ui'

const NEW = '__new'

// Brand sign-ups waiting for review: approve (linked to a brand record) or decline.
export default function BrandSignups({ accounts, brands, onChanged }: { accounts: BrandAccount[]; brands: Brand[]; onChanged: () => void }) {
  const pending = accounts.filter((a) => a.status === 'pending')
  if (pending.length === 0) return null
  return (
    <section id="brand-signups">
      <h3 className="section-title">Sign-ups to review</h3>
      <ul className="list">
        {pending.map((a) => (
          <SignupCard key={a.user_id} account={a} brands={brands} onChanged={onChanged} />
        ))}
      </ul>
    </section>
  )
}

function SignupCard({ account, brands, onChanged }: { account: BrandAccount; brands: Brand[]; onChanged: () => void }) {
  // Suggest the existing brand record with the same name, if there is one.
  const match = brands.find((b) => b.name.toLowerCase() === account.business_name.toLowerCase())
  const [link, setLink] = useState(match?.id ?? NEW)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      onChanged()
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  return (
    <li className="card signup-card">
      <div className="card-top">
        <strong className="card-title">{account.business_name}</strong>
        <span className="badge" data-status="pending">
          New
        </span>
      </div>
      <span className="muted small">
        {account.category} · {account.area} · signed up {formatDate(account.created_at.slice(0, 10))}
      </span>
      <dl className="facts compact">
        <dt>Contact</dt>
        <dd>{account.contact_name}</dd>
        <dt>Email</dt>
        <dd>
          <a href={`mailto:${account.email}`}>{account.email}</a>
        </dd>
        {account.phone && (
          <>
            <dt>Phone</dt>
            <dd>
              <a href={`tel:${account.phone.replace(/\s/g, '')}`}>{account.phone}</a>
            </dd>
          </>
        )}
        {account.instagram && (
          <>
            <dt>Instagram</dt>
            <dd>
              <a href={`https://instagram.com/${account.instagram}`} target="_blank" rel="noreferrer">
                @{account.instagram}
              </a>
            </dd>
          </>
        )}
        {account.website && (
          <>
            <dt>Website</dt>
            <dd>
              <a href={account.website.startsWith('http') ? account.website : `https://${account.website}`} target="_blank" rel="noreferrer">
                {account.website}
              </a>
            </dd>
          </>
        )}
      </dl>
      <label>
        Brand record
        <select id={`link-${account.user_id}`} value={link} onChange={(e) => setLink(e.target.value)}>
          <option value={NEW}>Create a new brand record</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              Link to {b.name}
            </option>
          ))}
        </select>
      </label>
      <ErrorText error={error} />
      <div className="actions">
        <button className="primary small" disabled={busy} onClick={() => run(() => api.approveBrandAccount(account.user_id, link === NEW ? null : link))}>
          Approve
        </button>
        <button className="secondary small" disabled={busy} onClick={() => run(() => api.declineBrandAccount(account.user_id))}>
          Decline
        </button>
      </div>
    </li>
  )
}
