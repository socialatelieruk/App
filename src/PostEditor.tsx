import { useState } from 'react'
import { PLATFORMS, STATUSES, type Platform, type Post } from './types'

interface Props {
  post: Post
  isNew: boolean
  onSave: (post: Post) => void
  onDelete: (id: string) => void
  onDuplicate: (post: Post) => void
  onClose: () => void
}

export default function PostEditor({ post, isNew, onSave, onDelete, onDuplicate, onClose }: Props) {
  const [draft, setDraft] = useState<Post>(post)
  const [copied, setCopied] = useState(false)

  const set = <K extends keyof Post>(key: K, value: Post[K]) => setDraft((d) => ({ ...d, [key]: value }))

  const togglePlatform = (p: Platform) =>
    set('platforms', draft.platforms.includes(p) ? draft.platforms.filter((x) => x !== p) : [...draft.platforms, p])

  const copyCaption = async () => {
    const text = [draft.caption, draft.hashtags].filter(Boolean).join('\n\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard can be unavailable in some webviews; nothing else to do.
    }
  }

  const canSave = draft.title.trim() !== '' && draft.date !== ''

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <form
        className="sheet"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          if (canSave) onSave({ ...draft, title: draft.title.trim() })
        }}
      >
        <header className="sheet-header">
          <button type="button" className="link" onClick={onClose}>
            Cancel
          </button>
          <h2>{isNew ? 'New post' : 'Edit post'}</h2>
          <button type="submit" className="link strong" disabled={!canSave}>
            Save
          </button>
        </header>

        <div className="sheet-body">
          <label>
            Title
            <input value={draft.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Autumn collection teaser" autoFocus={isNew} />
          </label>

          <div className="row">
            <label>
              Date
              <input type="date" value={draft.date} onChange={(e) => set('date', e.target.value)} />
            </label>
            <label>
              Time
              <input type="time" value={draft.time} onChange={(e) => set('time', e.target.value)} />
            </label>
          </div>

          <fieldset>
            <legend>Platforms</legend>
            <div className="chips">
              {PLATFORMS.map((p) => (
                <button type="button" key={p} className={`chip ${draft.platforms.includes(p) ? 'on' : ''}`} data-platform={p} onClick={() => togglePlatform(p)}>
                  {p}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Status</legend>
            <div className="segmented">
              {STATUSES.map((s) => (
                <button type="button" key={s} className={draft.status === s ? 'on' : ''} onClick={() => set('status', s)}>
                  {s}
                </button>
              ))}
            </div>
          </fieldset>

          <label>
            Caption
            <textarea rows={5} value={draft.caption} onChange={(e) => set('caption', e.target.value)} placeholder="Write your caption…" />
            <span className="hint">{draft.caption.length} characters</span>
          </label>

          <label>
            Hashtags
            <input value={draft.hashtags} onChange={(e) => set('hashtags', e.target.value)} placeholder="#socialatelier #design" />
          </label>

          <label>
            Notes
            <textarea rows={3} value={draft.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Assets needed, links, ideas…" />
          </label>

          <div className="actions">
            <button type="button" className="secondary" onClick={copyCaption} disabled={!draft.caption && !draft.hashtags}>
              {copied ? 'Copied!' : 'Copy caption'}
            </button>
            {!isNew && (
              <>
                <button type="button" className="secondary" onClick={() => onDuplicate(draft)}>
                  Duplicate
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => {
                    if (confirm('Delete this post?')) onDelete(draft.id)
                  }}
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
      </form>
    </div>
  )
}
