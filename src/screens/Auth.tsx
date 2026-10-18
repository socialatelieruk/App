import { useState } from 'react'
import { api } from '../api'
import { errorMessage } from '../format'
import { ErrorText } from '../ui'

export default function Auth() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [joinAs, setJoinAs] = useState<'creator' | 'brand'>('creator')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await fn()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <img className="logo" src={`${import.meta.env.BASE_URL}logo.png`} alt="The Social Atelier" />
      <p className="lead">An invitation-only house of brand collaborations, experiences and events for creators.</p>

      {api.mode === 'demo' ? (
        <div className="stack">
          <p className="notice">Demo mode: no backend connected yet. Try it as any role.</p>
          <button className="primary" disabled={busy} onClick={() => run(() => api.demoSignIn!('influencer'))}>
            Try as an influencer
          </button>
          <button className="secondary" disabled={busy} onClick={() => run(() => api.demoSignIn!('admin'))}>
            Try as The Social Atelier (admin)
          </button>
          <button className="secondary" disabled={busy} onClick={() => run(() => api.demoSignIn!('brand'))}>
            Try as a brand
          </button>
        </div>
      ) : (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault()
            run(() => (mode === 'signin' ? api.signIn(email, password) : api.signUp(email, password, joinAs === 'brand' ? 'brand' : undefined)))
          }}
        >
          {mode === 'signup' && (
            <fieldset className="stack tight">
              <legend className="eyebrow">I'm joining as</legend>
              <div className="segmented">
                <button type="button" className={joinAs === 'creator' ? 'on' : ''} onClick={() => setJoinAs('creator')}>
                  A creator
                </button>
                <button type="button" className={joinAs === 'brand' ? 'on' : ''} onClick={() => setJoinAs('brand')}>
                  A brand
                </button>
              </div>
            </fieldset>
          )}
          <label>
            Email
            <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              minLength={8}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <ErrorText error={error} />
          {notice && <p className="notice">{notice}</p>}
          <button className="primary" type="submit" disabled={busy}>
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
          <button type="button" className="link" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
            {mode === 'signin' ? 'New here? Apply to join' : 'Already have an account? Sign in'}
          </button>
          {mode === 'signin' && (
            <button
              type="button"
              className="link subtle"
              onClick={() => {
                if (!email) return setError('Enter your email first.')
                run(async () => {
                  await api.resetPassword(email)
                  setNotice('Password reset email sent.')
                })
              }}
            >
              Forgot password?
            </button>
          )}
        </form>
      )}
      {api.mode === 'demo' && <ErrorText error={error} />}
    </div>
  )
}
