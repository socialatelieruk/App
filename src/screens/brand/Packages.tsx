import { useState } from 'react'
import { api } from '../../api'
import { errorMessage } from '../../format'
import { openExternal } from '../../links'
import type { Package } from '../../types'
import { ErrorText, Sheet } from '../../ui'
import { billingLabel } from './labels'

// Choose a package and pay: Stripe Checkout in a browser sheet, or straight away in demo mode.
export default function Packages({ packages, onClose, onPaid }: { packages: Package[]; onClose: () => void; onPaid: () => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [waiting, setWaiting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pay = async (p: Package) => {
    setBusy(p.id)
    setError(null)
    try {
      const result = await api.startCheckout(p.id)
      if (result.paid) return onPaid()
      if (result.url) {
        await openExternal(result.url)
        setWaiting(true)
      }
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Sheet title="Packages" onClose={onClose}>
      <p className="muted">Each package covers one brief. We review your brief, publish it to our creators and send you a shortlist to approve.</p>
      {waiting && (
        <div className="notice stack tight">
          <span>Finish paying in the Stripe window. Your package appears here as soon as Stripe confirms it.</span>
          <button className="link" onClick={onPaid}>
            I've paid, refresh
          </button>
        </div>
      )}
      <ul className="list">
        {packages.map((p) => (
          <li key={p.id} className="card package-card">
            <span className="eyebrow">{p.billing === 'monthly' ? 'Monthly' : 'One-off'}</span>
            <strong className="card-title">{p.name}</strong>
            <p className="package-price">{billingLabel(p)}</p>
            <p className="muted small">
              {p.creators} creator{p.creators === 1 ? '' : 's'}
              {p.billing === 'monthly' ? ' a month' : ''}
              {p.description ? ` · ${p.description}` : ''}
            </p>
            <button className="primary" disabled={!!busy} onClick={() => pay(p)}>
              {busy === p.id ? 'Starting…' : api.mode === 'demo' ? 'Pay (demo)' : p.billing === 'monthly' ? 'Subscribe with card' : 'Pay with card'}
            </button>
          </li>
        ))}
      </ul>
      <ErrorText error={error} />
      {api.mode === 'live' && <p className="muted small">Payments are taken securely by Stripe. We never see your card details.</p>}
    </Sheet>
  )
}
