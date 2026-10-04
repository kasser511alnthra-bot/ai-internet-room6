import React, { useEffect, useState } from 'react'
import { useApp } from '../lib/context'
import { fmtTime, todayRiyadh } from '../lib/util'

export default function TeamPage() {
  const { sb } = useApp()
  const [date, setDate] = useState(todayRiyadh())
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const [m, att, abs, exc] = await Promise.all([
        sb.from('members').select('id,full_name,employee_code,role,is_active,deleted_at,departments(name)').order('full_name'),
        sb.from('attendance').select('member_id,name_snapshot,check_in,check_out').eq('work_date', date),
        sb.from('absences').select('member_id,name_snapshot,penalty').eq('work_date', date).is('cancelled_at', null),
        sb.from('excuses').select('member_id,name_snapshot,status').eq('work_date', date).neq('status', 'rejected')
      ])
      const byId = {}
      for (const mem of m.data || []) byId[mem.id] = { member: mem, att: null, abs: null, exc: null }
      for (const a of att.data || []) if (byId[a.member_id]) byId[a.member_id].att = a
      for (const a of abs.data || []) if (byId[a.member_id]) byId[a.member_id].abs = a
      for (const x of exc.data || []) if (byId[x.member_id]) byId[x.member_id].exc = x
      setRows(Object.values(byId))
      setLoading(false)
    })()
  }, [sb, date])

  return (
    <div className="card">
      <div className="row space-between">
        <h1>Team — {date}</h1>
        <div>
          <label>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      <table>
        <thead><tr><th>Name</th><th>Department</th><th>Role</th><th>Status</th><th>In</th><th>Out</th></tr></thead>
        <tbody>
          {rows.map((r) => {
            const status = r.member.deleted_at
              ? <span className="badge off">archived</span>
              : !r.member.is_active
                ? <span className="badge off">inactive</span>
                : r.abs
                  ? <span className="badge off">absence</span>
                  : r.exc
                    ? <span className={`badge ${r.exc.status}`}>{r.exc.status} excuse</span>
                    : r.att
                      ? <span className="badge ok">clocked in</span>
                      : <span className="badge">—</span>
            return (
              <tr key={r.member.id}>
                <td>{r.member.full_name} <span className="muted">({r.member.employee_code})</span></td>
                <td>{r.member.departments?.name || '—'}</td>
                <td>{r.member.role}</td>
                <td>{status}</td>
                <td>{r.att ? fmtTime(r.att.check_in) : '—'}</td>
                <td>{r.att ? fmtTime(r.att.check_out) : '—'}</td>
              </tr>
            )
          })}
          {rows.length === 0 && <tr><td colSpan={6} className="muted">No members visible.</td></tr>}
        </tbody>
      </table>
      {loading && <p className="muted">Loading…</p>}
    </div>
  )
}
