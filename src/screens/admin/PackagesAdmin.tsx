import { useState } from 'react'
import { api } from '../../api'
import { errorMessage } from '../../format'
import type { Package, PackageInput } from '../../types'
import { ErrorText, Sheet } from '../../ui'
import { billingLabel } from '../brand/labels'

const blank: PackageInput = { name: '', description: '', creators: 4, price: 350, billing: 'one_off', active: true, sort: 10 }

// The packages brands can buy. Creators never see these.
export default function PackagesAdmin({ packages, onClose, onChanged }: { packages: Package[]; onClose: () => void; onChanged: () => void }) {
  const [editing, setEditing] = useState<Package | 'new' | null>(null)
  return (
    <Sheet
      title="Packages"
      onClose={onClose}
      action={
        <button className="link strong" onClick={() => setEditing('new')}>
          + New
        </button>
      }
    >
      <p className="muted small">Brands pick one of these and pay by card before submitting a brief. Changing a price only affects new payments.</p>
      <ul className="list">
        {packages.map((p) => (
          <li key={p.id}>
            <button className="card package-row" onClick={() => setEditing(p)}>
              <div className="card-top">
                <strong className="card-title">{p.name}</strong>
                <span className="badge" data-status={p.active ? 'open' : 'closed'}>
                  {p.active ? 'On sale' : 'Hidden'}
                </span>
              </div>
              <span className="muted small">
                {p.creators} creators{p.billing === 'monthly' ? ' a month' : ''} · {billingLabel(p)}
              </span>
              {p.description && <span className="small">{p.description}</span>}
            </button>
          </li>
        ))}
      </ul>
      {editing && (
        <PackageForm
          pkg={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            onChanged()
          }}
        />
      )}
    </Sheet>
  )
}

function PackageForm({ pkg, onClose, onSaved }: { pkg?: Package; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<PackageInput>(() => {
    if (!pkg) return blank
    const { id: _id, ...rest } = pkg
    return rest
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof PackageInput>(k: K, v: PackageInput[K]) => setForm((f) => ({ ...f, [k]: v }))

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.savePackage({ ...form, name: form.name.trim() }, pkg?.id)
      onSaved()
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Sheet title={pkg ? 'Edit package' : 'New package'} onClose={onClose}>
      <form className="stack" onSubmit={save}>
        <label>
          Name
          <input id="package-name" required value={form.name} onChange={(e) => set('name', e.target.value)} />
        </label>
        <label>
          Description
          <textarea id="package-description" rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} />
        </label>
        <fieldset className="stack tight">
          <legend className="eyebrow">Billing</legend>
          <div className="segmented">
            <button type="button" className={form.billing === 'one_off' ? 'on' : ''} onClick={() => set('billing', 'one_off')}>
              One-off
            </button>
            <button type="button" className={form.billing === 'monthly' ? 'on' : ''} onClick={() => set('billing', 'monthly')}>
              Monthly
            </button>
          </div>
        </fieldset>
        <div className="row">
          <label>
            Creators{form.billing === 'monthly' ? ' a month' : ''}
            <input id="package-creators" type="number" min={1} required value={form.creators} onChange={(e) => set('creators', Number(e.target.value))} />
          </label>
          <label>
            Price (£){form.billing === 'monthly' ? ' a month' : ''}
            <input id="package-price" type="number" min={0} step="0.01" required value={form.price} onChange={(e) => set('price', Number(e.target.value))} />
          </label>
        </div>
        <label className="toggle">
          <input id="package-active" type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} />
          On sale to brands
        </label>
        <ErrorText error={error} />
        <button className="primary" type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save package'}
        </button>
      </form>
    </Sheet>
  )
}
