import { useState } from 'react'
import { api } from '../../api'
import { errorMessage } from '../../format'
import { CATEGORIES, COLLAB_TYPES, type Category, type Collab, type CollabInput, type CollabType } from '../../types'
import { ErrorText, Sheet } from '../../ui'

const blank: CollabInput = {
  title: '',
  brand: '',
  description: '',
  category: 'Food & Drink',
  type: 'Booking',
  city: 'London',
  location: '',
  image_url: '',
  offer: '',
  deliverables: '',
  min_followers: 0,
  spots: 5,
  event_date: null,
  apply_by: null,
  content_due_days: 7,
  status: 'open',
}

export default function CollabForm({ collab, onClose, onSaved }: { collab?: Collab; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<CollabInput>(() => {
    if (!collab) return blank
    const { id: _id, created_at: _created, application_count: _count, ...rest } = collab
    return rest
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof CollabInput>(k: K, v: CollabInput[K]) => setForm((f) => ({ ...f, [k]: v }))

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.saveCollab({ ...form, event_date: form.type === 'Event' ? form.event_date : null }, collab?.id)
      onSaved()
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!collab || !confirm('Delete this collab and all its applications?')) return
    try {
      await api.deleteCollab(collab.id)
      onSaved()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Sheet title={collab ? 'Edit collab' : 'New collab'} onClose={onClose}>
      <form className="stack" onSubmit={save}>
        <label>
          Brand
          <input required value={form.brand} onChange={(e) => set('brand', e.target.value)} />
        </label>
        <label>
          Title
          <input required placeholder="e.g. Brunch for two" value={form.title} onChange={(e) => set('title', e.target.value)} />
        </label>
        <div className="row">
          <label>
            Type
            <select value={form.type} onChange={(e) => set('type', e.target.value as CollabType)}>
              {COLLAB_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            Category
            <select value={form.category} onChange={(e) => set('category', e.target.value as Category)}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="row">
          <label>
            City
            <input required value={form.city} onChange={(e) => set('city', e.target.value)} />
          </label>
          <label>
            Area / address
            <input value={form.location} onChange={(e) => set('location', e.target.value)} />
          </label>
        </div>
        <label>
          Description
          <textarea rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
        </label>
        <label>
          What the influencer gets
          <input placeholder="e.g. Dinner for two up to £100" value={form.offer} onChange={(e) => set('offer', e.target.value)} />
        </label>
        <label>
          What they post in return
          <input placeholder="e.g. 1 Reel + 3 stories" value={form.deliverables} onChange={(e) => set('deliverables', e.target.value)} />
        </label>
        <div className="row">
          <label>
            Min. followers
            <input type="number" min={0} value={form.min_followers} onChange={(e) => set('min_followers', Number(e.target.value))} />
          </label>
          <label>
            Spots
            <input type="number" min={1} value={form.spots} onChange={(e) => set('spots', Number(e.target.value))} />
          </label>
        </div>
        <div className="row">
          {form.type === 'Event' && (
            <label>
              Event date
              <input type="date" required value={form.event_date ?? ''} onChange={(e) => set('event_date', e.target.value || null)} />
            </label>
          )}
          <label>
            Apply by (optional)
            <input type="date" value={form.apply_by ?? ''} onChange={(e) => set('apply_by', e.target.value || null)} />
          </label>
        </div>
        <label>
          Content due (days after the visit)
          <input type="number" min={0} max={60} required value={form.content_due_days} onChange={(e) => set('content_due_days', Number(e.target.value))} />
        </label>
        <label>
          Image URL (optional)
          <input type="url" placeholder="https://…" value={form.image_url} onChange={(e) => set('image_url', e.target.value)} />
        </label>
        <label className="toggle">
          <input type="checkbox" checked={form.status === 'open'} onChange={(e) => set('status', e.target.checked ? 'open' : 'closed')} />
          Open for applications
        </label>
        <ErrorText error={error} />
        <button className="primary" type="submit" disabled={busy}>
          {busy ? 'Saving…' : collab ? 'Save changes' : 'Publish collab'}
        </button>
        {collab && (
          <button type="button" className="danger" onClick={remove}>
            Delete collab
          </button>
        )}
      </form>
    </Sheet>
  )
}
