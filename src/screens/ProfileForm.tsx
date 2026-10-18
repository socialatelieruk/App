import { useState } from 'react'
import { api } from '../api'
import { errorMessage } from '../format'
import type { Profile, ProfileInput } from '../types'
import { ErrorText } from '../ui'

const cleanHandle = (h: string) => h.trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?(instagram|tiktok)\.com\/@?/, '').replace(/\/$/, '')

export default function ProfileForm({ profile, onSaved, submitLabel }: { profile: Profile; onSaved: (p: Profile) => void; submitLabel: string }) {
  const [form, setForm] = useState<ProfileInput>({
    full_name: profile.full_name,
    instagram: profile.instagram,
    tiktok: profile.tiktok,
    followers: profile.followers,
    city: profile.city,
    bio: profile.bio,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof ProfileInput>(k: K, v: ProfileInput[K]) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.instagram.trim() && !form.tiktok.trim()) return setError('Add at least one of Instagram or TikTok.')
    setBusy(true)
    setError(null)
    try {
      onSaved(await api.saveMyProfile({ ...form, full_name: form.full_name.trim(), instagram: cleanHandle(form.instagram), tiktok: cleanHandle(form.tiktok), city: form.city.trim() }))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <label>
        Full name
        <input required value={form.full_name} onChange={(e) => set('full_name', e.target.value)} />
      </label>
      <div className="row">
        <label>
          Instagram
          <input placeholder="@handle" value={form.instagram} onChange={(e) => set('instagram', e.target.value)} autoCapitalize="none" />
        </label>
        <label>
          TikTok
          <input placeholder="@handle" value={form.tiktok} onChange={(e) => set('tiktok', e.target.value)} autoCapitalize="none" />
        </label>
      </div>
      <div className="row">
        <label>
          Followers (largest account)
          <input type="number" inputMode="numeric" min={0} required value={form.followers || ''} onChange={(e) => set('followers', Number(e.target.value))} />
        </label>
        <label>
          City
          <input required placeholder="London" value={form.city} onChange={(e) => set('city', e.target.value)} />
        </label>
      </div>
      <label>
        About you
        <textarea rows={3} placeholder="Your niche, audience and the content you make" value={form.bio} onChange={(e) => set('bio', e.target.value)} />
      </label>
      <ErrorText error={error} />
      <button className="primary" type="submit" disabled={busy}>
        {busy ? 'Saving…' : submitLabel}
      </button>
    </form>
  )
}
