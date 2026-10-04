import React, { useCallback, useEffect, useState } from 'react'
import { useApp } from '../lib/context'
import { fmtDateTime, fmtTime, rpcError, todayRiyadh } from '../lib/util'

export default function MyRecordsPage() {
  const { sb, member } = useApp()
  const [attendance, setAttendance] = useState([])
  const [absences, setAbsences] = useState([])
  const [excuses, setExcuses] = useState([])
  const [date, setDate] = useState(todayRiyadh())
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  const load = useCallback(async () => {
    const [a, b, c] = await Promise.all([
      sb.from('attendance').select('work_date,check_in,check_out').eq('member_id', member.id).order('check_in', { ascending: false }).limit(20),
      sb.from('absences').select('work_date,penalty,cancelled_at,created_at').eq('member_id', member.id).order('work_date', { ascending: false }).limit(20),
      sb.from('excuses').select('work_date,reason,status,created_at').eq('member_id', member.id).order('work_date', { ascending: false }).limit(20)
    ])
    setAttendance(a.data || [])
    setAbsences(b.data || [])
    setExcuses(c.data || [])
  }, [sb, member.id])

  useEffect(() => { load() }, [load])

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    const { error } = await sb.rpc('submit_excuse', { p_date: date, p_reason: reason })
    if (error) setMsg({ type: 'error', text: rpcError(error) })
    else { setMsg({ type: 'ok', text: 'Excuse submitted for review.' }); setReason('') }
    await load()
    setBusy(false)
  }

  return (
    <div className="card">
      <h1>My records</h1>

      <h2 className="section-title">Submit an excuse</h2>
      <form className="row" onSubmit={submit}>
        <div>
          <label>Date</label>
          <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="grow">
          <label>Reason</label>
          <input required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why were you / will you be away?" />
        </div>
        <button className="btn primary" disabled={busy} type="submit">Submit</button>
      </form>
      {msg && <p className={msg.type === 'error' ? 'error' : 'ok'}>{msg.text}</p>}

      <h2 className="section-title">Attendance</h2>
      <table>
        <thead><tr><th>Date</th><th>In</th><th>Out</th></tr></thead>
        <tbody>
          {attendance.map((a, i) => (
            <tr key={i}><td>{a.work_date}</td><td>{fmtTime(a.check_in)}</td><td>{fmtTime(a.check_out)}</td></tr>
          ))}
          {attendance.length === 0 && <tr><td colSpan={3} className="muted">No records yet.</td></tr>}
        </tbody>
      </table>

      <h2 className="section-title">Excuses</h2>
      <table>
        <thead><tr><th>Date</th><th>Reason</th><th>Status</th></tr></thead>
        <tbody>
          {excuses.map((x, i) => (
            <tr key={i}><td>{x.work_date}</td><td>{x.reason}</td><td><span className={`badge ${x.status}`}>{x.status}</span></td></tr>
          ))}
          {excuses.length === 0 && <tr><td colSpan={3} className="muted">No excuses.</td></tr>}
        </tbody>
      </table>

      <h2 className="section-title">Absences</h2>
      <table>
        <thead><tr><th>Date</th><th>Penalty</th><th>Status</th></tr></thead>
        <tbody>
          {absences.map((a, i) => (
            <tr key={i}>
              <td>{a.work_date}</td>
              <td>{a.penalty === 0 ? 'Waived' : a.penalty.toLocaleString()}</td>
              <td><span className={`badge ${a.cancelled_at ? 'ok' : 'off'}`}>{a.cancelled_at ? 'cancelled' : 'active'}</span></td>
            </tr>
          ))}
          {absences.length === 0 && <tr><td colSpan={3} className="muted">No absences.</td></tr>}
        </tbody>
      </table>
      <p className="muted">Updated {fmtDateTime(new Date().toISOString())}</p>
    </div>
  )
}
