import { useState } from 'react'
import { api } from '../api'
import { errorMessage } from '../format'
import { ErrorText } from '../ui'

export default function Auth() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
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
      <div className="brand-mark">SA</div>
      <h1>Social Atelier</h1>
      <p className="lead">Gifted experiences, events and brand collaborations for creators.</p>

      {api.mode === 'demo' ? (
        <div className="stack">
          <p className="notice">Demo mode: no backend connected yet. Try it as either role.</p>
          <button className="primary" disabled={busy} onClick={() => run(() => api.demoSignIn!('influencer'))}>
            Try as an influencer
          </button>
          <button className="secondary" disabled={busy} onClick={() => run(() => api.demoSignIn!('admin'))}>
            Try as Social Atelier (admin)
          </button>
        </div>
      ) : (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault()
            run(() => (mode === 'signin' ? api.signIn(email, password) : api.signUp(email, password)))
          }}
        >
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
