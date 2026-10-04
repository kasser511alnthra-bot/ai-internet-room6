import React, { useCallback, useEffect, useState } from 'react'
import { useApp } from '../lib/context'
import { rpcError, todayRiyadh } from '../lib/util'

export default function AdminReview() {
  const { sb } = useApp()
  const [excuses, setExcuses] = useState([])
  const [absences, setAbsences] = useState([])
  const [members, setMembers] = useState([])
  const [absMember, setAbsMember] = useState('')
  const [absDate, setAbsDate] = useState(todayRiyadh())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const [e, a, m] = await Promise.all([
      sb.from('excuses').select('id,member_id,name_snapshot,code_snapshot,work_date,reason,created_at').eq('status', 'pending').order('created_at'),
      sb.from('absences').select('id,member_id,name_snapshot,work_date,penalty,created_at').is('cancelled_at', null).order('work_date', { ascending: false }),
      sb.from('members').select('id,full_name,employee_code').is('deleted_at', null).order('full_name')
    ])
    setExcuses(e.data || [])
    setAbsences(a.data || [])
    setMembers(m.data || [])
  }, [sb])

  useEffect(() => { load() }, [load])

  const act = async (fn) => {
    setBusy(true)
    setError('')
    const { error } = await fn()
    if (error) setError(rpcError(error))
    else await load()
    setBusy(false)
  }

  const review = (id, approve) => act(() => sb.rpc('review_excuse', { p_id: id, p_approve: approve }))
  const cancel = (id) => act(() => sb.rpc('cancel_absence', { p_id: id }))
  const approveAbsence = async (e) => {
    e.preventDefault()
    await act(() => sb.rpc('approve_absence', { p_member: absMember, p_date: absDate }))
  }

  return (
    <div>
      <div className="card">
        <h1>Pending excuses</h1>
        {error && <p className="error">{error}</p>}
        <table>
          <thead><tr><th>Member</th><th>Date</th><th>Reason</th><th></th></tr></thead>
          <tbody>
            {excuses.map((x) => (
              <tr key={x.id}>
                <td>{x.name_snapshot} <span className="muted">({x.code_snapshot})</span></td>
                <td>{x.work_date}</td>
                <td>{x.reason}</td>
                <td>
                  <button className="btn small primary" disabled={busy} onClick={() => review(x.id, true)}>Approve</button>{' '}
                  <button className="btn small danger" disabled={busy} onClick={() => review(x.id, false)}>Reject</button>
                </td>
              </tr>
            ))}
            {excuses.length === 0 && <tr><td colSpan={4} className="muted">Nothing pending.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h1>Record an absence</h1>
        <form className="row" onSubmit={approveAbsence}>
          <div className="grow">
            <label>Member</label>
            <select required value={absMember} onChange={(e) => setAbsMember(e.target.value)}>
              <option value="">— choose —</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.full_name} ({m.employee_code})</option>)}
            </select>
          </div>
          <div>
            <label>Date</label>
            <input type="date" required value={absDate} onChange={(e) => setAbsDate(e.target.value)} />
          </div>
          <button className="btn primary" disabled={busy || !absMember} type="submit">Record</button>
        </form>
        <table>
          <thead><tr><th>Member</th><th>Date</th><th>Penalty</th><th></th></tr></thead>
          <tbody>
            {absences.map((a) => (
              <tr key={a.id}>
                <td>{a.name_snapshot}</td>
                <td>{a.work_date}</td>
                <td>{a.penalty.toLocaleString()}</td>
                <td><button className="btn small danger" disabled={busy} onClick={() => cancel(a.id)}>Cancel</button></td>
              </tr>
            ))}
            {absences.length === 0 && <tr><td colSpan={4} className="muted">No active absences.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
