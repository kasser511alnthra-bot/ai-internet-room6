import React, { useEffect, useState } from 'react'
import { useApp } from '../lib/context'
import { fmtDateTime } from '../lib/util'

export default function AdminAudit() {
  const { sb } = useApp()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      const { data } = await sb.from('audit_log')
        .select('action,entity_id,before_data,after_data,created_at')
        .order('created_at', { ascending: false })
        .limit(100)
      setRows(data || [])
      setLoading(false)
    })()
  }, [sb])

  return (
    <div className="card">
      <h1>Audit log (last 100)</h1>
      <table>
        <thead><tr><th>When</th><th>Action</th><th>Change</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.created_at + r.action}>
              <td>{fmtDateTime(r.created_at)}</td>
              <td>{r.action}</td>
              <td className="mono">
                {r.after_data ? JSON.stringify(r.after_data).slice(0, 120) : JSON.stringify(r.before_data || {}).slice(0, 120)}
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={3} className="muted">{loading ? 'Loading…' : 'Empty.'}</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
