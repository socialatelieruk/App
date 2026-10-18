import { useState } from 'react'
import { api } from '../../api'
import { errorMessage } from '../../format'
import { COLLAB_TYPES, COLLAB_TYPE_HINTS, type Brief, type BriefInput, type CollabType } from '../../types'
import { ErrorText, Sheet } from '../../ui'

const blank: BriefInput = {
  title: '',
  offer: '',
  deliverables: '',
  location: '',
  city: 'Manchester',
  preferred_dates: '',
  type: 'Booking',
  min_followers: 5000,
  creator_type: '',
  image_url: '',
}

// A new brief (funded by a paid payment), or a sent-back one being edited.
export default function BriefForm({ brief, paymentId, packageId, onClose, onSaved }: { brief?: Brief; paymentId?: string; packageId?: string | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<BriefInput>(() => {
    if (!brief) return blank
    const { title, offer, deliverables, location, city, preferred_dates, type, min_followers, creator_type, image_url } = brief
    return { title, offer, deliverables, location, city, preferred_dates, type, min_followers, creator_type, image_url }
  })
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof BriefInput>(k: K, v: BriefInput[K]) => setForm((f) => ({ ...f, [k]: v }))

  const upload = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return setError('Please choose a photo (JPG or PNG).')
    if (file.size > 10 * 1024 * 1024) return setError('Please choose a photo under 10 MB.')
    setUploading(true)
    setError(null)
    try {
      set('image_url', await api.uploadBriefImage(file))
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setUploading(false)
    }
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (brief) await api.resubmitBrief(brief.id, form)
      else await api.submitBrief(paymentId!, form, packageId ?? null)
      onSaved()
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Sheet title={brief ? 'Edit brief' : 'Your brief'} onClose={onClose}>
      {brief?.admin_note && <p className="notice">{brief.admin_note}</p>}
      <form className="stack" onSubmit={save}>
        <label>
          Campaign title
          <input id="brief-title" required placeholder="e.g. Bottomless brunch launch" value={form.title} onChange={(e) => set('title', e.target.value)} />
        </label>
        <label>
          What you're offering creators
          <textarea id="brief-offer" required rows={2} placeholder="e.g. Brunch for two with a drink each" value={form.offer} onChange={(e) => set('offer', e.target.value)} />
        </label>
        <label>
          What creators must post
          <textarea id="brief-deliverables" required rows={2} placeholder="e.g. 1 Reel + 3 stories tagging @yourbrand" value={form.deliverables} onChange={(e) => set('deliverables', e.target.value)} />
        </label>
        <fieldset className="stack tight">
          <legend className="eyebrow">Type of collab</legend>
          <div className="segmented">
            {COLLAB_TYPES.map((t) => (
              <button type="button" key={t} className={form.type === t ? 'on' : ''} onClick={() => set('type', t as CollabType)}>
                {t}
              </button>
            ))}
          </div>
          <span className="muted small">{COLLAB_TYPE_HINTS[form.type]}</span>
        </fieldset>
        <div className="row">
          <label>
            Address or area
            <input id="brief-location" required placeholder="e.g. Ancoats" value={form.location} onChange={(e) => set('location', e.target.value)} />
          </label>
          <label>
            Town or city
            <input id="brief-city" required value={form.city} onChange={(e) => set('city', e.target.value)} />
          </label>
        </div>
        <label>
          Preferred dates and times
          <input id="brief-dates" required placeholder="e.g. Saturdays in November, 11am–2pm" value={form.preferred_dates} onChange={(e) => set('preferred_dates', e.target.value)} />
        </label>
        <div className="row">
          <label>
            Minimum followers
            <input id="brief-followers" type="number" min={0} step={500} required value={form.min_followers} onChange={(e) => set('min_followers', Number(e.target.value))} />
          </label>
          <label>
            Creators you'd like
            <input id="brief-creator-type" placeholder="e.g. Food, lifestyle" value={form.creator_type} onChange={(e) => set('creator_type', e.target.value)} />
          </label>
        </div>
        <label>
          Photo for the listing
          <input id="brief-image" type="file" accept="image/*" onChange={(e) => upload(e.target.files?.[0])} />
        </label>
        {uploading && <p className="muted small">Uploading photo…</p>}
        {form.image_url && <img className="brief-image" src={form.image_url} alt="Listing photo" />}
        <ErrorText error={error} />
        <button className="primary" type="submit" disabled={busy || uploading}>
          {busy ? 'Sending…' : brief ? 'Resubmit brief' : 'Submit brief'}
        </button>
        <p className="muted small">The Social Atelier reviews every brief before it goes live to creators.</p>
      </form>
    </Sheet>
  )
}
