import React, { useCallback, useEffect, useState } from 'react'
import { useApp } from '../lib/context'
import { fmtTime, rpcError } from '../lib/util'

export default function HomePage() {
  const { sb, member } = useApp()
  const [openSession, setOpenSession] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const { data } = await sb
      .from('attendance')
      .select('id,check_in,check_out,work_date')
      .eq('member_id', member.id)
      .is('check_out', null)
      .maybeSingle()
    setOpenSession(data)
  }, [sb, member.id])

  useEffect(() => { load() }, [load])

  const clockIn = async () => {
    setBusy(true)
    setError('')
    const { error } = await sb.rpc('clock_in')
    if (error) setError(rpcError(error))
    await load()
    setBusy(false)
  }

  const clockOut = async () => {
    setBusy(true)
    setError('')
    const { error } = await sb.rpc('clock_out')
    if (error) setError(rpcError(error))
    await load()
    setBusy(false)
  }

  return (
    <div className="card narrow center-card">
      <h1>{member.full_name}</h1>
      <p className="muted">
        {openSession
          ? <>Clocked in since <strong>{fmtTime(openSession.check_in)}</strong></>
          : 'You are not clocked in.'}
      </p>
      {error && <p className="error">{error}</p>}
      {openSession
        ? <button className="btn primary" disabled={busy} onClick={clockOut}>Clock out</button>
        : <button className="btn primary" disabled={busy} onClick={clockIn}>Clock in</button>}
    </div>
  )
}
