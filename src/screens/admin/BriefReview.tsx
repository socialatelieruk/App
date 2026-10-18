import { useState } from 'react'
import { api } from '../../api'
import { errorMessage, formatDate, formatFollowers } from '../../format'
import { CATEGORIES, COLLAB_TYPES, type BrandAccount, type Brand, type Brief, type Category, type CollabInput, type CollabType, type Package } from '../../types'
import { Empty, ErrorText, Sheet } from '../../ui'

interface Props {
  briefs: Brief[]
  brands: Brand[]
  accounts: BrandAccount[]
  packages: Package[]
  onClose: () => void
  onChanged: () => void
}

// Brand categories → collab categories.
const CATEGORY_FOR: Record<string, Category> = { 'Food & Drink': 'Food & Drink', Beauty: 'Beauty', Wellness: 'Wellness', Fashion: 'Fashion', Hotels: 'Travel', Other: 'Lifestyle' }

// Briefs waiting for review: edit, then publish as a collab or send back with a note.
export default function BriefReview({ briefs, brands, accounts, packages, onClose, onChanged }: Props) {
  const waiting = briefs.filter((b) => b.status === 'submitted')
  const [open, setOpen] = useState<Brief | null>(waiting.length === 1 ? waiting[0] : null)
  const brandName = (id: string) => brands.find((b) => b.id === id)?.name ?? 'Brand'

  if (open) {
    return (
      <BriefEditor
        brief={open}
        brand={brands.find((b) => b.id === open.brand_id)}
        account={accounts.find((a) => a.brand_id === open.brand_id && a.status === 'approved')}
        pkg={packages.find((p) => p.id === open.package_id)}
        onClose={() => (waiting.length === 1 ? onClose() : setOpen(null))}
        onDone={() => {
          setOpen(null)
          onChanged()
          if (waiting.length === 1) onClose()
        }}
      />
    )
  }

  return (
    <Sheet title="Briefs to review" onClose={onClose}>
      {waiting.length === 0 ? (
        <Empty>No briefs waiting for review.</Empty>
      ) : (
        <ul className="list">
          {waiting.map((b) => (
            <li key={b.id}>
              <button className="card row-card" onClick={() => setOpen(b)}>
                <div>
                  <span className="eyebrow">{brandName(b.brand_id)}</span>
                  <strong>{b.title}</strong>
                  <span className="muted small">
                    {b.type} · {b.location} · sent {formatDate(b.updated_at.slice(0, 10))}
                  </span>
                </div>
                <span className="link small">Review</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  )
}

function BriefEditor({ brief, brand, account, pkg, onClose, onDone }: { brief: Brief; brand?: Brand; account?: BrandAccount; pkg?: Package; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState<CollabInput>({
    title: brief.title,
    brand: brand?.name ?? '',
    brand_id: brief.brand_id,
    package_id: brief.package_id,
    description: [brief.creator_type && `Looking for: ${brief.creator_type}`, brief.preferred_dates && `Dates: ${brief.preferred_dates}`].filter(Boolean).join('\n'),
    category: CATEGORY_FOR[account?.category ?? 'Other'] ?? 'Lifestyle',
    type: brief.type,
    city: brief.city,
    location: brief.location,
    image_url: brief.image_url,
    offer: brief.offer,
    deliverables: brief.deliverables,
    min_followers: brief.min_followers,
    spots: pkg?.creators ?? 5,
    event_date: null,
    apply_by: null,
    content_due_days: 7,
    status: 'open',
  })
  const [sendingBack, setSendingBack] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof CollabInput>(k: K, v: CollabInput[K]) => setForm((f) => ({ ...f, [k]: v }))

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      onDone()
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  return (
    <Sheet title={`Brief · ${brand?.name ?? ''}`} onClose={onClose}>
      <div className="brief-summary card">
        <span className="eyebrow">
          {brand?.name} · {pkg ? `${pkg.name}, ${pkg.creators} creators` : 'No package'}
        </span>
        <p className="small">
          <strong>Dates:</strong> {brief.preferred_dates || '—'}
          <br />
          <strong>Creators wanted:</strong> {brief.creator_type || '—'}, {formatFollowers(brief.min_followers)}+ followers
        </p>
      </div>
      {brief.image_url && <img className="brief-image" src={brief.image_url} alt="" />}

      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault()
          run(() => api.publishBrief(brief.id, { ...form, event_date: form.type === 'Event' ? form.event_date : null }))
        }}
      >
        <label>
          Title
          <input id="review-title" required value={form.title} onChange={(e) => set('title', e.target.value)} />
        </label>
        <div className="row">
          <label>
            Type
            <select id="review-type" value={form.type} onChange={(e) => set('type', e.target.value as CollabType)}>
              {COLLAB_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            Category
            <select id="review-category" value={form.category} onChange={(e) => set('category', e.target.value as Category)}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="row">
          <label>
            Area / address
            <input id="review-location" value={form.location} onChange={(e) => set('location', e.target.value)} />
          </label>
          <label>
            City
            <input id="review-city" required value={form.city} onChange={(e) => set('city', e.target.value)} />
          </label>
        </div>
        <label>
          Description (creators see this)
          <textarea id="review-description" rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
        </label>
        <label>
          What the creator gets
          <input id="review-offer" value={form.offer} onChange={(e) => set('offer', e.target.value)} />
        </label>
        <label>
          What they post
          <input id="review-deliverables" value={form.deliverables} onChange={(e) => set('deliverables', e.target.value)} />
        </label>
        <div className="row">
          <label>
            Min. followers
            <input id="review-followers" type="number" min={0} value={form.min_followers} onChange={(e) => set('min_followers', Number(e.target.value))} />
          </label>
          <label>
            Spots
            <input id="review-spots" type="number" min={1} value={form.spots} onChange={(e) => set('spots', Number(e.target.value))} />
          </label>
        </div>
        <div className="row">
          {form.type === 'Event' && (
            <label>
              Event date
              <input id="review-event-date" type="date" required value={form.event_date ?? ''} onChange={(e) => set('event_date', e.target.value || null)} />
            </label>
          )}
          <label>
            Apply by (optional)
            <input id="review-apply-by" type="date" value={form.apply_by ?? ''} onChange={(e) => set('apply_by', e.target.value || null)} />
          </label>
          <label>
            Content due (days after)
            <input id="review-due-days" type="number" min={0} value={form.content_due_days} onChange={(e) => set('content_due_days', Number(e.target.value))} />
          </label>
        </div>
        <ErrorText error={error} />
        {!sendingBack && (
          <div className="actions">
            <button className="primary" type="submit" disabled={busy}>
              {busy ? 'Publishing…' : 'Approve and publish'}
            </button>
            <button className="secondary" type="button" disabled={busy} onClick={() => setSendingBack(true)}>
              Send back
            </button>
          </div>
        )}
      </form>

      {sendingBack && (
        <form
          className="stack send-back"
          onSubmit={(e) => {
            e.preventDefault()
            run(() => api.sendBriefBack(brief.id, note.trim()))
          }}
        >
          <label>
            Note to {brand?.name ?? 'the brand'}
            <textarea id="review-note" rows={3} required placeholder="What should they change?" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div className="actions">
            <button className="primary small" type="submit" disabled={busy || !note.trim()}>
              Send back with note
            </button>
            <button className="secondary small" type="button" onClick={() => setSendingBack(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </Sheet>
  )
}
