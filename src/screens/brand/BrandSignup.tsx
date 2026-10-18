import { useState } from 'react'
import { api } from '../../api'
import { errorMessage } from '../../format'
import { BRAND_CATEGORIES, type BrandCategory, type BrandSignup as Signup } from '../../types'
import { ErrorText } from '../../ui'
import { BRAND_AREAS } from './labels'


// The business details a new brand sends for review.
export default function BrandSignupForm({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState<Signup>({ business_name: '', contact_name: '', phone: '', instagram: '', website: '', area: 'Manchester', category: 'Food & Drink' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof Signup>(k: K, v: Signup[K]) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.registerBrand(form)
      onDone()
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <div className="app">
      <header className="page-header">
        <span className="eyebrow">For brands</span>
        <h1>Tell us about your business</h1>
        <p className="muted">We review every brand before it can book creators. This takes a minute.</p>
      </header>
      <form className="stack" onSubmit={submit}>
        <label>
          Business name
          <input id="brand-business" required value={form.business_name} onChange={(e) => set('business_name', e.target.value)} />
        </label>
        <label>
          Your name
          <input id="brand-contact-name" required autoComplete="name" value={form.contact_name} onChange={(e) => set('contact_name', e.target.value)} />
        </label>
        <div className="row">
          <label>
            Phone
            <input id="brand-phone-signup" type="tel" required autoComplete="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </label>
          <label>
            Instagram
            <input id="brand-instagram-signup" placeholder="@handle" autoCapitalize="none" value={form.instagram} onChange={(e) => set('instagram', e.target.value)} />
          </label>
        </div>
        <label>
          Website
          <input id="brand-website" type="url" placeholder="https://" autoCapitalize="none" value={form.website} onChange={(e) => set('website', e.target.value)} />
        </label>
        <div className="row">
          <label>
            Area
            <select id="brand-area-signup" value={form.area} onChange={(e) => set('area', e.target.value)}>
              {BRAND_AREAS.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
          <label>
            Category
            <select id="brand-category" value={form.category} onChange={(e) => set('category', e.target.value as BrandCategory)}>
              {BRAND_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        <ErrorText error={error} />
        <button className="primary" type="submit" disabled={busy}>
          {busy ? 'Sending…' : 'Send for review'}
        </button>
      </form>
    </div>
  )
}

// What a brand sees until an admin approves (or declines) their account.
export function BrandPending({ declined }: { declined?: boolean }) {
  return (
    <div className="auth">
      <img className="logo" src={`${import.meta.env.BASE_URL}logo.png`} alt="The Social Atelier" />
      {declined ? (
        <>
          <h1 className="pending-title">Thank you for applying</h1>
          <p className="lead">We're not able to take on your brand at the moment. If you think this is a mistake, email us and we'll take another look.</p>
        </>
      ) : (
        <>
          <h1 className="pending-title">We're reviewing your account</h1>
          <p className="lead">Thank you for joining The Social Atelier. We'll email you as soon as your account is approved, usually within one working day.</p>
        </>
      )}
      <button className="secondary" onClick={() => api.signOut()}>
        Sign out
      </button>
    </div>
  )
}
