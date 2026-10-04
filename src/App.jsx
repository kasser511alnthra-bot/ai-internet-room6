import React, { useEffect, useState } from 'react'
import { AppContext, useApp } from './lib/context'
import { getClient } from './lib/supabase'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import MyRecordsPage from './pages/MyRecordsPage'
import TeamPage from './pages/TeamPage'
import AdminPage from './pages/AdminPage'

export default function App() {
  const [sb, setSb] = useState(null)
  const [missingConfig, setMissingConfig] = useState(false)
  const [session, setSession] = useState(null)
  const [member, setMember] = useState(null)
  const [booted, setBooted] = useState(false)
  const [tab, setTab] = useState('home')

  useEffect(() => {
    let subscription = null
    ;(async () => {
      const client = await getClient()
      if (!client) {
        setMissingConfig(true)
        setBooted(true)
        return
      }
      const { data } = client.auth.onAuthStateChange((_e, s) => setSession(s))
      subscription = data.subscription
      const { data: { session: s } } = await client.auth.getSession()
      setSession(s)
      setSb(client)
      setBooted(true)
    })()
    return () => subscription?.unsubscribe()
  }, [])

  useEffect(() => {
    ;(async () => {
      if (!sb || !session) {
        setMember(null)
        return
      }
      const { data } = await sb
        .from('members')
        .select('id,username,employee_code,full_name,role,is_active,department_id,shift_note,deleted_at,departments(name)')
        .eq('auth_user_id', session.user.id)
        .maybeSingle()
      setMember(data)
    })()
  }, [sb, session])

  const signOut = async () => {
    await sb.auth.signOut()
    setSession(null)
    setMember(null)
    setTab('home')
  }

  const active = member && member.is_active && !member.deleted_at
  const isAdmin = Boolean(active && member.role === 'admin')
  const isManager = Boolean(active && member.role === 'manager')

  let content
  if (!booted) {
    content = <div className="page center"><p className="muted">Loading…</p></div>
  } else if (missingConfig) {
    content = (
      <div className="page center">
        <div className="card narrow">
          <h1>Setup needed</h1>
          <p className="muted">
            Supabase credentials are not configured yet. Add SUPABASE_URL, SUPABASE_ANON_KEY and
            SUPABASE_SERVICE_ROLE_KEY from the Secrets page, then reload this page.
          </p>
        </div>
      </div>
    )
  } else if (!session) {
    content = <LoginPage />
  } else if (!active) {
    content = (
      <div className="page center">
        <div className="card narrow center-card">
          <h1>Pending activation</h1>
          <p className="muted">Your account exists but is not active yet. An administrator has to activate it before you can use the app.</p>
          <button className="btn" onClick={signOut}>Sign out</button>
        </div>
      </div>
    )
  } else {
    content = (
      <div className="shell">
        <header className="topbar">
          <span className="brand">AI Internet Room</span>
          <nav className="nav">
            <button className={tab === 'home' ? 'navlink active' : 'navlink'} onClick={() => setTab('home')}>Home</button>
            <button className={tab === 'records' ? 'navlink active' : 'navlink'} onClick={() => setTab('records')}>My records</button>
            {(isAdmin || isManager) && (
              <button className={tab === 'team' ? 'navlink active' : 'navlink'} onClick={() => setTab('team')}>Team</button>
            )}
            {isAdmin && (
              <button className={tab === 'admin' ? 'navlink active' : 'navlink'} onClick={() => setTab('admin')}>Admin</button>
            )}
          </nav>
          <button className="btn ghost" onClick={signOut}>Sign out</button>
        </header>
        <main className="page">
          {tab === 'home' && <HomePage />}
          {tab === 'records' && <MyRecordsPage />}
          {tab === 'team' && <TeamPage />}
          {tab === 'admin' && <AdminPage />}
        </main>
      </div>
    )
  }

  return <AppContext.Provider value={{ sb, session, member }}>{content}</AppContext.Provider>
}
