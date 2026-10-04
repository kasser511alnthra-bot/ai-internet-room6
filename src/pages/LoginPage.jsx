import React, { useState } from 'react'
import { useApp } from '../lib/context'

export default function LoginPage() {
  const { sb } = useApp()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    setInfo('')
    try {
      if (mode === 'signin') {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Login failed')
        const { error } = await sb.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token
        })
        if (error) throw error
      } else {
        const { error } = await sb.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } }
        })
        if (error) throw error
        setInfo('Account created. If email confirmation is enabled, confirm via the email you received. An administrator must then activate your account.')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page center">
      <form className="card narrow" onSubmit={submit}>
        <h1>AI Internet Room</h1>
        <p className="muted">Attendance, excuses and absences</p>
        <label>Email</label>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        {mode === 'signup' && (
          <>
            <label>Full name</label>
            <input required value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </>
        )}
        <label>Password</label>
        <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="error">{error}</p>}
        {info && <p className="ok">{info}</p>}
        <button className="btn primary block" disabled={busy} type="submit">
          {mode === 'signin' ? 'Sign in' : 'Sign up'}
        </button>
        <button
          type="button"
          className="btn ghost block"
          onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setInfo('') }}
        >
          {mode === 'signin' ? 'No account yet? Sign up' : 'Have an account? Sign in'}
        </button>
      </form>
    </div>
  )
}
