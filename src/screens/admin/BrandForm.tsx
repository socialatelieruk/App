import { useState } from 'react'
import { api } from '../../api'
import { errorMessage } from '../../format'
import { monthStart } from '../../money'
import { DEAL_TYPES, type Brand, type BrandInput, type DealType } from '../../types'
import { ErrorText, Sheet } from '../../ui'

const blank: BrandInput = {
  name: '',
  instagram: '',
  contact_name: '',
  email: '',
  phone: '',
  area: '',
  deal_type: 'gifted',
  monthly_fee: null,
  retainer_start: null,
  notes: '',
}

const DEAL_LABELS: Record<DealType, string> = { gifted: 'Gifted', paid: 'Paid', retainer: 'Retainer' }

export default function BrandForm({ brand, onClose, onSaved }: { brand?: Brand; onClose: () => void; onSaved: (b: Brand) => void }) {
  const [form, setForm] = useState<BrandInput>(() => {
    if (!brand) return blank
    const { id: _id, created_at: _created, ...rest } = brand
    return rest
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof BrandInput>(k: K, v: BrandInput[K]) => setForm((f) => ({ ...f, [k]: v }))

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const retainer = form.deal_type === 'retainer'
    try {
      onSaved(
        await api.saveBrand(
          {
            ...form,
            name: form.name.trim(),
            instagram: form.instagram.trim().replace(/^@/, ''),
            monthly_fee: retainer ? form.monthly_fee : null,
            retainer_start: retainer ? form.retainer_start : null,
          },
          brand?.id,
        ),
      )
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Sheet title={brand ? 'Edit brand' : 'New brand'} onClose={onClose}>
      <form className="stack" onSubmit={save}>
        <label>
          Brand name
          <input id="brand-name" required value={form.name} onChange={(e) => set('name', e.target.value)} />
        </label>
        <div className="row">
          <label>
            Instagram
            <input id="brand-instagram" placeholder="@handle" autoCapitalize="none" value={form.instagram} onChange={(e) => set('instagram', e.target.value)} />
          </label>
          <label>
            Area
            <input id="brand-area" placeholder="Ancoats, Manchester" value={form.area} onChange={(e) => set('area', e.target.value)} />
          </label>
        </div>
        <label>
          Contact name
          <input id="brand-contact" value={form.contact_name} onChange={(e) => set('contact_name', e.target.value)} />
        </label>
        <div className="row">
          <label>
            Email
            <input id="brand-email" type="email" autoCapitalize="none" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </label>
          <label>
            Phone
            <input id="brand-phone" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </label>
        </div>

        <fieldset className="stack tight">
          <legend className="eyebrow">Deal type</legend>
          <div className="segmented">
            {DEAL_TYPES.map((d) => (
              <button type="button" key={d} className={form.deal_type === d ? 'on' : ''} onClick={() => set('deal_type', d)}>
                {DEAL_LABELS[d]}
              </button>
            ))}
          </div>
        </fieldset>
        {form.deal_type === 'retainer' && (
          <div className="row">
            <label>
              Monthly fee (£)
              <input id="brand-monthly-fee" type="number" min={0} step="0.01" required value={form.monthly_fee ?? ''} onChange={(e) => set('monthly_fee', e.target.value === '' ? null : Number(e.target.value))} />
            </label>
            <label>
              Retainer started
              <input
                id="brand-retainer-start"
                type="month"
                required
                value={form.retainer_start?.slice(0, 7) ?? ''}
                onChange={(e) => set('retainer_start', e.target.value ? monthStart(`${e.target.value}-01`) : null)}
              />
            </label>
          </div>
        )}

        <label>
          Notes
          <textarea id="brand-notes" rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Rates, preferences, who to chase for payment…" />
        </label>
        <ErrorText error={error} />
        <button className="primary" type="submit" disabled={busy}>
          {busy ? 'Saving…' : brand ? 'Save brand' : 'Add brand'}
        </button>
      </form>
    </Sheet>
  )
}
