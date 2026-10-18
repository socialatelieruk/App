import { useState } from 'react'
import { api } from '../../api'
import { errorMessage } from '../../format'
import { formatMoney } from '../../money'
import {
  CATEGORIES,
  COLLAB_TYPES,
  PAYMENT_STATUSES,
  type Brand,
  type Category,
  type Collab,
  type CollabFinance,
  type CollabInput,
  type CollabType,
  type PaymentStatus,
} from '../../types'
import { ErrorText, Sheet } from '../../ui'
import BrandForm from './BrandForm'

const blank: CollabInput = {
  title: '',
  brand: '',
  brand_id: null,
  description: '',
  category: 'Food & Drink',
  type: 'Booking',
  city: 'Manchester',
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

interface Props {
  collab?: Collab
  brands: Brand[]
  finance?: CollabFinance
  brandId?: string // preselected when starting from a brand page
  onClose: () => void
  onSaved: () => void
}

const NEW_BRAND = '__new'

export default function CollabForm({ collab, brands, finance, brandId, onClose, onSaved }: Props) {
  const [form, setForm] = useState<CollabInput>(() => {
    if (!collab) return { ...blank, brand_id: brandId ?? null, brand: brands.find((b) => b.id === brandId)?.name ?? '' }
    const { id: _id, created_at: _created, application_count: _count, ...rest } = collab
    return rest
  })
  const [brandList, setBrandList] = useState(brands)
  const [addingBrand, setAddingBrand] = useState(false)
  // Money: a blank fee means the collab is gifted.
  const [fee, setFee] = useState(finance?.fee != null ? String(finance.fee) : '')
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(finance?.payment_status ?? 'unpaid')
  const [invoicedOn, setInvoicedOn] = useState(finance?.invoiced_on ?? '')
  const [paidOn, setPaidOn] = useState(finance?.paid_on ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof CollabInput>(k: K, v: CollabInput[K]) => setForm((f) => ({ ...f, [k]: v }))
  const brand = brandList.find((b) => b.id === form.brand_id)

  const chooseBrand = (b: Brand) => setForm((f) => ({ ...f, brand_id: b.id, brand: b.name }))

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.brand_id) return setError('Choose a brand, or add a new one.')
    setBusy(true)
    setError(null)
    try {
      const saved = await api.saveCollab({ ...form, event_date: form.type === 'Event' ? form.event_date : null }, collab?.id)
      if (fee !== '' || finance) {
        const paid = fee !== ''
        await api.saveFinance(saved.id, {
          fee: paid ? Number(fee) : null,
          payment_status: paid ? paymentStatus : 'unpaid',
          invoiced_on: paid && paymentStatus !== 'unpaid' ? invoicedOn || null : null,
          paid_on: paid && paymentStatus === 'paid' ? paidOn || null : null,
        })
      }
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
          <select
            id="collab-brand"
            required
            value={form.brand_id ?? ''}
            onChange={(e) => {
              if (e.target.value === NEW_BRAND) return setAddingBrand(true)
              const b = brandList.find((x) => x.id === e.target.value)
              if (b) chooseBrand(b)
            }}
          >
            <option value="" disabled>
              Choose a brand
            </option>
            {brandList.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
            <option value={NEW_BRAND}>+ New brand</option>
          </select>
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
        <fieldset className="money-fields stack">
          <legend className="eyebrow">Money (admins only)</legend>
          <div className="row">
            <label>
              Fee (£)
              <input id="collab-fee" type="number" min={0} step="0.01" placeholder="Blank if gifted" value={fee} onChange={(e) => setFee(e.target.value)} />
            </label>
            {fee !== '' && (
              <label>
                Payment
                <select id="collab-payment" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}>
                  {PAYMENT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s[0].toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {fee !== '' && paymentStatus !== 'unpaid' && (
            <div className="row">
              <label>
                Invoiced on
                <input id="collab-invoiced" type="date" value={invoicedOn} onChange={(e) => setInvoicedOn(e.target.value)} />
              </label>
              {paymentStatus === 'paid' && (
                <label>
                  Date paid
                  <input id="collab-paid" type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
                </label>
              )}
            </div>
          )}
          <p className="muted small">
            {brand?.deal_type === 'retainer'
              ? `${brand.name} is on a ${brand.monthly_fee ? formatMoney(brand.monthly_fee) + ' ' : ''}monthly retainer. Leave the fee blank unless this collab is billed separately.`
              : 'Leave the fee blank for gifted collabs. Dates fill in with today if left empty.'}
          </p>
        </fieldset>
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
      {addingBrand && (
        <BrandForm
          onClose={() => setAddingBrand(false)}
          onSaved={(b) => {
            setBrandList((list) => [...list, b].sort((x, y) => x.name.localeCompare(y.name)))
            chooseBrand(b)
            setAddingBrand(false)
          }}
        />
      )}
    </Sheet>
  )
}
